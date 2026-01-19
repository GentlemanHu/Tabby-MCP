/**
 * MCP Tool definition interface
 */
export interface McpTool {
    name: string;
    description: string;
    schema: Record<string, any>;
    handler: (params: any, context: any) => Promise<any>;
}

/**
 * Tool category interface for grouping related tools
 */
export interface ToolCategory {
    name: string;
    mcpTools: McpTool[];
}

/**
 * Terminal session information
 */
export interface TerminalSession {
    id: number;
    title: string;
    type: string;
    isActive: boolean;
}

/**
 * Command execution result
 */
export interface CommandResult {
    success: boolean;
    output: string;
    exitCode?: number;
    error?: string;
    outputId?: string;
    totalLines?: number;
}

/**
 * Active command tracking
 */
export interface ActiveCommand {
    tabId: number;
    command: string;
    timestamp: number;
    startMarker: string;
    endMarker: string;
    abort: () => void;
}

/**
 * MCP Configuration
 */
export interface McpConfig {
    port: number;
    host: string;
    enableLogging: boolean;
    startOnBoot: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    pairProgrammingMode: {
        enabled: boolean;
        showConfirmationDialog: boolean;
        autoFocusTerminal: boolean;
    };
}

/**
 * Command history entry
 */
export interface CommandHistoryEntry {
    id: string;
    tabId: number;
    command: string;
    timestamp: number;
    status: 'running' | 'completed' | 'aborted' | 'error';
    output?: string;
    exitCode?: number;
}

/**
 * Log entry
 */
export interface LogEntry {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: any;
}
