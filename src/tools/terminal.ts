import { Injectable } from '@angular/core';
import { AppService, BaseTabComponent, ConfigService, SplitTabComponent } from 'tabby-core';
import { BaseTerminalTabComponent, XTermFrontend } from 'tabby-terminal';
import { SerializeAddon } from '@xterm/addon-serialize';
import { BehaviorSubject } from 'rxjs';
import { z } from 'zod';
import { BaseToolCategory } from './base-tool-category';
import { McpLoggerService } from '../services/mcpLogger.service';
import { DialogService } from '../services/dialog.service';
import { McpTool, ActiveCommand, TerminalSession, CommandResult } from '../types/types';

/**
 * Terminal session with ID for tracking
 */
export interface TerminalSessionWithTab {
    id: number;
    tabParent: BaseTabComponent;
    tab: BaseTerminalTabComponent;
}

/**
 * Terminal Tools Category - Commands for terminal control
 */
@Injectable({ providedIn: 'root' })
export class TerminalToolCategory extends BaseToolCategory {
    name = 'terminal';

    private _activeCommands = new Map<number, ActiveCommand>();
    private _activeCommandsSubject = new BehaviorSubject<Map<number, ActiveCommand>>(new Map());

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
        this.registerTool(this.createGetTerminalBufferTool());
        this.registerTool(this.createAbortCommandTool());

        this.logger.info('Terminal tools initialized');
    }

    /**
     * Tool: Get list of terminal sessions
     */
    private createGetSessionListTool(): McpTool {
        return {
            name: 'get_session_list',
            description: 'Get list of all terminal sessions/tabs in Tabby',
            schema: {},
            handler: async () => {
                const sessions = this.findTerminalSessions();
                const result: TerminalSession[] = sessions.map(s => ({
                    id: s.id,
                    title: s.tab.title || `Terminal ${s.id}`,
                    type: s.tab.constructor.name,
                    isActive: this.app.activeTab === s.tabParent
                }));

                this.logger.info(`Found ${result.length} terminal sessions`);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
        };
    }

    /**
     * Tool: Execute command in terminal
     */
    private createExecCommandTool(): McpTool {
        return {
            name: 'exec_command',
            description: 'Execute a command in a terminal session. Use tabId from get_session_list.',
            schema: {
                command: z.string().describe('Command to execute'),
                tabId: z.number().optional().describe('Terminal tab ID (default: 0, the first terminal)'),
                waitForOutput: z.boolean().optional().describe('Wait for command output (default: true)'),
                timeout: z.number().optional().describe('Timeout in ms (default: 30000)')
            },
            handler: async (params: { command: string; tabId?: number; waitForOutput?: boolean; timeout?: number }) => {
                const { command, tabId = 0, waitForOutput = true, timeout = 30000 } = params;

                // Check pair programming mode
                if (this.config.store.mcp?.pairProgrammingMode?.enabled) {
                    if (this.config.store.mcp?.pairProgrammingMode?.showConfirmationDialog) {
                        const confirmed = await this.dialogService.showCommandConfirmation(command, tabId);
                        if (!confirmed) {
                            return {
                                content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Command rejected by user' }) }]
                            };
                        }
                    }
                }

                const sessions = this.findTerminalSessions();
                const session = sessions.find(s => s.id === tabId);

                if (!session) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `No terminal found with tabId ${tabId}` }) }]
                    };
                }

                try {
                    // Focus terminal if configured
                    if (this.config.store.mcp?.pairProgrammingMode?.autoFocusTerminal) {
                        this.app.selectTab(session.tabParent);
                    }

                    // Generate unique markers
                    const startMarker = `__MCP_START_${Date.now()}__`;
                    const endMarker = `__MCP_END_${Date.now()}__`;

                    // Track active command
                    let aborted = false;
                    const activeCommand: ActiveCommand = {
                        tabId,
                        command,
                        timestamp: Date.now(),
                        startMarker,
                        endMarker,
                        abort: () => { aborted = true; }
                    };
                    this._activeCommands.set(tabId, activeCommand);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));

                    // Send command with markers
                    const wrappedCommand = `echo "${startMarker}" && ${command} ; echo "${endMarker} $?"`;
                    session.tab.sendInput(wrappedCommand + '\n');

                    this.logger.info(`Executing command: ${command} in tab ${tabId}`);

                    if (!waitForOutput) {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: true, output: 'Command sent (not waiting for output)' }) }]
                        };
                    }

                    // Wait for output
                    const result = await this.waitForCommandOutput(session, startMarker, endMarker, timeout, () => aborted);

                    // Clean up active command
                    this._activeCommands.delete(tabId);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));

                    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
                } catch (error: any) {
                    this._activeCommands.delete(tabId);
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
     * Tool: Get terminal buffer content
     */
    private createGetTerminalBufferTool(): McpTool {
        return {
            name: 'get_terminal_buffer',
            description: 'Get the content of a terminal buffer',
            schema: {
                tabId: z.number().optional().describe('Terminal tab ID (default: 0)'),
                startLine: z.number().optional().describe('Start line (default: 0)'),
                endLine: z.number().optional().describe('End line (default: all)')
            },
            handler: async (params: { tabId?: number; startLine?: number; endLine?: number }) => {
                const { tabId = 0, startLine, endLine } = params;

                const sessions = this.findTerminalSessions();
                const session = sessions.find(s => s.id === tabId);

                if (!session) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `No terminal found with tabId ${tabId}` }) }]
                    };
                }

                const bufferContent = this.getTerminalBufferText(session);
                const lines = bufferContent.split('\n');

                const start = startLine ?? 0;
                const end = endLine ?? lines.length;
                const selectedLines = lines.slice(start, end);

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            success: true,
                            tabId,
                            totalLines: lines.length,
                            startLine: start,
                            endLine: end,
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
            description: 'Abort a running command by sending Ctrl+C',
            schema: {
                tabId: z.number().optional().describe('Terminal tab ID (default: 0)')
            },
            handler: async (params: { tabId?: number }) => {
                const { tabId = 0 } = params;

                const sessions = this.findTerminalSessions();
                const session = sessions.find(s => s.id === tabId);

                if (!session) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `No terminal found with tabId ${tabId}` }) }]
                    };
                }

                const activeCommand = this._activeCommands.get(tabId);
                if (activeCommand) {
                    activeCommand.abort();
                    this._activeCommands.delete(tabId);
                    this._activeCommandsSubject.next(new Map(this._activeCommands));
                }

                // Send Ctrl+C
                session.tab.sendInput('\x03');

                this.logger.info(`Aborted command in tab ${tabId}`);
                return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Command aborted' }) }] };
            }
        };
    }

    /**
     * Find all terminal sessions
     */
    public findTerminalSessions(): TerminalSessionWithTab[] {
        const sessions: TerminalSessionWithTab[] = [];
        let id = 0;

        this.app.tabs.forEach((tab: BaseTabComponent) => {
            if (tab instanceof BaseTerminalTabComponent) {
                sessions.push({
                    id: id++,
                    tabParent: tab,
                    tab: tab as BaseTerminalTabComponent
                });
            } else if (tab instanceof SplitTabComponent) {
                const childTabs = tab.getAllTabs().filter(
                    (childTab: BaseTabComponent) => childTab instanceof BaseTerminalTabComponent &&
                        (childTab as BaseTerminalTabComponent).frontend !== undefined
                );

                childTabs.forEach((childTab: BaseTabComponent) => {
                    sessions.push({
                        id: id++,
                        tabParent: tab,
                        tab: childTab as BaseTerminalTabComponent
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
     */
    private async waitForCommandOutput(
        session: TerminalSessionWithTab,
        startMarker: string,
        endMarker: string,
        timeout: number,
        isAborted: () => boolean
    ): Promise<CommandResult> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (isAborted()) {
                return { success: false, output: '', error: 'Command aborted' };
            }

            const buffer = this.getTerminalBufferText(session);
            const startIndex = buffer.lastIndexOf(startMarker);
            const endIndex = buffer.lastIndexOf(endMarker);

            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                const output = buffer.substring(startIndex + startMarker.length, endIndex).trim();

                // Extract exit code from end marker
                const exitCodeMatch = buffer.substring(endIndex).match(new RegExp(`${endMarker}\\s*(\\d+)`));
                const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;

                return {
                    success: exitCode === 0,
                    output,
                    exitCode
                };
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { success: false, output: '', error: 'Command timeout' };
    }
}
