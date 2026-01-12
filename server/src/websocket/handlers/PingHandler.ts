import { injectable, inject } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import type { IHandlerContext, ISocketWrapper } from '@jarvis/ws-server';
import { ClientManager } from '@jarvis/ws-server';

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
    async handle(socket: ISocketWrapper, data: any, context: IHandlerContext): Promise<void> {
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