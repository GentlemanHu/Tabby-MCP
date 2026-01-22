import { Component, OnInit, OnDestroy } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { Subscription } from 'rxjs';
import { McpService } from '../services/mcpService';
import { McpLoggerService } from '../services/mcpLogger.service';
import { McpI18nService } from '../services/i18n.service';

// Version from package.json - update on each release
const PLUGIN_VERSION = '1.1.5';

/**
 * MCP Settings Tab Component with i18n support
 */
@Component({
  selector: 'mcp-settings-tab',
  template: `
    <div class="mcp-settings">
      <div class="header-row">
        <h3>🔌 {{ t('mcp.settings.title') }}</h3>
        <span class="version-badge">v{{ version }}</span>
      </div>
      
      <div class="form-group">
        <label>{{ t('mcp.server.status') }}</label>
        <div class="status-container">
          <span class="status-indicator" [class.running]="isRunning"></span>
          <span>{{ isRunning ? t('mcp.server.running') : t('mcp.server.stopped') }}</span>
          <span *ngIf="isRunning" class="connection-count">
            ({{ t('mcp.server.connections', {count: activeConnections}) }})
          </span>
        </div>
        <div class="button-group mt-2">
          <button class="btn btn-primary" (click)="toggleServer()">
            {{ isRunning ? t('mcp.server.stop') : t('mcp.server.start') }}
          </button>
          <button class="btn btn-secondary" (click)="restartServer()" *ngIf="isRunning">
            {{ t('mcp.server.restart') }}
          </button>
        </div>
      </div>

      <hr />

      <div class="form-group">
        <label>{{ t('mcp.config.port') }}</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.port" 
               placeholder="3001" min="1024" max="65535" (change)="saveConfig()">
        <small class="form-text text-muted">{{ t('mcp.config.port.desc') }}</small>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.startOnBoot" (change)="saveConfig()">
            {{ t('mcp.config.startOnBoot') }}
          </label>
        </div>
      </div>

      <hr />

      <h4>📝 {{ t('mcp.logging.title') }}</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.enableLogging" (change)="saveConfig()">
            {{ t('mcp.logging.enable') }}
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <label>{{ t('mcp.logging.level') }}</label>
        <select class="form-control" [(ngModel)]="config.store.mcp.logLevel" (change)="saveConfig()">
          <option value="debug">{{ t('mcp.logging.level.debug') }}</option>
          <option value="info">{{ t('mcp.logging.level.info') }}</option>
          <option value="warn">{{ t('mcp.logging.level.warn') }}</option>
          <option value="error">{{ t('mcp.logging.level.error') }}</option>
        </select>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.enableLogging">
        <button class="btn btn-sm btn-secondary" (click)="viewLogs()">{{ t('mcp.logging.viewLogs') }}</button>
        <button class="btn btn-sm btn-outline-secondary ml-2" (click)="exportLogsToFile()">{{ t('mcp.logging.exportJson') }}</button>
        <button class="btn btn-sm btn-outline-secondary ml-2" (click)="clearLogs()">{{ t('mcp.logging.clearLogs') }}</button>
      </div>

      <hr />

      <h4>🤝 {{ t('mcp.pairProgramming.title') }}</h4>
      
      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.enabled" (change)="saveConfig()">
            {{ t('mcp.pairProgramming.enable') }}
          </label>
        </div>
        <small class="form-text text-muted">
          {{ t('mcp.pairProgramming.enable.desc') }}
        </small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.pairProgrammingMode.enabled">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.showConfirmationDialog" (change)="saveConfig()">
            {{ t('mcp.pairProgramming.showDialog') }}
          </label>
        </div>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.pairProgrammingMode.enabled">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.pairProgrammingMode.autoFocusTerminal" (change)="saveConfig()">
            {{ t('mcp.pairProgramming.autoFocus') }}
          </label>
        </div>
      </div>

      <hr />

      <h4>🎯 {{ t('mcp.sessionTracking.title') }}</h4>
      <small class="form-text text-muted mb-2">
        {{ t('mcp.sessionTracking.desc') }}
      </small>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.useStableIds" (change)="saveConfig()">
            {{ t('mcp.sessionTracking.stableIds') }}
          </label>
        </div>
        <small class="form-text text-muted">
          {{ t('mcp.sessionTracking.stableIds.desc') }}
        </small>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includeProfileInfo" (change)="saveConfig()">
            {{ t('mcp.sessionTracking.profileInfo') }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includePid" (change)="saveConfig()">
            {{ t('mcp.sessionTracking.pid') }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sessionTracking.includeCwd" (change)="saveConfig()">
            {{ t('mcp.sessionTracking.cwd') }}
          </label>
        </div>
      </div>

      <hr />

      <h4>🔄 {{ t('mcp.backgroundExecution.title') }}</h4>
      <small class="form-text text-muted mb-2">
        {{ t('mcp.backgroundExecution.desc') }}
      </small>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.backgroundExecution.enabled" (change)="saveConfig()">
            {{ t('mcp.backgroundExecution.enable') }}
          </label>
        </div>
        <small class="form-text text-muted">
          {{ t('mcp.backgroundExecution.enable.desc') }}
        </small>
      </div>

      <div class="alert alert-warning" *ngIf="config.store.mcp.backgroundExecution.enabled">
        <strong>⚠️ {{ t('mcp.backgroundExecution.warning.title') }}</strong>
        <ul class="mb-0">
          <li>{{ t('mcp.backgroundExecution.warning.visibility') }}</li>
          <li>{{ t('mcp.backgroundExecution.warning.conflicts') }}</li>
          <li>{{ t('mcp.backgroundExecution.warning.splitPanes') }}</li>
          <li>{{ t('mcp.backgroundExecution.warning.dangerous') }}</li>
        </ul>
        <hr class="my-2"/>
        <strong>✅ {{ t('mcp.backgroundExecution.safety.title') }}</strong>
        <ul class="mb-0">
          <li>{{ t('mcp.backgroundExecution.safety.pairProgramming') }}</li>
          <li>{{ t('mcp.backgroundExecution.safety.sessionId') }}</li>
          <li>{{ t('mcp.backgroundExecution.safety.monitor') }}</li>
        </ul>
      </div>

      <hr />

      <h4>📁 {{ t('mcp.sftp.title') }}</h4>
      <small class="form-text text-muted mb-2">
        {{ t('mcp.sftp.desc') }}
      </small>

      <div class="form-group">
        <div class="checkbox">
          <label>
            <input type="checkbox" [(ngModel)]="config.store.mcp.sftp.enabled" (change)="saveConfig()">
            {{ t('mcp.sftp.enable') }}
          </label>
        </div>
        <small class="form-text text-muted">
          {{ t('mcp.sftp.enable.desc') }}
        </small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>{{ t('mcp.sftp.maxReadSize') }}</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxFileSizeMB()" 
                 (ngModelChange)="setMaxFileSizeMB($event)" placeholder="1" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">{{ t('mcp.common.mb') }}</span>
          </div>
        </div>
        <small class="form-text text-muted">{{ t('mcp.sftp.maxReadSize.desc') }}</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>{{ t('mcp.sftp.maxUploadSize') }}</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxUploadSizeMB()" 
                 (ngModelChange)="setMaxUploadSizeMB($event)" placeholder="10" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">{{ t('mcp.common.mb') }}</span>
          </div>
        </div>
        <small class="form-text text-muted">{{ t('mcp.sftp.maxUploadSize.desc') }}</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>{{ t('mcp.sftp.maxDownloadSize') }}</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getMaxDownloadSizeMB()" 
                 (ngModelChange)="setMaxDownloadSizeMB($event)" placeholder="10" min="0.1" max="100" step="0.5">
          <div class="input-group-append">
            <span class="input-group-text">{{ t('mcp.common.mb') }}</span>
          </div>
        </div>
        <small class="form-text text-muted">{{ t('mcp.sftp.maxDownloadSize.desc') }}</small>
      </div>

      <div class="form-group" *ngIf="config.store.mcp.sftp.enabled">
        <label>{{ t('mcp.sftp.timeout') }}</label>
        <div class="input-group">
          <input type="number" class="form-control" [ngModel]="getTimeoutSeconds()" 
                 (ngModelChange)="setTimeoutSeconds($event)" placeholder="60" min="5" max="300" step="5">
          <div class="input-group-append">
            <span class="input-group-text">{{ t('mcp.common.sec') }}</span>
          </div>
        </div>
        <small class="form-text text-muted">{{ t('mcp.sftp.timeout.desc') }}</small>
      </div>

      <div class="alert alert-info" *ngIf="config.store.mcp.sftp.enabled">
        <strong>ℹ️ {{ t('mcp.sftp.notes.title') }}</strong>
        <ul class="mb-0">
          <li>{{ t('mcp.sftp.notes.binary') }}</li>
          <li>{{ t('mcp.sftp.notes.memory') }}</li>
          <li>{{ t('mcp.sftp.notes.overwrite') }}</li>
          <li>{{ t('mcp.sftp.notes.limit') }}</li>
        </ul>
      </div>

      <hr />

      <h4>⏱️ {{ t('mcp.timing.title') }}</h4>
      <small class="form-text text-muted mb-2">
        {{ t('mcp.timing.desc') }}
      </small>

      <div class="form-group">
        <label>{{ t('mcp.timing.pollInterval') }}</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.pollInterval" 
               placeholder="100" min="50" max="1000" (change)="saveConfig()">
        <small class="form-text text-muted">{{ t('mcp.timing.pollInterval.desc') }}</small>
      </div>

      <div class="form-group">
        <label>{{ t('mcp.timing.initialDelay') }}</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.initialDelay" 
               placeholder="0" min="0" max="5000" (change)="saveConfig()">
        <small class="form-text text-muted">{{ t('mcp.timing.initialDelay.desc') }}</small>
      </div>

      <div class="form-group">
        <label>{{ t('mcp.timing.sessionStableChecks') }}</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.sessionStableChecks" 
               placeholder="5" min="1" max="20" (change)="saveConfig()">
        <small class="form-text text-muted">{{ t('mcp.timing.sessionStableChecks.desc') }}</small>
      </div>

      <div class="form-group">
        <label>{{ t('mcp.timing.sessionPollInterval') }}</label>
        <input type="number" class="form-control" [(ngModel)]="config.store.mcp.timing.sessionPollInterval" 
               placeholder="200" min="100" max="2000" (change)="saveConfig()">
        <small class="form-text text-muted">{{ t('mcp.timing.sessionPollInterval.desc') }}</small>
      </div>

      <hr />

      <h4>🔗 {{ t('mcp.connectionInfo.title') }}</h4>
      <div class="connection-info">
        <p><strong>{{ t('mcp.connectionInfo.streamable') }}</strong> <code>http://localhost:{{ config.store.mcp.port }}/mcp</code></p>
        <p><strong>{{ t('mcp.connectionInfo.legacySse') }}</strong> <code>http://localhost:{{ config.store.mcp.port }}/sse</code></p>
        <p><strong>{{ t('mcp.connectionInfo.healthCheck') }}</strong> <code>http://localhost:{{ config.store.mcp.port }}/health</code></p>
        
        <div class="mt-3">
          <p class="text-muted">{{ t('mcp.connectionInfo.addToClient') }}</p>
          <pre class="config-example">{{getConfigExample()}}</pre>
          <button class="btn btn-sm btn-outline-primary" (click)="copyConfig()">{{ t('mcp.connectionInfo.copyConfig') }}</button>
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
export class McpSettingsTabComponent implements OnInit, OnDestroy {
  version = PLUGIN_VERSION;
  saveMessage = '';
  private configSub?: Subscription;

  constructor(
    public config: ConfigService,
    private mcpService: McpService,
    private logger: McpLoggerService,
    private i18n: McpI18nService
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
    // Ensure backgroundExecution config exists
    if (!this.config.store.mcp.backgroundExecution) {
      this.config.store.mcp.backgroundExecution = {
        enabled: false  // Default: disabled for safety
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

  ngOnDestroy(): void {
    this.configSub?.unsubscribe();
  }

  /**
   * Translation helper - delegates to i18n service
   */
  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
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
    this.saveMessage = this.t('mcp.common.saved');
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
