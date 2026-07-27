import { Injectable } from '@angular/core';
import { McpLoggerService } from './mcpLogger.service';
import { McpI18nService } from './i18n.service';

/**
 * Dialog Service - Non-blocking confirmation dialogs for MCP operations.
 *
 * Uses a plain DOM overlay instead of the native `confirm()` for two reasons:
 * 1. Native confirm()/alert() block the Electron renderer event loop and are known
 *    to break keyboard input and IME composition in xterm.js until the window is
 *    re-focused (space key swallowed, Chinese IME unable to compose - Issue #7).
 * 2. MCP tool handlers run outside the Angular zone (Express callbacks), where
 *    NgbModal-based dialogs may not render until the next change-detection cycle.
 *
 * The dialog restores focus to the previously focused element after closing so
 * the terminal (xterm helper textarea) regains keyboard/IME input immediately.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
    /** Serialize dialogs so concurrent MCP requests queue instead of stacking */
    private dialogQueue: Promise<unknown> = Promise.resolve();
    /** Auto-reject timeout so an unattended dialog never hangs the MCP client forever */
    private readonly AUTO_REJECT_MS = 120000;
    private stylesInjected = false;

    constructor(
        private logger: McpLoggerService,
        private i18n: McpI18nService
    ) { }

    /**
     * Show command confirmation dialog (exec_command)
     */
    async showCommandConfirmation(command: string, tabId: number): Promise<boolean> {
        this.logger.info(`Showing confirmation for command: ${command}`);
        const confirmed = await this.enqueueDialog(
            this.i18n.t('mcp.dialog.command.title'),
            `${this.i18n.t('mcp.dialog.tab')}: ${tabId}`,
            command
        );
        this.logger.info(confirmed ? 'Command confirmed by user' : 'Command rejected by user');
        return confirmed;
    }

    /**
     * Show generic operation confirmation dialog (send_input, SFTP operations, ...)
     * @param operation Tool/operation name shown in the header (e.g. 'sftp_delete')
     * @param target Context line (e.g. session title or connection name)
     * @param detail Preview content (input text, file paths, ...)
     */
    async showOperationConfirmation(operation: string, target: string, detail: string): Promise<boolean> {
        this.logger.info(`Showing confirmation for operation: ${operation} (${target})`);
        const confirmed = await this.enqueueDialog(
            `${this.i18n.t('mcp.dialog.operation.title')}: ${operation}`,
            target,
            detail
        );
        this.logger.info(confirmed ? `Operation ${operation} confirmed by user` : `Operation ${operation} rejected by user`);
        return confirmed;
    }

    /**
     * Show command result dialog
     */
    showCommandResult(command: string, output: string, success: boolean): void {
        this.logger.info(`Command ${success ? 'succeeded' : 'failed'}: ${command}`);
        if (!success) {
            this.logger.error(`Command failed: ${command}`, output);
        }
    }

    private enqueueDialog(title: string, subtitle: string, preview: string): Promise<boolean> {
        const next = this.dialogQueue.then(() => this.showDialog(title, subtitle, preview));
        // Keep the queue alive even if a dialog rejects unexpectedly
        this.dialogQueue = next.catch(() => undefined);
        return next;
    }

    private showDialog(title: string, subtitle: string, preview: string): Promise<boolean> {
        if (typeof document === 'undefined') {
            // Headless safety net: never silently approve
            this.logger.warn('Dialog requested without DOM available - rejecting');
            return Promise.resolve(false);
        }

        this.injectStyles();

        return new Promise<boolean>((resolve) => {
            const previouslyFocused = document.activeElement as HTMLElement | null;

            const overlay = document.createElement('div');
            overlay.className = 'mcp-dialog-overlay';

            const panel = document.createElement('div');
            panel.className = 'mcp-dialog-panel';

            const header = document.createElement('div');
            header.className = 'mcp-dialog-header';
            header.textContent = `🤖 ${title}`;

            const body = document.createElement('div');
            body.className = 'mcp-dialog-body';

            const subtitleEl = document.createElement('div');
            subtitleEl.className = 'mcp-dialog-subtitle';
            subtitleEl.textContent = subtitle;

            const previewEl = document.createElement('pre');
            previewEl.className = 'mcp-dialog-preview';
            // Show the complete operation payload; hidden suffixes would make approval unsafe.
            previewEl.textContent = preview;

            const countdownEl = document.createElement('div');
            countdownEl.className = 'mcp-dialog-countdown';

            body.appendChild(subtitleEl);
            body.appendChild(previewEl);
            body.appendChild(countdownEl);

            const footer = document.createElement('div');
            footer.className = 'mcp-dialog-footer';

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'mcp-dialog-btn mcp-dialog-btn-reject';
            rejectBtn.textContent = this.i18n.t('mcp.dialog.reject');

            const approveBtn = document.createElement('button');
            approveBtn.className = 'mcp-dialog-btn mcp-dialog-btn-approve';
            approveBtn.textContent = this.i18n.t('mcp.dialog.approve');

            footer.appendChild(rejectBtn);
            footer.appendChild(approveBtn);

            panel.appendChild(header);
            panel.appendChild(body);
            panel.appendChild(footer);
            overlay.appendChild(panel);

            let remainingSeconds = Math.floor(this.AUTO_REJECT_MS / 1000);
            const renderCountdown = () => {
                countdownEl.textContent = this.i18n.t('mcp.dialog.autoReject', { seconds: remainingSeconds });
            };
            renderCountdown();

            const countdownTimer = setInterval(() => {
                remainingSeconds--;
                if (remainingSeconds >= 0) {
                    renderCountdown();
                }
            }, 1000);

            const finish = (result: boolean) => {
                clearInterval(countdownTimer);
                clearTimeout(autoRejectTimer);
                document.removeEventListener('keydown', onKeyDown, true);
                overlay.remove();
                // Restore focus so the terminal regains keyboard/IME input (Issue #7)
                setTimeout(() => {
                    try {
                        previouslyFocused?.focus?.();
                    } catch {
                        // Element may be gone - nothing to restore
                    }
                }, 0);
                resolve(result);
            };

            const autoRejectTimer = setTimeout(() => finish(false), this.AUTO_REJECT_MS);

            const onKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    finish(false);
                }
            };

            rejectBtn.addEventListener('click', () => finish(false));
            approveBtn.addEventListener('click', () => finish(true));
            overlay.addEventListener('mousedown', (event) => {
                if (event.target === overlay) {
                    finish(false);
                }
            });
            document.addEventListener('keydown', onKeyDown, true);

            document.body.appendChild(overlay);
            // Focus the reject button so a stray Enter keypress is the safe choice
            rejectBtn.focus();
        });
    }

    private injectStyles(): void {
        if (this.stylesInjected || typeof document === 'undefined') {
            return;
        }
        const style = document.createElement('style');
        style.textContent = `
.mcp-dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000; backdrop-filter: blur(2px);
}
.mcp-dialog-panel {
  background: var(--theme-bg-more-2, #1e1e1e);
  color: var(--body-fg, #fff);
  width: 560px; max-width: 92vw; max-height: 80vh;
  border-radius: 8px; display: flex; flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.mcp-dialog-header {
  padding: 0.9rem 1rem; font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff; border-radius: 8px 8px 0 0;
}
.mcp-dialog-body { padding: 1rem; overflow-y: auto; }
.mcp-dialog-subtitle { opacity: 0.8; margin-bottom: 0.5rem; font-size: 0.9em; }
.mcp-dialog-preview {
  background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 4px;
  font-family: monospace; font-size: 0.85em; margin: 0 0 0.5rem 0;
  border-left: 3px solid #667eea; white-space: pre-wrap; word-break: break-all;
  max-height: 40vh; overflow-y: auto;
}
.mcp-dialog-countdown { font-size: 0.8em; opacity: 0.6; }
.mcp-dialog-footer {
  display: flex; gap: 0.5rem; justify-content: flex-end;
  padding: 0.75rem 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.mcp-dialog-btn {
  padding: 0.4rem 1.1rem; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.25); font-size: 0.9em;
}
.mcp-dialog-btn-reject { background: transparent; color: inherit; }
.mcp-dialog-btn-reject:hover, .mcp-dialog-btn-reject:focus { background: rgba(220, 53, 69, 0.25); outline: 1px solid #dc3545; }
.mcp-dialog-btn-approve { background: #28a745; border-color: #28a745; color: #fff; }
.mcp-dialog-btn-approve:hover, .mcp-dialog-btn-approve:focus { background: #218838; outline: 1px solid #1e7e34; }
`;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }
}
