import { injectable, inject } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import type { IHandlerContext, ISocketWrapper } from '@jarvis/ws-server';
import { ClientManager } from '@jarvis/ws-server';
import { AuthenticationService } from '../../services/AuthenticationService';
import { ChatService, CHAT_SERVICE_TOKEN } from '../../services/ChatService';
import { logger } from '@jarvis/server-utils';

/**
 * Handler for clearing conversation history
 */
@injectable()
export class ClearConversationHandler extends BaseHandler {
    readonly eventName = 'clear_conversation';

    constructor(
        @inject(ClientManager) clientManager: ClientManager,
        @inject(AuthenticationService) private authService: AuthenticationService,
        @inject(CHAT_SERVICE_TOKEN) private chatService: ChatService
    ) {
        super(clientManager);
        this.logActivity('ClearConversationHandler initialized');
    }

    /**
     * Handle clear conversation request
     */
    async handle(socket: ISocketWrapper, data: any, context: IHandlerContext): Promise<void> {
        // Validate client registration
        if (!this.validateClientRegistration(socket, context)) {
            return;
        }

        const client = context.client!;

        // Check if user has chat permissions
        if (!this.authService.hasPermission(client.user, 'chat')) {
            this.emitError(socket, 'Insufficient permissions to clear conversation');
            return;
        }

        this.logActivity('Clearing conversation history', {
            clientId: client.id,
            clientType: client.type,
            sessionId: data.sessionId || 'unknown'
        });

        try {
            // Clear conversation history for this client
            await this.chatService.clearHistory(client.id);

            // Send confirmation back to client
            socket.emit('conversation_cleared', {
                id: this.generateMessageId(),
                type: 'conversation_cleared',
                timestamp: Date.now(),
                success: true
            });

            this.logActivity('Conversation history cleared successfully', {
                clientId: client.id
            });

        } catch (error) {
            logger.error('Error clearing conversation history', {
                service: 'ClearConversationHandler',
                error: error instanceof Error ? error.message : 'Unknown error',
                clientId: client.id
            });

            this.emitError(socket, 'Failed to clear conversation history');

            this.logActivity('Failed to clear conversation history', {
                clientId: client.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}