import 'reflect-metadata';
import { ChatHandler } from '../../../websocket/handlers/ChatHandler';
import { ClientManager } from '../../../websocket/ClientManager';
import { AuthenticationService } from '../../../services/AuthenticationService';
import { ChatService, CHAT_SERVICE_TOKEN } from '../../../services/ChatService';
import { IHandlerContext, IClientConnection, ClientType } from '../../../websocket/types';
import { ChatMessage, AgentResponse } from '@jarvis/protocol';

// Mock dependencies
jest.mock('../../../websocket/ClientManager');
jest.mock('../../../services/AuthenticationService');

type MockSocket = {
    id: string;
    emit: jest.Mock;
    disconnect: jest.Mock;
};

describe('ChatHandler', () => {
    let chatHandler: ChatHandler;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuthService: jest.Mocked<AuthenticationService>;
    let mockChatService: jest.Mocked<ChatService>;
    let mockSocket: MockSocket;
    let mockClient: IClientConnection;
    let mockContext: IHandlerContext;

    beforeEach(() => {
        // Mock ClientManager
        mockClientManager = {
            getClient: jest.fn(),
            removeClient: jest.fn(),
            getAllClients: jest.fn(),
            getClientsByType: jest.fn(),
            getClientsByCapability: jest.fn(),
            broadcastToClientType: jest.fn(),
            broadcastToCapability: jest.fn(),
            getConnectionStats: jest.fn(),
        } as unknown as jest.Mocked<ClientManager>;

        // Mock AuthenticationService
        mockAuthService = {
            authenticateUser: jest.fn(),
            hasPermission: jest.fn().mockReturnValue(true),
            canUseTool: jest.fn(),
        } as unknown as jest.Mocked<AuthenticationService>;

        // Mock ChatService
        mockChatService = {
            processMessage: jest.fn(),
            clearHistory: jest.fn(),
            getStats: jest.fn(),
        } as unknown as jest.Mocked<ChatService>;

        // Mock Socket wrapper
        mockSocket = {
            id: 'socket-123',
            emit: jest.fn(),
            disconnect: jest.fn()
        };

        // Mock client
        mockClient = {
            id: 'socket-123',
            type: ClientType.BROWSER_EXTENSION,
            userAgent: 'test',
            capabilities: ['chat'],
            metadata: {},
            socket: mockSocket,
            connectedAt: Date.now(),
            user: {
                userId: 'test-user',
                isAuthenticated: true,
                permissions: ['chat']
            }
        };

        // Mock context with client
        mockContext = {
            clientId: 'socket-123',
            client: mockClient,
            timestamp: Date.now()
        };

        // Create handler instance
        chatHandler = new ChatHandler(mockClientManager, mockAuthService, mockChatService);

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Chat Message Processing', () => {
        const mockChatMessage: ChatMessage = {
            id: 'msg-123',
            type: 'chat_message',
            timestamp: Date.now(),
            content: 'Hello, how are you?',
            sessionId: 'session-123'
        };

        const mockAgentResponse: AgentResponse = {
            id: 'response-123',
            type: 'agent_response',
            timestamp: Date.now(),
            content: 'I am doing well, thank you!',
            sessionId: 'session-123'
        };

        it('should process chat message successfully', async () => {
            mockChatService.processMessage.mockResolvedValue(mockAgentResponse);

            await chatHandler.handle(mockSocket, mockChatMessage, mockContext);

            expect(mockChatService.processMessage).toHaveBeenCalledWith(mockChatMessage, mockContext);
            expect(mockSocket.emit).toHaveBeenCalledWith('agent_response', mockAgentResponse);
        });

        it('should not process message if client is not registered', async () => {
            const contextWithoutClient = { ...mockContext, client: undefined };
            mockClientManager.getAllClients.mockReturnValue([]);

            await chatHandler.handle(mockSocket, mockChatMessage, contextWithoutClient);

            expect(mockChatService.processMessage).not.toHaveBeenCalled();
            expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
                message: 'Client not registered. Please register first.'
            }));
        });

        it('should handle insufficient permissions', async () => {
            mockAuthService.hasPermission.mockReturnValue(false);
            const emitErrorSpy = jest.spyOn(chatHandler as any, 'emitError').mockImplementation();

            await chatHandler.handle(mockSocket, mockChatMessage, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(mockSocket, 'Insufficient permissions for chat');
            expect(mockChatService.processMessage).not.toHaveBeenCalled();
        });

        it('should handle chat service errors', async () => {
            const chatError = new Error('Chat service error');
            mockChatService.processMessage.mockRejectedValue(chatError);

            const emitErrorSpy = jest.spyOn(chatHandler as any, 'emitError').mockImplementation();

            await chatHandler.handle(mockSocket, mockChatMessage, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(
                mockSocket,
                'Chat service error'
            );
        });

        it('should handle unknown errors', async () => {
            mockChatService.processMessage.mockRejectedValue('Unknown error');

            const emitErrorSpy = jest.spyOn(chatHandler as any, 'emitError').mockImplementation();

            await chatHandler.handle(mockSocket, mockChatMessage, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(
                mockSocket,
                'Failed to process your request'
            );
        });
    });

    describe('Clear Conversation', () => {
        it('should clear conversation history successfully', async () => {
            mockChatService.clearHistory.mockResolvedValue(undefined);

            await chatHandler.clearConversation('client-123');

            expect(mockChatService.clearHistory).toHaveBeenCalledWith('client-123');
        });

        it('should handle clear history errors', async () => {
            const clearError = new Error('Clear history failed');
            mockChatService.clearHistory.mockRejectedValue(clearError);

            // Should not throw, just log the error
            await expect(chatHandler.clearConversation('client-123')).resolves.toBeUndefined();

            expect(mockChatService.clearHistory).toHaveBeenCalledWith('client-123');
        });
    });

    describe('Handler Statistics', () => {
        it('should return chat service statistics', () => {
            const mockStats = { agentInitialized: true, memoryEnabled: true, toolsAvailable: 5 };
            mockChatService.getStats.mockReturnValue(mockStats);

            const stats = chatHandler.getHandlerStats();

            expect(stats).toBe(mockStats);
            expect(mockChatService.getStats).toHaveBeenCalled();
        });
    });
});