import { BaseHandler } from '../src/BaseHandler';
import { IHandlerContext, ISocketWrapper, ILogger, IClientConnection } from '../src/types';

// Minimal mock ClientManager
class MockClientManager {
    private clients: Map<string, IClientConnection> = new Map();

    registerClient(client: IClientConnection) {
        this.clients.set(client.id, client);
    }

    getClient(id: string) {
        return this.clients.get(id);
    }

    getAllClients() {
        return Array.from(this.clients.values());
    }
}

// Expose protected methods via a testable subclass
class TestHandler extends BaseHandler<any> {
    readonly eventName = 'test_event';

    async handle() {
        // not used in these unit tests
    }

    // Expose protected methods for testing
    public _createContext(socket: ISocketWrapper): IHandlerContext {
        return this.createContext(socket);
    }

    public _emitError(socket: ISocketWrapper, message: string, details?: any): void {
        return this.emitError(socket, message, details);
    }

    public _validateClientRegistration(socket: ISocketWrapper, context: IHandlerContext): boolean {
        return this.validateClientRegistration(socket, context);
    }

    public _generateMessageId(): string {
        return this.generateMessageId();
    }

    public _logActivity(action: string, details?: any): void {
        return this.logActivity(action, details);
    }
}

describe('BaseHandler', () => {
    let clientManager: MockClientManager;
    let logger: ILogger;
    let handler: TestHandler;
    let socket: ISocketWrapper;

    beforeEach(() => {
        clientManager = new MockClientManager();

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        handler = new TestHandler((clientManager as unknown) as any, logger);

        socket = {
            id: 'socket-1',
            emit: jest.fn(),
            disconnect: jest.fn()
        };
    });

    it('creates context with client info and timestamp', () => {
        const client: IClientConnection = {
            id: 'socket-1',
            type: 'unknown' as any,
            capabilities: [],
            metadata: {},
            socket: socket,
            connectedAt: Date.now(),
            user: { isAuthenticated: false, permissions: [] }
        };

        clientManager.registerClient(client);

        const ctx = handler._createContext(socket);

        expect(ctx.clientId).toBe('socket-1');
        expect(ctx.client).toBe(client);
        expect(typeof ctx.timestamp).toBe('number');
        expect(ctx.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('emitError sends error envelope to socket', () => {
        handler._emitError(socket, 'Something bad', { code: 123 });

        expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
            id: expect.any(String),
            type: 'error',
            message: 'Something bad',
            details: { code: 123 }
        }));
    });

    it('validateClientRegistration fails and emits error when client not registered', () => {
        const ctx: IHandlerContext = { clientId: socket.id, client: undefined, timestamp: Date.now() };

        const result = handler._validateClientRegistration(socket, ctx);

        expect(result).toBe(false);
        expect((logger.warn as jest.Mock).mock.calls.length).toBeGreaterThan(0);
        expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'Client not registered. Please register first.' }));
    });

    it('validateClientRegistration passes when client exists', () => {
        const client: IClientConnection = {
            id: 'socket-1',
            type: 'unknown' as any,
            capabilities: [],
            metadata: {},
            socket: socket,
            connectedAt: Date.now(),
            user: { isAuthenticated: false, permissions: [] }
        };
        clientManager.registerClient(client);

        const ctx: IHandlerContext = { clientId: socket.id, client: client, timestamp: Date.now() };

        const result = handler._validateClientRegistration(socket, ctx);

        expect(result).toBe(true);
        expect((logger.debug as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('generateMessageId returns expected format', () => {
        const id = handler._generateMessageId();
        expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('logActivity calls appropriate logger methods', () => {
        handler._logActivity('action-no-details');
        expect(logger.info).toHaveBeenCalledWith('action-no-details', expect.objectContaining({ service: handler.eventName }));

        handler._logActivity('action-with-details', { foo: 'bar' });
        expect(logger.debug).toHaveBeenCalled();
    });
});
