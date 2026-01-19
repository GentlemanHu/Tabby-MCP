import { Component } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { McpService } from '../services/mcpService';
import { McpLoggerService } from '../services/mcpLogger.service';

/**
 * MCP Settings Tab Component
 */
@Component({
    selector: 'mcp-settings-tab',
    template: `
    <div class="mcp-settings">
      <h3>🔌 MCP Server Settings</h3>
      
      <div class="form-group">
        <label>Server Status</label>
        <div class="status-container">
          <span class="status-indicator" [class.running]="isRunning"></span>
          <span>{{ isRunning ? 'Running' : 'Stopped' }}</span>
          <span *ngIf="isRunning" class="connection-count">
            ({{ activeConnections }} connection{{ activeConnections !== 1 ? 's' : '' }})
          </span>
        </div>
        <div class="button-group mt-2">
          <button class="btn btn-primary" (click)="toggleServer()">
            {{ isRunning ? 'Stop Server' : 'Start Server' }}
          </button>
          <button class="btn btn-secondary" (click)="restartServer()" *ngIf="isRunning">
            Restart
          </button>
        </div>
      </div>

      <hr />

      <div class="form-group">
        <label>Port</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.port" 
               placeholder="3001" min="1024" max="65535">
        <small class="form-text text-muted">MCP server port (default: 3001)</small>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.startOnBoot">
            Start server on Tabby launch
          </label>
        </div>
      </div>

      <hr />

      <h4>📝 Logging</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.enableLogging">
            Enable logging
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <label>Log Level</label>
        <select class="form-control" [(ngModel)]="config.store.mcp.logLevel">
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <button class="btn btn-sm btn-secondary" (click)="viewLogs()">View Logs</button>
        <button class="btn btn-sm btn-outline-secondary ml-2" (click)="clearLogs()">Clear Logs</button>
      </div>

      <hr />

      <h4>🤝 Pair Programming Mode</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.enabled">
            Enable Pair Programming Mode
          </label>
        </div>
        <small class="form-text text-muted">
          When enabled, AI commands require confirmation before execution
        </small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.pairProgrammingMode.enabled">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.showConfirmationDialog">
            Show confirmation dialog
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.pairProgrammingMode.enabled">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.autoFocusTerminal">
            Auto-focus terminal on command execution
          </label>
        </div>
      </div>

      <hr />

      <h4>🔗 Connection Info</h4>
      <div class="connection-info">
        <p><strong>SSE Endpoint:</strong> <code>http://localhost:{{ config.store.mcp.port }}/sse</code></p>
        <p><strong>Health Check:</strong> <code>http://localhost:{{ config.store.mcp.port }}/health</code></p>
        
        <div class="mt-3">
          <p class="text-muted">Add to your MCP client (e.g., Cursor):</p>
          <pre class="config-example">{{getConfigExample()}}</pre>
          <button class="btn btn-sm btn-outline-primary" (click)="copyConfig()">Copy Config</button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .mcp-settings {
      padding: 1rem;
    }
    .status-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #dc3545;
    }
    .status-indicator.running {
      background: #28a745;
    }
    .connection-count {
      color: #6c757d;
      font-size: 0.9em;
    }
    .button-group {
      display: flex;
      gap: 0.5rem;
    }
    .connection-info {
      background: rgba(0,0,0,0.2);
      padding: 1rem;
      border-radius: 4px;
    }
    .config-example {
      background: rgba(0,0,0,0.3);
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.85em;
      overflow-x: auto;
    }
  `]
})
export class McpSettingsTabComponent {
    constructor(
        public config: ConfigService,
        private mcpService: McpService,
        private logger: McpLoggerService
    ) { }

    get isRunning(): boolean {
        return this.mcpService.isServerRunning();
    }

    get activeConnections(): number {
        return this.mcpService.getActiveConnections();
    }

    async toggleServer(): Promise<void> {
        if (this.isRunning) {
            await this.mcpService.stopServer();
        } else {
            await this.mcpService.startServer(this.config.store.mcp.port);
        }
    }

    async restartServer(): Promise<void> {
        await this.mcpService.restartServer();
    }

    viewLogs(): void {
        const logs = this.logger.exportLogs();
        console.log('MCP Logs:', logs);
        alert('Logs have been printed to the console (Cmd+Option+I)');
    }

    clearLogs(): void {
        this.logger.clearLogs();
    }

    getConfigExample(): string {
        return JSON.stringify({
            mcpServers: {
                'Tabby MCP': {
                    type: 'sse',
                    url: `http://localhost:${this.config.store.mcp?.port || 3001}/sse`
                }
            }
        }, null, 2);
    }

    copyConfig(): void {
        navigator.clipboard.writeText(this.getConfigExample());
        this.logger.info('Config copied to clipboard');
    }
}
