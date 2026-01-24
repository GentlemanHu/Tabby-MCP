import { Injectable } from '@angular/core';
import { AppService, BaseTabComponent, ConfigService, SplitTabComponent } from 'tabby-core';
import { BaseTerminalTabComponent, XTermFrontend } from 'tabby-terminal';
import { SerializeAddon } from '@xterm/addon-serialize';
import { BehaviorSubject } from 'rxjs';
import { z } from 'zod';
import { BaseToolCategory } from './base-tool-category';
import { McpLoggerService } from '../services/mcpLogger.service';
import { DialogService } from '../services/dialog.service';
import { McpTool, ActiveCommand, CommandResult, EnhancedTerminalSession, SessionLocator } from '../types/types';

/**
 * Terminal session with stable ID for tracking
 * Enhanced to support split pane identification
 */
export interface TerminalSessionWithTab {
    sessionId: string;        // Stable UUID (unique per pane)
    tabIndex: number;         // Global index across all panes
    tabParent: BaseTabComponent;  // The actual tab (may be SplitTabComponent)
    tab: BaseTerminalTabComponent;  // The terminal component

    // Split pane information
    isSplit: boolean;         // Is this pane inside a SplitTabComponent?
    splitTabIndex?: number;   // Index of the parent SplitTabComponent in app.tabs
    paneIndex?: number;       // Index within the SplitTabComponent (0, 1, 2, ...)
    totalPanes?: number;      // Total panes in the split
    isFocusedPane?: boolean;  // Is this the focused pane in the split?
}

/**
 * Terminal Tools Category - Commands for terminal control
 * Enhanced with stable session IDs and flexible session targeting
 */
@Injectable({ providedIn: 'root' })
export class TerminalToolCategory extends BaseToolCategory {
    name = 'terminal';

    // Session registry for stable IDs (UUID per tab)
    private tabToSessionId = new WeakMap<BaseTerminalTabComponent, string>();

    // Active commands tracked by sessionId
    private _activeCommands = new Map<string, ActiveCommand>();
    private _activeCommandsSubject = new BehaviorSubject<Map<string, ActiveCommand>>(new Map());

    // Shell type cache per session (avoids repeated detection)
    private shellTypeCache = new Map<string, 'bash' | 'zsh' | 'fish' | 'sh'>();

    public readonly activeCommands$ = this._activeCommandsSubject.asObservable();

    constructor(
        private app: AppService,
        logger: McpLoggerService,
        private config: ConfigService,
        private dialogService: DialogService
    ) {
        super(logger);
        this.initializeTools();
    }

    /**
     * Initialize all terminal tools
     */
    private initializeTools(): void {
        this.registerTool(this.createGetSessionListTool());
        this.registerTool(this.createExecCommandTool());
        this.registerTool(this.createSendInputTool());
        this.registerTool(this.createGetTerminalBufferTool());
        this.registerTool(this.createAbortCommandTool());
        this.registerTool(this.createGetCommandStatusTool());
        this.registerTool(this.createFocusPaneTool());

        this.logger.info('Terminal tools initialized');
    }

    /**
     * Get or create a stable session ID for a tab
     * Made public for cross-category access (e.g., from TabManagementToolCategory)
     */
    public getOrCreateSessionId(tab: BaseTerminalTabComponent): string {
        let sessionId = this.tabToSessionId.get(tab);
        if (!sessionId) {
            // Generate UUID
            sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            this.tabToSessionId.set(tab, sessionId);
        }
        return sessionId;
    }

    /**
     * Detect shell type from terminal session info
     * Used to generate shell-compatible command wrappers
     * 
     * Detection priority:
     * 1. Cached result (if previously detected)
     * 2. Terminal buffer analysis (most accurate for active sessions)
     * 3. Profile type/name hints
     * 4. Terminal title hints
     * 5. Default to 'sh' (POSIX fallback)
     */
    private detectShellType(session: TerminalSessionWithTab): 'bash' | 'zsh' | 'fish' | 'sh' {
        // Step 1: Check cache first
        const cached = this.shellTypeCache.get(session.sessionId);
        if (cached) {
            this.logger.debug(`Shell type from cache: ${cached} for session ${session.sessionId}`);
            return cached;
        }

        const tabAny = session.tab as any;

        // Step 2: Analyze terminal buffer for shell-specific patterns
        // This is the most reliable method for connected sessions
        try {
            const buffer = this.getTerminalBufferText(session);
            if (buffer && buffer.length > 0) {
                // Fish-specific patterns
                // - Welcome message: "Welcome to fish"
                // - Error message when using $?: "fish: $? is not the exit status"
                // - Fish version info: "fish, version X.Y.Z"
                // - Fish default prompts: ❯, ⏎, or specific fish greeting
                const fishBufferPatterns = [
                    /Welcome to fish/i,
                    /fish:.*\$\? is not the exit status/i,
                    /fish,?\s*version/i,
                    /In fish, please use \$status/i,
                    /❯\s*$/m,  // Fish default prompt character
                ];

                for (const pattern of fishBufferPatterns) {
                    if (pattern.test(buffer)) {
                        this.logger.info(`Detected fish shell from buffer pattern: ${pattern}`);
                        this.shellTypeCache.set(session.sessionId, 'fish');
                        return 'fish';
                    }
                }

                // Bash-specific patterns
                const bashBufferPatterns = [
                    /bash.*version/i,
                    /GNU bash/i,
                ];
                for (const pattern of bashBufferPatterns) {
                    if (pattern.test(buffer)) {
                        this.logger.info(`Detected bash shell from buffer pattern`);
                        this.shellTypeCache.set(session.sessionId, 'bash');
                        return 'bash';
                    }
                }

                // Zsh-specific patterns
                const zshBufferPatterns = [
                    /zsh.*version/i,
                    /oh-my-zsh/i,
                ];
                for (const pattern of zshBufferPatterns) {
                    if (pattern.test(buffer)) {
                        this.logger.info(`Detected zsh shell from buffer pattern`);
                        this.shellTypeCache.set(session.sessionId, 'zsh');
                        return 'zsh';
                    }
                }
            }
        } catch (e) {
            this.logger.debug(`Buffer analysis failed, falling back to profile/title hints`);
        }

        // Step 3: Check profile info (fallback)
        const profileName = tabAny.profile?.name || '';
        const profileType = tabAny.profile?.type || '';
        const profileOptions = tabAny.profile?.options || {};
        const shellPath = profileOptions.shell || profileOptions.command || '';
        const allProfileText = `${profileName} ${profileType} ${shellPath}`.toLowerCase();

        const fishPatterns = [/\bfish\b/i, /fish$/i];
        const zshPatterns = [/\bzsh\b/i, /zsh$/i];
        const bashPatterns = [/\bbash\b/i, /bash$/i];

        if (fishPatterns.some(p => p.test(allProfileText))) {
            this.logger.debug(`Detected fish shell from profile: ${profileName}`);
            this.shellTypeCache.set(session.sessionId, 'fish');
            return 'fish';
        }
        if (zshPatterns.some(p => p.test(allProfileText))) {
            this.logger.debug(`Detected zsh shell from profile: ${profileName}`);
            this.shellTypeCache.set(session.sessionId, 'zsh');
            return 'zsh';
        }
        if (bashPatterns.some(p => p.test(allProfileText))) {
            this.logger.debug(`Detected bash shell from profile: ${profileName}`);
            this.shellTypeCache.set(session.sessionId, 'bash');
            return 'bash';
        }

        // Step 4: Check terminal title (last resort)
        const title = session.tab.title || '';
        if (fishPatterns.some(p => p.test(title))) {
            this.logger.debug(`Detected fish shell from title: ${title}`);
            this.shellTypeCache.set(session.sessionId, 'fish');
            return 'fish';
        }
        if (zshPatterns.some(p => p.test(title))) {
            this.logger.debug(`Detected zsh shell from title: ${title}`);
            this.shellTypeCache.set(session.sessionId, 'zsh');
            return 'zsh';
        }
        if (bashPatterns.some(p => p.test(title))) {
            this.logger.debug(`Detected bash shell from title: ${title}`);
            this.shellTypeCache.set(session.sessionId, 'bash');
            return 'bash';
        }

        // Step 5: Default to 'sh' (POSIX compatible - safest fallback)
        this.logger.debug(`Shell type unknown, defaulting to sh (POSIX) for session ${session.sessionId}`);
        // Don't cache unknown - allow re-detection on next command
        return 'sh';
    }



    /**
     * Generate shell-compatible wrapped command for output capture
     * 
     * CRITICAL: Commands are wrapped in `eval` to ensure that syntax errors
     * in the user command do NOT prevent the end marker from being printed.
     * Without eval, a syntax error causes the shell to reject the entire line,
     * including our end marker, causing the MCP server to hang until timeout.
     * 
     * Different shells use different syntax:
     * - bash/zsh/sh: eval '...' with single-quote escaping, $? for exit code
     * - fish: eval "..." with backslash escaping, $status for exit code
     */
    private getWrappedCommand(
        command: string,
        startMarker: string,
        endMarker: string,
        shellType: 'bash' | 'zsh' | 'fish' | 'sh'
    ): string {
        switch (shellType) {
            case 'fish':
                // Fish shell: use $status instead of $?, eval with double quotes
                // Fish escaping: \ escapes " and \ inside double quotes
                const fishEscaped = command
                    .replace(/\\/g, '\\\\')  // Escape backslashes first
                    .replace(/"/g, '\\"');   // Escape double quotes
                return `echo "${startMarker}"; eval "${fishEscaped}"; set -l __mcp_exit $status; echo "${endMarker} $__mcp_exit"`;

            case 'bash':
            case 'zsh':
            case 'sh':
            default:
                // Bash/Zsh/POSIX: wrap in eval to catch syntax errors
                // Use single quotes to prevent premature variable expansion
                // Escape strategy: ' -> '\'' (close quote, escaped quote, open quote)
                const escaped = command.replace(/'/g, "'\\''");
                return `echo "${startMarker}" && eval '${escaped}' ; echo "${endMarker} $?"`;
        }
    }

    /**
     * Find session by flexible locator
     * Priority: sessionId > tabIndex > title > profileName
     * If no locator is provided, returns the currently active/focused session
     */
    public findSessionByLocator(locator: SessionLocator): TerminalSessionWithTab | null {
        const sessions = this.findTerminalSessions();

        // If no locator parameters provided, return the currently active session
        if (!locator.sessionId && locator.tabIndex === undefined && !locator.title && !locator.profileName) {
            // First try to find the focused pane in a split
            const focusedSession = sessions.find(s => s.isFocusedPane === true);
            if (focusedSession) return focusedSession;

            // Otherwise return the first session (most recently used)
            return sessions[0] || null;
        }

        // Priority 1: sessionId (stable, recommended)
        if (locator.sessionId) {
            const found = sessions.find(s => s.sessionId === locator.sessionId);
            if (found) return found;
        }

        // Priority 2: tabIndex (legacy, may change)
        if (locator.tabIndex !== undefined) {
            const found = sessions.find(s => s.tabIndex === locator.tabIndex);
            if (found) return found;
        }

        // Priority 3: title (partial, case-insensitive)
        if (locator.title) {
            const titleLower = locator.title.toLowerCase();
            const found = sessions.find(s =>
                s.tab.title?.toLowerCase().includes(titleLower)
            );
            if (found) return found;
        }

        // Priority 4: profileName (partial, case-insensitive)
        if (locator.profileName) {
            const nameLower = locator.profileName.toLowerCase();
            const found = sessions.find(s => {
                const profile = (s.tab as any).profile;
                return profile?.name?.toLowerCase().includes(nameLower);
            });
            if (found) return found;
        }

        return null;
    }

    /**
     * Tool: Get list of terminal sessions with enhanced metadata
     * Now includes detailed split pane information
     */
    private createGetSessionListTool(): McpTool {
        return {
            name: 'get_session_list',
            description: `Get list of all terminal sessions with stable IDs and metadata.
Use sessionId (stable UUID) for reliable session targeting.

For split panes:
- isSplit: true if this session is inside a split tab
- splitTabIndex: Index of parent tab (use for grouping panes)
- paneIndex: Position within the split (0, 1, 2, ...)
- totalPanes: Number of panes in the split
- isFocusedPane: Whether this is the currently focused pane`,
            schema: z.object({}),
            handler: async () => {
                const sessions = this.findTerminalSessions();
                const result = sessions.map(s => {
                    const tabAny = s.tab as any;
                    return {
                        sessionId: s.sessionId,
                        tabIndex: s.tabIndex,
                        title: s.tab.title || `Terminal ${s.tabIndex}`,
                        type: s.tab.constructor.name,
                        isActive: this.app.activeTab === s.tabParent,
                        hasActiveCommand: this._activeCommands.has(s.sessionId),
                        profile: tabAny.profile ? {
                            id: tabAny.profile.id,
                            name: tabAny.profile.name,
                            type: tabAny.profile.type
                        } : undefined,
                        pid: tabAny.session?.pty?.pid,
                        cwd: tabAny.session?.cwd,
                        // Split pane information
                        isSplit: s.isSplit,
                        splitTabIndex: s.splitTabIndex,
                        paneIndex: s.paneIndex,
                        totalPanes: s.totalPanes,
                        isFocusedPane: s.isFocusedPane
                    };
                });

                this.logger.info(`Found ${result.length} terminal sessions`);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
        };
    }

    /**
     * Tool: Execute command in terminal
     * Enhanced with flexible session targeting
     */
    private createExecCommandTool(): McpTool {
        return {
            name: 'exec_command',
            description: `Execute a command in a terminal session.
Session targeting (priority order): sessionId > tabIndex > title > profileName
- sessionId: Stable UUID (recommended, use get_session_list to get IDs)
- tabIndex: Array index (legacy, may change if tabs are reordered)
- title: Match by terminal title (partial, case-insensitive)
- profileName: Match by profile name (partial, case-insensitive)

For interactive/paging commands (less, vim, top), set waitForOutput=false.
For long-running commands, increase timeout or use waitForOutput=false and poll with get_terminal_buffer.`,
            schema: z.object({
                command: z.string().describe('Command to execute'),
                sessionId: z.string().optional().describe('Stable session ID (recommended, from get_session_list)'),
                tabIndex: z.number().optional().describe('Tab index (legacy, may change if tabs reorder)'),
                title: z.string().optional().describe('Match session by title (partial, case-insensitive)'),
                profileName: z.string().optional().describe('Match session by profile name (partial, case-insensitive)'),
                waitForOutput: z.boolean().optional().describe('Wait for command completion (default: true). Set false for interactive commands.'),
                timeout: z.number().optional().describe('Timeout in ms (default: 30000, max: 300000)')
            }),
            handler: async (params: {
                command: string;
                sessionId?: string;
                tabIndex?: number;
                title?: string;
                profileName?: string;
                waitForOutput?: boolean;
                timeout?: number;
            }) => {
                const { command, sessionId, tabIndex, title, profileName, waitForOutput = true, timeout: rawTimeout = 30000 } = params;
                const timeout = Math.min(rawTimeout, 300000); // Max 5 minutes

                // Find session using locator
                const session = this.findSessionByLocator({ sessionId, tabIndex, title, profileName });

                if (!session) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: 'No matching terminal session found',
                                hint: 'Use get_session_list to see available sessions with their sessionIds'
                            })
                        }]
                    };
                }

                // Check pair programming mode
                if (this.config.store.mcp?.pairProgrammingMode?.enabled) {
                    if (this.config.store.mcp?.pairProgrammingMode?.showConfirmationDialog) {
                        const confirmed = await this.dialogService.showCommandConfirmation(command, session.tabIndex);
                        if (!confirmed) {
                            return {
                                content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Command rejected by user' }) }]
                            };
                        }
                    }
                }

                try {
                    // Focus terminal ONLY if background execution is disabled
                    // Background mode allows AI to work on tabs without disturbing user's current focus
                    const backgroundMode = this.config.store.mcp?.backgroundExecution?.enabled ?? false;
                    if (!backgroundMode) {
                        this.app.selectTab(session.tabParent);
                        // For split panes, also focus the specific pane
                        if (session.isSplit && session.tabParent instanceof SplitTabComponent) {
                            (session.tabParent as SplitTabComponent).focus(session.tab);
                        }
                    }

                    // For non-waiting mode, just send the command
                    if (!waitForOutput) {
                        session.tab.sendInput(command + '\n');
                        this.logger.info(`Sent command (async): ${command} in session ${session.sessionId}`);
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true,
                                    sessionId: session.sessionId,
                                    message: 'Command sent (not waiting for output)',
                                    hint: 'Use get_terminal_buffer with same sessionId to check output'
                                })
                            }]
                        };
                    }

                    // Generate unique markers
                    const timestamp = Date.now();
                    const startMarker = `__MCP_START_${timestamp}__`;
                    const endMarker = `__MCP_END_${timestamp}__`;

                    // Track active command
                    let aborted = false;
                    const activeCommand: ActiveCommand = {
                        tabId: session.tabIndex,
                        command,
                        timestamp,
                        startMarker,
                        endMarker,
                        abort: () => { aborted = true; }
                    };
                    this._activeCommands.set(session.sessionId, activeCommand);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));

                    // Send command with markers - use shell-aware wrapper
                    const detectedShell = this.detectShellType(session);
                    const wrappedCommand = this.getWrappedCommand(command, startMarker, endMarker, detectedShell);
                    session.tab.sendInput(wrappedCommand + '\n');

                    this.logger.info(`Executing command: ${command} in session ${session.sessionId} (shell: ${detectedShell})`);

                    // Wait for output
                    const result = await this.waitForCommandOutput(session, startMarker, endMarker, timeout, () => aborted);

                    // Clean up active command
                    this._activeCommands.delete(session.sessionId);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));

                    // Add sessionId to result for reference
                    return { content: [{ type: 'text', text: JSON.stringify({ ...result, sessionId: session.sessionId }) }] };
                } catch (error: any) {
                    this._activeCommands.delete(session.sessionId);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));

                    this.logger.error('Command execution error:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }

    /**
     * Tool: Send raw input to terminal (for interactive commands)
     */
    private createSendInputTool(): McpTool {
        return {
            name: 'send_input',
            description: `Send raw input to a terminal. Use this for interactive commands like vim, less, top, etc.
Session targeting: sessionId (recommended) > tabIndex > title > profileName
Special keys: \\x03 (Ctrl+C), \\x04 (Ctrl+D), \\x1b (Escape), \\r (Enter)`,
            schema: z.object({
                input: z.string().describe('Input to send (can include special characters like \\n, \\x03 for Ctrl+C)'),
                sessionId: z.string().optional().describe('Stable session ID (recommended)'),
                tabIndex: z.number().optional().describe('Tab index (legacy)'),
                title: z.string().optional().describe('Match by title'),
                profileName: z.string().optional().describe('Match by profile name')
            }),
            handler: async (params: { input: string; sessionId?: string; tabIndex?: number; title?: string; profileName?: string }) => {
                const { input, sessionId, tabIndex, title, profileName } = params;

                const session = this.findSessionByLocator({ sessionId, tabIndex, title, profileName });

                if (!session) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: 'No matching terminal session found',
                                hint: 'Use get_session_list to see available sessions'
                            })
                        }]
                    };
                }

                // Process escape sequences
                const processedInput = input
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

                session.tab.sendInput(processedInput);
                this.logger.info(`Sent input to session ${session.sessionId}: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`);

                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: session.sessionId, message: 'Input sent' }) }]
                };
            }
        };
    }

    /**
     * Tool: Get terminal buffer content
     */
    private createGetTerminalBufferTool(): McpTool {
        return {
            name: 'get_terminal_buffer',
            description: `Get the content of a terminal buffer. Use this to check command output after using send_input or async exec_command.
Session targeting: sessionId (recommended) > tabIndex > title > profileName`,
            schema: z.object({
                sessionId: z.string().optional().describe('Stable session ID (recommended)'),
                tabIndex: z.number().optional().describe('Tab index (legacy)'),
                title: z.string().optional().describe('Match by title'),
                profileName: z.string().optional().describe('Match by profile name'),
                lastNLines: z.number().optional().describe('Get only the last N lines (default: all)'),
                startLine: z.number().optional().describe('Start line (0-indexed)'),
                endLine: z.number().optional().describe('End line (exclusive)')
            }),
            handler: async (params: {
                sessionId?: string;
                tabIndex?: number;
                title?: string;
                profileName?: string;
                lastNLines?: number;
                startLine?: number;
                endLine?: number;
            }) => {
                const { sessionId, tabIndex, title, profileName, lastNLines, startLine, endLine } = params;

                const session = this.findSessionByLocator({ sessionId, tabIndex, title, profileName });

                if (!session) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: 'No matching terminal session found',
                                hint: 'Use get_session_list to see available sessions'
                            })
                        }]
                    };
                }

                const bufferContent = this.getTerminalBufferText(session);
                const lines = bufferContent.split('\n');

                let selectedLines: string[];
                if (lastNLines !== undefined) {
                    selectedLines = lines.slice(-lastNLines);
                } else {
                    const start = startLine ?? 0;
                    const end = endLine ?? lines.length;
                    selectedLines = lines.slice(start, end);
                }

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            sessionId: session.sessionId,
                            tabIndex: session.tabIndex,
                            totalLines: lines.length,
                            returnedLines: selectedLines.length,
                            content: selectedLines.join('\n')
                        })
                    }]
                };
            }
        };
    }

    /**
     * Tool: Abort running command
     */
    private createAbortCommandTool(): McpTool {
        return {
            name: 'abort_command',
            description: `Abort a running command by sending Ctrl+C.
Session targeting: sessionId (recommended) > tabIndex > title > profileName`,
            schema: z.object({
                sessionId: z.string().optional().describe('Stable session ID (recommended)'),
                tabIndex: z.number().optional().describe('Tab index (legacy)'),
                title: z.string().optional().describe('Match by title'),
                profileName: z.string().optional().describe('Match by profile name')
            }),
            handler: async (params: { sessionId?: string; tabIndex?: number; title?: string; profileName?: string }) => {
                const { sessionId, tabIndex, title, profileName } = params;

                const session = this.findSessionByLocator({ sessionId, tabIndex, title, profileName });

                if (!session) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: 'No matching terminal session found'
                            })
                        }]
                    };
                }

                const activeCommand = this._activeCommands.get(session.sessionId);
                if (activeCommand) {
                    activeCommand.abort();
                    this._activeCommands.delete(session.sessionId);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));
                }

                // Send Ctrl+C
                session.tab.sendInput('\x03');

                this.logger.info(`Aborted command in session ${session.sessionId}`);
                return { content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: session.sessionId, message: 'Ctrl+C sent' }) }] };
            }
        };
    }

    /**
     * Tool: Get status of active commands
     */
    private createGetCommandStatusTool(): McpTool {
        return {
            name: 'get_command_status',
            description: 'Get the status of active/running commands across all terminals',
            schema: z.object({}),
            handler: async () => {
                const activeCommands = Array.from(this._activeCommands.entries()).map(([sessionId, cmd]) => ({
                    sessionId,
                    tabIndex: cmd.tabId,
                    command: cmd.command,
                    startedAt: new Date(cmd.timestamp).toISOString(),
                    runningFor: `${Math.round((Date.now() - cmd.timestamp) / 1000)}s`
                }));

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            activeCommands,
                            count: activeCommands.length
                        }, null, 2)
                    }]
                };
            }
        };
    }

    /**
     * Tool: Focus a specific pane in a split tab
     */
    private createFocusPaneTool(): McpTool {
        return {
            name: 'focus_pane',
            description: `Focus a specific pane in a split terminal tab.
Use sessionId to identify the exact pane to focus.
After focusing, commands sent to that split tab will go to the focused pane.`,
            schema: z.object({
                sessionId: z.string().describe('Session ID of the pane to focus (from get_session_list)')
            }),
            handler: async (params: { sessionId: string }) => {
                const { sessionId } = params;

                const session = this.findSessionByLocator({ sessionId });
                if (!session) {
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: false,
                                error: 'No matching session found'
                            })
                        }]
                    };
                }

                // Check if the session is in a split tab
                if (session.isSplit && session.tabParent instanceof SplitTabComponent) {
                    const splitTab = session.tabParent as SplitTabComponent;
                    splitTab.focus(session.tab);

                    this.logger.info(`Focused pane ${session.paneIndex} in split tab`);
                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true,
                                message: `Focused pane ${session.paneIndex} of ${session.totalPanes}`,
                                sessionId: session.sessionId,
                                paneIndex: session.paneIndex,
                                title: session.tab.title
                            })
                        }]
                    };
                } else {
                    // Not in a split, just select the tab
                    this.app.selectTab(session.tabParent);

                    return {
                        content: [{
                            type: 'text', text: JSON.stringify({
                                success: true,
                                message: 'Selected tab (not a split pane)',
                                sessionId: session.sessionId
                            })
                        }]
                    };
                }
            }
        };
    }

    /**
     * Find all terminal sessions with stable IDs
     * Enhanced to include split pane information
     */
    public findTerminalSessions(): TerminalSessionWithTab[] {
        const sessions: TerminalSessionWithTab[] = [];
        let globalIndex = 0;

        this.app.tabs.forEach((tab: BaseTabComponent, appTabIndex: number) => {
            if (tab instanceof BaseTerminalTabComponent) {
                // Single terminal tab (not in a split)
                const sessionId = this.getOrCreateSessionId(tab);
                sessions.push({
                    sessionId,
                    tabIndex: globalIndex++,
                    tabParent: tab,
                    tab: tab as BaseTerminalTabComponent,
                    isSplit: false
                });
            } else if (tab instanceof SplitTabComponent) {
                // Split tab containing multiple panes
                const splitTab = tab as SplitTabComponent;
                const childTabs = splitTab.getAllTabs().filter(
                    (childTab: BaseTabComponent) => childTab instanceof BaseTerminalTabComponent &&
                        (childTab as BaseTerminalTabComponent).frontend !== undefined
                );
                const focusedTab = splitTab.getFocusedTab();
                const totalPanes = childTabs.length;

                childTabs.forEach((childTab: BaseTabComponent, paneIdx: number) => {
                    const termTab = childTab as BaseTerminalTabComponent;
                    const sessionId = this.getOrCreateSessionId(termTab);
                    sessions.push({
                        sessionId,
                        tabIndex: globalIndex++,
                        tabParent: tab,
                        tab: termTab,
                        isSplit: true,
                        splitTabIndex: appTabIndex,
                        paneIndex: paneIdx,
                        totalPanes: totalPanes,
                        isFocusedPane: childTab === focusedTab
                    });
                });
            }
        });

        return sessions;
    }

    /**
     * Get terminal buffer as text
     */
    private getTerminalBufferText(session: TerminalSessionWithTab): string {
        try {
            const frontend = session.tab.frontend as XTermFrontend;
            if (!frontend) {
                return '';
            }

            // Access xterm through type assertion since it may be private
            const xtermInstance = (frontend as any).xterm;
            if (!xtermInstance) {
                return '';
            }

            // Check if serialize addon is already registered
            let serializeAddon = (xtermInstance as any)._addonManager?._addons?.find(
                (addon: any) => addon.instance instanceof SerializeAddon
            )?.instance;

            if (!serializeAddon) {
                serializeAddon = new SerializeAddon();
                xtermInstance.loadAddon(serializeAddon);
            }

            return serializeAddon.serialize();
        } catch (err) {
            this.logger.error('Error getting terminal buffer:', err);
            return '';
        }
    }

    /**
     * Wait for command output between markers
     * Timing is configurable via Settings → MCP → Timing
     */
    private async waitForCommandOutput(
        session: TerminalSessionWithTab,
        startMarker: string,
        endMarker: string,
        timeout: number,
        isAborted: () => boolean
    ): Promise<CommandResult> {
        const startTime = Date.now();
        let lastBufferLength = 0;
        let stableCount = 0;

        // Get timing config (with fallback defaults)
        const timing = this.config.store.mcp?.timing || {};
        const pollInterval = timing.pollInterval ?? 100;
        const initialDelay = timing.initialDelay ?? 0;

        // Optional initial delay (configurable, default 0)
        if (initialDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, initialDelay));
        }

        while (Date.now() - startTime < timeout) {
            if (isAborted()) {
                return { success: false, output: '', error: 'Command aborted' };
            }

            const buffer = this.getTerminalBufferText(session);

            // Look for end marker with exit code pattern (complete marker)
            // End marker format: __MCP_END_<timestamp>__ <exit_code>
            const endPattern = new RegExp(`${endMarker}\\s+(\\d+)`, 'm');
            const endMatch = buffer.match(endPattern);

            if (endMatch) {
                // Found complete end marker with exit code
                const endIndex = buffer.indexOf(endMatch[0]);
                const startIndex = buffer.lastIndexOf(startMarker, endIndex);

                if (startIndex !== -1 && startIndex < endIndex) {
                    // Extract output between markers
                    let output = buffer.substring(startIndex + startMarker.length, endIndex).trim();

                    // Remove command echo (first line often contains the wrapped command)
                    // Look for the start marker echo line and skip it
                    const lines = output.split('\n');
                    if (lines.length > 0 && lines[0].includes(startMarker.slice(0, 10))) {
                        lines.shift();
                        output = lines.join('\n').trim();
                    }

                    const exitCode = parseInt(endMatch[1], 10);

                    return {
                        success: exitCode === 0,
                        output,
                        exitCode
                    };
                }
            }

            // Track buffer stability (helps detect when output is complete)
            if (buffer.length === lastBufferLength) {
                stableCount++;
            } else {
                stableCount = 0;
                lastBufferLength = buffer.length;
            }

            // Wait between checks (configurable via Settings → MCP → Timing)
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        // On timeout, return partial output if start marker found
        const buffer = this.getTerminalBufferText(session);
        const startIndex = buffer.lastIndexOf(startMarker);
        if (startIndex !== -1) {
            let partialOutput = buffer.substring(startIndex + startMarker.length).trim();

            // Clean up command echo
            const lines = partialOutput.split('\n');
            if (lines.length > 0 && lines[0].includes('&&')) {
                lines.shift();
                partialOutput = lines.join('\n').trim();
            }

            return {
                success: false,
                output: partialOutput,
                error: 'Command timeout (partial output captured)',
                exitCode: -1
            };
        }

        return { success: false, output: '', error: 'Command timeout' };
    }
}
