import { inject, injectable } from 'tsyringe';
import { WebSocket } from 'ws';
import { BaseHandler } from './BaseHandler';
import { IClientConnection, IHandlerContext, IEventHandler } from '../types';
import { ToolExecutionStatus } from '@jarvis/protocol';
import { ClientManager } from '../ClientManager';
import { logger } from '../../utils/logger';

/**
 * Handler for tool execution status updates from browser extension clients
 * 
 * Handles:
 * - Tool execution status updates during long-running operations
 * - Progress reporting and status message logging
 * - Future: Could forward status to UI for progress indication
 */

@injectable()
export class ToolExecutionStatusHandler extends BaseHandler implements IEventHandler {
    readonly eventName = 'tool_execution_status';

    constructor(
        @inject(ClientManager) clientManager: ClientManager
    ) {
        super(clientManager);
    }

    /**
     * Handle incoming tool execution status message
     */
    async handle(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, data: any, context: IHandlerContext): Promise<void> {
        const status = data as ToolExecutionStatus;
        
        if (!context.client) {
            logger.error('Tool execution status received from unregistered client', {
                service: 'ToolExecutionStatusHandler',
                socketId: socket.id
            });
            return;
        }

        await this.handleToolExecutionStatus(context.client, status);
    }

    /**
     * Handle tool execution status updates from client
     */
    private async handleToolExecutionStatus(
        client: IClientConnection, 
        status: ToolExecutionStatus
    ): Promise<void> {
        logger.verbose('Received tool execution status update', {
            service: 'ToolExecutionStatusHandler',
            executionId: status.executionId,
            status: status.status,
            progress: status.progress,
            clientId: client.id
        });

        try {
            // Validate status format
            this.validateToolStatus(status);
            
            // Forward status updates to all clients (especially popup UI)
            // This allows the UI to show progress during tool execution
            this.forwardStatusToClients(status);
            
            if (status.statusMessage) {
                logger.debug('Tool execution status message', {
                    service: 'ToolExecutionStatusHandler',
                    executionId: status.executionId,
                    statusMessage: status.statusMessage,
                    clientId: client.id
                });
            }
            
        } catch (error) {
            logger.warn('Invalid tool execution status update', {
                service: 'ToolExecutionStatusHandler',
                executionId: status.executionId,
                clientId: client.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Validate tool execution status format
     */
    private validateToolStatus(status: ToolExecutionStatus): void {
        const required = ['id', 'type', 'timestamp', 'executionId', 'status'];
        
        for (const field of required) {
            if (!(field in status)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (status.type !== 'tool_execution_status') {
            throw new Error(`Invalid status type: ${status.type}`);
        }
        
        const validStatuses = ['queued', 'executing', 'completed', 'failed', 'timeout'];
        if (!validStatuses.includes(status.status)) {
            throw new Error(`Invalid status value: ${status.status}`);
        }
        
        if (status.progress !== undefined) {
            if (typeof status.progress !== 'number' || status.progress < 0 || status.progress > 100) {
                throw new Error('Progress must be a number between 0 and 100');
            }
        }
    }

    /**
     * Forward tool status updates to all connected clients
     */
    private forwardStatusToClients(status: ToolExecutionStatus): void {
        // Broadcast to all connected clients
        // This ensures the popup UI receives status updates during tool execution
        const allClients = this.clientManager.getAllClients();
        
        for (const client of allClients) {
            try {
                client.socket.emit('tool_execution_status', status);
            } catch (error) {
                logger.warn('Failed to forward status update to client', {
                    service: 'ToolExecutionStatusHandler',
                    clientId: client.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        logger.debug('Tool status forwarded to clients', {
            service: 'ToolExecutionStatusHandler',
            executionId: status.executionId,
            status: status.status,
            statusMessage: status.statusMessage,
            clientCount: allClients.length
        });
    }

    /**
     * Get handler statistics
     */
    getStats() {
        return {
            handlerName: 'ToolExecutionStatusHandler'
        };
    }
}