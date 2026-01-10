import { WebSocket } from 'ws';
import { injectable, inject } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import { IHandlerContext } from '../types';
import { ClientManager } from '../ClientManager';
import { AuthenticationService } from '../../services/AuthenticationService';
import { ChatService, CHAT_SERVICE_TOKEN } from '../../services/ChatService';
import { ChatMessage } from '@jarvis/protocol';
import { logger } from '../../utils/logger';

/**
 * Simplified Chat Handler using LangGraph
 * 
 * Streamlined chat handling that:
 * - Uses LangGraph agents with web search capabilities
 * - Maintains separate conversation histories per client
 * - Provides clean error handling and logging
 * - Simplified architecture with minimal service dependencies
 */
@injectable()
export class ChatHandler extends BaseHandler {
    readonly eventName = 'chat_message';

    constructor(
        @inject(ClientManager) clientManager: ClientManager,
        @inject(AuthenticationService) private authService: AuthenticationService,
        @inject(CHAT_SERVICE_TOKEN) private chatService: ChatService
    ) {
        super(clientManager);
        this.logActivity('ChatHandler initialized');
    }

    /**
     * Handle chat message using simplified LangGraph service
     */
    async handle(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, data: ChatMessage, context: IHandlerContext): Promise<void> {
        // Validate client registration
        if (!this.validateClientRegistration(socket, context)) {
            return;
        }

        const client = context.client!;

        // Check if user has chat permissions
        if (!this.authService.hasPermission(client.user, 'chat')) {
            this.emitError(socket, 'Insufficient permissions for chat');
            return;
        }

        this.logActivity('Processing chat message with LangGraph', {
            clientId: client.id,
            clientType: client.type,
            sessionId: data.sessionId,
            messageLength: data.content.length
        });

        try {
            // Process message through ChatService
            const response = await this.chatService.processMessage(data, context);

            // Send response to client
            socket.emit('agent_response', response);

            this.logActivity('Chat message processed successfully', {
                clientId: client.id,
                sessionId: data.sessionId,
                responseLength: response.content.length
            });

        } catch (error) {
            logger.error('Error processing chat message', {
                service: 'ChatHandler',
                error: error instanceof Error ? error.message : 'Unknown error',
                clientId: client.id,
                sessionId: data.sessionId
            });

            this.emitError(socket, error instanceof Error ? error.message : 'Failed to process your request');

            this.logActivity('Chat message processing failed', {
                clientId: client.id,
                sessionId: data.sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Clear conversation history for a client
     */
    async clearConversation(clientId: string): Promise<void> {
        try {
            await this.chatService.clearHistory(clientId);
            this.logActivity('Conversation cleared', { clientId });
        } catch (error) {
            this.logActivity('Error clearing conversation', {
                clientId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get handler statistics
     */
    getHandlerStats() {
        return this.chatService.getStats();
    }
}