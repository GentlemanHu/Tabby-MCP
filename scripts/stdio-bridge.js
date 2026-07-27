#!/usr/bin/env node

/**
 * Tabby MCP STDIO Bridge
 * 
 * This script provides STDIO transport for MCP clients that don't support SSE.
 * It acts as a bridge between stdin/stdout and the Tabby MCP SSE server.
 * 
 * Usage:
 *   node stdio-bridge.js [--port 3001] [--host localhost]
 * 
 * For Claude Desktop mcp.json:
 *   {
 *     "mcpServers": {
 *       "tabby-mcp-server": {
 *         "command": "node",
 *         "args": ["/path/to/tabby-mcp-server/scripts/stdio-bridge.js"]
 *       }
 *     }
 *   }
 */

const http = require('http');
const readline = require('readline');

// Configuration - match the server's loopback-only bind
const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '127.0.0.1';

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    let port = DEFAULT_PORT;
    let host = DEFAULT_HOST;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            port = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--host' && args[i + 1]) {
            host = args[i + 1];
            i++;
        }
    }

    return { port, host };
}

const config = parseArgs();
const baseUrl = `http://${config.host}:${config.port}`;

// Session state for SSE connection
let sessionId = null;
let sseConnection = null;
let connectingPromise = null;
let reconnectTimer = null;
let stopping = false;

// Log to stderr (so it doesn't interfere with STDIO protocol)
function log(message) {
    process.stderr.write(`[stdio-bridge] ${message}\n`);
}

// Send JSON-RPC response to stdout
function sendResponse(response) {
    const json = JSON.stringify(response);
    process.stdout.write(json + '\n');
}

// Make HTTP request to MCP server
function httpRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Connect to SSE endpoint and handle events. Concurrent callers share one attempt.
function connectSSE() {
    if (sessionId && sseConnection && !sseConnection.destroyed) {
        return Promise.resolve(sessionId);
    }
    if (connectingPromise) {
        return connectingPromise;
    }

    connectingPromise = new Promise((resolve, reject) => {
        const url = new URL('/sse', baseUrl);
        let settled = false;
        let sessionTimeout;

        log(`Connecting to SSE: ${url.href}`);

        const req = http.get(url.href, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                settled = true;
                reject(new Error(`SSE connection failed: ${res.statusCode}`));
                return;
            }

            sseConnection = res;
            let buffer = '';

            sessionTimeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    req.destroy();
                    reject(new Error('Timed out waiting for SSE session ID'));
                }
            }, 5000);

            res.on('data', (chunk) => {
                buffer += chunk.toString();

                // Process complete SSE lines. The endpoint event contains the
                // /messages URL and subsequent message events contain JSON-RPC.
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const payload = line.slice(6);
                        try {
                            handleSSEMessage(JSON.parse(payload));
                        } catch {
                            // Endpoint events are URLs, heartbeat comments are non-JSON
                        }
                    }

                    if (line.includes('sessionId=')) {
                        const match = line.match(/[?&]sessionId=([a-zA-Z0-9-]+)/);
                        if (match) {
                            sessionId = match[1];
                            log(`Session ID: ${sessionId}`);
                            if (!settled) {
                                settled = true;
                                clearTimeout(sessionTimeout);
                                resolve(sessionId);
                            }
                        }
                    }
                }
            });

            res.on('error', (err) => {
                log(`SSE error: ${err.message}`);
            });

            res.on('close', () => {
                clearTimeout(sessionTimeout);
                sseConnection = null;
                sessionId = null;
                log('SSE connection closed');
                if (!settled) {
                    settled = true;
                    reject(new Error('SSE connection closed before session initialization'));
                }
                if (!stopping) {
                    scheduleReconnect();
                }
            });
        });

        req.on('error', (error) => {
            clearTimeout(sessionTimeout);
            if (!settled) {
                settled = true;
                reject(error);
            }
        });
    }).finally(() => {
        connectingPromise = null;
    });

    return connectingPromise;
}

function scheduleReconnect() {
    if (stopping || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSSE().catch(error => {
            log(`Reconnect failed: ${error.message}`);
            scheduleReconnect();
        });
    }, 5000);
}

// Handle incoming SSE message
function handleSSEMessage(data) {
    // Forward SSE messages as JSON-RPC notifications
    sendResponse(data);
}

// Send message to MCP server via POST
async function sendToServer(message) {
    if (!sessionId) {
        log('No session ID, establishing SSE connection...');
        await connectSSE();
    }

    const response = await httpRequest('POST', `/messages?sessionId=${sessionId}`, message);
    if (response.status < 200 || response.status >= 300) {
        const detail = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`MCP server returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    // Legacy SSE responses arrive exclusively on the SSE stream. Do not write
    // the POST acknowledgement body (often "Accepted") to stdout: doing so
    // corrupts the newline-delimited JSON-RPC protocol and can duplicate replies.
}

// Handle JSON-RPC request from stdin
async function handleRequest(request) {
    try {
        await sendToServer(request);
    } catch (error) {
        log(`Error handling request: ${error.message}`);
        sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            error: {
                code: -32603,
                message: error.message
            }
        });
    }
}

// Main entry point
async function main() {
    log(`Starting STDIO bridge for Tabby MCP at ${baseUrl}`);

    // Check if server is running
    try {
        const health = await httpRequest('GET', '/health');
        if (health.status !== 200) {
            log('Warning: MCP server may not be running. Start Tabby and enable MCP server.');
        } else {
            log('MCP server is running');
        }
    } catch (error) {
        log(`Warning: Cannot connect to MCP server at ${baseUrl}`);
        log('Make sure Tabby is running and MCP server is started.');
    }

    // Connect to SSE
    try {
        await connectSSE();
    } catch (error) {
        log(`SSE connection error: ${error.message}`);
    }

    // Read from stdin
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const request = JSON.parse(line);
            await handleRequest(request);
        } catch (error) {
            log(`Invalid JSON: ${error.message}`);
        }
    });

    const shutdown = (reason) => {
        if (stopping) return;
        stopping = true;
        log(`${reason}, exiting`);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (sseConnection) sseConnection.destroy();
        process.exit(0);
    };

    rl.on('close', () => shutdown('STDIO closed'));

    // Handle termination
    process.on('SIGINT', () => shutdown('Received SIGINT'));
    process.on('SIGTERM', () => shutdown('Received SIGTERM'));
}

main().catch(error => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
