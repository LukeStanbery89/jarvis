import { WebSocket } from 'ws';
import { inject } from 'tsyringe';
import { IEventHandler, IHandlerContext } from '../types';
import { ClientManager } from '../ClientManager';
import { logger } from '../../utils/logger';

/**
 * Base class for all WebSocket event handlers
 * Provides common functionality and ensures consistent structure
 */
export abstract class BaseHandler implements IEventHandler {
    constructor(
        @inject(ClientManager) protected clientManager: ClientManager
    ) { }

    abstract readonly eventName: string;

    /**
     * Handle the WebSocket event
     * Subclasses must implement this method
     */
    abstract handle(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, data: any, context: IHandlerContext): Promise<void>;

    /**
     * Create handler context from socket
     */
    protected createContext(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }): IHandlerContext {
        return {
            clientId: socket.id,
            client: this.clientManager.getClient(socket.id),
            timestamp: Date.now()
        };
    }

    /**
     * Emit error to client
     */
    protected emitError(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, message: string, details?: any): void {
        socket.emit('error', {
            id: this.generateMessageId(),
            type: 'error',
            timestamp: Date.now(),
            message,
            details
        });
    }

    /**
     * Generate unique message ID
     */
    protected generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate that client is registered before processing events
     */
    protected validateClientRegistration(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, context: IHandlerContext): boolean {
        if (!context.client) {
            logger.warn('Client validation failed', {
                service: this.eventName,
                socketId: socket.id,
                availableClients: Array.from(this.clientManager.getAllClients()).map(c => c.id)
            });
            this.emitError(socket, 'Client not registered. Please register first.');
            return false;
        }
        logger.verbose('Client validation passed', {
            service: this.eventName,
            clientId: context.client.id
        });
        return true;
    }

    /**
     * Log handler activity
     */
    protected logActivity(action: string, details?: any): void {
        if (details) {
            logger.verbose(action, { service: this.eventName, ...details });
        } else {
            logger.info(action, { service: this.eventName });
        }
    }
}