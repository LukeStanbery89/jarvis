import 'reflect-metadata';
import { BaseHandler } from '../../../websocket/handlers/BaseHandler';
import { ClientManager } from '../../../websocket/ClientManager';
import { IHandlerContext, IClientConnection, ClientType } from '../../../websocket/types';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('../../../websocket/ClientManager');
jest.mock('../../../utils/logger');

type MockSocket = {
    id: string;
    emit: jest.Mock;
    disconnect: jest.Mock;
};

/**
 * Concrete implementation of BaseHandler for testing purposes
 */
class TestHandler extends BaseHandler {
    readonly eventName = 'test_event';

    async handle(socket: MockSocket, data: any, context: IHandlerContext): Promise<void> {
        // Test implementation - does nothing
    }
}

describe('BaseHandler', () => {
    let handler: TestHandler;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockSocket: MockSocket;
    let mockClient: IClientConnection;

    beforeEach(() => {
        // Mock ClientManager
        mockClientManager = {
            getClient: jest.fn(),
            removeClient: jest.fn(),
            getAllClients: jest.fn(),
            registerClient: jest.fn(),
            getClientsByType: jest.fn(),
            getClientsByCapability: jest.fn(),
            broadcastToClientType: jest.fn(),
            broadcastToCapability: jest.fn(),
            getConnectionCount: jest.fn(),
            getConnectionStats: jest.fn()
        } as unknown as jest.Mocked<ClientManager>;

        // Mock Socket wrapper
        mockSocket = {
            id: 'socket-123',
            emit: jest.fn(),
            disconnect: jest.fn()
        };

        // Mock client connection
        mockClient = {
            id: 'socket-123',
            type: ClientType.BROWSER_EXTENSION,
            capabilities: ['page_content', 'dom_manipulation'],
            metadata: {},
            socket: mockSocket,
            connectedAt: Date.now(),
            user: {
                userId: 'user-123',
                isAuthenticated: true,
                permissions: ['chat', 'tools']
            }
        } as IClientConnection;

        // Create handler instance
        handler = new TestHandler(mockClientManager);

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Context Creation', () => {
        it('should create context with socket information', () => {
            mockClientManager.getClient.mockReturnValue(mockClient);

            const context = handler['createContext'](mockSocket);

            expect(context).toEqual({
                clientId: 'socket-123',
                client: mockClient,
                timestamp: expect.any(Number)
            });
            expect(mockClientManager.getClient).toHaveBeenCalledWith('socket-123');
        });

        it('should create context with undefined client if not found', () => {
            mockClientManager.getClient.mockReturnValue(undefined);

            const context = handler['createContext'](mockSocket);

            expect(context).toEqual({
                clientId: 'socket-123',
                client: undefined,
                timestamp: expect.any(Number)
            });
        });

        it('should create context with current timestamp', () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            const context = handler['createContext'](mockSocket);

            expect(context.timestamp).toBe(now);
        });
    });

    describe('Error Emission', () => {
        it('should emit error message to socket', () => {
            handler['emitError'](mockSocket, 'Test error message');

            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                id: expect.stringMatching(/^msg_\d+_[a-z0-9]+$/),
                type: 'error',
                timestamp: expect.any(Number),
                message: 'Test error message',
                details: undefined
            });
        });

        it('should emit error with details', () => {
            const details = { code: 400, field: 'username' };
            handler['emitError'](mockSocket, 'Validation failed', details);

            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                id: expect.stringMatching(/^msg_\d+_[a-z0-9]+$/),
                type: 'error',
                timestamp: expect.any(Number),
                message: 'Validation failed',
                details
            });
        });

        it('should generate unique message IDs for multiple errors', () => {
            handler['emitError'](mockSocket, 'Error 1');
            handler['emitError'](mockSocket, 'Error 2');

            expect(mockSocket.emit).toHaveBeenCalledTimes(2);

            const firstCall = (mockSocket.emit as jest.Mock).mock.calls[0][1];
            const secondCall = (mockSocket.emit as jest.Mock).mock.calls[1][1];

            expect(firstCall.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
            expect(secondCall.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
            expect(firstCall.id).not.toBe(secondCall.id);
        });
    });

    describe('Message ID Generation', () => {
        it('should generate message ID with correct format', () => {
            const messageId = handler['generateMessageId']();

            expect(messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
        });

        it('should generate unique message IDs', () => {
            const id1 = handler['generateMessageId']();
            const id2 = handler['generateMessageId']();

            expect(id1).not.toBe(id2);
        });
    });

    describe('Client Registration Validation', () => {
        it('should return true when client is registered', () => {
            const context: IHandlerContext = {
                clientId: 'socket-123',
                client: mockClient,
                timestamp: Date.now()
            };

            const result = handler['validateClientRegistration'](mockSocket, context);

            expect(result).toBe(true);
        });

        it('should return false and emit error when client is not registered', () => {
            const contextWithoutClient: IHandlerContext = {
                clientId: 'socket-123',
                client: undefined,
                timestamp: Date.now()
            };

            mockClientManager.getAllClients.mockReturnValue([]);

            const result = handler['validateClientRegistration'](mockSocket, contextWithoutClient);

            expect(result).toBe(false);
            expect(mockSocket.emit).toHaveBeenCalledWith('error',
                expect.objectContaining({
                    message: 'Client not registered. Please register first.'
                })
            );
        });

        it('should log warning when client validation fails', () => {
            const contextWithoutClient: IHandlerContext = {
                clientId: 'socket-123',
                client: undefined,
                timestamp: Date.now()
            };

            mockClientManager.getAllClients.mockReturnValue([]);

            handler['validateClientRegistration'](mockSocket, contextWithoutClient);

            expect(logger.warn).toHaveBeenCalledWith('Client validation failed', {
                service: 'test_event',
                socketId: 'socket-123',
                availableClients: []
            });
        });

        it('should log verbose message when client validation passes', () => {
            const context: IHandlerContext = {
                clientId: 'socket-123',
                client: mockClient,
                timestamp: Date.now()
            };

            handler['validateClientRegistration'](mockSocket, context);

            expect(logger.verbose).toHaveBeenCalledWith('Client validation passed', {
                service: 'test_event',
                clientId: 'socket-123'
            });
        });
    });

    describe('Activity Logging', () => {
        it('should log activity with service name', () => {
            handler['logActivity']('Test action performed');

            expect(logger.info).toHaveBeenCalledWith('Test action performed', {
                service: 'test_event'
            });
        });

        it('should log activity with details', () => {
            const details = { userId: 'user-123', action: 'create' };
            handler['logActivity']('User action', details);

            expect(logger.verbose).toHaveBeenCalledWith('User action', {
                service: 'test_event',
                ...details
            });
        });
    });
});