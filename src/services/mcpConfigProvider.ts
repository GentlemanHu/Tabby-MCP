import { Injectable } from '@angular/core';
import { ConfigProvider } from 'tabby-core';

/**
 * MCP Configuration Provider - Default settings for the plugin
 */
@Injectable()
export class McpConfigProvider extends ConfigProvider {
    defaults = {
        mcp: {
            port: 3001,
            host: 'http://localhost:3001',
            enableLogging: true,
            startOnBoot: true,
            logLevel: 'info',
            pairProgrammingMode: {
                enabled: true,
                showConfirmationDialog: true,
                autoFocusTerminal: true
            },
            // Timing configuration (in milliseconds)
            timing: {
                pollInterval: 100,          // How often to check for command output
                initialDelay: 0,            // Delay before starting to poll (0 = no delay)
                sessionStableChecks: 5,     // Number of stable checks for session ready detection
                sessionPollInterval: 200    // Interval for session ready polling
            },
            // Session tracking configuration
            sessionTracking: {
                useStableIds: true,         // Use stable UUIDs for session/tab identification
                includeProfileInfo: true,   // Include profile info in session list
                includePid: true,           // Include process ID in session info
                includeCwd: true            // Include current working directory
            },
            // Background execution mode - allows MCP to run commands without focusing the terminal
            backgroundExecution: {
                enabled: false              // Default: false (focus terminal for visibility/safety)
            },
            // SFTP configuration (requires tabby-ssh)
            sftp: {
                enabled: true,              // Enable SFTP tools if tabby-ssh is available
                maxFileSize: 1024 * 1024,   // Max file size for read operations (1MB)
                maxUploadSize: 10 * 1024 * 1024 * 1024,   // Default: 10GB
                maxDownloadSize: 10 * 1024 * 1024 * 1024, // Default: 10GB
                timeout: 60000              // SFTP operation timeout in ms
            }
        }
    };
}
