import { ToolExecutionRequest, ToolExecutionResponse } from '@jarvis/protocol';
import { logger } from '../utils/logger';

/**
 * Base class for browser extension tool executors
 * 
 * Provides:
 * - Common interface for tool execution
 * - Standard response formatting
 * - Error handling utilities
 * - Logging support
 */

export abstract class BaseToolExecutor {
    abstract readonly toolName: string;
    
    /**
     * Execute the tool with the given request
     */
    abstract execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse>;

    /**
     * Create a successful tool execution response
     */
    protected createSuccessResponse(
        request: ToolExecutionRequest,
        result: any,
        executionTime: number
    ): ToolExecutionResponse {
        return {
            id: this.generateMessageId(),
            type: 'tool_execution_response',
            timestamp: Date.now(),
            executionId: request.executionId,
            success: true,
            result,
            executionTime
        };
    }

    /**
     * Create an error tool execution response
     */
    protected createErrorResponse(
        request: ToolExecutionRequest,
        errorType: 'validation' | 'permission' | 'timeout' | 'browser_api' | 'network' | 'unknown',
        message: string,
        recoverable: boolean,
        executionTime: number,
        retryAfter?: number
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
                recoverable,
                retryAfter
            },
            executionTime
        };
    }

    /**
     * Send status update during tool execution
     */
    protected async sendStatusUpdate(
        request: ToolExecutionRequest,
        status: 'queued' | 'executing' | 'completed' | 'failed' | 'timeout',
        progress?: number,
        statusMessage?: string
    ): Promise<void> {
        const statusUpdate = {
            id: this.generateMessageId(),
            type: 'tool_execution_status',
            timestamp: Date.now(),
            executionId: request.executionId,
            status,
            progress,
            statusMessage
        };

        try {
            // Send status update directly through WebSocket manager
            // Since tools run in background script context, we can access websocketManager directly
            const { websocketManager } = await import('../websocket');
            if (websocketManager.connected) {
                websocketManager.sendMessage('tool_execution_status', statusUpdate);
            }
        } catch (error) {
            logger.error('Failed to send status update', {
                service: 'BaseToolExecutor',
                toolName: this.toolName,
                executionId: request.executionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Validate tool parameters against expected schema
     */
    protected validateParameters(
        parameters: Record<string, unknown>,
        expectedParameters: string[] = []
    ): void {
        for (const param of expectedParameters) {
            if (!(param in parameters)) {
                throw new Error(`Missing required parameter: ${param}`);
            }
        }
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}