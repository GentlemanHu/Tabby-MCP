import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';
import { McpLoggerService } from './mcpLogger.service';
import { ToolCategory, McpTool } from '../types/types';

/**
 * MCP Server Service - Core MCP server with SSE transport
 */
@Injectable({ providedIn: 'root' })
export class McpService {
    private server!: McpServer;
    private transports: { [sessionId: string]: SSEServerTransport } = {};
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
            version: '1.0.0'
        });

        // Configure Express
        this.configureExpress();
        this.logger.info('MCP Server initialized');
    }

    /**
     * Register a tool category with the MCP server
     */
    public registerToolCategory(category: ToolCategory): void {
        this.toolCategories.push(category);

        category.mcpTools.forEach(tool => {
            this.server.tool(
                tool.name,
                tool.description,
                tool.schema as z.ZodRawShape,
                tool.handler
            );
            this.logger.info(`Registered tool: ${tool.name}`);
        });
    }

    /**
     * Register a single tool
     */
    public registerTool(tool: McpTool): void {
        this.server.tool(
            tool.name,
            tool.description,
            tool.schema as z.ZodRawShape,
            tool.handler
        );
        this.logger.info(`Registered tool: ${tool.name}`);
    }

    /**
     * Configure Express server with SSE endpoints
     */
    private configureExpress(): void {
        this.app = express();

        // Health check endpoint
        this.app.get('/health', (_, res) => {
            res.status(200).json({
                status: 'ok',
                server: 'Tabby MCP',
                version: '1.0.0',
                uptime: process.uptime()
            });
        });

        // Server info endpoint
        this.app.get('/info', (_, res) => {
            res.status(200).json({
                name: 'Tabby MCP',
                version: '1.0.0',
                transport: 'SSE',
                tools: this.toolCategories.flatMap(c => c.mcpTools.map(t => ({
                    name: t.name,
                    description: t.description
                })))
            });
        });

        // SSE endpoint for MCP clients
        this.app.get('/sse', async (req: Request, res: Response) => {
            this.logger.info('Establishing new SSE connection');

            try {
                const transport = new SSEServerTransport(
                    '/messages',
                    res as unknown as ServerResponse<IncomingMessage>
                );

                this.logger.info(`New SSE connection: sessionId=${transport.sessionId}`);
                this.transports[transport.sessionId] = transport;

                res.on('close', () => {
                    this.logger.info(`SSE connection closed: sessionId=${transport.sessionId}`);
                    delete this.transports[transport.sessionId];
                });

                await this.server.connect(transport);
            } catch (error) {
                this.logger.error('Failed to establish SSE connection:', error);
                res.status(500).send('Failed to establish SSE connection');
            }
        });

        // Messages endpoint for SSE transport
        this.app.post('/messages', async (req: Request, res: Response) => {
            const sessionId = req.query.sessionId as string;

            if (!sessionId) {
                res.status(400).json({ error: 'Missing sessionId parameter' });
                return;
            }

            const transport = this.transports[sessionId];
            if (!transport) {
                res.status(400).json({ error: `No transport found for sessionId ${sessionId}` });
                return;
            }

            this.logger.debug(`Message received for sessionId=${sessionId}`);
            await transport.handlePostMessage(req, res);
        });

        // Configure API endpoints for direct tool access
        this.configureToolEndpoints();
    }

    /**
     * Configure HTTP API endpoints for direct tool access
     */
    private configureToolEndpoints(): void {
        this.toolCategories.forEach(category => {
            category.mcpTools.forEach(tool => {
                this.app.post(`/api/tool/${tool.name}`, express.json(), async (req: Request, res: Response) => {
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
            // Close all transports
            Object.values(this.transports).forEach(transport => {
                try {
                    transport.close();
                } catch (e) {
                    // Ignore close errors
                }
            });
            this.transports = {};

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
        return Object.keys(this.transports).length;
    }
}

export * from '../types/types';
