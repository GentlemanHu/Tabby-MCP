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
 * Mirrors the defaults defined in McpConfigProvider (config.store.mcp)
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
        // Gate sensitive SFTP operations; send_input follows showConfirmationDialog
        confirmFileOperations: boolean;
        autoFocusTerminal: boolean;
    };
    timing: {
        pollInterval: number;
        initialDelay: number;
        sessionStableChecks: number;
        sessionPollInterval: number;
    };
    sessionTracking: {
        useStableIds: boolean;
        includeProfileInfo: boolean;
        includePid: boolean;
        includeCwd: boolean;
    };
    backgroundExecution: {
        enabled: boolean;
    };
    directToolApi: {
        enabled: boolean;
    };
    sftp: {
        enabled: boolean;
        maxFileSize: number;
        maxUploadSize: number;
        maxDownloadSize: number;
        timeout: number;
    };
    environmentDetection: {
        enabled: boolean;
        useEnhancedHeuristics: boolean;
        mode: 'heuristic' | 'active';
    };
    useStreamCapture?: boolean; // Experimental mode to fix output truncation
    /** Internal loopback handover secret; generated lazily and never exposed by MCP endpoints */
    serverControlToken?: string;
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

/**
 * Enhanced terminal session with stable ID and metadata
 */
export interface EnhancedTerminalSession {
    sessionId: string;       // Stable unique ID (UUID)
    tabIndex: number;        // Array index (may change if tabs are reordered)
    title: string;
    type: string;
    isActive: boolean;
    hasActiveCommand: boolean;
    profile?: {
        id: string;
        name: string;
        type: string;
    };
    pid?: number;            // Process ID if available
    cwd?: string;            // Current working directory if available
}

/**
 * Session locator for flexible session targeting
 * Priority: sessionId > tabIndex > title > profileName
 */
export interface SessionLocator {
    sessionId?: string;      // Stable session ID (recommended)
    tabIndex?: number;       // Tab index (legacy, may change)
    title?: string;          // Match by title (partial, case-insensitive)
    profileName?: string;    // Match by profile name (partial, case-insensitive)
}

/**
 * SFTP file/directory information
 */
export interface SFTPFileInfo {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedTime: string;
    permissions: string;
}

/**
 * SFTP operation result
 */
export interface SFTPResult {
    success: boolean;
    message?: string;
    error?: string;
    files?: SFTPFileInfo[];
    localPath?: string;
    remotePath?: string;
}
