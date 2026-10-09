import { Injectable } from '@angular/core';
import { ConfigService, PlatformService } from 'tabby-core';
import { PLUGIN_VERSION } from '../version';

export interface PluginUpdateInfo {
    current: string;
    latest: string;
    available: boolean;
}

/**
 * Detects a newer tabby-mcp-server on npm and installs it through the same
 * PlatformService.installPlugin path Tabby's built-in plugin manager uses.
 */
@Injectable({ providedIn: 'root' })
export class PluginUpdateService {
    readonly packageName = 'tabby-mcp-server';

    constructor(
        private platform: PlatformService,
        private config: ConfigService
    ) { }

    async check(): Promise<PluginUpdateInfo> {
        const current = PLUGIN_VERSION;
        const response = await fetch(`https://registry.npmjs.org/${this.packageName}/latest`);
        if (!response.ok) {
            throw new Error(`npm registry returned ${response.status}`);
        }
        const body = await response.json();
        const latest = String(body?.version || '');
        if (!/^\d+\.\d+\.\d+/.test(latest)) {
            throw new Error('npm registry returned an invalid version');
        }
        return {
            current,
            latest,
            available: this.isNewer(latest, current)
        };
    }

    /** Same install + restart request the Plugins settings tab performs. */
    async install(version: string): Promise<void> {
        if (!/^\d+\.\d+\.\d+/.test(version)) {
            throw new Error(`Refusing to install invalid version: ${version}`);
        }
        await this.platform.installPlugin(this.packageName, version);
        this.config.requestRestart();
    }

    private isNewer(remote: string, local: string): boolean {
        const parse = (value: string) => value.replace(/^v/, '').split('-')[0].split('.').map(part => parseInt(part, 10) || 0);
        const next = parse(remote);
        const current = parse(local);
        for (let index = 0; index < 3; index++) {
            const left = next[index] || 0;
            const right = current[index] || 0;
            if (left !== right) {
                return left > right;
            }
        }
        return false;
    }
}
