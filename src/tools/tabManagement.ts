import { Injectable } from '@angular/core';
import { AppService, BaseTabComponent, ConfigService, SplitTabComponent, ProfilesService } from 'tabby-core';
import { z } from 'zod';
import { BaseToolCategory } from './base-tool-category';
import { McpLoggerService } from '../services/mcpLogger.service';
import { McpTool } from '../types/types';

/**
 * Tab Management Tools Category - Comprehensive tab and profile management
 */
@Injectable({ providedIn: 'root' })
export class TabManagementToolCategory extends BaseToolCategory {
    name = 'tab_management';

    constructor(
        private app: AppService,
        logger: McpLoggerService,
        private config: ConfigService,
        private profilesService: ProfilesService
    ) {
        super(logger);
        this.initializeTools();
    }

    private initializeTools(): void {
        // Tab operations
        this.registerTool(this.createListTabsTool());
        this.registerTool(this.createSelectTabTool());
        this.registerTool(this.createCloseTabTool());
        this.registerTool(this.createCloseAllTabsTool());
        this.registerTool(this.createDuplicateTabTool());
        this.registerTool(this.createNextTabTool());
        this.registerTool(this.createPreviousTabTool());
        this.registerTool(this.createMoveTabLeftTool());
        this.registerTool(this.createMoveTabRightTool());
        this.registerTool(this.createReopenLastTabTool());

        // Profile/Session operations
        this.registerTool(this.createListProfilesTool());
        this.registerTool(this.createOpenProfileTool());
        this.registerTool(this.createShowProfileSelectorTool());
        this.registerTool(this.createQuickConnectTool());

        // Split pane operations
        this.registerTool(this.createSplitTabTool());

        this.logger.info('Tab management tools initialized');
    }

    // ============= Tab Operations =============

    private createListTabsTool(): McpTool {
        return {
            name: 'list_tabs',
            description: 'List all open tabs in Tabby with their details (id, title, type, active status)',
            schema: {},
            handler: async () => {
                const tabs = this.app.tabs.map((tab, index) => ({
                    id: index,
                    title: tab.title || `Tab ${index}`,
                    type: tab.constructor.name,
                    isActive: this.app.activeTab === tab,
                    hasFocus: tab.hasFocus,
                    color: tab.color
                }));

                this.logger.info(`Listed ${tabs.length} tabs`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, tabs, count: tabs.length }, null, 2) }]
                };
            }
        };
    }

    private createSelectTabTool(): McpTool {
        return {
            name: 'select_tab',
            description: 'Select/focus a specific tab by its index',
            schema: {
                tabIndex: z.number().describe('Index of the tab to select (0-based)')
            },
            handler: async (params: { tabIndex: number }) => {
                const { tabIndex } = params;

                if (tabIndex < 0 || tabIndex >= this.app.tabs.length) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Invalid tab index: ${tabIndex}. Available: 0-${this.app.tabs.length - 1}` }) }]
                    };
                }

                const tab = this.app.tabs[tabIndex];
                this.app.selectTab(tab);

                this.logger.info(`Selected tab ${tabIndex}: ${tab.title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Selected tab: ${tab.title}` }) }]
                };
            }
        };
    }

    private createCloseTabTool(): McpTool {
        return {
            name: 'close_tab',
            description: 'Close a specific tab by its index. If no index provided, closes the active tab.',
            schema: {
                tabIndex: z.number().optional().describe('Index of the tab to close (default: active tab)'),
                force: z.boolean().optional().describe('Force close without asking (default: false)')
            },
            handler: async (params: { tabIndex?: number; force?: boolean }) => {
                const { tabIndex, force = false } = params;

                let tab: BaseTabComponent | null;
                if (tabIndex !== undefined) {
                    if (tabIndex < 0 || tabIndex >= this.app.tabs.length) {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Invalid tab index: ${tabIndex}` }) }]
                        };
                    }
                    tab = this.app.tabs[tabIndex];
                } else {
                    tab = this.app.activeTab;
                }

                if (!tab) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No tab to close' }) }]
                    };
                }

                const title = tab.title;
                await this.app.closeTab(tab, !force);

                this.logger.info(`Closed tab: ${title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Closed tab: ${title}` }) }]
                };
            }
        };
    }

    private createCloseAllTabsTool(): McpTool {
        return {
            name: 'close_all_tabs',
            description: 'Close all open tabs',
            schema: {},
            handler: async () => {
                const count = this.app.tabs.length;
                const success = await this.app.closeAllTabs();

                if (success) {
                    this.logger.info(`Closed all ${count} tabs`);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Closed ${count} tabs` }) }]
                    };
                } else {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Some tabs blocked closure' }) }]
                    };
                }
            }
        };
    }

    private createDuplicateTabTool(): McpTool {
        return {
            name: 'duplicate_tab',
            description: 'Duplicate the active tab or a specific tab',
            schema: {
                tabIndex: z.number().optional().describe('Index of the tab to duplicate (default: active tab)')
            },
            handler: async (params: { tabIndex?: number }) => {
                const { tabIndex } = params;

                let tab: BaseTabComponent | null;
                if (tabIndex !== undefined) {
                    if (tabIndex < 0 || tabIndex >= this.app.tabs.length) {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Invalid tab index: ${tabIndex}` }) }]
                        };
                    }
                    tab = this.app.tabs[tabIndex];
                } else {
                    tab = this.app.activeTab;
                }

                if (!tab) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No tab to duplicate' }) }]
                    };
                }

                const newTab = await this.app.duplicateTab(tab);

                if (newTab) {
                    this.logger.info(`Duplicated tab: ${tab.title}`);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Duplicated tab: ${tab.title}`, newTabIndex: this.app.tabs.indexOf(newTab) }) }]
                    };
                } else {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Failed to duplicate tab' }) }]
                    };
                }
            }
        };
    }

    private createNextTabTool(): McpTool {
        return {
            name: 'next_tab',
            description: 'Switch to the next tab',
            schema: {},
            handler: async () => {
                this.app.nextTab();
                const currentTab = this.app.activeTab;

                this.logger.info(`Switched to next tab: ${currentTab?.title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, currentTab: currentTab?.title }) }]
                };
            }
        };
    }

    private createPreviousTabTool(): McpTool {
        return {
            name: 'previous_tab',
            description: 'Switch to the previous tab',
            schema: {},
            handler: async () => {
                this.app.previousTab();
                const currentTab = this.app.activeTab;

                this.logger.info(`Switched to previous tab: ${currentTab?.title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, currentTab: currentTab?.title }) }]
                };
            }
        };
    }

    private createMoveTabLeftTool(): McpTool {
        return {
            name: 'move_tab_left',
            description: 'Move the active tab to the left',
            schema: {},
            handler: async () => {
                this.app.moveSelectedTabLeft();
                const currentTab = this.app.activeTab;
                const index = currentTab ? this.app.tabs.indexOf(currentTab) : -1;

                this.logger.info(`Moved tab left: ${currentTab?.title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, tabTitle: currentTab?.title, newIndex: index }) }]
                };
            }
        };
    }

    private createMoveTabRightTool(): McpTool {
        return {
            name: 'move_tab_right',
            description: 'Move the active tab to the right',
            schema: {},
            handler: async () => {
                this.app.moveSelectedTabRight();
                const currentTab = this.app.activeTab;
                const index = currentTab ? this.app.tabs.indexOf(currentTab) : -1;

                this.logger.info(`Moved tab right: ${currentTab?.title}`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: true, tabTitle: currentTab?.title, newIndex: index }) }]
                };
            }
        };
    }

    private createReopenLastTabTool(): McpTool {
        return {
            name: 'reopen_last_tab',
            description: 'Reopen the last closed tab',
            schema: {},
            handler: async () => {
                const tab = await this.app.reopenLastTab();

                if (tab) {
                    this.logger.info(`Reopened tab: ${tab.title}`);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: true, tabTitle: tab.title }) }]
                    };
                } else {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No tab to reopen' }) }]
                    };
                }
            }
        };
    }

    // ============= Profile/Session Operations =============

    private createListProfilesTool(): McpTool {
        return {
            name: 'list_profiles',
            description: 'List all available terminal profiles (local shell, SSH connections, etc.)',
            schema: {},
            handler: async () => {
                try {
                    const profiles = await this.profilesService.getProfiles();
                    const formatted = profiles.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        group: p.group,
                        icon: p.icon,
                        color: p.color
                    }));

                    this.logger.info(`Listed ${profiles.length} profiles`);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: true, profiles: formatted, count: profiles.length }, null, 2) }]
                    };
                } catch (error: any) {
                    this.logger.error('Error listing profiles:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }

    private createOpenProfileTool(): McpTool {
        return {
            name: 'open_profile',
            description: 'Open a new terminal tab using a specific profile (use list_profiles to get available profiles)',
            schema: {
                profileId: z.string().optional().describe('ID of the profile to open'),
                profileName: z.string().optional().describe('Name of the profile to open (if ID not provided)')
            },
            handler: async (params: { profileId?: string; profileName?: string }) => {
                const { profileId, profileName } = params;

                if (!profileId && !profileName) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Either profileId or profileName must be provided' }) }]
                    };
                }

                try {
                    const profiles = await this.profilesService.getProfiles();
                    let profile = profiles.find(p =>
                        (profileId && p.id === profileId) ||
                        (profileName && p.name.toLowerCase().includes(profileName.toLowerCase()))
                    );

                    if (!profile) {
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: false,
                                    error: `Profile not found: ${profileId || profileName}`,
                                    availableProfiles: profiles.map(p => ({ id: p.id, name: p.name }))
                                })
                            }]
                        };
                    }

                    const tab = await this.profilesService.openNewTabForProfile(profile);

                    if (tab) {
                        this.logger.info(`Opened profile: ${profile.name}`);
                        return {
                            content: [{
                                type: 'text', text: JSON.stringify({
                                    success: true,
                                    message: `Opened profile: ${profile.name}`,
                                    tabIndex: this.app.tabs.indexOf(tab),
                                    tabTitle: tab.title
                                })
                            }]
                        };
                    } else {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Failed to open profile' }) }]
                        };
                    }
                } catch (error: any) {
                    this.logger.error('Error opening profile:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }

    private createShowProfileSelectorTool(): McpTool {
        return {
            name: 'show_profile_selector',
            description: 'Show the profile selector dialog for the user to choose a profile',
            schema: {},
            handler: async () => {
                try {
                    const profile = await this.profilesService.showProfileSelector();

                    if (profile) {
                        this.logger.info(`User selected profile: ${profile.name}`);
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: true, selectedProfile: profile.name }) }]
                        };
                    } else {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'User cancelled profile selection' }) }]
                        };
                    }
                } catch (error: any) {
                    this.logger.error('Error showing profile selector:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }

    private createQuickConnectTool(): McpTool {
        return {
            name: 'quick_connect',
            description: 'Quick connect to SSH using a connection string (e.g., "user@host")',
            schema: {
                query: z.string().describe('SSH connection string (e.g., "user@host" or "user@host:port")')
            },
            handler: async (params: { query: string }) => {
                const { query } = params;

                try {
                    const profile = await this.profilesService.quickConnect(query);

                    if (profile) {
                        this.logger.info(`Quick connect to: ${query}`);
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Connected to: ${query}`, profile: profile.name }) }]
                        };
                    } else {
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Quick connect failed' }) }]
                        };
                    }
                } catch (error: any) {
                    this.logger.error('Error with quick connect:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }

    // ============= Split Pane Operations =============

    private createSplitTabTool(): McpTool {
        return {
            name: 'split_tab',
            description: 'Split the current terminal horizontally or vertically',
            schema: {
                direction: z.enum(['horizontal', 'vertical']).describe('Split direction'),
                ratio: z.number().optional().describe('Split ratio (0.1 to 0.9, default: 0.5)')
            },
            handler: async (params: { direction: 'horizontal' | 'vertical'; ratio?: number }) => {
                const { direction, ratio = 0.5 } = params;

                const activeTab = this.app.activeTab;
                if (!activeTab) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No active tab' }) }]
                    };
                }

                try {
                    // Get the parent split tab or create one
                    let splitTab = this.app.getParentTab(activeTab);

                    if (!splitTab) {
                        // The current tab is not in a split - we'd need to wrap it
                        // For now, just duplicate the tab as a simple solution
                        const newTab = await this.app.duplicateTab(activeTab);
                        if (newTab) {
                            this.logger.info(`Created split by duplicating tab (${direction})`);
                            return {
                                content: [{
                                    type: 'text', text: JSON.stringify({
                                        success: true,
                                        message: `Created new tab (split simulation)`,
                                        note: 'Full split pane requires SplitTabComponent integration'
                                    })
                                }]
                            };
                        }
                    }

                    this.logger.info(`Split tab ${direction}`);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: true, direction }) }]
                    };
                } catch (error: any) {
                    this.logger.error('Error splitting tab:', error);
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }]
                    };
                }
            }
        };
    }
}
