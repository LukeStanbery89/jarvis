import { DynamicStructuredTool } from '@langchain/core/tools';
import { inject, injectable } from 'tsyringe';
import { ToolDefinition, ToolExecutionRequest } from '@jarvis/protocol';
import { ToolExecutionManager } from './ToolExecutionManager';
import { ToolSecurityValidator } from './ToolSecurityValidator';
import { ClientManager, IClientConnection } from '@jarvis/ws-server';
import { logger } from '@jarvis/server-utils';

/**
 * LangChain tool wrapper for browser extension tools
 * 
 * Provides seamless integration between LangGraph agents and browser extension capabilities.
 * Handles:
 * - Asynchronous tool execution via WebSocket
 * - Client selection and load balancing
 * - Security validation and context management
 * - Error handling and timeout management
 * - Result formatting for LangChain consumption
 */

@injectable()
export class BrowserExtensionTool extends DynamicStructuredTool {
    constructor(
        private toolDefinition: ToolDefinition,
        @inject(ToolExecutionManager) private executionManager: ToolExecutionManager,
        @inject(ToolSecurityValidator) private securityValidator: ToolSecurityValidator,
        @inject(ClientManager) private clientManager: ClientManager
    ) {
        super({
            name: toolDefinition.name,
            description: toolDefinition.description,
            schema: toolDefinition.parameters,
            func: async (input: Record<string, any>) => {
                logger.info('DynamicStructuredTool received input', {
                    service: 'BrowserExtensionTool',
                    toolName: toolDefinition.name,
                    input
                });
                return await this.executeInternal(input);
            }
        });

        logger.info('BrowserExtensionTool created', {
            service: 'BrowserExtensionTool',
            toolName: this.name,
            description: this.description
        });
    }

    /**
     * Parse string input to parameters object
     */
    private parseInput(input: string): Record<string, any> {
        logger.info("parseInput", { input });
        try {
            return JSON.parse(input);
        } catch (error) {
            logger.warn('Failed to parse JSON input, using fallback parsing', {
                service: 'BrowserExtensionTool',
                toolName: this.toolDefinition.name,
                input: input.substring(0, 100), // Log first 100 chars for debugging
                error: error instanceof Error ? error.message : 'Unknown parse error'
            });

            // If JSON parsing fails, try to infer parameters based on tool type
            switch (this.toolDefinition.name) {
                case 'open_url':
                    // Try to detect newTab parameter from input string
                    const newTab = /new[\s\-_]?tab|new[\s\-_]?window/i.test(input);
                    const urlMatch = input.match(/https?:\/\/[^\s]+|[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}/);
                    const url = urlMatch ? urlMatch[0] : input.trim();

                    logger.info('Parsed open_url parameters from string', {
                        service: 'BrowserExtensionTool',
                        toolName: this.toolDefinition.name,
                        url,
                        newTab,
                        originalInput: input
                    });

                    return { url, newTab };
                case 'extract_page_content':
                    // Page content extraction doesn't need parameters
                    return {};
                default:
                    // Fallback to generic input parameter
                    return { input: input };
            }
        }
    }

    /**
     * Execute the tool on a browser extension client
     */
    private async executeInternal(parameters: Record<string, any>): Promise<string> {
        const executionId = this.executionManager.generateExecutionId();

        logger.info('Executing browser extension tool', {
            service: 'BrowserExtensionTool',
            toolName: this.name,
            executionId,
            parameters: Object.keys(parameters),
            parameterValues: parameters
        });

        try {
            // 1. Find available client with this capability
            const client = await this.selectClient();

            // 2. Create execution request with security context
            const request = this.createExecutionRequest(executionId, parameters, client);

            // 3. Validate security constraints
            await this.securityValidator.validateToolRequest(request, client, this.toolDefinition);

            // 4. Execute tool on client and return result
            const result = await this.executionManager.executeToolOnClient(client, request);

            logger.info('Browser extension tool completed successfully', {
                service: 'BrowserExtensionTool',
                toolName: this.name,
                executionId,
                clientId: client.id
            });

            return result;

        } catch (error) {
            logger.error('Browser extension tool execution failed', {
                service: 'BrowserExtensionTool',
                toolName: this.name,
                executionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Re-throw with context for LangChain
            throw new Error(`Browser tool '${this.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Select an available client for tool execution
     */
    private async selectClient(): Promise<IClientConnection> {
        // Get all clients with this specific tool capability
        const clientsWithTool = this.clientManager.getClientsByCapability(this.name);

        // Fallback to general browser API capability
        if (clientsWithTool.length === 0) {
            const clientsWithBrowserApi = this.clientManager.getClientsByCapability('browser_api_access');

            if (clientsWithBrowserApi.length === 0) {
                throw new Error(`No browser extension client available for tool: ${this.name}`);
            }

            return this.selectOptimalClient(clientsWithBrowserApi);
        }

        return this.selectOptimalClient(clientsWithTool);
    }

    /**
     * Select optimal client from available clients (basic load balancing)
     */
    private selectOptimalClient(clients: IClientConnection[]): IClientConnection {
        if (clients.length === 1) {
            return clients[0];
        }

        // Simple load balancing: select client with fewest pending executions
        let optimalClient = clients[0];
        let minPendingExecutions = this.executionManager.getPendingExecutionsForClient(clients[0].id);

        for (let i = 1; i < clients.length; i++) {
            const pendingExecutions = this.executionManager.getPendingExecutionsForClient(clients[i].id);
            if (pendingExecutions < minPendingExecutions) {
                optimalClient = clients[i];
                minPendingExecutions = pendingExecutions;
            }
        }

        logger.verbose('Selected optimal client for tool execution', {
            service: 'BrowserExtensionTool',
            toolName: this.name,
            selectedClientId: optimalClient.id,
            pendingExecutions: minPendingExecutions,
            totalAvailableClients: clients.length
        });

        return optimalClient;
    }

    /**
     * Create tool execution request with security context
     */
    private createExecutionRequest(
        executionId: string,
        parameters: Record<string, any>,
        client: IClientConnection
    ): ToolExecutionRequest {
        return {
            id: this.generateMessageId(),
            type: 'tool_execution_request',
            timestamp: Date.now(),
            executionId,
            toolName: this.name,
            parameters,
            timeout: this.getToolTimeout(),
            securityContext: {
                allowedOrigins: this.getAllowedOrigins(),
                permissions: this.getRequiredPermissions(),
                parameterValidation: this.toolDefinition.parameters
            }
        };
    }

    /**
     * Get tool-specific timeout (can be overridden per tool)
     */
    private getToolTimeout(): number {
        // Default timeout of 30 seconds, can be customized per tool type
        const defaultTimeout = 30000;

        switch (this.name) {
            case 'extract_page_content':
                return 15000; // Page content extraction should be fast
            case 'open_url':
                return 45000; // URL navigation might take longer
            default:
                return defaultTimeout;
        }
    }

    /**
     * Get allowed origins for this tool execution
     */
    private getAllowedOrigins(): string[] {
        return process.env.ALLOWED_TOOL_ORIGINS?.split(',') || ['localhost', '127.0.0.1'];
    }

    /**
     * Get required permissions for this tool
     */
    private getRequiredPermissions(): string[] {
        // Tool-specific permission requirements
        switch (this.name) {
            case 'extract_page_content':
                return ['content_extraction', 'page_access'];
            case 'open_url':
                return ['navigation', 'tab_management'];
            default:
                return ['browser_interaction'];
        }
    }


    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get tool statistics
     */
    getStats() {
        return {
            toolName: this.name,
            description: this.description,
            availableClients: this.clientManager.getClientsByCapability(this.name).length,
            executionStats: this.executionManager.getStats()
        };
    }
}