import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { initWebSocketServer, IWebSocketServer } from '../../websocket/index';
import { container } from '../../container';
import { ClientManager } from '../../websocket/ClientManager';
import { AuthenticationService } from '../../services/AuthenticationService';
import { RegistrationHandler } from '../../websocket/handlers/RegistrationHandler';
import { ChatHandler } from '../../websocket/handlers/ChatHandler';
import { PingHandler } from '../../websocket/handlers/PingHandler';
import { IEventHandler, IClientConnection, ClientType, IUserInfo } from '../../websocket/types';
import { logger } from '../../utils/logger';

// Mock all dependencies
jest.mock('ws');
jest.mock('../../container');
jest.mock('../../websocket/ClientManager');
jest.mock('../../services/AuthenticationService');
jest.mock('../../websocket/handlers/RegistrationHandler');
jest.mock('../../websocket/handlers/ChatHandler');
jest.mock('../../websocket/handlers/PingHandler');
jest.mock('../../utils/logger');

describe('WebSocket Server', () => {
    let mockHttpServer: HttpServer;
    let mockWebSocketServer: jest.Mocked<WebSocketServer>;
    let mockWebSocket: jest.Mocked<WebSocket>;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuthService: jest.Mocked<AuthenticationService>;
    let mockRegistrationHandler: jest.Mocked<RegistrationHandler>;
    let mockChatHandler: jest.Mocked<ChatHandler>;
    let mockPingHandler: jest.Mocked<PingHandler>;
    let mockContainer: jest.Mocked<typeof container>;

    beforeEach(() => {
        // Setup mock HTTP server
        mockHttpServer = {} as HttpServer;

        // Setup mock WebSocket
        mockWebSocket = {
            send: jest.fn(),
            close: jest.fn(),
            on: jest.fn(),
            readyState: WebSocket.OPEN,
        } as unknown as jest.Mocked<WebSocket>;

        // Setup mock WebSocket server
        mockWebSocketServer = {
            on: jest.fn(),
            close: jest.fn(),
        } as unknown as jest.Mocked<WebSocketServer>;

        // Setup mock services
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

        mockAuthService = {} as jest.Mocked<AuthenticationService>;

        // Setup mock handlers
        mockRegistrationHandler = {
            eventName: 'client_registration',
            handle: jest.fn(),
        } as unknown as jest.Mocked<RegistrationHandler>;

        mockChatHandler = {
            eventName: 'chat_message',
            handle: jest.fn(),
        } as unknown as jest.Mocked<ChatHandler>;

        mockPingHandler = {
            eventName: 'ping',
            handle: jest.fn(),
        } as unknown as jest.Mocked<PingHandler>;

        // Setup mock container
        mockContainer = container as jest.Mocked<typeof container>;
        mockContainer.resolve = jest.fn()
            .mockReturnValueOnce(mockClientManager)
            .mockReturnValueOnce(mockAuthService)
            .mockReturnValueOnce({ handleClientDisconnection: jest.fn() }) // ToolExecutionManager
            .mockReturnValueOnce(mockRegistrationHandler)
            .mockReturnValueOnce(mockChatHandler)
            .mockReturnValueOnce(mockPingHandler)
            .mockReturnValueOnce({}) // ClearConversationHandler
            .mockReturnValueOnce({}) // ToolExecutionResponseHandler
            .mockReturnValueOnce({}); // ToolExecutionStatusHandler

        // Setup WebSocketServer constructor mock
        (WebSocketServer as jest.MockedClass<typeof WebSocketServer>).mockImplementation(() => mockWebSocketServer);

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('initWebSocketServer', () => {
        it('should create WebSocket server with default configuration', () => {
            initWebSocketServer(mockHttpServer);

            expect(WebSocketServer).toHaveBeenCalledWith({
                server: mockHttpServer,
                perMessageDeflate: false
            });
        });

        it('should resolve services from container', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockContainer.resolve).toHaveBeenCalledWith(ClientManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(AuthenticationService);
        });

        it('should register handlers', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockContainer.resolve).toHaveBeenCalledWith(RegistrationHandler);
            expect(mockContainer.resolve).toHaveBeenCalledWith(ChatHandler);
            expect(mockContainer.resolve).toHaveBeenCalledWith(PingHandler);
            expect(logger.info).toHaveBeenCalledWith('Handler registered', {
                service: 'WebSocketServer',
                eventName: 'client_registration'
            });
            expect(logger.info).toHaveBeenCalledWith('Handler registered', {
                service: 'WebSocketServer',
                eventName: 'chat_message'
            });
            expect(logger.info).toHaveBeenCalledWith('Handler registered', {
                service: 'WebSocketServer',
                eventName: 'ping'
            });
        });

        it('should setup connection handler', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockWebSocketServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });

        it('should return WebSocket server instance with expected methods', () => {
            const server = initWebSocketServer(mockHttpServer);

            expect(server).toHaveProperty('wss', mockWebSocketServer);
            expect(server).toHaveProperty('clientManager', mockClientManager);
            expect(server).toHaveProperty('authService', mockAuthService);
            expect(server).toHaveProperty('getHandler');
            expect(server).toHaveProperty('getClient');
            expect(server).toHaveProperty('getAllClients');
            expect(server).toHaveProperty('getClientsByType');
            expect(server).toHaveProperty('getClientsByCapability');
            expect(server).toHaveProperty('broadcastToClientType');
            expect(server).toHaveProperty('broadcastToCapability');
            expect(server).toHaveProperty('getConnectionStats');
            expect(server).toHaveProperty('shutdown');
        });

        it('should log initialization message', () => {
            initWebSocketServer(mockHttpServer);

            expect(logger.info).toHaveBeenCalledWith('WebSocket server initialized', {
                service: 'WebSocketServer',
                handlers: expect.arrayContaining(['client_registration', 'chat_message', 'ping'])
            });
        });
    });

    describe('WebSocket Server Instance', () => {
        let server: IWebSocketServer;

        beforeEach(() => {
            server = initWebSocketServer(mockHttpServer);
        });

        describe('getHandler', () => {
            it('should return handler for valid event name', () => {
                const handler = server.getHandler('client_registration');
                expect(handler).toBe(mockRegistrationHandler);
            });

            it('should return undefined for invalid event name', () => {
                const handler = server.getHandler('invalid_event');
                expect(handler).toBeUndefined();
            });
        });

        describe('client management delegation', () => {
            it('should delegate getClient to clientManager', () => {
                const mockSocketWrapper = { id: 'test-id', emit: jest.fn(), disconnect: jest.fn() };
                const mockClient: IClientConnection = {
                    id: 'test-client',
                    type: ClientType.BROWSER_EXTENSION,
                    capabilities: ['page-content'],
                    metadata: {},
                    socket: mockSocketWrapper,
                    connectedAt: Date.now(),
                    user: { isAuthenticated: false, permissions: [] }
                };
                mockClientManager.getClient.mockReturnValue(mockClient);

                const result = server.getClient('test-socket-id');

                expect(mockClientManager.getClient).toHaveBeenCalledWith('test-socket-id');
                expect(result).toBe(mockClient);
            });

            it('should delegate getAllClients to clientManager', () => {
                const mockSocketWrapper = { id: 'test-id', emit: jest.fn(), disconnect: jest.fn() };
                const mockClients: IClientConnection[] = [{
                    id: 'client1',
                    type: ClientType.BROWSER_EXTENSION,
                    capabilities: ['page-content'],
                    metadata: {},
                    socket: mockSocketWrapper,
                    connectedAt: Date.now(),
                    user: { isAuthenticated: false, permissions: [] }
                }, {
                    id: 'client2',
                    type: ClientType.BROWSER_EXTENSION,
                    capabilities: ['page-content'],
                    metadata: {},
                    socket: mockSocketWrapper,
                    connectedAt: Date.now(),
                    user: { isAuthenticated: false, permissions: [] }
                }];
                mockClientManager.getAllClients.mockReturnValue(mockClients);

                const result = server.getAllClients();

                expect(mockClientManager.getAllClients).toHaveBeenCalled();
                expect(result).toBe(mockClients);
            });

            it('should delegate broadcastToClientType to clientManager', () => {
                server.broadcastToClientType('browser-extension', 'test-event', { data: 'test' });

                expect(mockClientManager.broadcastToClientType).toHaveBeenCalledWith(
                    'browser-extension',
                    'test-event',
                    { data: 'test' }
                );
            });

            it('should delegate getConnectionStats to clientManager', () => {
                const mockStats = {
                    total: 5,
                    byType: { 'browser_extension': 3, 'unknown': 2 },
                    authenticated: 1
                };
                mockClientManager.getConnectionStats.mockReturnValue(mockStats);

                const result = server.getConnectionStats();

                expect(mockClientManager.getConnectionStats).toHaveBeenCalled();
                expect(result).toBe(mockStats);
            });
        });

        describe('shutdown', () => {
            it('should log shutdown message and close WebSocket server', () => {
                server.shutdown();

                expect(logger.info).toHaveBeenCalledWith('Shutting down WebSocket server', {
                    service: 'WebSocketServer'
                });
                expect(mockWebSocketServer.close).toHaveBeenCalled();
            });
        });
    });

    describe('WebSocket connection handling', () => {
        let connectionCallback: Function;

        beforeEach(() => {
            initWebSocketServer(mockHttpServer);
            connectionCallback = (mockWebSocketServer.on as jest.Mock).mock.calls[0][1];
        });

        it('should log client connection and setup handlers', () => {
            const mockRequest = {} as any;
            connectionCallback(mockWebSocket, mockRequest);

            expect(logger.info).toHaveBeenCalledWith('Client connected', {
                service: 'WebSocketServer',
                socketId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/)
            });

            expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        it('should handle incoming JSON messages', async () => {
            const mockClient: IClientConnection = {
                id: 'test-client',
                type: ClientType.BROWSER_EXTENSION,
                capabilities: ['page-content'],
                metadata: {},
                socket: { id: 'test-id', emit: jest.fn(), disconnect: jest.fn() },
                connectedAt: Date.now(),
                user: { isAuthenticated: false, permissions: [] }
            };
            mockClientManager.getClient.mockReturnValue(mockClient);
            mockRegistrationHandler.handle.mockResolvedValue(undefined);

            connectionCallback(mockWebSocket, {});

            // Get the message callback
            const messageCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'message')[1];

            const testMessage = JSON.stringify({
                id: 'test-id',
                type: 'client_registration',
                timestamp: Date.now(),
                clientType: 'browser_extension'
            });

            await messageCallback(Buffer.from(testMessage));

            expect(mockRegistrationHandler.handle).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/),
                    emit: expect.any(Function),
                    disconnect: expect.any(Function)
                }),
                expect.objectContaining({
                    type: 'client_registration',
                    clientType: 'browser_extension'
                }),
                expect.objectContaining({
                    clientId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/),
                    client: mockClient,
                    timestamp: expect.any(Number)
                })
            );
        });

        it('should handle malformed JSON messages', async () => {
            connectionCallback(mockWebSocket, {});

            // Get the message callback
            const messageCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'message')[1];

            await messageCallback(Buffer.from('invalid json'));

            expect(logger.error).toHaveBeenCalledWith('Message handling failed', {
                service: 'WebSocketServer',
                error: expect.stringContaining('Unexpected token'),
                socketId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/)
            });
        });

        it('should handle unknown message types', async () => {
            connectionCallback(mockWebSocket, {});

            // Get the message callback
            const messageCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'message')[1];

            const testMessage = JSON.stringify({
                type: 'unknown_type',
                data: 'test'
            });

            await messageCallback(Buffer.from(testMessage));

            expect(logger.warn).toHaveBeenCalledWith('Unknown message type', {
                service: 'WebSocketServer',
                messageType: 'unknown_type',
                socketId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/)
            });
        });

        it('should handle close events', () => {
            connectionCallback(mockWebSocket, {});

            // Get the close callback
            const closeCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'close')[1];

            closeCallback(1000, Buffer.from('Normal closure'));

            expect(logger.info).toHaveBeenCalledWith('Client disconnected', {
                service: 'WebSocketServer',
                socketId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/),
                code: 1000,
                reason: 'Normal closure'
            });
        });

        it('should handle WebSocket errors', () => {
            connectionCallback(mockWebSocket, {});

            // Get the error callback
            const errorCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'error')[1];

            const testError = new Error('WebSocket connection failed');
            errorCallback(testError);

            expect(logger.error).toHaveBeenCalledWith('Socket error', {
                service: 'WebSocketServer',
                error: 'WebSocket connection failed',
                socketId: expect.stringMatching(/^socket_\d+_[a-z0-9]+$/)
            });
        });
    });

    describe('Socket wrapper functionality', () => {
        let connectionCallback: Function;

        beforeEach(() => {
            initWebSocketServer(mockHttpServer);
            connectionCallback = (mockWebSocketServer.on as jest.Mock).mock.calls[0][1];
        });

        it('should create socket wrapper with emit functionality', () => {
            connectionCallback(mockWebSocket, {});

            // Simulate sending a message through the wrapper
            const messageCallback = (mockWebSocket.on as jest.Mock).mock.calls
                .find(call => call[0] === 'message')[1];

            // Mock a handler that uses socket.emit
            mockPingHandler.handle.mockImplementation(async (socket) => {
                socket.emit('pong', { type: 'pong', timestamp: Date.now() });
            });

            const testMessage = JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            });

            messageCallback(Buffer.from(testMessage));

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('"type":"pong"')
            );
        });
    });
});