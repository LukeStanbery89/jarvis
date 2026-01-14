import { BaseToolExecutor } from './BaseToolExecutor';
import { ExtractPageContentTool } from './ExtractPageContentTool';
import { OpenUrlTool } from './OpenUrlTool';
import { ToolExecutionRequest, ToolExecutionResponse, ToolDefinition } from '@jarvis/protocol';
import { logger } from './utils/logger';
import { WebSocketClient } from '@jarvis/ws-client';

/**
 * Client-side tool execution manager
 *
 * Handles:
 * - Tool registration and discovery
 * - Execution request routing
 * - Tool lifecycle management
 * - Error handling and timeout management
 */

export class ToolExecutor {
    private tools = new Map<string, BaseToolExecutor>();
    private executionTimeouts = new Map<string, NodeJS.Timeout>();
    private websocketManager?: WebSocketClient;

    constructor(websocketManager?: WebSocketClient) {
        this.websocketManager = websocketManager;
        this.registerBuiltinTools();
        logger.info('ToolExecutor initialized', {
            service: 'ToolExecutor',
            registeredTools: Array.from(this.tools.keys())
        });
    }

    /**
     * Set the WebSocket manager reference (for late initialization)
     */
    setWebSocketManager(websocketManager: WebSocketClient): void {
        this.websocketManager = websocketManager;
        // Update existing tools with the websocket manager
        for (const tool of this.tools.values()) {
            tool.setWebSocketManager(websocketManager);
        }
    }

    /**
     * Register built-in tools
     */
    private registerBuiltinTools(): void {
        this.registerTool(new ExtractPageContentTool(this.websocketManager));
        this.registerTool(new OpenUrlTool(this.websocketManager));
    }

    /**
     * Register a tool executor
     */
    private registerTool(tool: BaseToolExecutor): void {
        this.tools.set(tool.toolName, tool);
        logger.debug('Tool registered', {
            service: 'ToolExecutor',
            toolName: tool.toolName
        });
    }

    /**
     * Execute a tool request
     */
    async executeToolRequest(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
        logger.info('Executing tool request', {
            service: 'ToolExecutor',
            toolName: request.toolName,
            executionId: request.executionId,
            timeout: request.timeout
        });

        const tool = this.tools.get(request.toolName);

        if (!tool) {
            logger.error('Tool not found', {
                service: 'ToolExecutor',
                toolName: request.toolName,
                executionId: request.executionId,
                availableTools: Array.from(this.tools.keys())
            });

            return this.createErrorResponse(
                request,
                'validation',
                `Tool '${request.toolName}' not found`,
                false,
                0
            );
        }

        const timeout = request.timeout || 30000; // 30 second default
        const startTime = Date.now();

        try {
            // Set up timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Tool execution timeout after ${timeout}ms`));
                }, timeout);

                this.executionTimeouts.set(request.executionId, timeoutId);
            });

            // Execute tool with timeout
            const response = await Promise.race([
                tool.execute(request),
                timeoutPromise
            ]);

            // Clear timeout on success
            this.clearExecutionTimeout(request.executionId);

            logger.info('Tool execution completed successfully', {
                service: 'ToolExecutor',
                toolName: request.toolName,
                executionId: request.executionId,
                executionTime: Date.now() - startTime
            });

            return response;

        } catch (error) {
            // Clear timeout on error
            this.clearExecutionTimeout(request.executionId);

            const executionTime = Date.now() - startTime;
            const isTimeout = error instanceof Error && error.message.includes('timeout');

            logger.error('Tool execution failed', {
                service: 'ToolExecutor',
                toolName: request.toolName,
                executionId: request.executionId,
                error: error instanceof Error ? error.message : 'Unknown error',
                isTimeout,
                executionTime
            });

            return this.createErrorResponse(
                request,
                isTimeout ? 'timeout' : 'unknown',
                error instanceof Error ? error.message : 'Unknown error',
                !isTimeout, // Timeouts are not recoverable, other errors might be
                executionTime
            );
        }
    }

    /**
     * Get available tools and their definitions
     */
    getAvailableTools(): ToolDefinition[] {
        const definitions: ToolDefinition[] = [];

        for (const [toolName, tool] of this.tools) {
            try {
                // Each tool class should have a static getToolDefinition method
                const toolClass = tool.constructor as any;
                if (typeof toolClass.getToolDefinition === 'function') {
                    definitions.push(toolClass.getToolDefinition());
                } else {
                    logger.warn('Tool missing definition method', {
                        service: 'ToolExecutor',
                        toolName
                    });
                }
            } catch (error) {
                logger.error('Failed to get tool definition', {
                    service: 'ToolExecutor',
                    toolName,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return definitions;
    }

    /**
     * Get capabilities list for client registration
     */
    getCapabilities(): string[] {
        const capabilities = [
            'browser_api_access',
            'page_content_extraction',
            'navigation',
            'tab_management'
        ];

        // Add specific tool capabilities
        for (const toolName of this.tools.keys()) {
            capabilities.push(toolName);
        }

        return capabilities;
    }

    /**
     * Clear execution timeout
     */
    private clearExecutionTimeout(executionId: string): void {
        const timeoutId = this.executionTimeouts.get(executionId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.executionTimeouts.delete(executionId);
        }
    }

    /**
     * Create error response
     */
    private createErrorResponse(
        request: ToolExecutionRequest,
        errorType: 'validation' | 'permission' | 'timeout' | 'browser_api' | 'network' | 'unknown',
        message: string,
        recoverable: boolean,
        executionTime: number
    ): ToolExecutionResponse {
        return {
            id: this.generateMessageId(),
            type: 'tool_execution_response',
            timestamp: Date.now(),
            executionId: request.executionId,
            success: false,
            error: {
                type: errorType,
                message,
                recoverable
            },
            executionTime
        };
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        // Clear all pending timeouts
        for (const timeoutId of this.executionTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.executionTimeouts.clear();

        logger.info('ToolExecutor cleaned up', {
            service: 'ToolExecutor'
        });
    }
}
