import 'reflect-metadata';
import { ChatHandler } from '../../../websocket/handlers/ChatHandler';
import { ClientManager } from '@jarvis/ws-server';
import { AuthenticationService } from '../../../services/AuthenticationService';
import { ChatService } from '../../../services/ChatService';
import { ClientType } from '@jarvis/ws-server';
import type { IHandlerContext, IClientConnection, ISocketWrapper } from '@jarvis/ws-server';
import { ChatMessage, AgentResponse } from '@jarvis/protocol';

// Keep mocks local and minimal — preserve real BaseHandler but mock ClientManager
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

describe('ChatHandler (unit)', () => {
    let handler: ChatHandler;
    let mockClientManager: jest.Mocked<ClientManager>;
    let mockAuth: jest.Mocked<AuthenticationService>;
    let mockChat: jest.Mocked<ChatService>;
    let socket: ISocketWrapper & { emit: jest.Mock; };
    let context: Partial<IHandlerContext>;

    beforeEach(() => {
        mockClientManager = new (require('@jarvis/ws-server').ClientManager)();
        mockClientManager.getClient = jest.fn();

        mockAuth = {
            authenticateUser: jest.fn(),
            hasPermission: jest.fn().mockReturnValue(true),
            canUseTool: jest.fn()
        } as unknown as jest.Mocked<AuthenticationService>;

        mockChat = {
            processMessage: jest.fn(),
            clearHistory: jest.fn(),
            getStats: jest.fn()
        } as unknown as jest.Mocked<ChatService>;

        socket = { id: 'socket-1', emit: jest.fn() } as any;

        context = {
            clientId: 'socket-1',
            client: {
                id: 'socket-1',
                type: ClientType.BROWSER_EXTENSION,
                capabilities: ['chat'],
                metadata: {},
                socket,
                connectedAt: Date.now(),
                user: { userId: 'u1', isAuthenticated: true, permissions: ['chat'] }
            } as IClientConnection
        };

        handler = new ChatHandler(mockClientManager as any, mockAuth as any, mockChat as any);

        jest.clearAllMocks();
    });

    it('has the correct eventName', () => {
        expect(handler.eventName).toBe('chat_message');
    });

    it('does not process when client missing and emits an error', async () => {
        const msg: ChatMessage = { id: 'm1', type: 'chat_message', timestamp: Date.now(), content: 'hi', sessionId: 's1' };

        const ctx = { ...context, client: undefined } as IHandlerContext;

        const emitSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

        await handler.handle(socket as any, msg, ctx);

        expect(mockChat.processMessage).not.toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalled();
    });

    it('rejects when auth has no permission', async () => {
        mockAuth.hasPermission.mockReturnValue(false);
        const msg: ChatMessage = { id: 'm2', type: 'chat_message', timestamp: Date.now(), content: 'hello', sessionId: 's2' };
        const emitSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();

        await handler.handle(socket as any, msg, context as IHandlerContext);

        expect(mockChat.processMessage).not.toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalledWith(socket, 'Insufficient permissions for chat');
    });

    it('forwards successful chat responses to the socket', async () => {
        const response: AgentResponse = { id: 'r1', type: 'agent_response', timestamp: Date.now(), content: 'resp', sessionId: 's1' };
        mockChat.processMessage.mockResolvedValue(response as any);

        const msg: ChatMessage = { id: 'm3', type: 'chat_message', timestamp: Date.now(), content: 'hey', sessionId: 's3' };

        await handler.handle(socket as any, msg, context as IHandlerContext);

        expect(mockChat.processMessage).toHaveBeenCalledWith(msg, context);
        expect(socket.emit).toHaveBeenCalledWith('agent_response', response);
    });

    it('emits error message when chatService throws an Error', async () => {
        const err = new Error('boom');
        mockChat.processMessage.mockRejectedValue(err);

        const emitSpy = jest.spyOn(handler as any, 'emitError').mockImplementation();
        const msg: ChatMessage = { id: 'm4', type: 'chat_message', timestamp: Date.now(), content: 'x', sessionId: 's4' };

        await handler.handle(socket as any, msg, context as IHandlerContext);

        expect(emitSpy).toHaveBeenCalledWith(socket, err.message);
    });
});