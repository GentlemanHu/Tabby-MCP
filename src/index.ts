import { NgModule, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import TabbyCoreModule, {
    AppService,
    ConfigProvider,
    ConfigService,
    ToolbarButtonProvider,
    ProfilesService
} from 'tabby-core';
import { SettingsTabProvider } from 'tabby-settings';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

// Services
import { McpService } from './services/mcpService';
import { McpLoggerService } from './services/mcpLogger.service';
import { McpConfigProvider } from './services/mcpConfigProvider';
import { DialogService } from './services/dialog.service';

// Tools
import { TerminalToolCategory } from './tools/terminal';
import { TabManagementToolCategory } from './tools/tabManagement';
import { SFTPToolCategory } from './tools/sftp';

// Settings
import { McpSettingsTabProvider } from './settings';
import { McpSettingsTabComponent } from './components/mcpSettingsTab.component';

// Styles
import './styles.scss';

/**
 * MCP Module - Main Angular module for the Tabby MCP plugin
 * 
 * Features:
 * - Complete terminal control (exec, buffer, abort)
 * - Tab management (create, close, duplicate, move, select)
 * - Profile management (list, open, quick connect SSH)
 * - Pair programming mode with command confirmation
 * - Comprehensive logging
 */
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
        NgbModule
    ],
    providers: [
        McpService,
        McpLoggerService,
        DialogService,
        TerminalToolCategory,
        TabManagementToolCategory,
        SFTPToolCategory,
        { provide: SettingsTabProvider, useClass: McpSettingsTabProvider, multi: true },
        { provide: ConfigProvider, useClass: McpConfigProvider, multi: true }
    ],
    declarations: [
        McpSettingsTabComponent
    ]
})
export default class McpModule implements OnDestroy {
    private initialized = false;
    private appReadySubscription?: Subscription;
    private shutdownInProgress = false;

    constructor(
        private app: AppService,
        private config: ConfigService,
        private mcpService: McpService,
        private logger: McpLoggerService,
        private terminalTools: TerminalToolCategory,
        private tabManagementTools: TabManagementToolCategory,
        private sftpTools: SFTPToolCategory
    ) {
        this.logger.info('MCP Module loading...');

        // Register all tool categories with MCP service
        this.mcpService.registerToolCategory(this.terminalTools);
        this.mcpService.registerToolCategory(this.tabManagementTools);

        // Register SFTP tools if available (tabby-ssh installed)
        if (this.sftpTools.isAvailable()) {
            this.mcpService.registerToolCategory(this.sftpTools);
            this.logger.info('SFTP tools registered');
        }

        // Initialize server after app is ready
        this.appReadySubscription = this.app.ready$.subscribe(() => {
            this.config.ready$.toPromise().then(() => {
                this.initializeOnBoot();
            });
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.handleBeforeUnload);
            window.addEventListener('unload', this.handleBeforeUnload);
        }
    }

    /**
     * Initialize MCP server on application boot
     */
    private async initializeOnBoot(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        try {
            const mcpConfig = this.config.store.mcp;

            if (!mcpConfig) {
                this.logger.warn('MCP config not found, using defaults');
                return;
            }

            const startOnBoot = mcpConfig.startOnBoot !== false;

            if (startOnBoot) {
                this.logger.info('Starting MCP server on boot...');
                await this.mcpService.startServer(mcpConfig.port);
                this.logger.info(`MCP server started on port ${mcpConfig.port}`);
            } else {
                this.logger.info('MCP server auto-start disabled');
            }
        } catch (error) {
            this.logger.error('Failed to start MCP server on boot:', error);
        }
    }

    ngOnDestroy(): void {
        this.appReadySubscription?.unsubscribe();

        if (typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.handleBeforeUnload);
            window.removeEventListener('unload', this.handleBeforeUnload);
        }

        this.shutdownServer('module destroy');
    }

    private handleBeforeUnload = (): void => {
        this.shutdownServer('window unload');
    };

    private shutdownServer(reason: string): void {
        if (this.shutdownInProgress || !this.mcpService.isServerRunning()) {
            return;
        }

        this.shutdownInProgress = true;
        this.logger.info(`Stopping MCP server due to ${reason}...`);

        this.mcpService.stopServerSync(reason);
    }
}

// Re-export types and services
export * from './services/mcpService';
export * from './services/mcpLogger.service';
export * from './services/mcpConfigProvider';
export * from './services/dialog.service';
export * from './tools/terminal';
export * from './tools/tabManagement';
export * from './tools/sftp';
export * from './types/types';
