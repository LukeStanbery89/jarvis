import { IEventHandler, IHandlerContext, ISocketWrapper, ILogger } from './types';
import { ClientManager } from './ClientManager';

/**
 * Base class for all WebSocket event handlers
 * Provides common functionality and ensures consistent structure
 * Generic type parameter TData allows type-safe message handling
 */
export abstract class BaseHandler<TData = unknown> implements IEventHandler<TData> {
    protected logger: ILogger;

    constructor(
        protected clientManager: ClientManager,
        logger?: ILogger
    ) {
        // Default to console logger if none provided
        this.logger = logger || {
            info: (message: string, meta?: any) => console.log(message, meta),
            warn: (message: string, meta?: any) => console.warn(message, meta),
            error: (message: string, meta?: any) => console.error(message, meta),
            debug: (message: string, meta?: any) => console.debug(message, meta)
        };
    }

    abstract readonly eventName: string;

    /**
     * Handle the WebSocket event
     * Subclasses must implement this method
     */
    abstract handle(socket: ISocketWrapper, data: TData, context: IHandlerContext): Promise<void>;

    /**
     * Create handler context from socket
     */
    protected createContext(socket: ISocketWrapper): IHandlerContext {
        return {
            clientId: socket.id,
            client: this.clientManager.getClient(socket.id),
            timestamp: Date.now()
        };
    }

    /**
     * Emit error to client
     */
    protected emitError(socket: ISocketWrapper, message: string, details?: any): void {
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
    protected validateClientRegistration(socket: ISocketWrapper, context: IHandlerContext): boolean {
        if (!context.client) {
            this.logger.warn('Client validation failed', {
                service: this.eventName,
                socketId: socket.id,
                availableClients: Array.from(this.clientManager.getAllClients()).map(c => c.id)
            });
            this.emitError(socket, 'Client not registered. Please register first.');
            return false;
        }
        this.logger.debug('Client validation passed', {
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
            this.logger.debug(action, { service: this.eventName, ...details });
        } else {
            this.logger.info(action, { service: this.eventName });
        }
    }
}
