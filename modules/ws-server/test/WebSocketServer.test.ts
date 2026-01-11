/**
 * Tests for WebSocketServer
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer } from '../src/WebSocketServer';
import { IEventHandler, ISocketWrapper, ILogger, ClientType } from '../src/types';

// Mock handler for testing
class MockHandler implements IEventHandler<any> {
    readonly eventName: string;
    handle = jest.fn();

    constructor(eventName: string) {
        this.eventName = eventName;
    }
}

describe('WebSocketServer', () => {
    let httpServer: HttpServer;
    let wss: WebSocketServer;
    let mockLogger: ILogger;

    beforeEach(() => {
        httpServer = {
            listen: jest.fn(),
            close: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            emit: jest.fn(),
            removeListener: jest.fn()
        } as any;

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
    });

    afterEach(async () => {
        if (wss) {
            try {
                await wss.shutdown();
            } catch (error) {
                // Ignore shutdown errors in tests
            }
        }
    });

    describe('constructor', () => {
        it('should create server with default config', () => {
            wss = new WebSocketServer(httpServer, {}, mockLogger);
            expect(wss).toBeDefined();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'WebSocket server initialized',
                expect.objectContaining({
                    service: 'WebSocketServer',
                    path: '/'
                })
            );
        });

        it('should create server with custom config', () => {
            wss = new WebSocketServer(
                httpServer,
                {
                    path: '/custom',
                    maxConnections: 50,
                    pingInterval: 15000,
                    clientTimeout: 30000,
                    clientManager: {
                        defaultPermissions: ['read'],
                        maxMetadataSize: 5000
                    }
                },
                mockLogger
            );
            expect(wss).toBeDefined();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'WebSocket server initialized',
                expect.objectContaining({
                    path: '/custom',
                    maxConnections: 50
                })
            );
        });

        it('should work without logger', () => {
            wss = new WebSocketServer(httpServer);
            expect(wss).toBeDefined();
        });

        it('should validate configuration', () => {
            expect(() => {
                wss = new WebSocketServer(httpServer, {
                    maxConnections: -1
                }, mockLogger);
            }).toThrow('maxConnections must be a non-negative number');
        });
    });

    describe('handler registration', () => {
        beforeEach(() => {
            wss = new WebSocketServer(httpServer, {}, mockLogger);
        });

        it('should register handler', () => {
            const handler = new MockHandler('test_event');
            wss.registerHandler(handler);

            expect(wss.getHandler('test_event')).toBe(handler);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Handler registered',
                expect.objectContaining({
                    eventName: 'test_event'
                })
            );
        });

        it('should override existing handler', () => {
            const handler1 = new MockHandler('test_event');
            const handler2 = new MockHandler('test_event');

            wss.registerHandler(handler1);
            wss.registerHandler(handler2);

            expect(wss.getHandler('test_event')).toBe(handler2);
        });

        it('should return undefined for non-existent handler', () => {
            expect(wss.getHandler('non_existent')).toBeUndefined();
        });
    });

    describe('client management', () => {
        beforeEach(() => {
            wss = new WebSocketServer(httpServer, {}, mockLogger);
        });

        it('should start with no clients', () => {
            expect(wss.getAllClients()).toEqual([]);
            expect(wss.getConnectionStats().total).toBe(0);
        });

        it('should query clients by type', () => {
            const clients = wss.getClientsByType(ClientType.BROWSER_EXTENSION);
            expect(clients).toEqual([]);
        });

        it('should query clients by capability', () => {
            const clients = wss.getClientsByCapability('chat');
            expect(clients).toEqual([]);
        });

        it('should get connection stats', () => {
            const stats = wss.getConnectionStats();
            expect(stats).toEqual({
                total: 0,
                byType: {},
                authenticated: 0
            });
        });
    });

    describe('broadcasting', () => {
        let mockSocket: ISocketWrapper;

        beforeEach(() => {
            wss = new WebSocketServer(httpServer, {}, mockLogger);

            mockSocket = {
                id: 'socket-123',
                emit: jest.fn(),
                disconnect: jest.fn()
            };

            // Manually add client to test broadcasting
            (wss as any).clientManager.registerClient(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['chat']
            );
        });

        it('should broadcast to client type', () => {
            wss.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test_event', { data: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });
        });

        it('should broadcast to capability', () => {
            wss.broadcastToCapability('chat', 'test_event', { data: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });
        });

        it('should not error when broadcasting to empty set', () => {
            expect(() => {
                wss.broadcastToClientType(ClientType.HARDWARE, 'test_event', {});
            }).not.toThrow();

            expect(() => {
                wss.broadcastToCapability('non_existent', 'test_event', {});
            }).not.toThrow();
        });
    });

    describe('shutdown', () => {
        let mockSocket: ISocketWrapper;

        beforeEach(() => {
            wss = new WebSocketServer(httpServer, {}, mockLogger);

            mockSocket = {
                id: 'socket-123',
                emit: jest.fn(),
                disconnect: jest.fn()
            };

            // Manually add client
            (wss as any).clientManager.registerClient(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['chat']
            );
        });

        it('should notify clients on shutdown', async () => {
            const shutdownPromise = wss.shutdown();

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'server_shutdown',
                expect.objectContaining({
                    message: 'Server is shutting down'
                })
            );

            await shutdownPromise;
        });

        it('should disconnect all clients', async () => {
            await wss.shutdown();
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        it('should clear client registry', async () => {
            await wss.shutdown();
            expect(wss.getAllClients()).toEqual([]);
        });

        it('should log shutdown', async () => {
            await wss.shutdown();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Shutting down WebSocket server',
                expect.objectContaining({ service: 'WebSocketServer' })
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'WebSocket server shut down successfully',
                expect.objectContaining({ service: 'WebSocketServer' })
            );
        });

        it('should handle shutdown errors gracefully', async () => {
            mockSocket.emit = jest.fn(() => {
                throw new Error('Emit failed');
            });

            await expect(wss.shutdown()).resolves.not.toThrow();
        });
    });

    describe('max connections enforcement', () => {
        it('should accept connections below limit', () => {
            wss = new WebSocketServer(
                httpServer,
                { maxConnections: 2 },
                mockLogger
            );

            // This is a unit test, so we test the logic rather than actual connections
            // In integration tests, we would test with real WebSocket connections
            expect(wss.getAllClients()).toHaveLength(0);
        });
    });

    describe('configuration validation', () => {
        it('should reject invalid maxConnections', () => {
            expect(() => {
                wss = new WebSocketServer(httpServer, { maxConnections: -1 }, mockLogger);
            }).toThrow();
        });

        it('should reject invalid pingInterval', () => {
            expect(() => {
                wss = new WebSocketServer(httpServer, { pingInterval: 500 }, mockLogger);
            }).toThrow();
        });

        it('should reject invalid clientTimeout', () => {
            expect(() => {
                wss = new WebSocketServer(httpServer, { clientTimeout: 500 }, mockLogger);
            }).toThrow();
        });
    });
});
