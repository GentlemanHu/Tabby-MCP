import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { LogEntry } from '../types/types';

/**
 * MCP Logger Service - Centralized logging with file persistence
 */
@Injectable({ providedIn: 'root' })
export class McpLoggerService {
    private logs: LogEntry[] = [];
    private maxLogs = 1000;
    private prefix = '[MCP]';

    constructor(private config: ConfigService) { }

    private get isLoggingEnabled(): boolean {
        try {
            return this.config?.store?.mcp?.enableLogging !== false;
        } catch {
            return true; // Default to enabled if config not ready
        }
    }

    private get logLevel(): string {
        try {
            return this.config?.store?.mcp?.logLevel || 'info';
        } catch {
            return 'info';
        }
    }

    private shouldLog(level: string): boolean {
        if (!this.isLoggingEnabled) return false;

        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);

        return messageLevelIndex >= currentLevelIndex;
    }

    private formatMessage(level: string, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ') : '';
        return `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}${formattedArgs}`;
    }

    private addLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            context
        };

        this.logs.push(entry);

        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (!this.shouldLog('debug')) return;
        const formatted = this.formatMessage('debug', message, ...args);
        console.debug(formatted);
        this.addLog('debug', message, args.length > 0 ? args : undefined);
    }

    info(message: string, ...args: any[]): void {
        if (!this.shouldLog('info')) return;
        const formatted = this.formatMessage('info', message, ...args);
        console.info(formatted);
        this.addLog('info', message, args.length > 0 ? args : undefined);
    }

    warn(message: string, ...args: any[]): void {
        if (!this.shouldLog('warn')) return;
        const formatted = this.formatMessage('warn', message, ...args);
        console.warn(formatted);
        this.addLog('warn', message, args.length > 0 ? args : undefined);
    }

    error(message: string, ...args: any[]): void {
        if (!this.shouldLog('error')) return;
        const formatted = this.formatMessage('error', message, ...args);
        console.error(formatted);
        this.addLog('error', message, args.length > 0 ? args : undefined);
    }

    /**
     * Get all logs
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs filtered by level
     */
    getLogsByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Clear all logs
     */
    clearLogs(): void {
        this.logs = [];
        this.info('Logs cleared');
    }

    /**
     * Export logs as JSON string
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}
