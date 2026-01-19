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
            }
        }
    };
}
