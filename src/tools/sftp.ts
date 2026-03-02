import { Injectable } from '@angular/core';
import { AppService, BaseTabComponent, SplitTabComponent, ConfigService } from 'tabby-core';
import { z } from 'zod';
import { BehaviorSubject } from 'rxjs';
import { BaseToolCategory } from './base-tool-category';
import { McpLoggerService } from '../services/mcpLogger.service';
import { McpTool, SFTPFileInfo } from '../types/types';
import { TerminalToolCategory } from './terminal';
import * as fs from 'fs';
import * as path from 'path';

// Try to import tabby-ssh (optional dependency)
let SSHTabComponent: any;
let sftpAvailable = false;

try {
    const sshModule = require('tabby-ssh');
    SSHTabComponent = sshModule.SSHTabComponent;
    sftpAvailable = true;
} catch {
    // tabby-ssh not installed, SFTP features will be disabled
}

/**
 * Transfer task status
 */
interface TransferTask {
    id: string;
    type: 'upload' | 'download';
    localPath: string;
    remotePath: string;
    sessionId: string;
    connectionName: string;    // SSH connection title for display
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;          // 0-100
    bytesTransferred: number;
    totalBytes: number;
    startTime: number;
    endTime?: number;
    error?: string;
    speed?: number;            // bytes/sec
    cancelCallback?: () => void; // Function to force kill the transfer
    reject?: (reason?: any) => void; // Function to reject the tool promise
}

/**
 * SFTP Tools Category - File transfer operations for SSH sessions
 * Uses Tabby's real SFTP API: SSHSession.openSFTP() -> SFTPSession
 * 
 * PARAMETER NAMING CONVENTION:
 * - path: Remote path for single operations
 * - localPath/remotePath: For upload/download
 * - sourcePath/destPath: For rename/move
 * 
 * TRANSFER MODES:
 * - sync=true (default): Wait for completion
 * - sync=false: Return immediately with transferId, use sftp_get_transfer_status
 */
@Injectable({ providedIn: 'root' })
export class SFTPToolCategory extends BaseToolCategory {
    name = 'sftp';

    // Cache SFTP sessions with TTL and SSH session reference
    // Key: sshSession object (using Map because we need to iterate for cleanup)
    // Value: { sftpSession, createdAt } - createdAt for TTL expiration
    private sftpSessionCache = new Map<any, { sftpSession: any; createdAt: number }>();
    private readonly SFTP_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
    // Note: Session IDs are now managed by TerminalToolCategory for consistency

    // Transfer task queue
    private transferTasks = new Map<string, TransferTask>();
    private _transferTasksSubject = new BehaviorSubject<TransferTask[]>([]);
    public readonly transferTasks$ = this._transferTasksSubject.asObservable();
    private maxTransferHistory = 100;

    constructor(
        private app: AppService,
        private config: ConfigService,
        logger: McpLoggerService,
        private terminalTools: TerminalToolCategory
    ) {
        super(logger);
        if (sftpAvailable) {
            this.initializeTools();
            this.logger.info('SFTP tools initialized (using Tabby SFTPSession API with shared session registry)');
        } else {
            this.logger.warn('SFTP tools not available (tabby-ssh not installed)');
        }
    }

    public isAvailable(): boolean {
        return sftpAvailable;
    }

    private initializeTools(): void {
        // Basic SFTP operations
        this.registerTool(this.createListFilesTool());
        this.registerTool(this.createReadFileTool());
        this.registerTool(this.createWriteFileTool());
        this.registerTool(this.createMkdirTool());
        this.registerTool(this.createDeleteTool());
        this.registerTool(this.createRenameTool());
        this.registerTool(this.createStatTool());

        // File transfer operations
        this.registerTool(this.createUploadTool());
        this.registerTool(this.createDownloadTool());
        this.registerTool(this.createGetTransferStatusTool());
        this.registerTool(this.createListTransfersTool());
        this.registerTool(this.createCancelTransferTool());
    }

    private generateTransferId(): string {
        return 'transfer_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    /** Emit current transfer state to UI subscribers */
    private emitTransferUpdate(): void {
        this._transferTasksSubject.next(Array.from(this.transferTasks.values()));
    }

    private cleanupOldTransfers(): void {
        const tasks = Array.from(this.transferTasks.values());
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
        if (completed.length > this.maxTransferHistory) {
            completed.sort((a, b) => (a.endTime || 0) - (b.endTime || 0));
            const toRemove = completed.slice(0, completed.length - this.maxTransferHistory);
            toRemove.forEach(t => this.transferTasks.delete(t.id));
            this.emitTransferUpdate();
        }
    }

    /**
     * Wait for transfer to complete with a polling fallback.
     * 
     * Tabby's SFTP API (based on russh) may not always resolve the Promise
     * even when the transfer is complete. This method uses Promise.race to
     * detect completion via polling the isComplete() method.
     * 
     * Also checks for SSH session disconnection to prevent infinite waits.
     * 
     * @param sftpPromise - The original sftpSession.upload/download promise
     * @param transferObj - StreamFileUpload or StreamFileDownload with isComplete()
     * @param sshSession - Optional SSH session to check for disconnection
     * @param pollIntervalMs - How often to check isComplete()
     * @param maxWaitMs - Maximum time to wait before timing out (0 = no timeout)
     */
    private async waitForTransferComplete<T>(
        sftpPromise: Promise<T>,
        transferObj: { isComplete: () => boolean; isCancelled: () => boolean },
        sshSession?: { open: boolean },
        pollIntervalMs: number = 500,
        maxWaitMs: number = 0
    ): Promise<T | 'completed_via_polling'> {
        const startTime = Date.now();

        // Create a polling promise that resolves when transfer is complete
        const pollingPromise = new Promise<'completed_via_polling'>((resolve, reject) => {
            const checkComplete = () => {
                // Check if SSH session disconnected
                if (sshSession && sshSession.open === false) {
                    this.logger.warn('[SFTP] SSH session disconnected during transfer');
                    reject(new Error('SSH connection lost during transfer'));
                    return;
                }

                // Check if cancelled
                if (transferObj.isCancelled()) {
                    reject(new Error('Transfer cancelled'));
                    return;
                }

                // Check if complete
                if (transferObj.isComplete()) {
                    this.logger.debug('[SFTP] Transfer detected as complete via polling');
                    resolve('completed_via_polling');
                    return;
                }

                // Check timeout (if maxWaitMs > 0)
                if (maxWaitMs > 0 && (Date.now() - startTime) > maxWaitMs) {
                    reject(new Error(`Transfer timed out after ${maxWaitMs}ms`));
                    return;
                }

                // Continue polling
                setTimeout(checkComplete, pollIntervalMs);
            };

            // Start polling with a slight delay to let the native promise resolve first
            setTimeout(checkComplete, pollIntervalMs);
        });

        // Race between the original promise and our polling promise
        return Promise.race([sftpPromise, pollingPromise]);
    }

    // ============== Public methods for UI ==============

    /** Get current snapshot of all transfers */
    public getTransfers(): TransferTask[] {
        return Array.from(this.transferTasks.values());
    }

    /** Cancel a transfer by ID (for UI button) */
    public cancelTransferById(transferId: string): boolean {
        const task = this.transferTasks.get(transferId);
        if (task && (task.status === 'pending' || task.status === 'running')) {
            task.status = 'cancelled';
            task.endTime = Date.now();

            // Force kill the underlying session/stream
            if (task.cancelCallback) {
                try {
                    task.cancelCallback();
                    this.logger.info(`Called cancel callback for task ${transferId}`);
                } catch (e) {
                    this.logger.error(`Error calling cancel callback for ${transferId}:`, e);
                }
            }

            // Force reject the promise to unblock MCP tool
            if (task.reject) {
                task.reject(new Error('Transfer cancelled by user'));
            }

            this.emitTransferUpdate();
            this.logger.info(`Transfer ${transferId} cancelled by user`);
            return true;
        }
        return false;
    }

    /** Clear all completed/failed/cancelled transfers from history */
    public clearCompletedTransfers(): void {
        const toRemove: string[] = [];
        this.transferTasks.forEach((task, id) => {
            if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
                toRemove.push(id);
            }
        });
        toRemove.forEach(id => this.transferTasks.delete(id));
        this.emitTransferUpdate();
        this.logger.info(`Cleared ${toRemove.length} completed transfers`);
    }

    /**
     * Get session ID for a tab - delegates to TerminalToolCategory
     * This ensures SFTP uses the same session IDs as terminal tools
     */
    private getOrCreateSessionId(tab: any): string {
        // Delegate to terminal tools to ensure consistent session IDs
        // TerminalToolCategory.getOrCreateSessionId expects BaseTerminalTabComponent
        // SSHTabComponent extends BaseTerminalTabComponent, so this works
        return this.terminalTools.getOrCreateSessionId(tab);
    }

    private findAllSSHTabs(): any[] {
        if (!sftpAvailable) return [];

        const sshTabs: any[] = [];
        for (const tab of this.app.tabs) {
            if (tab instanceof SSHTabComponent) {
                sshTabs.push(tab);
            } else if (tab instanceof SplitTabComponent) {
                const splitTab = tab as SplitTabComponent;
                for (const childTab of splitTab.getAllTabs()) {
                    if (childTab instanceof SSHTabComponent) {
                        sshTabs.push(childTab);
                    }
                }
            }
        }
        return sshTabs;
    }

    private findSSHSession(locator: { sessionId?: string; tabIndex?: number; title?: string }): { tab: any; sessionId: string } | null {
        if (!sftpAvailable) return null;

        const sshTabs = this.findAllSSHTabs();
        this.logger.debug(`[findSSHSession] Found ${sshTabs.length} SSH tabs, locator: ${JSON.stringify(locator)}`);

        // CASE 1: No locator provided - return first SSH tab (if any) as default
        if (!locator.sessionId && locator.tabIndex === undefined && !locator.title) {
            if (sshTabs.length > 0) {
                const tab = sshTabs[0];
                const sessionId = this.getOrCreateSessionId(tab);
                this.logger.info(`[findSSHSession] No locator provided, using first SSH tab. sessionId=${sessionId}`);
                return { tab, sessionId };
            }
            this.logger.warn('[findSSHSession] No SSH tabs available');
            return null;
        }

        // CASE 2: sessionId provided - MUST find exact match, NO FALLBACK
        if (locator.sessionId) {
            this.logger.debug(`[findSSHSession] Searching by sessionId: ${locator.sessionId}`);
            for (const tab of sshTabs) {
                const tabSessionId = this.getOrCreateSessionId(tab);
                this.logger.debug(`[findSSHSession] Checking tab: sessionId=${tabSessionId}, title=${tab.title}`);
                if (tabSessionId === locator.sessionId) {
                    this.logger.info(`[findSSHSession] Found exact sessionId match: ${locator.sessionId}`);
                    return { tab, sessionId: locator.sessionId };
                }
            }
            // CRITICAL: Do NOT fallback! Return null if sessionId doesn't match.
            this.logger.warn(`[findSSHSession] sessionId ${locator.sessionId} NOT FOUND among ${sshTabs.length} SSH tabs. Returning null.`);
            return null;
        }

        // CASE 3: tabIndex provided
        if (locator.tabIndex !== undefined) {
            const allTabs = this.app.tabs;
            if (locator.tabIndex >= 0 && locator.tabIndex < allTabs.length) {
                const tab = allTabs[locator.tabIndex];
                if (tab instanceof SSHTabComponent) {
                    const sessionId = this.getOrCreateSessionId(tab);
                    this.logger.info(`[findSSHSession] Found by tabIndex: ${locator.tabIndex}, sessionId=${sessionId}`);
                    return { tab, sessionId };
                } else if (tab instanceof SplitTabComponent) {
                    const splitTab = tab as SplitTabComponent;
                    const focusedTab = splitTab.getFocusedTab();
                    if (focusedTab && focusedTab instanceof SSHTabComponent) {
                        const sessionId = this.getOrCreateSessionId(focusedTab);
                        this.logger.info(`[findSSHSession] Found focused pane in split tab ${locator.tabIndex}, sessionId=${sessionId}`);
                        return { tab: focusedTab, sessionId };
                    }
                }
            }
            // tabIndex provided but no match - return null
            this.logger.warn(`[findSSHSession] tabIndex ${locator.tabIndex} did not resolve to an SSH tab`);
            return null;
        }

        // CASE 4: title provided
        if (locator.title) {
            const titleLower = locator.title.toLowerCase();
            const found = sshTabs.find(tab => tab.title?.toLowerCase().includes(titleLower));
            if (found) {
                const sessionId = this.getOrCreateSessionId(found);
                this.logger.info(`[findSSHSession] Found by title match: ${locator.title}, sessionId=${sessionId}`);
                return { tab: found, sessionId };
            }
            this.logger.warn(`[findSSHSession] No title match for: ${locator.title}`);
            return null;
        }

        // Should not reach here, but if it does, return null
        this.logger.warn('[findSSHSession] No locator matched');
        return null;
    }

    private async getSFTPSession(sshTab: any): Promise<any> {
        try {
            const sshSession = sshTab.sshSession;
            if (!sshSession) {
                this.logger.debug('[getSFTPSession] No sshSession on tab');
                return null;
            }

            // Check if SSH session itself is still open
            if (!sshSession.open) {
                this.logger.debug('[getSFTPSession] sshSession.open is false');
                // Clear any stale cache entry
                this.sftpSessionCache.delete(sshSession);
                return null;
            }

            // Check cache first
            const cached = this.sftpSessionCache.get(sshSession);
            if (cached) {
                const age = Date.now() - cached.createdAt;

                // Check TTL expiration (proactive cleanup before issues occur)
                if (age > this.SFTP_SESSION_TTL_MS) {
                    this.logger.info(`[getSFTPSession] SFTP session expired (age: ${Math.round(age / 1000)}s > TTL: ${this.SFTP_SESSION_TTL_MS / 1000}s). Recreating...`);
                    this.sftpSessionCache.delete(sshSession);
                    // Fall through to create new session
                } else {
                    // CRITICAL: Validate cached session is still alive
                    // Even within TTL, network issues can cause session to become stale
                    try {
                        // Quick health check with a lightweight operation
                        await Promise.race([
                            cached.sftpSession.stat('/'),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('SFTP health check timeout')), 3000)
                            )
                        ]);
                        this.logger.debug(`[getSFTPSession] Cached SFTP session validated (age: ${Math.round(age / 1000)}s)`);
                        return cached.sftpSession;
                    } catch (healthError: any) {
                        // Cached session is stale/broken, remove and recreate
                        this.logger.warn(`[getSFTPSession] Cached SFTP session failed health check: ${healthError.message}. Recreating...`);
                        this.sftpSessionCache.delete(sshSession);
                        // Fall through to create new session
                    }
                }
            }

            // Check if openSFTP is available
            if (typeof sshSession.openSFTP !== 'function') {
                this.logger.debug('[getSFTPSession] sshSession.openSFTP is not a function');
                return null;
            }

            // Create new SFTP session
            this.logger.debug('[getSFTPSession] Opening new SFTP session...');
            const sftpSession = await sshSession.openSFTP();

            // Store with creation timestamp for TTL management
            this.sftpSessionCache.set(sshSession, {
                sftpSession,
                createdAt: Date.now()
            });
            this.logger.info('[getSFTPSession] New SFTP session opened and cached');

            // Cleanup old entries from disconnected sessions
            this.cleanupStaleSFTPSessions();

            return sftpSession;
        } catch (error: any) {
            this.logger.error('[getSFTPSession] Failed to open SFTP session:', error.message || error);
            return null;
        }
    }

    /**
     * Cleanup stale SFTP sessions from closed SSH connections
     * Called periodically when creating new sessions
     */
    private cleanupStaleSFTPSessions(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [sshSession, cached] of this.sftpSessionCache.entries()) {
            // Remove if SSH session is closed OR TTL expired
            if (sshSession.open === false || (now - cached.createdAt) > this.SFTP_SESSION_TTL_MS) {
                this.sftpSessionCache.delete(sshSession);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`[cleanupStaleSFTPSessions] Removed ${cleaned} stale entries`);
        }
    }

    private readonly sessionSchema = {
        sessionId: z.string().optional().describe('SSH session ID (from get_session_list)'),
        tabIndex: z.number().optional().describe('Tab index of SSH session'),
        title: z.string().optional().describe('Match SSH session by tab title')
    };

    // ============== BASIC SFTP OPERATIONS ==============

    private createListFilesTool(): McpTool {
        return {
            name: 'sftp_list_files',
            description: `List files in remote directory via SFTP.
Returns: Array of {name, path, isDirectory, size, modifiedTime}`,
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().optional().describe('Remote directory path (default: "/")')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path?: string }) => {
                this.logger.info(`[sftp_list_files] Called with params: ${JSON.stringify(params)}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_list_files] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }
                this.logger.debug(`[sftp_list_files] Using session: ${session.sessionId}`);

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    const remotePath = params.path || '/';
                    const files = await sftp.readdir(remotePath);
                    const fileList: SFTPFileInfo[] = files.map((f: any) => ({
                        name: f.name,
                        path: f.fullPath,
                        isDirectory: f.isDirectory,
                        isSymlink: f.isSymlink,
                        size: f.size,
                        mode: f.mode,
                        modifiedTime: f.modified?.toISOString() || 'unknown'
                    }));

                    this.logger.info(`[sftp_list_files] Success: ${fileList.length} files in ${remotePath}`);

                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true,
                                sessionId: session.sessionId,
                                path: remotePath,
                                files: fileList,
                                count: fileList.length
                            }, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createReadFileTool(): McpTool {
        return {
            name: 'sftp_read_file',
            description: `Read remote file content via SFTP. For text files only.
Max size: Configurable in Settings (default: 1MB)`,
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().describe('Remote file path to read'),
                maxSize: z.number().optional().describe('Max bytes (default: 1MB)')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path: string; maxSize?: number }) => {
                this.logger.info(`[sftp_read_file] Called: path=${params.path}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_read_file] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    const stats = await sftp.stat(params.path);
                    const maxSize = params.maxSize || this.config.store.mcp?.sftp?.maxFileSize || 1024 * 1024;

                    if (stats.size > maxSize) {
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: false,
                                    error: `File too large: ${stats.size} bytes (max: ${maxSize})`,
                                    hint: 'Use sftp_download to download the file locally'
                                })
                            }]
                        };
                    }

                    const handle = await sftp.open(params.path, 1); // OPEN_READ
                    const chunks: Uint8Array[] = [];
                    while (true) {
                        const chunk = await handle.read();
                        if (!chunk || chunk.length === 0) break;
                        chunks.push(chunk);
                    }
                    await handle.close();

                    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                    const combined = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        combined.set(chunk, offset);
                        offset += chunk.length;
                    }
                    const content = new TextDecoder('utf-8').decode(combined);

                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true, sessionId: session.sessionId, path: params.path, size: stats.size, content
                            })
                        }]
                    };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createWriteFileTool(): McpTool {
        return {
            name: 'sftp_write_file',
            description: `Write string content to remote file via SFTP.
For text content only. Use sftp_upload for binary files.`,
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().describe('Remote file path'),
                content: z.string().describe('Text content to write'),
                append: z.boolean().optional().describe('Append instead of overwrite')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path: string; content: string; append?: boolean }) => {
                this.logger.info(`[sftp_write_file] Called: path=${params.path}, contentLen=${params.content?.length}, append=${params.append}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_write_file] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    const flags = params.append ? (2 | 8 | 4) : (2 | 8 | 16);
                    const handle = await sftp.open(params.path, flags);
                    const data = new TextEncoder().encode(params.content);
                    await handle.write(data);
                    await handle.close();

                    this.logger.info(`[sftp_write_file] Success: ${data.length} bytes written to ${params.path}`);

                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true, sessionId: session.sessionId, path: params.path, bytesWritten: data.length
                            })
                        }]
                    };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createMkdirTool(): McpTool {
        return {
            name: 'sftp_mkdir',
            description: 'Create directory on remote server via SFTP.',
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().describe('Directory path to create')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path: string }) => {
                const session = this.findSSHSession(params);
                if (!session) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    await sftp.mkdir(params.path);
                    return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: session.sessionId, path: params.path }) }] };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createDeleteTool(): McpTool {
        return {
            name: 'sftp_delete',
            description: 'Delete file or empty directory via SFTP.',
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().describe('Path to delete'),
                isDirectory: z.boolean().optional().describe('Force treat as directory')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path: string; isDirectory?: boolean }) => {
                this.logger.info(`[sftp_delete] Called: path=${params.path}, isDirectory=${params.isDirectory}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_delete] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    let isDir = params.isDirectory;
                    if (isDir === undefined) {
                        try {
                            const stats = await sftp.stat(params.path);
                            isDir = stats.isDirectory;
                        } catch { isDir = false; }
                    }

                    if (isDir) {
                        await sftp.rmdir(params.path);
                    } else {
                        await sftp.unlink(params.path);
                    }

                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true, sessionId: session.sessionId, path: params.path, type: isDir ? 'directory' : 'file'
                            })
                        }]
                    };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createRenameTool(): McpTool {
        return {
            name: 'sftp_rename',
            description: 'Rename or move file/directory via SFTP.',
            schema: z.object({
                ...this.sessionSchema,
                sourcePath: z.string().describe('Current path'),
                destPath: z.string().describe('New path')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; sourcePath: string; destPath: string }) => {
                const session = this.findSSHSession(params);
                if (!session) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    await sftp.rename(params.sourcePath, params.destPath);
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true, sessionId: session.sessionId, sourcePath: params.sourcePath, destPath: params.destPath
                            })
                        }]
                    };
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createStatTool(): McpTool {
        return {
            name: 'sftp_stat',
            description: 'Get file/directory info (exists, size, permissions, etc).',
            schema: z.object({
                ...this.sessionSchema,
                path: z.string().describe('Path to stat')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; path: string }) => {
                const session = this.findSSHSession(params);
                if (!session) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    const stats = await sftp.stat(params.path);
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true, sessionId: session.sessionId, path: params.path, exists: true,
                                isDirectory: stats.isDirectory, isSymlink: stats.isSymlink, size: stats.size, mode: stats.mode,
                                modifiedTime: stats.modified?.toISOString() || 'unknown'
                            })
                        }]
                    };
                } catch (error: any) {
                    const errorStr = error.message || String(error);
                    if (errorStr.includes('No such file') || errorStr.includes('not found')) {
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true, sessionId: session.sessionId, path: params.path, exists: false
                                })
                            }]
                        };
                    }
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorStr }) }] };
                }
            }
        };
    }

    // ============== FILE TRANSFER OPERATIONS ==============

    private createUploadTool(): McpTool {
        return {
            name: 'sftp_upload',
            description: `Upload a local file to a remote server via SFTP.

⚠️ IMPORTANT: Use these exact parameter names:
  • localPath (required): Absolute path to the local file to upload
  • remotePath (required): Destination path on the remote server
  • sync (optional): Wait for completion (default: true)

Example: { "localPath": "/home/user/file.txt", "remotePath": "/tmp/uploaded.txt" }

Max upload size is configurable in Tabby Settings → MCP → SFTP.`,
            schema: z.object({
                ...this.sessionSchema,
                localPath: z.string().describe('REQUIRED: Absolute path to local file (e.g., /home/user/file.txt)'),
                remotePath: z.string().describe('REQUIRED: Remote destination path (e.g., /tmp/uploaded.txt)'),
                sync: z.boolean().optional().describe('Wait for completion, default true. Set false to get transferId for async tracking')
            }),
            handler: async (params: {
                sessionId?: string; tabIndex?: number; title?: string;
                localPath: string; remotePath: string; sync?: boolean
            }) => {
                this.logger.info(`[sftp_upload] Called: localPath=${params.localPath}, remotePath=${params.remotePath}, sync=${params.sync !== false}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_upload] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }
                this.logger.debug(`[sftp_upload] Using session: ${session.sessionId}`);

                // Check local file exists
                if (!fs.existsSync(params.localPath)) {
                    this.logger.warn(`[sftp_upload] Local file not found: ${params.localPath}`);
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false, error: `Local file not found: ${params.localPath}`
                            })
                        }]
                    };
                }

                const stats = fs.statSync(params.localPath);
                const maxSize = this.config.store.mcp?.sftp?.maxUploadSize || 10 * 1024 * 1024;

                if (stats.size > maxSize) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: `File too large: ${stats.size} bytes (max: ${maxSize})`,
                                hint: 'Increase max upload size in Settings → MCP → SFTP'
                            })
                        }]
                    };
                }

                const transferId = this.generateTransferId();
                const task: TransferTask = {
                    id: transferId,
                    type: 'upload',
                    localPath: params.localPath,
                    remotePath: params.remotePath,
                    sessionId: session.sessionId,
                    connectionName: session.tab.title || 'SSH Connection',
                    status: 'pending',
                    progress: 0,
                    bytesTransferred: 0,
                    totalBytes: stats.size,
                    startTime: Date.now()
                };
                this.transferTasks.set(transferId, task);
                this._transferTasksSubject.next(Array.from(this.transferTasks.values()));
                this.cleanupOldTransfers();

                const sync = params.sync !== false;

                const doUpload = async () => {
                    task.status = 'running';
                    this.emitTransferUpdate();
                    let fileUpload: StreamFileUpload | undefined;
                    try {
                        const sftpSession = await this.getSFTPSession(session.tab);
                        if (!sftpSession) {
                            throw new Error('Could not open SFTP session');
                        }

                        // Bind cancel callback to force close session on user cancel
                        task.cancelCallback = () => {
                            this.logger.warn(`[SFTP] Force cancelling upload: ${transferId}`);
                            try {
                                if (fileUpload) fileUpload.cancel();
                                sftpSession.end();
                            } catch (e) {
                                this.logger.error('[SFTP] Error cancelling upload:', e);
                            }
                        };

                        // Use Tabby's official SFTP API (russh-based)
                        fileUpload = new StreamFileUpload(
                            params.localPath,
                            stats.size,
                            (bytes: number) => {
                                task.bytesTransferred = bytes;
                                task.progress = Math.round((bytes / task.totalBytes) * 100);
                                task.speed = bytes / ((Date.now() - task.startTime) / 1000);
                            }
                        );

                        // Wrap with polling fallback to handle Tabby SFTP API not resolving
                        // Also pass sshSession to detect connection loss during transfer
                        const sshSession = (session.tab as any).sshSession;
                        const uploadPromise = sftpSession.upload(params.remotePath, fileUpload);
                        const result = await this.waitForTransferComplete(uploadPromise, fileUpload, sshSession);

                        if (result === 'completed_via_polling') {
                            this.logger.info(`[sftp_upload] Transfer completed via polling fallback`);
                        }

                        task.status = 'completed';
                        task.progress = 100;
                        task.bytesTransferred = task.totalBytes;
                        task.endTime = Date.now();
                        this.emitTransferUpdate();
                    } catch (error: any) {
                        task.status = 'failed';
                        task.error = error.message || String(error);
                        task.endTime = Date.now();
                        this.emitTransferUpdate();

                        // Try to cancel/close if running
                        if (fileUpload) {
                            fileUpload.cancel();
                        }

                        throw error;
                    } finally {
                        // Ensure file descriptor is closed
                        if (fileUpload) {
                            fileUpload.close();
                        }
                    }
                };

                if (sync) {
                    try {
                        await doUpload();
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true,
                                    transferId,
                                    localPath: params.localPath,
                                    remotePath: params.remotePath,
                                    bytesTransferred: task.bytesTransferred,
                                    duration: task.endTime! - task.startTime
                                })
                            }]
                        };
                    } catch (error: any) {
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: false, transferId, error: error.message || String(error)
                                })
                            }]
                        };
                    }
                } else {
                    // Async mode - start upload in background
                    doUpload().catch(e => this.logger.error('Async upload failed:', e));
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true,
                                async: true,
                                transferId,
                                message: 'Upload started. Use sftp_get_transfer_status to check progress.'
                            })
                        }]
                    };
                }
            }
        };
    }

    private createDownloadTool(): McpTool {
        return {
            name: 'sftp_download',
            description: `Download a remote file to local path via SFTP.

⚠️ IMPORTANT: Use these exact parameter names:
  • remotePath (required): Path to the file on the remote server
  • localPath (required): Absolute path for local destination
  • sync (optional): Wait for completion (default: true)

Example: { "remotePath": "/tmp/remote.txt", "localPath": "/home/user/downloaded.txt" }

Max download size is configurable in Tabby Settings → MCP → SFTP.`,
            schema: z.object({
                ...this.sessionSchema,
                remotePath: z.string().describe('REQUIRED: Remote file path to download (e.g., /tmp/remote.txt)'),
                localPath: z.string().describe('REQUIRED: Local destination path, must be absolute (e.g., /home/user/file.txt)'),
                sync: z.boolean().optional().describe('Wait for completion, default true. Set false to get transferId for async tracking')
            }),
            handler: async (params: {
                sessionId?: string; tabIndex?: number; title?: string;
                remotePath: string; localPath: string; sync?: boolean
            }) => {
                this.logger.info(`[sftp_download] Called: remotePath=${params.remotePath}, localPath=${params.localPath}, sync=${params.sync !== false}`);
                const session = this.findSSHSession(params);
                if (!session) {
                    this.logger.warn('[sftp_download] No SSH session found');
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No SSH session found' }) }] };
                }
                this.logger.debug(`[sftp_download] Using session: ${session.sessionId}`);

                try {
                    const sftp = await this.getSFTPSession(session.tab);
                    if (!sftp) {
                        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Could not open SFTP session' }) }] };
                    }

                    // Check remote file size
                    let remoteStats;
                    try {
                        remoteStats = await sftp.stat(params.remotePath);
                    } catch (error: any) {
                        if (error.code === 'ENOENT' || error.message?.includes('No such file')) {
                            return {
                                content: [{
                                    type: 'text', text: JSON.stringify({
                                        success: false,
                                        error: `Remote file not found: ${params.remotePath}`
                                    })
                                }]
                            };
                        }
                        throw error;
                    }

                    const maxSize = this.config.store.mcp?.sftp?.maxDownloadSize || 10 * 1024 * 1024;

                    if (remoteStats.size > maxSize) {
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: false,
                                    error: `File too large: ${remoteStats.size} bytes (max: ${maxSize})`,
                                    hint: 'Increase max download size in Settings → MCP → SFTP'
                                })
                            }]
                        };
                    }

                    // Ensure local directory exists
                    const localDir = path.dirname(params.localPath);
                    if (!fs.existsSync(localDir)) {
                        fs.mkdirSync(localDir, { recursive: true });
                    }

                    const transferId = this.generateTransferId();
                    const task: TransferTask = {
                        id: transferId,
                        type: 'download',
                        localPath: params.localPath,
                        remotePath: params.remotePath,
                        sessionId: session.sessionId,
                        connectionName: session.tab.title || 'SSH Connection',
                        status: 'pending',
                        progress: 0,
                        bytesTransferred: 0,
                        totalBytes: remoteStats.size,
                        startTime: Date.now()
                    };
                    this.transferTasks.set(transferId, task);
                    this._transferTasksSubject.next(Array.from(this.transferTasks.values()));
                    this.cleanupOldTransfers();

                    const sync = params.sync !== false;

                    const doDownload = async () => {
                        task.status = 'running';
                        this.emitTransferUpdate();
                        let fileDownload: StreamFileDownload | undefined;
                        try {
                            const sftpSession = await this.getSFTPSession(session.tab);
                            if (!sftpSession) {
                                throw new Error('Could not open SFTP session');
                            }

                            // Bind cancel callback to force close session on user cancel
                            task.cancelCallback = () => {
                                this.logger.warn(`[SFTP] Force cancelling download: ${transferId}`);
                                try {
                                    if (fileDownload) fileDownload.cancel();
                                    sftpSession.end();
                                } catch (e) {
                                    this.logger.error('[SFTP] Error cancelling download:', e);
                                }
                            };

                            // Use Tabby's official SFTP API (russh-based)
                            fileDownload = new StreamFileDownload(
                                params.localPath,
                                remoteStats.size,
                                (bytes: number) => {
                                    task.bytesTransferred = bytes;
                                    task.progress = Math.round((bytes / task.totalBytes) * 100);
                                    task.speed = bytes / ((Date.now() - task.startTime) / 1000);
                                }
                            );

                            // Wrap with polling fallback to handle Tabby SFTP API not resolving
                            // Also pass sshSession to detect connection loss during transfer
                            const sshSession = (session.tab as any).sshSession;
                            const downloadPromise = sftpSession.download(params.remotePath, fileDownload);
                            const result = await this.waitForTransferComplete(downloadPromise, fileDownload, sshSession);

                            if (result === 'completed_via_polling') {
                                this.logger.info(`[sftp_download] Transfer completed via polling fallback`);
                            }

                            task.status = 'completed';
                            task.progress = 100;
                            task.bytesTransferred = task.totalBytes;
                            task.endTime = Date.now();
                            this.emitTransferUpdate();
                        } catch (error: any) {
                            task.status = 'failed';
                            task.error = error.message || String(error);
                            task.endTime = Date.now();
                            this.emitTransferUpdate();

                            // Try to cancel/close if running
                            if (fileDownload) {
                                fileDownload.cancel();
                            }

                            throw error;
                        } finally {
                            // Ensure file descriptor is closed
                            if (fileDownload) {
                                fileDownload.close();
                            }
                        }
                    };

                    if (sync) {
                        await doDownload();
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true,
                                    transferId,
                                    remotePath: params.remotePath,
                                    localPath: params.localPath,
                                    bytesTransferred: task.bytesTransferred,
                                    duration: task.endTime! - task.startTime
                                })
                            }]
                        };
                    } else {
                        doDownload().catch(e => this.logger.error('Async download failed:', e));
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true,
                                    async: true,
                                    transferId,
                                    message: 'Download started. Use sftp_get_transfer_status to check progress.'
                                })
                            }]
                        };
                    }
                } catch (error: any) {
                    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message || String(error) }) }] };
                }
            }
        };
    }

    private createGetTransferStatusTool(): McpTool {
        return {
            name: 'sftp_get_transfer_status',
            description: 'Get status and progress of a file transfer task.',
            schema: z.object({
                transferId: z.string().describe('Transfer task ID from sftp_upload/sftp_download')
            }),
            handler: async (params: { transferId: string }) => {
                const task = this.transferTasks.get(params.transferId);
                if (!task) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false, error: 'Transfer not found', transferId: params.transferId
                            })
                        }]
                    };
                }

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            transferId: task.id,
                            type: task.type,
                            status: task.status,
                            progress: task.progress,
                            bytesTransferred: task.bytesTransferred,
                            totalBytes: task.totalBytes,
                            speed: task.speed,
                            localPath: task.localPath,
                            remotePath: task.remotePath,
                            startTime: new Date(task.startTime).toISOString(),
                            endTime: task.endTime ? new Date(task.endTime).toISOString() : undefined,
                            duration: task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime,
                            error: task.error
                        })
                    }]
                };
            }
        };
    }

    private createListTransfersTool(): McpTool {
        return {
            name: 'sftp_list_transfers',
            description: 'List all active and recent file transfers.',
            schema: z.object({
                status: z.enum(['all', 'active', 'completed', 'failed']).optional().describe('Filter by status')
            }),
            handler: async (params: { status?: string }) => {
                let tasks = Array.from(this.transferTasks.values());

                if (params.status && params.status !== 'all') {
                    if (params.status === 'active') {
                        tasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
                    } else {
                        tasks = tasks.filter(t => t.status === params.status);
                    }
                }

                // Sort by start time descending
                tasks.sort((a, b) => b.startTime - a.startTime);

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            count: tasks.length,
                            transfers: tasks.map(t => ({
                                id: t.id,
                                type: t.type,
                                status: t.status,
                                progress: t.progress,
                                localPath: t.localPath,
                                remotePath: t.remotePath,
                                bytesTransferred: t.bytesTransferred,
                                totalBytes: t.totalBytes
                            }))
                        }, null, 2)
                    }]
                };
            }
        };
    }

    private createCancelTransferTool(): McpTool {
        return {
            name: 'sftp_cancel_transfer',
            description: 'Cancel an active file transfer.',
            schema: z.object({
                transferId: z.string().describe('Transfer task ID to cancel')
            }),
            handler: async (params: { transferId: string }) => {
                const task = this.transferTasks.get(params.transferId);
                if (!task) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false, error: 'Transfer not found'
                            })
                        }]
                    };
                }

                if (task.status !== 'pending' && task.status !== 'running') {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false, error: `Cannot cancel transfer in status: ${task.status}`
                            })
                        }]
                    };
                }

                task.status = 'cancelled';
                task.endTime = Date.now();

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            transferId: params.transferId,
                            message: 'Transfer cancelled'
                        })
                    }]
                };
            }
        };
    }
}

/**
 * Stream-based FileUpload adapter for SFTP upload
 * Reads file in chunks to prevent OOM on large files
 */
class StreamFileUpload {
    private fd: number | null = null;
    private name: string;
    private filePath: string;
    private size: number;
    private position = 0;
    private readonly chunkSize = 64 * 1024; // 64KB chunks
    private onProgress: (bytes: number) => void;
    private cancelled = false;

    constructor(filePath: string, size: number, onProgress?: (bytes: number) => void) {
        this.name = path.basename(filePath);
        this.filePath = filePath;
        this.size = size;
        this.onProgress = onProgress || (() => { });
    }

    open(): void {
        if (this.fd === null) {
            this.fd = fs.openSync(this.filePath, 'r');
        }
    }

    getName(): string { return this.name; }
    getSize(): number { return this.size; }
    getMode(): number { return 0o644; }
    getCompletedBytes(): number { return this.position; }
    isComplete(): boolean { return this.position >= this.size; }
    isCancelled(): boolean { return this.cancelled; }

    cancel(): void {
        this.cancelled = true;
        this.close();
    }

    async read(): Promise<Uint8Array> {
        if (this.cancelled) throw new Error('Transfer cancelled');
        if (this.fd === null) this.open();

        if (this.position >= this.size) {
            return new Uint8Array(0);
        }

        const buffer = Buffer.alloc(this.chunkSize);
        const bytesRead = fs.readSync(this.fd!, buffer, 0, this.chunkSize, this.position);

        if (bytesRead === 0) return new Uint8Array(0);

        this.position += bytesRead;
        this.onProgress(this.position);

        return new Uint8Array(buffer.subarray(0, bytesRead));
    }

    // Required by some SFTP implementations
    async readAll(): Promise<Uint8Array> {
        throw new Error('readAll not supported for stream upload (file too large)');
    }

    close(): void {
        if (this.fd !== null) {
            try {
                fs.closeSync(this.fd);
            } catch (e) {
                // Ignore close errors
            }
            this.fd = null;
        }
    }
}

/**
 * Stream-based FileDownload adapter for SFTP download
 * Writes file in chunks to prevent OOM and enable immediate disk persistence
 */
class StreamFileDownload {
    private fd: number | null = null;
    private name: string;
    private filePath: string;
    private expectedSize: number;
    private bytesReceived = 0;
    private onProgress: (bytes: number) => void;
    private cancelled = false;

    constructor(filePath: string, size: number, onProgress?: (bytes: number) => void) {
        this.name = path.basename(filePath);
        this.filePath = filePath;
        this.expectedSize = size;
        this.onProgress = onProgress || (() => { });
    }

    open(): void {
        if (this.fd === null) {
            // Ensure directory exists
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Open for writing, create if not exists, truncate if exists
            this.fd = fs.openSync(this.filePath, 'w');
        }
    }

    getName(): string { return this.name; }
    getSize(): number { return this.expectedSize; }
    getMode(): number { return 0o644; }
    getCompletedBytes(): number { return this.bytesReceived; }
    isComplete(): boolean { return this.bytesReceived >= this.expectedSize; }
    isCancelled(): boolean { return this.cancelled; }

    cancel(): void {
        this.cancelled = true;
        this.close();
    }

    async write(buffer: Uint8Array): Promise<void> {
        if (this.cancelled) throw new Error('Transfer cancelled');
        if (this.fd === null) this.open();

        fs.writeSync(this.fd!, buffer);
        this.bytesReceived += buffer.length;
        this.onProgress(this.bytesReceived);
    }

    // Deprecated: No longer needed as we write correctly to disk
    getData(): Uint8Array {
        return new Uint8Array(0);
    }

    close(): void {
        if (this.fd !== null) {
            try {
                fs.closeSync(this.fd);
            } catch (e) {
                // Ignore close errors
            }
            this.fd = null;
        }
    }
}
