import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';
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
    private server!: McpServer;
    private legacyTransports: { [sessionId: string]: SSEServerTransport } = {};
    private streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    private app!: express.Application;
    private httpServer?: http.Server;
    private isRunning = false;
    private toolCategories: ToolCategory[] = [];

    constructor(
        public config: ConfigService,
        private logger: McpLoggerService
    ) {
        this.initializeServer();
    }

    /**
     * Initialize the MCP server
     */
    private initializeServer(): void {
        // Initialize MCP Server
        this.server = new McpServer({
            name: 'Tabby MCP',
            version: PLUGIN_VERSION
        });

        // Configure Express
        this.configureExpress();
        this.logger.info('MCP Server initialized (Streamable HTTP + Legacy SSE)');
    }

    /**
     * Register a tool category with the MCP server
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

            (this.server.tool as any)(
                tool.name,
                tool.description,
                rawShape,
                tool.handler
            );
            this.logger.info(`Registered tool: ${tool.name}`);
        });
    }

    /**
     * Register a single tool
     */
    public registerTool(tool: McpTool): void {
        // Extract the raw shape from z.object() for MCP SDK compatibility
        const rawShape = tool.schema && typeof tool.schema === 'object' && 'shape' in tool.schema
            ? (tool.schema as any).shape
            : tool.schema;

        (this.server.tool as any)(
            tool.name,
            tool.description,
            rawShape,
            tool.handler
        );
        this.logger.info(`Registered tool: ${tool.name}`);
    }

    /**
     * Configure Express server with Streamable HTTP and SSE endpoints
     */
    private configureExpress(): void {
        this.app = express();

        // Parse JSON for all routes
        this.app.use(express.json());

        // Health check endpoint
        this.app.get('/health', (_, res) => {
            res.status(200).json({
                status: 'ok',
                server: 'Tabby MCP',
                version: '1.1.3',
                transport: 'StreamableHTTP + SSE',
                uptime: process.uptime()
            });
        });

        // Server info endpoint
        this.app.get('/info', (_, res) => {
            res.status(200).json({
                name: 'Tabby MCP',
                version: '1.1.3',
                protocolVersion: '2025-03-26',
                transports: ['streamable-http', 'sse'],
                endpoints: {
                    streamableHttp: '/mcp',
                    legacySse: '/sse',
                    legacyMessages: '/messages'
                },
                tools: this.toolCategories.flatMap(c => c.mcpTools.map(t => ({
                    name: t.name,
                    description: t.description
                })))
            });
        });

        // Tools list endpoint (for debugging)
        this.app.get('/tools', (_, res) => {
            res.status(200).json({
                count: this.toolCategories.reduce((sum, c) => sum + c.mcpTools.length, 0),
                categories: this.toolCategories.map(c => ({
                    name: c.name,
                    tools: c.mcpTools.map(t => t.name)
                }))
            });
        });

        // ============================================================
        // STREAMABLE HTTP TRANSPORT (New, Recommended - Protocol 2025-03-26)
        // Single endpoint handling all MCP communication
        // ============================================================

        this.app.all('/mcp', async (req: Request, res: Response) => {
            // Validate Origin header for security (DNS rebinding protection)
            const origin = req.headers.origin;
            const host = req.headers.host;
            if (origin && !this.isValidOrigin(origin, host)) {
                this.logger.warn(`Rejected request with invalid origin: ${origin}`);
                res.status(403).json({ error: 'Invalid origin' });
                return;
            }

            // Handle GET request - establish SSE stream for server-to-client messages
            if (req.method === 'GET') {
                this.logger.info('Streamable HTTP: GET /mcp - Establishing SSE stream');

                // Check for existing session
                const sessionId = req.headers['mcp-session-id'] as string;
                if (sessionId && this.streamableTransports[sessionId]) {
                    // Reuse existing transport
                    const transport = this.streamableTransports[sessionId];
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('mcp-session-id', sessionId);

                    // Keep connection alive
                    const heartbeat = setInterval(() => {
                        if (!res.writableEnded) {
                            res.write(': heartbeat\n\n');
                        }
                    }, 15000);

                    res.on('close', () => {
                        clearInterval(heartbeat);
                        this.logger.info(`Streamable HTTP: SSE stream closed for session: ${sessionId}`);
                        // Note: Don't delete transport here - it may still be used for POST requests
                        // The transport.onclose handler will clean up when fully disconnected
                    });
                    return;
                }

                // No session - return info about how to connect
                res.status(400).json({
                    error: 'Session required',
                    message: 'Send a POST request with initialize message first to establish session'
                });
                return;
            }

            // Handle DELETE request - close session
            if (req.method === 'DELETE') {
                const sessionId = req.headers['mcp-session-id'] as string;
                if (sessionId && this.streamableTransports[sessionId]) {
                    try {
                        await this.streamableTransports[sessionId].close();
                    } catch (e) {
                        // Ignore close errors
                    }
                    delete this.streamableTransports[sessionId];
                    this.logger.info(`Streamable HTTP: Session closed: ${sessionId}`);
                    res.status(200).json({ message: 'Session closed' });
                } else {
                    res.status(404).json({ error: 'Session not found' });
                }
                return;
            }

            // Handle POST request - main message handling
            if (req.method === 'POST') {
                const sessionId = req.headers['mcp-session-id'] as string || randomUUID();
                const acceptHeader = req.headers.accept || '';

                this.logger.debug(`Streamable HTTP: POST /mcp sessionId=${sessionId}`);

                // Check if we need to create new transport
                let transport = this.streamableTransports[sessionId];
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
                    };

                    this.streamableTransports[sessionId] = transport;

                    // Connect to MCP server
                    await this.server.connect(transport);

                    this.logger.info(`Streamable HTTP: New session created: ${sessionId}`);
                }

                // Set session ID header in response
                res.setHeader('mcp-session-id', sessionId);

                // Handle the message
                try {
                    await transport.handleRequest(req, res, req.body);
                } catch (error: any) {
                    this.logger.error('Streamable HTTP: Error handling request:', error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: error.message || 'Internal error' },
                            id: req.body?.id || null
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
                });

                res.on('error', (err) => {
                    this.logger.error(`Legacy SSE: Connection error sessionId=${sessionId}`, err);
                    clearInterval(heartbeatInterval);
                    delete this.legacyTransports[sessionId];
                });

                await this.server.connect(transport);
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

            this.logger.debug(`Legacy SSE: Message received for sessionId=${sessionId}`);
            await transport.handlePostMessage(req, res);
        });

        // Configure API endpoints for direct tool access
        this.configureToolEndpoints();
    }

    /**
     * Validate origin header for security
     */
    private isValidOrigin(origin: string, host: string | undefined): boolean {
        // Allow requests from localhost
        const localhostPatterns = [
            'http://localhost',
            'http://127.0.0.1',
            'https://localhost',
            'https://127.0.0.1'
        ];

        for (const pattern of localhostPatterns) {
            if (origin.startsWith(pattern)) {
                return true;
            }
        }

        // Allow if origin matches host
        if (host) {
            try {
                const originHost = new URL(origin).host;
                if (originHost === host) {
                    return true;
                }
            } catch {
                // Invalid URL
            }
        }

        return false;
    }

    /**
     * Configure HTTP API endpoints for direct tool access
     */
    private configureToolEndpoints(): void {
        this.toolCategories.forEach(category => {
            category.mcpTools.forEach(tool => {
                this.app.post(`/api/tool/${tool.name}`, async (req: Request, res: Response) => {
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
    }

    /**
     * Start the MCP server
     */
    public async startServer(port?: number): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('MCP server is already running');
            return;
        }

        const serverPort = port || this.config.store.mcp?.port || 3001;

        return new Promise((resolve, reject) => {
            try {
                this.httpServer = http.createServer(this.app);

                this.httpServer.listen(serverPort, () => {
                    this.isRunning = true;
                    this.logger.info(`MCP server started on port ${serverPort}`);
                    this.logger.info(`  Streamable HTTP: http://localhost:${serverPort}/mcp`);
                    this.logger.info(`  Legacy SSE: http://localhost:${serverPort}/sse`);
                    resolve();
                });

                this.httpServer.on('error', (err: any) => {
                    this.isRunning = false;
                    if (err.code === 'EADDRINUSE') {
                        this.logger.error(`Port ${serverPort} is already in use`);
                    } else {
                        this.logger.error('Server error:', err);
                    }
                    reject(err);
                });
            } catch (err) {
                this.logger.error('Failed to start MCP server:', err);
                this.isRunning = false;
                reject(err);
            }
        });
    }

    /**
     * Stop the MCP server
     */
    public async stopServer(): Promise<void> {
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
            for (const [sessionId, transport] of Object.entries(this.streamableTransports)) {
                try {
                    await transport.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
            this.streamableTransports = {};

            // Close HTTP server
            if (this.httpServer) {
                await new Promise<void>((resolve) => {
                    this.httpServer!.close(() => resolve());
                });
                this.httpServer = undefined;
            }

            this.isRunning = false;
            this.logger.info('MCP server stopped');
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
}

export * from '../types/types';
