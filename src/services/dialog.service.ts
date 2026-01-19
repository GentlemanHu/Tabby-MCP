import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { McpLoggerService } from './mcpLogger.service';

/**
 * Dialog Service - Handles command confirmation dialogs
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
    constructor(
        private modal: NgbModal,
        private logger: McpLoggerService
    ) { }

    /**
     * Show command confirmation dialog
     */
    async showCommandConfirmation(command: string, tabId: number): Promise<boolean> {
        this.logger.info(`Showing confirmation for command: ${command}`);

        // For now, use a simple confirm dialog
        // In production, this would be a custom modal component
        return new Promise<boolean>((resolve) => {
            const confirmed = confirm(
                `🤖 MCP Command Confirmation\n\n` +
                `Terminal: Tab ${tabId}\n` +
                `Command: ${command}\n\n` +
                `Do you want to execute this command?`
            );

            if (confirmed) {
                this.logger.info('Command confirmed by user');
            } else {
                this.logger.info('Command rejected by user');
            }

            resolve(confirmed);
        });
    }

    /**
     * Show command result dialog
     */
    showCommandResult(command: string, output: string, success: boolean): void {
        this.logger.info(`Command ${success ? 'succeeded' : 'failed'}: ${command}`);

        // Could be enhanced with a custom modal
        if (!success) {
            console.error(`Command failed: ${command}\nOutput: ${output}`);
        }
    }
}
