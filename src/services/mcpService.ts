import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';
import { Socket } from 'net';
import { McpLoggerService } from './mcpLogger.service';
import { ToolCategory, McpTool } from '../types/types';
import { randomUUID } from 'crypto';
import { PLUGIN_VERSION } from '../version';

/**
 * MCP Server Service - Core MCP server with Streamable HTTP and SSE transport
 * 
 * Supports both:
 * - Streamable HTTP (new, recommended): Single /mcp endpoint
 * - Legacy SSE: GET /sse + POST /messages (backwards compatible)
 */
@Injectable({ providedIn: 'root' })
export class McpService {
    // Per-session McpServer instances - each client gets its own server to avoid SDK Bug #1459
    // This prevents one client's disconnect from affecting other clients' pending requests
    private sessionServers: { [sessionId: string]: McpServer } = {};
    private legacyTransports: { [sessionId: string]: SSEServerTransport } = {};
    private streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    private app!: express.Application;
    private httpServer?: http.Server;
    private sockets = new Set<Socket>();
    private isRunning = false;
    private startPromise?: Promise<void>;
    private lifecycleGeneration = 0;
    private toolCategories: ToolCategory[] = [];
    // Store tool definitions for registering with each new server
    private registeredTools: { name: string, description: string, schema: any, handler: any }[] = [];
    // Track whether tool endpoints have been registered to prevent duplicates on restart
    private toolEndpointsConfigured = false;
    private readonly instanceId = randomUUID();
    private controlToken?: string;

    private isToolEnabled(toolName: string): boolean {
        if (toolName === 'get_session_environment') {
            return this.config?.store?.mcp?.environmentDetection?.enabled === true;
        }
        if (toolName.startsWith('sftp_')) {
            return this.config?.store?.mcp?.sftp?.enabled !== false;
        }
        return true;
    }

    private getEnabledToolsFromCategory(category: ToolCategory): McpTool[] {
        return category.mcpTools.filter(tool => this.isToolEnabled(tool.name));
    }

    constructor(
        public config: ConfigService,
        private logger: McpLoggerService
    ) {
        this.initializeServer();
    }

    /**
     * Initialize the MCP service (no longer creates a single server)
     */
    private initializeServer(): void {
        // Configure Express - servers are created per-session now
        this.configureExpress();
        this.logger.info('MCP Service initialized (Streamable HTTP + Legacy SSE) - per-session servers');
    }

    /**
     * Create a new McpServer instance for a specific session
     * Each client gets its own server to avoid SDK Bug #1459
     */
    private createServerForSession(sessionId: string): McpServer {
        const server = new McpServer({
            name: 'Tabby MCP',
            version: PLUGIN_VERSION
        });

        // Register enabled tools with this server instance
        const enabledTools = this.registeredTools.filter(tool => this.isToolEnabled(tool.name));
        for (const toolDef of enabledTools) {
            (server.tool as any)(
                toolDef.name,
                toolDef.description,
                toolDef.schema,
                toolDef.handler
            );
        }

        this.sessionServers[sessionId] = server;
        this.logger.debug(`[Session ${sessionId}] Created new McpServer with ${enabledTools.length} tools`);
        return server;
    }

    /**
     * Clean up server for a specific session
     */
    private cleanupServerForSession(sessionId: string): void {
        if (this.sessionServers[sessionId]) {
            delete this.sessionServers[sessionId];
            this.logger.debug(`[Session ${sessionId}] Cleaned up McpServer`);
        }
    }

    /**
     * Register a tool category - stores definitions for per-session server creation
     */
    public registerToolCategory(category: ToolCategory): void {
        this.toolCategories.push(category);

        category.mcpTools.forEach(tool => {
            // Extract the raw shape from z.object() for MCP SDK compatibility
            // MCP SDK expects { key: z.string() } format, not z.object({...})
            const rawShape = tool.schema && typeof tool.schema === 'object' && 'shape' in tool.schema
                ? (tool.schema as any).shape
                : tool.schema;

            this.logger.debug(`Registering tool: ${tool.name} with schema keys: ${Object.keys(rawShape || {}).join(', ')}`);

            // Store tool definition for later registration with per-session servers
            this.registeredTools.push({
                name: tool.name,
                description: tool.description,
                schema: rawShape,
                handler: tool.handler
            });

            this.logger.info(`Registered tool definition: ${tool.name}`);
        });
    }

    /**
     * Register a single tool - stores definition for per-session server creation
     */
    public registerTool(tool: McpTool): void {
        // Extract the raw shape from z.object() for MCP SDK compatibility
        const rawShape = tool.schema && typeof tool.schema === 'object' && 'shape' in tool.schema
            ? (tool.schema as any).shape
            : tool.schema;

        // Store tool definition for later registration with per-session servers
        this.registeredTools.push({
            name: tool.name,
            description: tool.description,
            schema: rawShape,
            handler: tool.handler
        });

        this.logger.info(`Registered tool definition: ${tool.name}`);
    }

    /**
     * Configure Express server with Streamable HTTP and SSE endpoints
     */
    private configureExpress(): void {
        this.app = express();

        // Parse JSON for all routes
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            if (this.checkHost(req, res)) {
                next();
            }
        });

        // Health check endpoint
        this.app.get('/health', (_, res) => {
            res.status(200).json({
                status: 'ok',
                server: 'Tabby MCP',
                version: PLUGIN_VERSION,
                instanceId: this.instanceId,
                transport: 'StreamableHTTP + SSE',
                uptime: process.uptime()
            });
        });

        // Internal loopback-only handover endpoint. A newly launched Tabby window
        // uses the persisted token to ask a stale previous plugin instance to
        // release the configured port (Issue #5). This is intentionally not
        // documented as a public API.
        this.app.post('/internal/shutdown', (req: Request, res: Response) => {
            const suppliedToken = req.headers['x-tabby-mcp-control-token'];
            if (!this.isLoopbackRequest(req) || !this.controlToken || suppliedToken !== this.controlToken) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }

            res.status(202).json({ message: 'Shutdown accepted', instanceId: this.instanceId });
            setTimeout(() => {
                void this.stopServerInternal(true, 'stale instance handover').catch(error => {
                    this.logger.error('Stale instance handover shutdown failed:', error);
                });
            }, 50);
        });

        // Server info endpoint
        this.app.get('/info', (_, res) => {
            res.status(200).json({
                name: 'Tabby MCP',
                version: PLUGIN_VERSION,
                protocolVersion: '2025-03-26',
                transports: ['streamable-http', 'sse'],
                endpoints: {
                    streamableHttp: '/mcp',
                    legacySse: '/sse',
                    legacyMessages: '/messages'
                },
                tools: this.toolCategories.flatMap(c => this.getEnabledToolsFromCategory(c).map(t => ({
                    name: t.name,
                    description: t.description
                })))
            });
        });

        // Tools list endpoint (for debugging)
        this.app.get('/tools', (_, res) => {
            res.status(200).json({
                count: this.toolCategories.reduce((sum, c) => sum + this.getEnabledToolsFromCategory(c).length, 0),
                categories: this.toolCategories.map(c => ({
                    name: c.name,
                    tools: this.getEnabledToolsFromCategory(c).map(t => t.name)
                }))
            });
        });

        // ============================================================
        // STREAMABLE HTTP TRANSPORT (New, Recommended - Protocol 2025-03-26)
        // Single endpoint handling all MCP communication
        // ============================================================

        this.app.all('/mcp', async (req: Request, res: Response) => {
            // Validate Origin header for security (DNS rebinding protection)
            if (!this.checkOrigin(req, res)) {
                return;
            }

            // GET and DELETE must be handled by the SDK so Accept, protocol version,
            // session validation, single-stream enforcement, and SSE routing all apply.
            if (req.method === 'GET' || req.method === 'DELETE') {
                const sessionId = req.headers['mcp-session-id'] as string | undefined;
                const transport = sessionId ? this.streamableTransports[sessionId] : undefined;
                if (!transport) {
                    res.status(sessionId ? 404 : 400).json({
                        jsonrpc: '2.0',
                        error: {
                            code: sessionId ? -32001 : -32000,
                            message: sessionId ? 'Session not found' : 'Mcp-Session-Id header is required'
                        },
                        id: null
                    });
                    return;
                }

                try {
                    await transport.handleRequest(req, res);
                } catch (error: any) {
                    this.logger.error(`Streamable HTTP: ${req.method} request failed:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: error.message || 'Internal error' },
                            id: null
                        });
                    }
                }
                return;
            }

            // Handle POST request - main message handling
            if (req.method === 'POST') {
                const clientSessionId = req.headers['mcp-session-id'] as string | undefined;
                const initializeRequest = this.isInitializeRequest(req.body);
                let transport = clientSessionId ? this.streamableTransports[clientSessionId] : undefined;

                if (!transport && clientSessionId) {
                    res.status(404).json({
                        jsonrpc: '2.0',
                        error: { code: -32001, message: `Session not found: ${clientSessionId}` },
                        id: req.body?.id ?? null
                    });
                    return;
                }
                if (!transport && !initializeRequest) {
                    res.status(400).json({
                        jsonrpc: '2.0',
                        error: { code: -32000, message: 'Initialize the session before sending MCP messages' },
                        id: req.body?.id ?? null
                    });
                    return;
                }

                const sessionId = clientSessionId || randomUUID();
                let createdTransport = false;
                this.logger.debug(`Streamable HTTP: POST /mcp sessionId=${sessionId}`);

                if (!transport) {
                    // Create new Streamable HTTP transport
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => sessionId,
                        onsessioninitialized: (sid) => {
                            this.logger.info(`Streamable HTTP: Session initialized: ${sid}`);
                        }
                    });

                    // Register close handler to clean up when connection is closed
                    transport.onclose = () => {
                        this.logger.info(`Streamable HTTP: Transport closed (onclose): ${sessionId}`);
                        delete this.streamableTransports[sessionId];
                        this.sessionMetadata.delete(sessionId);
                        this.cleanupServerForSession(sessionId); // Clean up the per-session server
                    };

                    this.streamableTransports[sessionId] = transport;
                    this.initSessionMetadata(sessionId, 'streamable', req);
                    createdTransport = true;

                    const server = this.createServerForSession(sessionId);
                    try {
                        await server.connect(transport);
                    } catch (error: any) {
                        delete this.streamableTransports[sessionId];
                        this.sessionMetadata.delete(sessionId);
                        this.cleanupServerForSession(sessionId);
                        this.logger.error('Streamable HTTP: Failed to create session:', error);
                        res.status(500).json({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: error.message || 'Failed to create session' },
                            id: req.body?.id ?? null
                        });
                        return;
                    }

                    this.logger.info(`Streamable HTTP: New session created: ${sessionId}`);
                }

                // Track activity
                if (req.body?.method) {
                    let activity = req.body.method;
                    if (activity === 'tools/call' && req.body.params?.name) {
                        activity += `: ${req.body.params.name}`;
                    }
                    this.trackActivity(sessionId, activity);
                }

                // Handle the message
                try {
                    await transport.handleRequest(req, res, req.body);
                    if (createdTransport && !transport.sessionId) {
                        await transport.close();
                    }
                } catch (error: any) {
                    if (createdTransport) {
                        await transport.close().catch(() => undefined);
                    }
                    this.logger.error('Streamable HTTP: Error handling request:', error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: error.message || 'Internal error' },
                            id: req.body?.id ?? null
                        });
                    }
                }
                return;
            }

            // Method not allowed
            res.setHeader('Allow', 'GET, POST, DELETE');
            res.status(405).json({ error: 'Method not allowed' });
        });

        // ============================================================
        // LEGACY SSE TRANSPORT (Backwards Compatible - Protocol 2024-11-05)
        // GET /sse for SSE stream, POST /messages for sending
        // ============================================================

        // SSE endpoint for legacy MCP clients
        this.app.get('/sse', async (req: Request, res: Response) => {
            // Same DNS-rebinding protection as /mcp (previously only /mcp was guarded)
            if (!this.checkOrigin(req, res)) {
                return;
            }
            this.logger.info('Legacy SSE: Establishing connection');

            // Set headers for SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            try {
                const transport = new SSEServerTransport(
                    '/messages',
                    res as unknown as ServerResponse<IncomingMessage>
                );

                const sessionId = transport.sessionId;
                this.logger.info(`Legacy SSE: New connection sessionId=${sessionId}`);
                this.legacyTransports[sessionId] = transport;
                this.initSessionMetadata(sessionId, 'sse', req);

                // Set up heartbeat to keep connection alive
                const heartbeatInterval = setInterval(() => {
                    try {
                        if (!res.writableEnded) {
                            res.write(': heartbeat\n\n');
                        }
                    } catch (e) {
                        // Connection closed
                        clearInterval(heartbeatInterval);
                    }
                }, 15000);

                res.on('close', () => {
                    this.logger.info(`Legacy SSE: Connection closed sessionId=${sessionId}`);
                    clearInterval(heartbeatInterval);
                    delete this.legacyTransports[sessionId];
                    this.sessionMetadata.delete(sessionId);
                    this.cleanupServerForSession(sessionId); // Clean up the per-session server
                });

                res.on('error', (err) => {
                    this.logger.error(`Legacy SSE: Connection error sessionId=${sessionId}`, err);
                    clearInterval(heartbeatInterval);
                    delete this.legacyTransports[sessionId];
                    this.sessionMetadata.delete(sessionId);
                    this.cleanupServerForSession(sessionId); // Clean up the per-session server
                });

                // Create per-session McpServer and connect to transport
                const server = this.createServerForSession(sessionId);
                await server.connect(transport);
            } catch (error) {
                this.logger.error('Legacy SSE: Failed to establish connection:', error);
                if (!res.headersSent) {
                    res.status(500).send('Failed to establish SSE connection');
                }
            }
        });

        // POST /sse - Redirect to Streamable HTTP or inform about legacy mode
        this.app.post('/sse', (req: Request, res: Response) => {
            this.logger.debug('POST /sse received - redirecting to /mcp endpoint');
            // Redirect to the new Streamable HTTP endpoint
            res.redirect(307, '/mcp');
        });

        // Messages endpoint for legacy SSE transport
        this.app.post('/messages', async (req: Request, res: Response) => {
            if (!this.checkOrigin(req, res)) {
                return;
            }

            const sessionId = req.query.sessionId as string;

            if (!sessionId) {
                res.status(400).json({ error: 'Missing sessionId parameter' });
                return;
            }

            const transport = this.legacyTransports[sessionId];
            if (!transport) {
                res.status(400).json({ error: `No transport found for sessionId ${sessionId}` });
                return;
            }

            // Track activity
            if (req.body?.method) {
                let activity = req.body.method;
                if (activity === 'tools/call' && req.body.params?.name) {
                    activity += `: ${req.body.params.name}`;
                }
                this.trackActivity(sessionId, activity);
            }

            this.logger.debug(`Legacy SSE: Message received for sessionId=${sessionId}`);
            // CRITICAL: pass req.body as parsedBody. express.json() has already
            // consumed the request stream, so without this the SDK would try to
            // re-read an exhausted stream and fail with an empty body.
            await transport.handlePostMessage(req, res, req.body);
        });

    }

    /**
     * Shared Origin validation for all MCP endpoints (DNS rebinding protection).
     * Requests without an Origin header (curl, local CLI bridges) are allowed.
     * Returns false if the response has already been rejected.
     */
    private checkOrigin(req: Request, res: Response): boolean {
        const origin = req.headers.origin;
        if (origin && !this.isValidOrigin(origin, req.socket.localPort)) {
            this.logger.warn(`Rejected request with invalid origin: ${origin}`);
            res.status(403).json({ error: 'Invalid origin' });
            return false;
        }
        return true;
    }

    /**
     * Host header validation. The server listens on IPv4 loopback only, so any
     * other hostname (or a mismatched port) indicates a rebinding attempt.
     */
    private checkHost(req: Request, res: Response): boolean {
        const host = req.headers.host;
        try {
            const parsed = new URL(`http://${host || ''}`);
            const validHostname = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
            const validPort = parsed.port === String(req.socket.localPort || this.config.store.mcp?.port || 3001);
            if (validHostname && validPort) {
                return true;
            }
        } catch {
            // Reject malformed Host headers below.
        }

        this.logger.warn(`Rejected request with invalid Host header: ${host || '(missing)'}`);
        res.status(403).json({ error: 'Invalid host' });
        return false;
    }

    /** True only for connections originating from this machine's loopback stack */
    private isLoopbackRequest(req: Request): boolean {
        const address = req.socket.remoteAddress;
        return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
    }

    /**
     * Validate origin header for security
     */
    private isValidOrigin(origin: string, localPort: number | undefined): boolean {
        try {
            const url = new URL(origin);
            const validProtocol = url.protocol === 'http:' || url.protocol === 'https:';
            const validHostname = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
            const validPort = url.port === String(localPort || this.config.store.mcp?.port || 3001);
            return validProtocol && validHostname && validPort;
        } catch {
            return false;
        }
    }

    /** JSON-RPC initialize detection (single message or batch) */
    private isInitializeRequest(body: any): boolean {
        if (Array.isArray(body)) {
            return body.some(msg => msg?.method === 'initialize');
        }
        return body?.method === 'initialize';
    }

    /**
     * Configure HTTP API endpoints for direct tool access
     */
    private configureToolEndpoints(): void {
        if (this.toolEndpointsConfigured) {
            this.logger.debug('Tool endpoints already configured, skipping');
            return;
        }
        this.toolCategories.forEach(category => {
            category.mcpTools.forEach(tool => {
                this.app.post(`/api/tool/${tool.name}`, async (req: Request, res: Response) => {
                    if (!this.checkOrigin(req, res)) {
                        return;
                    }
                    if (this.config.store.mcp?.directToolApi?.enabled !== true) {
                        res.status(404).json({
                            error: 'Direct tool API is disabled',
                            hint: 'Use the MCP /mcp endpoint instead.'
                        });
                        return;
                    }
                    if (!this.isToolEnabled(tool.name)) {
                        res.status(404).json({
                            error: `Tool not available: ${tool.name}`,
                            hint: 'The corresponding feature may be disabled in Settings → MCP.'
                        });
                        return;
                    }
                    try {
                        this.logger.info(`API call: ${tool.name}`, req.body);
                        const result = await tool.handler(req.body, {});
                        res.json(result);
                    } catch (error: any) {
                        this.logger.error(`Tool ${tool.name} error:`, error);
                        res.status(500).json({ error: error.message });
                    }
                });
            });
        });
        this.toolEndpointsConfigured = true;
        this.logger.info(`Configured ${this.toolCategories.reduce((s, c) => s + c.mcpTools.length, 0)} tool API endpoints`);
    }

    /**
     * Start the MCP server.
     *
     * Issue #5: after an unclean Tabby shutdown, the previous process (or the OS
     * TIME_WAIT state / the renderer reusing the port) can still hold the port
     * when the plugin boots again. Instead of failing permanently on the first
     * EADDRINUSE, retry with backoff - the port is usually released within a
     * few seconds. The server also binds to 127.0.0.1 only, so it never
     * competes for (or exposes itself on) non-loopback interfaces.
     */
    public startServer(port?: number): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('MCP server is already running');
            return Promise.resolve();
        }
        if (this.startPromise) {
            return this.startPromise;
        }

        const generation = ++this.lifecycleGeneration;
        const pending = this.startServerInternal(port, generation);
        this.startPromise = pending;
        void pending.then(
            () => {
                if (this.startPromise === pending) this.startPromise = undefined;
            },
            () => {
                if (this.startPromise === pending) this.startPromise = undefined;
            }
        );
        return pending;
    }

    private async startServerInternal(port: number | undefined, generation: number): Promise<void> {
        const serverPort = port || this.config.store.mcp?.port || 3001;
        this.assertStartActive(generation);
        await this.ensureControlToken();
        this.assertStartActive(generation);

        // Must run after tool categories have been registered by McpModule.
        this.configureToolEndpoints();

        const maxAttempts = 5;
        const retryDelayMs = 1500;
        let lastError: any;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.assertStartActive(generation);
            try {
                await this.listenOnce(serverPort, generation);
                return;
            } catch (err: any) {
                lastError = err;
                this.assertStartActive(generation);
                if (err?.code !== 'EADDRINUSE') {
                    this.logger.error('Server error:', err);
                    throw err;
                }

                const stale = await this.isStaleMcpInstance(serverPort);
                this.assertStartActive(generation);
                if (stale) {
                    this.logger.warn(`Port ${serverPort} is used by another Tabby MCP server instance. Requesting graceful handover (${attempt}/${maxAttempts})...`);
                    await this.requestStaleInstanceShutdown(serverPort);
                } else {
                    this.logger.warn(`Port ${serverPort} is in use by another process; retrying (${attempt}/${maxAttempts})...`);
                }

                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }
        }

        this.assertStartActive(generation);
        this.logger.error(`Port ${serverPort} is still in use after ${maxAttempts} attempts. Change the port in Settings → MCP, or free the port and restart the server.`);
        throw lastError;
    }

    /** A stop request bumps the generation so a pending start aborts instead of binding */
    private assertStartActive(generation: number): void {
        if (generation !== this.lifecycleGeneration) {
            const error: any = new Error('MCP server start cancelled');
            error.code = 'ECANCELED';
            throw error;
        }
    }

    /**
     * Persist a per-install control token used only for loopback stale-instance
     * handover. Existing installations get one lazily on first server start.
     */
    private async ensureControlToken(): Promise<void> {
        const existing = this.config.store.mcp?.serverControlToken;
        if (typeof existing === 'string' && existing.length >= 32) {
            this.controlToken = existing;
            return;
        }

        this.controlToken = randomUUID() + randomUUID();
        this.config.store.mcp.serverControlToken = this.controlToken;
        try {
            await this.config.save();
        } catch (error) {
            // Keep the in-memory token so this instance still functions. Handover
            // will become available after a later successful config save.
            this.logger.warn('Could not persist MCP control token:', error);
        }
    }

    /** Single bind attempt on the loopback interface */
    private listenOnce(serverPort: number, generation: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = http.createServer(this.app);
            let settled = false;

            server.on('connection', (socket: Socket) => {
                this.sockets.add(socket);
                socket.on('close', () => {
                    this.sockets.delete(socket);
                });
            });

            server.on('error', (err: any) => {
                if (settled) {
                    this.logger.error('Server error:', err);
                    return;
                }
                settled = true;
                this.isRunning = false;
                try {
                    server.close();
                } catch {
                    // Nothing to clean up
                }
                reject(err);
            });

            // Bind to loopback only: MCP has no authentication, so it must not be
            // reachable from other machines on the network
            server.listen(serverPort, '127.0.0.1', () => {
                if (generation !== this.lifecycleGeneration) {
                    settled = true;
                    server.close();
                    const error: any = new Error('MCP server start cancelled');
                    error.code = 'ECANCELED';
                    reject(error);
                    return;
                }

                settled = true;
                this.httpServer = server;
                this.isRunning = true;
                this.logger.info(`MCP server started on 127.0.0.1:${serverPort}`);
                this.logger.info(`  Streamable HTTP: http://127.0.0.1:${serverPort}/mcp`);
                this.logger.info(`  Legacy SSE: http://127.0.0.1:${serverPort}/sse`);
                resolve();
            });
        });
    }

    /**
     * Probe /health to determine whether the port is held by a previous
     * Tabby MCP instance (which will release it soon) or a foreign process.
     */
    private async isStaleMcpInstance(serverPort: number): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.get({
                host: '127.0.0.1',
                port: serverPort,
                path: '/health',
                timeout: 1000
            }, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body)?.server === 'Tabby MCP');
                    } catch {
                        resolve(false);
                    }
                });
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /** Ask a previous v1.6.3+ instance to release the port */
    private async requestStaleInstanceShutdown(serverPort: number): Promise<boolean> {
        if (!this.controlToken) {
            return false;
        }

        return new Promise((resolve) => {
            const req = http.request({
                host: '127.0.0.1',
                port: serverPort,
                path: '/internal/shutdown',
                method: 'POST',
                timeout: 1000,
                headers: {
                    'X-Tabby-MCP-Control-Token': this.controlToken,
                    'Content-Length': '0'
                }
            }, (res) => {
                res.resume();
                res.on('end', () => resolve(res.statusCode === 202));
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }

    /**
     * Stop the MCP server
     */
    public async stopServer(): Promise<void> {
        await this.stopServerInternal(false, 'manual stop');
    }

    /**
     * Best-effort synchronous cleanup for window/application shutdown.
     * Avoids awaiting async transport closes during unload while still releasing the port.
     */
    public stopServerSync(reason: string = 'shutdown'): void {
        void this.stopServerInternal(true, reason);
    }

    private async stopServerInternal(forceImmediate: boolean, reason: string): Promise<void> {
        // Cancel any in-flight start so a pending retry loop cannot bind the port
        // after this stop completes.
        ++this.lifecycleGeneration;
        const pendingStart = this.startPromise;
        if (!this.isRunning && pendingStart) {
            try {
                await pendingStart;
            } catch {
                // A stop request intentionally cancels an in-flight start.
            }
        }
        if (!this.isRunning) {
            this.logger.info('MCP server is not running');
            return;
        }

        try {
            // Close all legacy transports
            Object.values(this.legacyTransports).forEach(transport => {
                try {
                    transport.close();
                } catch (e) {
                    // Ignore close errors
                }
            });
            this.legacyTransports = {};

            // Close all streamable transports
            for (const transport of Object.values(this.streamableTransports)) {
                try {
                    if (forceImmediate) {
                        void transport.close().catch(() => undefined);
                    } else {
                        await transport.close();
                    }
                } catch (e) {
                    // Ignore close errors
                }
            }
            this.streamableTransports = {};

            this.sessionMetadata.clear();

            // Clear all per-session servers
            this.sessionServers = {};
            this.logger.debug('Cleared all per-session McpServer instances');

            // Force close all active connections
            if (this.sockets.size > 0) {
                this.logger.info(`Closing ${this.sockets.size} active connections`);
                for (const socket of this.sockets) {
                    socket.destroy();
                }
                this.sockets.clear();
            }

            // Close HTTP server
            if (this.httpServer) {
                const server = this.httpServer;
                this.httpServer = undefined;
                this.isRunning = false;

                if (forceImmediate) {
                    try {
                        server.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                } else {
                    await new Promise<void>((resolve) => {
                        server.close(() => resolve());
                    });
                }
            } else {
                this.isRunning = false;
            }

            this.logger.info(`MCP server stopped (${reason})`);
        } catch (err) {
            this.logger.error('Error stopping MCP server:', err);
            throw err;
        }
    }

    /**
     * Restart the MCP server
     */
    public async restartServer(): Promise<void> {
        await this.stopServer();
        await this.startServer();
    }

    /**
     * Check if server is running
     */
    public isServerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get active connections count
     */
    public getActiveConnections(): number {
        return Object.keys(this.legacyTransports).length + Object.keys(this.streamableTransports).length;
    }

    // ============================================================
    // CONNECTION MONITORING & MANAGEMENT
    // ============================================================

    private sessionMetadata = new Map<string, {
        id: string,
        type: 'sse' | 'streamable',
        userAgent?: string,
        startTime: number,
        lastActive: number,
        lastActivity: string,
        history: string[] // Last 10 activities
    }>();

    private trackActivity(sessionId: string, activity: string) {
        const meta = this.sessionMetadata.get(sessionId);
        if (meta) {
            meta.lastActive = Date.now();
            meta.lastActivity = activity;
            meta.history.unshift(`[${new Date().toLocaleTimeString()}] ${activity}`);
            if (meta.history.length > 10) meta.history.pop();
        }
    }

    private initSessionMetadata(sessionId: string, type: 'sse' | 'streamable', req: Request) {
        this.sessionMetadata.set(sessionId, {
            id: sessionId,
            type,
            userAgent: req.headers['user-agent'],
            startTime: Date.now(),
            lastActive: Date.now(),
            lastActivity: 'Connected',
            history: []
        });
    }

    public getSessions() {
        return Array.from(this.sessionMetadata.values()).sort((a, b) => b.lastActive - a.lastActive);
    }

    public async closeSession(sessionId: string): Promise<boolean> {
        this.logger.info(`Manually closing session: ${sessionId}`);

        let found = false;

        // Try closing streamable transport
        if (this.streamableTransports[sessionId]) {
            try {
                await this.streamableTransports[sessionId].close();
            } catch (e) { }
            delete this.streamableTransports[sessionId];
            found = true;
        }

        // Try closing legacy transport
        if (this.legacyTransports[sessionId]) {
            try {
                this.legacyTransports[sessionId].close();
            } catch (e) { }
            delete this.legacyTransports[sessionId];
            found = true;
        }

        this.sessionMetadata.delete(sessionId);
        // Release the per-session McpServer as well - for legacy transports the
        // SSE 'close' event may not fire here, which previously leaked the server
        this.cleanupServerForSession(sessionId);
        return found;
    }
}

export * from '../types/types';
