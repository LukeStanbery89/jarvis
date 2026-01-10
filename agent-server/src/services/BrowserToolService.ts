import { inject, injectable } from 'tsyringe';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { BrowserExtensionTool } from '../tools/browser/BrowserExtensionTool';
import { ToolExecutionManager } from '../tools/browser/ToolExecutionManager';
import { ToolSecurityValidator } from '../tools/browser/ToolSecurityValidator';
import { ClientManager } from '../websocket/ClientManager';
import { ToolDefinition } from '../../../shared/types';
import { logger } from '../utils/logger';

/**
 * Service for managing browser extension tools integration with LangChain
 * 
 * Handles:
 * - Registration of browser tools with agent framework
 * - Tool discovery from connected clients
 * - Dynamic tool availability management
 * - Tool execution coordination
 */

@injectable()
export class BrowserToolService {
    private registeredTools = new Map<string, BrowserExtensionTool>();
    private toolDefinitions: ToolDefinition[] = [];

    constructor(
        @inject(ToolExecutionManager) private executionManager: ToolExecutionManager,
        @inject(ToolSecurityValidator) private securityValidator: ToolSecurityValidator,
        @inject(ClientManager) private clientManager: ClientManager
    ) {
        this.initializeBuiltinTools();
        
        logger.info('BrowserToolService initialized', {
            service: 'BrowserToolService',
            registeredTools: this.toolDefinitions.length
        });
    }

    /**
     * Initialize built-in browser tools
     */
    private initializeBuiltinTools(): void {
        // Register extract page content tool
        this.registerTool({
            name: 'extract_page_content',
            description: 'Extract content from the current web page in the browser, prioritizing selected text if available',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        });

        // Register open URL tool
        this.registerTool({
            name: 'open_url',
            description: 'Navigate to a specified URL in the current browser tab or open in new tab',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The URL to navigate to',
                        pattern: '^https?://.+'
                    },
                    newTab: {
                        type: 'boolean',
                        description: 'Whether to open the URL in a new tab (default: false)'
                    }
                },
                required: ['url']
            }
        });

        logger.debug('Built-in browser tools registered', {
            service: 'BrowserToolService',
            tools: this.toolDefinitions.map(t => t.name)
        });
    }

    /**
     * Register a browser tool
     */
    private registerTool(definition: ToolDefinition): void {
        const tool = new BrowserExtensionTool(
            definition,
            this.executionManager,
            this.securityValidator,
            this.clientManager
        );

        this.registeredTools.set(definition.name, tool);
        this.toolDefinitions.push(definition);

        logger.debug('Browser tool registered', {
            service: 'BrowserToolService',
            toolName: definition.name
        });
    }

    /**
     * Get all available browser tools as LangChain StructuredTool instances
     */
    getTools(): DynamicStructuredTool[] {
        // Always return all registered tools - availability will be checked at execution time
        const allTools: DynamicStructuredTool[] = Array.from(this.registeredTools.values());

        logger.debug('Browser tools returned', {
            service: 'BrowserToolService',
            toolCount: allTools.length,
            totalRegistered: this.registeredTools.size,
            tools: allTools.map(t => t.name),
            connectedClients: this.clientManager.getAllClients().length
        });

        return allTools;
    }

    /**
     * Get tool definitions for client registration
     */
    getToolDefinitions(): ToolDefinition[] {
        return [...this.toolDefinitions];
    }

    /**
     * Check if a specific tool is available
     */
    isToolAvailable(toolName: string): boolean {
        if (!this.registeredTools.has(toolName)) {
            return false;
        }

        const supportingClients = this.clientManager.getClientsByCapability(toolName);
        const fallbackClients = this.clientManager.getClientsByCapability('browser_api_access');
        
        return supportingClients.length > 0 || fallbackClients.length > 0;
    }

    /**
     * Get tool by name
     */
    getTool(toolName: string): BrowserExtensionTool | undefined {
        return this.registeredTools.get(toolName);
    }

    /**
     * Get service statistics
     */
    getStats() {
        const stats = {
            totalTools: this.registeredTools.size,
            availableTools: this.getTools().length,
            toolDefinitions: this.toolDefinitions.length,
            connectedClients: this.clientManager.getAllClients().length,
            executionStats: this.executionManager.getStats()
        };

        // Add per-tool availability
        const toolAvailability: Record<string, any> = {};
        for (const [toolName] of this.registeredTools) {
            toolAvailability[toolName] = {
                available: this.isToolAvailable(toolName),
                supportingClients: this.clientManager.getClientsByCapability(toolName).length,
                fallbackClients: this.clientManager.getClientsByCapability('browser_api_access').length
            };
        }

        return {
            ...stats,
            toolAvailability
        };
    }

    /**
     * Refresh tool availability based on current client connections
     */
    refreshToolAvailability(): void {
        logger.debug('Refreshing tool availability', {
            service: 'BrowserToolService',
            connectedClients: this.clientManager.getAllClients().length
        });

        // Tool availability is dynamically calculated in getTools()
        // This method can be called when clients connect/disconnect
        // to trigger any necessary updates
    }
}