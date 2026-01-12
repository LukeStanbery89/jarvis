import 'reflect-metadata';
import { RegistrationHandler } from '../../../websocket/handlers/RegistrationHandler';
import { ClientManager } from '@jarvis/ws-server';
import { AuthenticationService } from '../../../services/AuthenticationService';
import type { IHandlerContext, IClientRegistration, ISocketWrapper } from '@jarvis/ws-server';
import { ClientType } from '@jarvis/ws-server';

// Preserve real BaseHandler but mock ClientManager so validation/emitError work
jest.mock('@jarvis/ws-server', () => {
    const realWs = jest.requireActual('@jarvis/ws-server');
    const ClientManagerMock = jest.fn().mockImplementation(() => ({
        getClient: jest.fn(),
        registerClient: jest.fn(),
        getAllClients: jest.fn().mockReturnValue(new Map())
    }));
    return {
        ...realWs,
        ClientManager: ClientManagerMock,
    };
});

describe('RegistrationHandler (unit)', () => {
    let handler: RegistrationHandler;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuth: jest.Mocked<AuthenticationService>;
    let socket: ISocketWrapper & { emit: jest.Mock; };

    beforeEach(() => {
        mockClientManager = new (require('@jarvis/ws-server').ClientManager)();
        mockClientManager.registerClient = jest.fn();

        mockAuth = {
            authenticateUser: jest.fn(),
            hasPermission: jest.fn(),
            canUseTool: jest.fn()
        } as unknown as jest.Mocked<AuthenticationService>;

        socket = { id: 's1', emit: jest.fn() } as any;

        handler = new RegistrationHandler(mockClientManager as any, mockAuth as any);

        jest.clearAllMocks();
    });

    it('has correct eventName', () => {
        expect(handler.eventName).toBe('client_registration');
    });

    it('registers client and emits confirmation when auth succeeds', async () => {
        const reg: IClientRegistration = {
            id: 'r1', type: 'client_registration', timestamp: Date.now(),
            clientType: ClientType.BROWSER_EXTENSION, capabilities: ['page_content']
        } as any;

        const userInfo = { userId: 'u1', isAuthenticated: true, permissions: ['chat'] };
        mockAuth.authenticateUser.mockResolvedValue(userInfo as any);

        const returnedClient = { id: 's1', user: userInfo } as any;
        mockClientManager.registerClient.mockReturnValue(returnedClient);

        const ctx = { clientId: 's1' } as IHandlerContext;

        // spy on private emitError to ensure not called
        const emitErrorSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

        await handler.handle(socket as any, reg, ctx);

        expect(mockAuth.authenticateUser).toHaveBeenCalled();
        expect(mockClientManager.registerClient).toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('registration_confirmed', expect.objectContaining({ clientId: 's1' }));
        expect(emitErrorSpy).not.toHaveBeenCalled();
    });

    it('calls emitError when authentication fails', async () => {
        const reg: IClientRegistration = {
            id: 'r2', type: 'client_registration', timestamp: Date.now(),
            clientType: ClientType.BROWSER_EXTENSION, capabilities: ['basic']
        } as any;

        mockAuth.authenticateUser.mockRejectedValue(new Error('bad token'));

        const emitSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

        await handler.handle(socket as any, reg, { clientId: 's1' } as IHandlerContext);

        expect(mockClientManager.registerClient).not.toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalledWith(socket, 'Registration failed', expect.any(Object));
    });
});