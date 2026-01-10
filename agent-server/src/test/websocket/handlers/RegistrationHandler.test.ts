import 'reflect-metadata';
import { RegistrationHandler } from '../../../websocket/handlers/RegistrationHandler';
import { ClientManager } from '../../../websocket/ClientManager';
import { AuthenticationService } from '../../../services/AuthenticationService';
import { IHandlerContext, IClientRegistration, ClientType, IClientConnection, IUserInfo } from '../../../websocket/types';

// Mock dependencies
jest.mock('../../../websocket/ClientManager');
jest.mock('../../../services/AuthenticationService');

type MockSocket = {
    id: string;
    emit: jest.Mock;
    disconnect: jest.Mock;
};

describe('RegistrationHandler', () => {
    let handler: RegistrationHandler;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuthService: jest.Mocked<AuthenticationService>;
    let mockSocket: MockSocket;
    let mockContext: IHandlerContext;

    beforeEach(() => {
        // Mock ClientManager
        mockClientManager = {
            registerClient: jest.fn(),
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
            hasPermission: jest.fn(),
            canUseTool: jest.fn(),
        } as unknown as jest.Mocked<AuthenticationService>;

        // Mock Socket wrapper
        mockSocket = {
            id: 'socket-123',
            emit: jest.fn(),
            disconnect: jest.fn()
        };

        // Mock context
        mockContext = {
            clientId: 'socket-123',
            client: undefined,
            timestamp: Date.now()
        };

        // Create handler instance
        handler = new RegistrationHandler(mockClientManager, mockAuthService);

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Registration Process', () => {
        const registrationData: IClientRegistration = {
            id: 'reg-123',
            type: 'client_registration',
            timestamp: Date.now(),
            clientType: ClientType.BROWSER_EXTENSION,
            capabilities: ['page_content', 'dom_manipulation'],
            userAgent: 'Mozilla/5.0 Chrome/91.0',
            metadata: { extensionVersion: '2.1.0' },
            sessionToken: 'session_token_123',
            userId: 'user-456'
        };

        const mockUserInfo: IUserInfo = {
            userId: 'user-456',
            sessionToken: 'session_token_123',
            isAuthenticated: true,
            permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools', 'advanced_features', 'file_upload']
        };

        let mockClientConnection: IClientConnection;

        beforeEach(() => {
            mockClientConnection = {
                id: 'socket-123',
                type: ClientType.BROWSER_EXTENSION,
                capabilities: ['page_content', 'dom_manipulation'],
                metadata: { version: '1.0.0' },
                socket: mockSocket,
                connectedAt: Date.now(),
                user: mockUserInfo
            };

            mockAuthService.authenticateUser.mockResolvedValue(mockUserInfo);
            mockClientManager.registerClient.mockReturnValue(mockClientConnection);

            // Mock private methods
            jest.spyOn(handler as any, 'logActivity').mockImplementation();
            jest.spyOn(handler as any, 'generateMessageId').mockReturnValue('msg_12345_abcd');
            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
        });

        it('should register client successfully with authentication', async () => {
            await handler.handle(mockSocket, registrationData, mockContext);

            // Verify authentication was called
            expect(mockAuthService.authenticateUser).toHaveBeenCalledWith(
                'session_token_123',
                'user-456'
            );

            // Verify client registration
            expect(mockClientManager.registerClient).toHaveBeenCalledWith(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['page_content', 'dom_manipulation'],
                'Mozilla/5.0 Chrome/91.0',
                { extensionVersion: '2.1.0' },
                mockUserInfo
            );

            // Verify confirmation message
            expect(mockSocket.emit).toHaveBeenCalledWith('registration_confirmed', {
                id: 'msg_12345_abcd',
                type: 'registration_confirmed',
                timestamp: 1234567890,
                clientId: 'socket-123',
                serverCapabilities: ['chat', 'agent_processing', 'tool_orchestration', 'multi_client_support', 'real_time_status'],
                authenticated: true,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools', 'advanced_features', 'file_upload']
            });
        });

        it('should handle registration with minimal data', async () => {
            const minimalData = {
                id: 'reg-123',
                type: 'client_registration' as const,
                timestamp: Date.now(),
                clientType: ClientType.BROWSER_EXTENSION,
                capabilities: ['basic']
            };

            await handler.handle(mockSocket, minimalData, mockContext);

            expect(mockClientManager.registerClient).toHaveBeenCalledWith(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['basic'],
                undefined, // userAgent
                undefined, // metadata
                mockUserInfo
            );
        });

        it('should handle authentication errors gracefully', async () => {
            const authError = new Error('Invalid session token');
            mockAuthService.authenticateUser.mockRejectedValue(authError);

            // Mock the emitError method
            const emitErrorSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

            await handler.handle(mockSocket, registrationData, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(
                mockSocket,
                'Registration failed',
                {
                    reason: 'Invalid session token'
                }
            );

            expect(mockClientManager.registerClient).not.toHaveBeenCalled();
            expect(mockSocket.emit).not.toHaveBeenCalledWith('registration_confirmed', expect.any(Object));
        });
    });

    describe('Error Handling', () => {
        const registrationData: IClientRegistration = {
            id: 'reg-123',
            type: 'client_registration',
            timestamp: Date.now(),
            clientType: ClientType.BROWSER_EXTENSION,
            capabilities: ['basic']
        };

        it('should handle client manager errors', async () => {
            const registrationError = new Error('Client manager error');
            mockClientManager.registerClient.mockImplementation(() => {
                throw registrationError;
            });

            const emitErrorSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

            await handler.handle(mockSocket, registrationData, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(
                mockSocket,
                'Registration failed',
                {
                    reason: 'Client manager error'
                }
            );
        });

        it('should handle unknown errors', async () => {
            mockAuthService.authenticateUser.mockRejectedValue('Unknown error');

            const emitErrorSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

            await handler.handle(mockSocket, registrationData, mockContext);

            expect(emitErrorSpy).toHaveBeenCalledWith(
                mockSocket,
                'Registration failed',
                {
                    reason: 'Unknown error'
                }
            );
        });
    });

    describe('Client Types', () => {
        beforeEach(() => {
            jest.spyOn(handler as any, 'logActivity').mockImplementation();
            jest.spyOn(handler as any, 'generateMessageId').mockReturnValue('msg_12345_abcd');
            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
        });

        it('should register browser extension client', async () => {
            const browserData: IClientRegistration = {
                id: 'reg-browser',
                type: 'client_registration',
                timestamp: Date.now(),
                clientType: ClientType.BROWSER_EXTENSION,
                capabilities: ['page_content', 'dom_manipulation', 'tab_management'],
                userAgent: 'Mozilla/5.0 Chrome/91.0',
                metadata: {
                    extensionVersion: '2.1.0',
                    browserName: 'chrome'
                }
            };

            const mockUserInfo = {
                isAuthenticated: false,
                permissions: ['chat', 'tools']
            };

            mockAuthService.authenticateUser.mockResolvedValue(mockUserInfo);
            mockClientManager.registerClient.mockReturnValue({
                id: 'socket-123',
                type: ClientType.BROWSER_EXTENSION,
                capabilities: browserData.capabilities,
                metadata: browserData.metadata || {},
                socket: mockSocket,
                connectedAt: Date.now(),
                user: mockUserInfo
            });

            await handler.handle(mockSocket, browserData, mockContext);

            expect(mockClientManager.registerClient).toHaveBeenCalledWith(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['page_content', 'dom_manipulation', 'tab_management'],
                'Mozilla/5.0 Chrome/91.0',
                {
                    extensionVersion: '2.1.0',
                    browserName: 'chrome'
                },
                mockUserInfo
            );
        });

        it('should register unknown client type', async () => {
            const unknownData: IClientRegistration = {
                id: 'reg-unknown',
                type: 'client_registration',
                timestamp: Date.now(),
                clientType: ClientType.UNKNOWN,
                capabilities: ['basic'],
                metadata: { source: 'unknown_client' }
            };

            const mockUserInfo = {
                isAuthenticated: false,
                permissions: ['chat', 'tools']
            };

            mockAuthService.authenticateUser.mockResolvedValue(mockUserInfo);
            mockClientManager.registerClient.mockReturnValue({
                id: 'socket-123',
                type: ClientType.UNKNOWN,
                capabilities: ['basic'],
                metadata: { source: 'unknown_client' },
                socket: mockSocket,
                connectedAt: Date.now(),
                user: mockUserInfo
            });

            await handler.handle(mockSocket, unknownData, mockContext);

            expect(mockClientManager.registerClient).toHaveBeenCalledWith(
                mockSocket,
                ClientType.UNKNOWN,
                ['basic'],
                undefined,
                { source: 'unknown_client' },
                mockUserInfo
            );
        });
    });
});