import { injectable, inject } from 'tsyringe';
import { BaseHandler } from './BaseHandler';
import type { IHandlerContext, IClientRegistration, ISocketWrapper } from '@jarvis/ws-server';
import { ClientManager } from '@jarvis/ws-server';
import { AuthenticationService } from '../../services/AuthenticationService';
import { logger } from '@jarvis/server-utils';

/**
 * Handles client registration events
 * Authenticates clients and registers them with the ClientManager
 */
@injectable()
export class RegistrationHandler extends BaseHandler<IClientRegistration> {
    readonly eventName = 'client_registration';

    constructor(
        @inject(ClientManager) clientManager: ClientManager,
        @inject(AuthenticationService) private authService: AuthenticationService
    ) {
        super(clientManager);
    }

    async handle(socket: ISocketWrapper, data: IClientRegistration, context: IHandlerContext): Promise<void> {
        try {
            this.logActivity('Processing client registration', {
                clientType: data.clientType,
                capabilities: data.capabilities,
                socketId: socket.id
            });

            // Note: Skip client registration validation for this handler since we're registering

            // Authenticate the user
            const userInfo = await this.authService.authenticateUser(
                data.sessionToken,
                data.userId
            );

            // Register the client with ClientManager
            const clientConnection = this.clientManager.registerClient(
                socket,
                data.clientType,
                data.capabilities,
                data.userAgent,
                data.metadata,
                userInfo
            );

            // Send registration confirmation
            const confirmationMessage = {
                id: this.generateMessageId(),
                type: 'registration_confirmed',
                timestamp: Date.now(),
                clientId: socket.id,
                serverCapabilities: this.getServerCapabilities(),
                authenticated: userInfo.isAuthenticated,
                permissions: userInfo.permissions
            };

            socket.emit('registration_confirmed', confirmationMessage);

            this.logActivity('Client registration successful', {
                clientId: socket.id,
                clientType: data.clientType,
                authenticated: userInfo.isAuthenticated
            });

        } catch (error) {
            logger.error('Error during client registration', {
                service: 'RegistrationHandler',
                error: error instanceof Error ? error.message : 'Unknown error',
                socketId: socket.id
            });

            this.emitError(socket, 'Registration failed', {
                reason: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get server capabilities that clients can query
     */
    private getServerCapabilities(): string[] {
        return [
            'chat',
            'agent_processing',
            'tool_orchestration',
            'multi_client_support',
            'real_time_status'
        ];
    }
}