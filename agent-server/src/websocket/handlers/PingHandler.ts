import { WebSocket } from 'ws';
import { injectable, inject } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import { IHandlerContext } from '../types';
import { ClientManager } from '../ClientManager';

/**
 * Handler for ping/pong messages to maintain connection health
 */
@injectable()
export class PingHandler extends BaseHandler {
    readonly eventName = 'ping';

    constructor(
        @inject(ClientManager) clientManager: ClientManager
    ) {
        super(clientManager);
        this.logActivity('PingHandler initialized');
    }

    /**
     * Handle ping message and respond with pong
     */
    async handle(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, data: any, context: IHandlerContext): Promise<void> {
        this.logActivity('Ping received, sending pong', {
            clientId: context.clientId,
            pingId: data.id
        });

        // Send pong response
        socket.emit('pong', {
            id: data.id || this.generateMessageId(),
            type: 'pong',
            timestamp: Date.now(),
            originalTimestamp: data.timestamp
        });
    }
}