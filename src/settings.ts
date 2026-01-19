import { Injectable } from '@angular/core';
import { SettingsTabProvider } from 'tabby-settings';
import { McpSettingsTabComponent } from './components/mcpSettingsTab.component';

/**
 * MCP Settings Tab Provider
 */
@Injectable()
export class McpSettingsTabProvider extends SettingsTabProvider {
    id = 'mcp';
    icon = 'server';
    title = 'MCP';

    getComponentType(): any {
        return McpSettingsTabComponent;
    }
}
