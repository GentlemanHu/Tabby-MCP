import { Injectable } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { translate, defaultLocale } from '../i18n';
import { McpLoggerService } from './mcpLogger.service';

/**
 * MCP i18n Service
 * Provides translation support that follows Tabby's locale settings
 */
@Injectable({ providedIn: 'root' })
export class McpI18nService {
    private currentLocale: string = defaultLocale;

    constructor(
        private config: ConfigService,
        private logger: McpLoggerService
    ) {
        this.init();
    }

    private init(): void {
        // Get initial locale from Tabby config
        this.updateLocale();

        // Subscribe to config changes to detect language switches
        this.config.changed$.subscribe(() => {
            this.updateLocale();
        });
    }

    private updateLocale(): void {
        // Tabby stores language setting in config.store.language
        const newLocale = this.config.store.language || defaultLocale;
        if (newLocale !== this.currentLocale) {
            this.currentLocale = newLocale;
            this.logger.debug(`[i18n] Locale changed to: ${newLocale}`);
        }
    }

    /**
     * Get current locale
     */
    getLocale(): string {
        return this.currentLocale;
    }

    /**
     * Translate a key to current locale
     * @param key Translation key (e.g., 'mcp.settings.title')
     * @param params Optional parameters for interpolation
     */
    t(key: string, params?: Record<string, string | number>): string {
        return translate(this.currentLocale, key, params);
    }

    /**
     * Alias for t() - translate a key
     */
    translate(key: string, params?: Record<string, string | number>): string {
        return this.t(key, params);
    }
}
