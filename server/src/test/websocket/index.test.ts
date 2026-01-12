import { Server as HttpServer } from 'http';
import { initWebSocketServer, IWebSocketServer } from '../../websocket/index';
import { container } from '../../container';
import { WebSocketServer, ClientManager } from '@jarvis/ws-server';
import { AuthenticationService } from '../../services/AuthenticationService';
import { ToolExecutionManager } from '@jarvis/rag-tools-server';
import { RegistrationHandler } from '../../websocket/handlers/RegistrationHandler';
import { ChatHandler } from '../../websocket/handlers/ChatHandler';
import { PingHandler } from '../../websocket/handlers/PingHandler';
import { ClearConversationHandler } from '../../websocket/handlers/ClearConversationHandler';
import { ToolExecutionResponseHandler } from '../../websocket/handlers/ToolExecutionHandler';
import { ToolExecutionStatusHandler } from '../../websocket/handlers/ToolExecutionStatusHandler';
import { ClientType } from '@jarvis/ws-server';
import type { IClientConnection } from '@jarvis/ws-server';
import { logger } from '@jarvis/server-utils';

// Mock all dependencies
jest.mock('@jarvis/ws-server');
jest.mock('../../container');
jest.mock('../../services/AuthenticationService');
jest.mock('@jarvis/rag-tools-server');
jest.mock('../../websocket/handlers/RegistrationHandler');
jest.mock('../../websocket/handlers/ChatHandler');
jest.mock('../../websocket/handlers/PingHandler');
jest.mock('../../websocket/handlers/ClearConversationHandler');
jest.mock('../../websocket/handlers/ToolExecutionHandler');
jest.mock('../../websocket/handlers/ToolExecutionStatusHandler');

describe('WebSocket Server', () => {
    let mockHttpServer: HttpServer;
    let mockWebSocketServer: jest.Mocked<WebSocketServer>;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuthService: jest.Mocked<AuthenticationService>;
    let mockToolExecutionManager: jest.Mocked<ToolExecutionManager>;
    let mockRegistrationHandler: jest.Mocked<RegistrationHandler>;
    let mockChatHandler: jest.Mocked<ChatHandler>;
    let mockPingHandler: jest.Mocked<PingHandler>;
    let mockClearConversationHandler: jest.Mocked<ClearConversationHandler>;
    let mockToolExecutionResponseHandler: jest.Mocked<ToolExecutionResponseHandler>;
    let mockToolExecutionStatusHandler: jest.Mocked<ToolExecutionStatusHandler>;
    let mockContainer: jest.Mocked<typeof container>;

    beforeEach(() => {
        // Setup mock HTTP server
        mockHttpServer = {} as HttpServer;

        // Setup mock client manager
        mockClientManager = {
            getClient: jest.fn(),
            getAllClients: jest.fn(),
            getClientsByType: jest.fn(),
            getClientsByCapability: jest.fn(),
            broadcastToClientType: jest.fn(),
            broadcastToCapability: jest.fn(),
            getConnectionStats: jest.fn(),
            registerClient: jest.fn(),
            removeClient: jest.fn(),
        } as unknown as jest.Mocked<ClientManager>;

        // Setup mock WebSocket server from @jarvis/ws-server
        mockWebSocketServer = {
            clientManager: mockClientManager,
            registerHandler: jest.fn(),
            getHandler: jest.fn(),
            getClient: jest.fn(),
            getAllClients: jest.fn(),
            getClientsByType: jest.fn(),
            getClientsByCapability: jest.fn(),
            broadcastToClientType: jest.fn(),
            broadcastToCapability: jest.fn(),
            getConnectionStats: jest.fn(),
            shutdown: jest.fn(),
        } as unknown as jest.Mocked<WebSocketServer>;

        // Setup mock services
        mockAuthService = {} as jest.Mocked<AuthenticationService>;
        mockToolExecutionManager = {
            handleClientDisconnection: jest.fn(),
            getStats: jest.fn(),
        } as unknown as jest.Mocked<ToolExecutionManager>;

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

        mockClearConversationHandler = {
            eventName: 'clear_conversation',
            handle: jest.fn(),
        } as unknown as jest.Mocked<ClearConversationHandler>;

        mockToolExecutionResponseHandler = {
            eventName: 'tool_execution_response',
            handle: jest.fn(),
        } as unknown as jest.Mocked<ToolExecutionResponseHandler>;

        mockToolExecutionStatusHandler = {
            eventName: 'tool_execution_status',
            handle: jest.fn(),
        } as unknown as jest.Mocked<ToolExecutionStatusHandler>;

        // Setup mock container - returns services and handlers in order
        mockContainer = container as jest.Mocked<typeof container>;
        mockContainer.resolve = jest.fn(<T>(token: any): T => {
            if (token === AuthenticationService) return mockAuthService as T;
            if (token === ToolExecutionManager) return mockToolExecutionManager as T;
            if (token === RegistrationHandler) return mockRegistrationHandler as T;
            if (token === ChatHandler) return mockChatHandler as T;
            if (token === PingHandler) return mockPingHandler as T;
            if (token === ClearConversationHandler) return mockClearConversationHandler as T;
            if (token === ToolExecutionResponseHandler) return mockToolExecutionResponseHandler as T;
            if (token === ToolExecutionStatusHandler) return mockToolExecutionStatusHandler as T;
            throw new Error(`Unexpected resolve call for ${token}`);
        }) as any;
        mockContainer.registerInstance = jest.fn();

        // Setup WebSocketServer constructor mock from @jarvis/ws-server
        (WebSocketServer as jest.MockedClass<typeof WebSocketServer>).mockImplementation(
            () => mockWebSocketServer
        );

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('initWebSocketServer', () => {
        it('should create WebSocketServer from @jarvis/ws-server with correct config', () => {
            initWebSocketServer(mockHttpServer);

            expect(WebSocketServer).toHaveBeenCalledWith(
                mockHttpServer,
                expect.objectContaining({
                    path: '/',
                    messageFormat: 'legacy',
                    maxConnections: 0,
                    pingInterval: 30000,
                    clientTimeout: 60000,
                    clientManager: {
                        defaultPermissions: ['chat', 'tools', 'navigation', 'tab_management']
                    }
                }),
                logger
            );
        });

        it('should resolve services from container', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockContainer.resolve).toHaveBeenCalledWith(AuthenticationService);
            expect(mockContainer.resolve).toHaveBeenCalledWith(ToolExecutionManager);
        });

        it('should register ClientManager instance with container', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockContainer.registerInstance).toHaveBeenCalledWith(
                ClientManager,
                mockClientManager
            );
        });

        it('should register all handlers with WebSocketServer', () => {
            initWebSocketServer(mockHttpServer);

            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockRegistrationHandler);
            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockChatHandler);
            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockPingHandler);
            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockClearConversationHandler);
            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockToolExecutionResponseHandler);
            expect(mockWebSocketServer.registerHandler).toHaveBeenCalledWith(mockToolExecutionStatusHandler);
        });

        it('should return WebSocket server instance with expected interface', () => {
            const server = initWebSocketServer(mockHttpServer);

            expect(server).toHaveProperty('wss');
            expect(server).toHaveProperty('clientManager');
            expect(server).toHaveProperty('authService');
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

            expect(logger.info).toHaveBeenCalledWith(
                'WebSocket server initialized with @jarvis/ws-server',
                {
                    service: 'WebSocketServer',
                    messageFormat: 'legacy',
                    handlers: [
                        'client_registration',
                        'chat_message',
                        'ping',
                        'clear_conversation',
                        'tool_execution_response',
                        'tool_execution_status'
                    ]
                }
            );
        });
    });

    describe('WebSocket Server Instance', () => {
        let server: IWebSocketServer;
        let originalGetClientMock: jest.Mock;

        beforeEach(() => {
            // Store reference to original mock before it gets wrapped
            originalGetClientMock = mockWebSocketServer.getClient as jest.Mock;
            server = initWebSocketServer(mockHttpServer);
        });

        describe('getHandler', () => {
            it('should delegate to WebSocketServer.getHandler', () => {
                mockWebSocketServer.getHandler.mockReturnValue(mockRegistrationHandler);

                const handler = server.getHandler('client_registration');

                expect(mockWebSocketServer.getHandler).toHaveBeenCalledWith('client_registration');
                expect(handler).toBe(mockRegistrationHandler);
            });

            it('should return undefined for invalid event name', () => {
                mockWebSocketServer.getHandler.mockReturnValue(undefined);

                const handler = server.getHandler('invalid_event');

                expect(mockWebSocketServer.getHandler).toHaveBeenCalledWith('invalid_event');
                expect(handler).toBeUndefined();
            });
        });

        describe('client management delegation', () => {
            it('should delegate getClient to WebSocketServer', () => {
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
                originalGetClientMock.mockReturnValue(mockClient);

                const result = server.getClient('test-socket-id');

                expect(originalGetClientMock).toHaveBeenCalledWith('test-socket-id');
                expect(result).toBe(mockClient);
            });

            it('should delegate getAllClients to WebSocketServer', () => {
                const mockSocketWrapper = { id: 'test-id', emit: jest.fn(), disconnect: jest.fn() };
                const mockClients: IClientConnection[] = [{
                    id: 'client1',
                    type: ClientType.BROWSER_EXTENSION,
                    capabilities: ['page-content'],
                    metadata: {},
                    socket: mockSocketWrapper,
                    connectedAt: Date.now(),
                    user: { isAuthenticated: false, permissions: [] }
                }];
                mockWebSocketServer.getAllClients.mockReturnValue(mockClients);

                const result = server.getAllClients();

                expect(mockWebSocketServer.getAllClients).toHaveBeenCalled();
                expect(result).toBe(mockClients);
            });

            it('should delegate getClientsByType to WebSocketServer', () => {
                const mockClients: IClientConnection[] = [];
                mockWebSocketServer.getClientsByType.mockReturnValue(mockClients);

                const result = server.getClientsByType(ClientType.BROWSER_EXTENSION);

                expect(mockWebSocketServer.getClientsByType).toHaveBeenCalledWith(ClientType.BROWSER_EXTENSION);
                expect(result).toBe(mockClients);
            });

            it('should delegate broadcastToClientType to WebSocketServer', () => {
                server.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test-event', { data: 'test' });

                expect(mockWebSocketServer.broadcastToClientType).toHaveBeenCalledWith(
                    ClientType.BROWSER_EXTENSION,
                    'test-event',
                    { data: 'test' }
                );
            });

            it('should delegate getConnectionStats to WebSocketServer', () => {
                const mockStats = {
                    total: 5,
                    byType: {
                        [ClientType.BROWSER_EXTENSION]: 3,
                        [ClientType.RASPBERRY_PI]: 0,
                        [ClientType.HARDWARE]: 0,
                        [ClientType.CLI]: 0,
                        [ClientType.UNKNOWN]: 2
                    },
                    authenticated: 1
                };
                mockWebSocketServer.getConnectionStats.mockReturnValue(mockStats);

                const result = server.getConnectionStats();

                expect(mockWebSocketServer.getConnectionStats).toHaveBeenCalled();
                expect(result).toBe(mockStats);
            });
        });

        describe('shutdown', () => {
            it('should log shutdown message and delegate to WebSocketServer', () => {
                server.shutdown();

                expect(logger.info).toHaveBeenCalledWith('Shutting down WebSocket server', {
                    service: 'WebSocketServer'
                });
                expect(mockWebSocketServer.shutdown).toHaveBeenCalled();
            });
        });

        describe('tool execution manager integration', () => {
            it('should call handleClientDisconnection when getClient returns undefined', () => {
                originalGetClientMock.mockReturnValue(undefined);

                const result = server.getClient('non-existent-socket');

                expect(originalGetClientMock).toHaveBeenCalledWith('non-existent-socket');
                expect(mockToolExecutionManager.handleClientDisconnection).toHaveBeenCalledWith('non-existent-socket');
                expect(result).toBeUndefined();
            });

            it('should not call handleClientDisconnection when getClient returns a client', () => {
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
                originalGetClientMock.mockReturnValue(mockClient);

                const result = server.getClient('existing-socket');

                expect(originalGetClientMock).toHaveBeenCalledWith('existing-socket');
                expect(mockToolExecutionManager.handleClientDisconnection).not.toHaveBeenCalled();
                expect(result).toBe(mockClient);
            });
        });
    });
});
