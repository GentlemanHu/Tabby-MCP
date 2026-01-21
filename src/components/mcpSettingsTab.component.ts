import { Component, OnInit } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { McpService } from '../services/mcpService';
import { McpLoggerService } from '../services/mcpLogger.service';

// Version from package.json - update on each release
const PLUGIN_VERSION = '1.1.2';

/**
 * MCP Settings Tab Component
 */
@Component({
  selector: 'mcp-settings-tab',
  template: `
    <div class="mcp-settings">
      <div class="header-row">
        <h3>🔌 MCP Server Settings</h3>
        <span class="version-badge">v{{ version }}</span>
      </div>
      
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
               placeholder="3001" min="1024" max="65535" (change)="saveConfig()">
        <small class="form-text text-muted">MCP server port (default: 3001)</small>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.startOnBoot" (change)="saveConfig()">
            Start server on Tabby launch
          </label>
        </div>
      </div>

      <hr />

      <h4>📝 Logging</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.enableLogging" (change)="saveConfig()">
            Enable logging
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <label>Log Level</label>
        <select class="form-control" [(ngModel)]="config.store.mcp.logLevel" (change)="saveConfig()">
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <button class="btn btn-sm btn-secondary" (click)="viewLogs()">View Logs</button>
        <button class="btn btn-sm btn-outline-secondary ml-2" (click)="exportLogsToFile()">Export JSON</button>
        <button class="btn btn-sm btn-outline-secondary ml-2" (click)="clearLogs()">Clear Logs</button>
      </div>

      <hr />

      <h4>🤝 Pair Programming Mode</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.enabled" (change)="saveConfig()">
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
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.showConfirmationDialog" (change)="saveConfig()">
            Show confirmation dialog
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.pairProgrammingMode.enabled">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.autoFocusTerminal" (change)="saveConfig()">
            Auto-focus terminal on command execution
          </label>
        </div>
      </div>

      <hr />

      <h4>🎯 Session Tracking</h4>
      <small class="form-text text-muted mb-2">
        Configure how sessions and tabs are identified
      </small>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.useStableIds" (change)="saveConfig()">
            Use stable UUIDs for session identification
          </label>
        </div>
        <small class="form-text text-muted">
          Sessions get persistent IDs that don't change when tabs are reordered
        </small>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includeProfileInfo" (change)="saveConfig()">
            Include profile info in session list
          </label>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includePid" (change)="saveConfig()">
            Include process ID in session info
          </label>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includeCwd" (change)="saveConfig()">
            Include current working directory in session info
          </label>
        </div>
      </div>

      <hr />

      <h4>📁 SFTP Settings</h4>
      <small class="form-text text-muted mb-2">
        SFTP file transfer support (requires tabby-ssh plugin)
      </small>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sftp.enabled" (change)="saveConfig()">
            Enable SFTP tools
          </label>
        </div>
        <small class="form-text text-muted">
          If tabby-ssh is not installed, SFTP tools will be disabled automatically
        </small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>Max Read Size</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxFileSizeMB()" 
                 (ngModelChange)="setMaxFileSizeMB($event)" placeholder="1" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">MB</span>
          </div>
        </div>
        <small class="form-text text-muted">Maximum file size for sftp_read_file (default: 1 MB, max: 100 MB)</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>Max Upload Size</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxUploadSizeMB()" 
                 (ngModelChange)="setMaxUploadSizeMB($event)" placeholder="10" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">MB</span>
          </div>
        </div>
        <small class="form-text text-muted">Maximum file size for sftp_upload (default: 10 MB, max: 100 MB)</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>Max Download Size</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxDownloadSizeMB()" 
                 (ngModelChange)="setMaxDownloadSizeMB($event)" placeholder="10" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">MB</span>
          </div>
        </div>
        <small class="form-text text-muted">Maximum file size for sftp_download (default: 10 MB, max: 100 MB)</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>Timeout (seconds)</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getTimeoutSeconds()" 
                 (ngModelChange)="setTimeoutSeconds($event)" placeholder="60" min="5" max="300" step="5">
          <div class="input-group-append">
            <span class="input-group-text">sec</span>
          </div>
        </div>
        <small class="form-text text-muted">SFTP operation timeout (default: 60 seconds)</small>
      </div>

      <div class="alert alert-info" *ngIf="config.store.mcp.sftp.enabled">
        <strong>ℹ️ SFTP Notes:</strong>
        <ul class="mb-0">
          <li>File transfers are direct binary (no base64 encoding)</li>
          <li>Large files may consume significant memory during transfer</li>
          <li><code>sftp_write_file</code> can overwrite files without confirmation</li>
          <li>If file exceeds size limit, MCP will return an error (no popup)</li>
        </ul>
      </div>

      <hr />

      <h4>⏱️ Timing Settings</h4>
      <small class="form-text text-muted mb-2">
        Advanced timing configuration for command execution and session detection
      </small>

      <div class="form-group">
        <label>Poll Interval (ms)</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.pollInterval" 
               placeholder="100" min="50" max="1000" (change)="saveConfig()">
        <small class="form-text text-muted">How often to check for command output (default: 100)</small>
      </div>

      <div class="form-group">
        <label>Initial Delay (ms)</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.initialDelay" 
               placeholder="0" min="0" max="5000" (change)="saveConfig()">
        <small class="form-text text-muted">Delay before polling starts (default: 0)</small>
      </div>

      <div class="form-group">
        <label>Session Stable Checks</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.sessionStableChecks" 
               placeholder="5" min="1" max="20" (change)="saveConfig()">
        <small class="form-text text-muted">Number of stable checks for session ready detection (default: 5)</small>
      </div>

      <div class="form-group">
        <label>Session Poll Interval (ms)</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.sessionPollInterval" 
               placeholder="200" min="100" max="2000" (change)="saveConfig()">
        <small class="form-text text-muted">Interval for session ready polling (default: 200)</small>
      </div>

      <hr />

      <h4>🔗 Connection Info</h4>
      <div class="connection-info">
        <p><strong>Streamable HTTP (Recommended):</strong> <code>http://localhost:{{ config.store.mcp.port }}/mcp</code></p>
        <p><strong>Legacy SSE:</strong> <code>http://localhost:{{ config.store.mcp.port }}/sse</code></p>
        <p><strong>Health Check:</strong> <code>http://localhost:{{ config.store.mcp.port }}/health</code></p>
        
        <div class="mt-3">
          <p class="text-muted">Add to your MCP client (e.g., Cursor, VS Code):</p>
          <pre class="config-example">{{getConfigExample()}}</pre>
          <button class="btn btn-sm btn-outline-primary" (click)="copyConfig()">Copy Config</button>
        </div>
      </div>

      <div class="save-status mt-3" *ngIf="saveMessage">
        <span class="text-success">{{ saveMessage }}</span>
      </div>
    </div>
  `,
  styles: [`
    .mcp-settings {
      padding: 1rem;
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .version-badge {
      background: rgba(0, 123, 255, 0.2);
      color: #007bff;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: bold;
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
    .ml-2 {
      margin-left: 0.5rem;
    }
    .mb-2 {
      margin-bottom: 0.5rem;
      display: block;
    }
    .save-status {
      padding: 0.5rem;
      background: rgba(40, 167, 69, 0.1);
      border-radius: 4px;
    }
  `]
})
export class McpSettingsTabComponent implements OnInit {
  version = PLUGIN_VERSION;
  saveMessage = '';

  constructor(
    public config: ConfigService,
    private mcpService: McpService,
    private logger: McpLoggerService
  ) { }

  ngOnInit(): void {
    // Ensure timing config exists
    if (!this.config.store.mcp.timing) {
      this.config.store.mcp.timing = {
        pollInterval: 100,
        initialDelay: 0,
        sessionStableChecks: 5,
        sessionPollInterval: 200
      };
    }
    // Ensure sessionTracking config exists
    if (!this.config.store.mcp.sessionTracking) {
      this.config.store.mcp.sessionTracking = {
        useStableIds: true,
        includeProfileInfo: true,
        includePid: true,
        includeCwd: true
      };
    }
    // Ensure sftp config exists
    if (!this.config.store.mcp.sftp) {
      this.config.store.mcp.sftp = {
        enabled: true,
        maxFileSize: 1024 * 1024,      // 1MB for read
        maxUploadSize: 10 * 1024 * 1024,   // 10MB for upload
        maxDownloadSize: 10 * 1024 * 1024, // 10MB for download
        timeout: 60000
      };
    }
    // Ensure new fields exist on existing config
    if (this.config.store.mcp.sftp.maxUploadSize === undefined) {
      this.config.store.mcp.sftp.maxUploadSize = 10 * 1024 * 1024;
    }
    if (this.config.store.mcp.sftp.maxDownloadSize === undefined) {
      this.config.store.mcp.sftp.maxDownloadSize = 10 * 1024 * 1024;
    }
  }

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

  exportLogsToFile(): void {
    const logs = this.logger.exportLogs();
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.logger.info('Logs exported to JSON file');
  }

  clearLogs(): void {
    this.logger.clearLogs();
  }

  saveConfig(): void {
    this.config.save();
    this.saveMessage = '✓ Settings saved';
    setTimeout(() => { this.saveMessage = ''; }, 2000);
  }

  // ============== Size conversion helpers (MB <-> Bytes) ==============

  getMaxFileSizeMB(): number {
    return Math.round((this.config.store.mcp?.sftp?.maxFileSize || 1048576) / 1048576 * 10) / 10;
  }
  setMaxFileSizeMB(mb: number): void {
    this.config.store.mcp.sftp.maxFileSize = Math.round(mb * 1048576);
    this.saveConfig();
  }

  getMaxUploadSizeMB(): number {
    return Math.round((this.config.store.mcp?.sftp?.maxUploadSize || 10485760) / 1048576 * 10) / 10;
  }
  setMaxUploadSizeMB(mb: number): void {
    this.config.store.mcp.sftp.maxUploadSize = Math.round(mb * 1048576);
    this.saveConfig();
  }

  getMaxDownloadSizeMB(): number {
    return Math.round((this.config.store.mcp?.sftp?.maxDownloadSize || 10485760) / 1048576 * 10) / 10;
  }
  setMaxDownloadSizeMB(mb: number): void {
    this.config.store.mcp.sftp.maxDownloadSize = Math.round(mb * 1048576);
    this.saveConfig();
  }

  getTimeoutSeconds(): number {
    return Math.round((this.config.store.mcp?.sftp?.timeout || 60000) / 1000);
  }
  setTimeoutSeconds(sec: number): void {
    this.config.store.mcp.sftp.timeout = sec * 1000;
    this.saveConfig();
  }

  // ============== Config example ==============

  getConfigExample(): string {
    const port = this.config.store.mcp?.port || 3001;
    return JSON.stringify({
      mcpServers: {
        'Tabby MCP': {
          type: 'sse',
          url: `http://localhost:${port}/mcp`
        }
      }
    }, null, 2);
  }

  copyConfig(): void {
    navigator.clipboard.writeText(this.getConfigExample());
    this.logger.info('Config copied to clipboard');
  }
}
