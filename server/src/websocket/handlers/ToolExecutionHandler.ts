import { inject, injectable } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import type { IClientConnection, IHandlerContext, ISocketWrapper } from '@jarvis/ws-server';
import { ToolExecutionResponse, ToolExecutionStatus } from '@jarvis/protocol';
import { ToolExecutionManager } from '@jarvis/rag-tools-server';
import { ClientManager } from '@jarvis/ws-server';
import { logger } from '@jarvis/server-utils';

/**
 * Handler for tool execution responses from browser extension clients
 *
 * Handles:
 * - Tool execution responses with results or errors
 * - Coordination with ToolExecutionManager for Promise resolution
 * - Error logging and debugging for failed tool executions
 */

@injectable()
export class ToolExecutionResponseHandler extends BaseHandler<ToolExecutionResponse> {
    readonly eventName = 'tool_execution_response';

    constructor(
        @inject(ClientManager) clientManager: ClientManager,
        @inject(ToolExecutionManager) private executionManager: ToolExecutionManager
    ) {
        super(clientManager);
    }

    /**
     * Handle incoming tool execution response message
     */
    async handle(socket: ISocketWrapper, data: ToolExecutionResponse, context: IHandlerContext): Promise<void> {
        const response = data as ToolExecutionResponse;

        if (!context.client) {
            logger.error('Tool execution response received from unregistered client', {
                service: 'ToolExecutionResponseHandler',
                socketId: socket.id
            });
            return;
        }

        await this.handleToolExecutionResponse(context.client, response);
    }

    /**
     * Handle tool execution response from client
     */
    async handleToolExecutionResponse(
        client: IClientConnection,
        response: ToolExecutionResponse
    ): Promise<void> {
        logger.info('Received tool execution response', {
            service: 'ToolExecutionHandler',
            executionId: response.executionId,
            success: response.success,
            clientId: client.id,
            toolName: 'unknown' // Will be resolved by ToolExecutionManager
        });

        try {
            // Validate response format
            this.validateToolResponse(response);

            // Forward to execution manager for Promise resolution
            this.executionManager.handleToolResponse(response);

            logger.verbose('Tool execution response processed successfully', {
                service: 'ToolExecutionHandler',
                executionId: response.executionId,
                clientId: client.id
            });

        } catch (error) {
            logger.error('Failed to process tool execution response', {
                service: 'ToolExecutionResponseHandler',
                executionId: response.executionId,
                clientId: client.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // If validation fails, still try to forward to manager
            // The manager can handle invalid responses appropriately
            this.executionManager.handleToolResponse(response);
        }
    }


    /**
     * Validate tool execution response format
     */
    private validateToolResponse(response: ToolExecutionResponse): void {
        const required = ['id', 'type', 'timestamp', 'executionId', 'success', 'executionTime'];

        for (const field of required) {
            if (!(field in response)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (response.type !== 'tool_execution_response') {
            throw new Error(`Invalid response type: ${response.type}`);
        }

        if (typeof response.success !== 'boolean') {
            throw new Error('Success field must be boolean');
        }

        if (typeof response.executionTime !== 'number' || response.executionTime < 0) {
            throw new Error('ExecutionTime must be a non-negative number');
        }

        // If success is false, error should be present
        if (!response.success && !response.error) {
            logger.warn('Failed tool response missing error details', {
                service: 'ToolExecutionHandler',
                executionId: response.executionId
            });
        }

        // Validate error format if present
        if (response.error) {
            this.validateErrorFormat(response.error);
        }
    }


    /**
     * Validate error object format
     */
    private validateErrorFormat(error: any): void {
        const required = ['type', 'message', 'recoverable'];

        for (const field of required) {
            if (!(field in error)) {
                throw new Error(`Error object missing required field: ${field}`);
            }
        }

        const validErrorTypes = ['validation', 'permission', 'timeout', 'browser_api', 'network', 'unknown'];
        if (!validErrorTypes.includes(error.type)) {
            throw new Error(`Invalid error type: ${error.type}`);
        }

        if (typeof error.message !== 'string') {
            throw new Error('Error message must be a string');
        }

        if (typeof error.recoverable !== 'boolean') {
            throw new Error('Error recoverable field must be boolean');
        }

        if (error.retryAfter !== undefined && (typeof error.retryAfter !== 'number' || error.retryAfter < 0)) {
            throw new Error('Error retryAfter must be a non-negative number');
        }
    }

    /**
     * Get handler statistics
     */
    getStats() {
        return {
            handlerName: 'ToolExecutionResponseHandler',
            executionStats: this.executionManager.getStats()
        };
    }
}