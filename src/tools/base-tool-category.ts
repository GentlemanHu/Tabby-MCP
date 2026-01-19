import { McpTool, ToolCategory } from '../types/types';
import { McpLoggerService } from '../services/mcpLogger.service';

/**
 * Base class for tool categories
 */
export abstract class BaseToolCategory implements ToolCategory {
    abstract name: string;
    public mcpTools: McpTool[] = [];

    constructor(protected logger: McpLoggerService) { }

    /**
     * Register a tool with this category
     */
    protected registerTool(tool: McpTool): void {
        this.mcpTools.push(tool);
        this.logger.debug(`Tool registered in category ${this.name}: ${tool.name}`);
    }
}
