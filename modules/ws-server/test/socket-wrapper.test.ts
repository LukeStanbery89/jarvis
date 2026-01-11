/**
 * Tests for socket wrapper utilities
 */

import { WebSocket } from 'ws';
import {
    createSocketWrapper,
    isSocketConnected,
    sendPing,
    MessageEnvelope
} from '../src/utils/socket-wrapper';
import { ILogger } from '../src/types';

describe('Socket Wrapper Utilities', () => {
    let mockWebSocket: jest.Mocked<WebSocket>;
    let mockLogger: ILogger;

    beforeEach(() => {
        mockWebSocket = {
            send: jest.fn(),
            close: jest.fn(),
            ping: jest.fn(),
            get readyState() { return WebSocket.OPEN; }
        } as any;

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
    });

    describe('createSocketWrapper', () => {
        it('should create wrapper with correct id', () => {
            const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
            expect(wrapper.id).toBe('socket-123');
        });

        it('should work without logger', () => {
            const wrapper = createSocketWrapper(mockWebSocket, 'socket-123');
            expect(wrapper.id).toBe('socket-123');
        });

        describe('emit', () => {
            it('should send message envelope when socket is open', () => {
                const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
                wrapper.emit('test_event', { key: 'value' });

                expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
                const sentMessage = mockWebSocket.send.mock.calls[0][0] as string;
                const envelope: MessageEnvelope = JSON.parse(sentMessage);

                expect(envelope.type).toBe('test_event');
                expect(envelope.payload).toEqual({ key: 'value' });
                expect(envelope.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
                expect(envelope.timestamp).toBeLessThanOrEqual(Date.now());
            });

            it('should not send when socket is closed', () => {
                const closedSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CLOSED; }
                } as any;
                const wrapper = createSocketWrapper(closedSocket, 'socket-123', mockLogger);
                wrapper.emit('test_event', { key: 'value' });

                expect(closedSocket.send).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    'Cannot emit to closed socket',
                    expect.objectContaining({
                        socketId: 'socket-123',
                        event: 'test_event'
                    })
                );
            });

            it('should not send when socket is connecting', () => {
                const connectingSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CONNECTING; }
                } as any;
                const wrapper = createSocketWrapper(connectingSocket, 'socket-123', mockLogger);
                wrapper.emit('test_event', { key: 'value' });

                expect(connectingSocket.send).not.toHaveBeenCalled();
            });

            it('should not send when socket is closing', () => {
                const closingSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CLOSING; }
                } as any;
                const wrapper = createSocketWrapper(closingSocket, 'socket-123', mockLogger);
                wrapper.emit('test_event', { key: 'value' });

                expect(closingSocket.send).not.toHaveBeenCalled();
            });

            it('should handle serialization errors', () => {
                const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
                const circular: any = {};
                circular.self = circular;

                wrapper.emit('test_event', circular);

                expect(mockWebSocket.send).not.toHaveBeenCalled();
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'Failed to send message',
                    expect.objectContaining({
                        socketId: 'socket-123',
                        event: 'test_event'
                    })
                );
            });

            it('should handle various payload types', () => {
                const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);

                // String
                wrapper.emit('test', 'string payload');
                expect(mockWebSocket.send).toHaveBeenCalled();

                // Number
                wrapper.emit('test', 42);
                expect(mockWebSocket.send).toHaveBeenCalled();

                // Boolean
                wrapper.emit('test', true);
                expect(mockWebSocket.send).toHaveBeenCalled();

                // Null
                wrapper.emit('test', null);
                expect(mockWebSocket.send).toHaveBeenCalled();

                // Array
                wrapper.emit('test', [1, 2, 3]);
                expect(mockWebSocket.send).toHaveBeenCalled();

                // Object
                wrapper.emit('test', { nested: { deep: 'value' } });
                expect(mockWebSocket.send).toHaveBeenCalled();
            });
        });

        describe('disconnect', () => {
            it('should close socket when open', () => {
                const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
                wrapper.disconnect();

                expect(mockWebSocket.close).toHaveBeenCalledTimes(1);
            });

            it('should close socket when connecting', () => {
                const connectingSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CONNECTING; }
                } as any;
                const wrapper = createSocketWrapper(connectingSocket, 'socket-123', mockLogger);
                wrapper.disconnect();

                expect(connectingSocket.close).toHaveBeenCalledTimes(1);
            });

            it('should not close socket when already closed', () => {
                const closedSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CLOSED; }
                } as any;
                const wrapper = createSocketWrapper(closedSocket, 'socket-123', mockLogger);
                wrapper.disconnect();

                expect(closedSocket.close).not.toHaveBeenCalled();
            });

            it('should not close socket when closing', () => {
                const closingSocket = {
                    ...mockWebSocket,
                    get readyState() { return WebSocket.CLOSING; }
                } as any;
                const wrapper = createSocketWrapper(closingSocket, 'socket-123', mockLogger);
                wrapper.disconnect();

                expect(closingSocket.close).not.toHaveBeenCalled();
            });
        });
    });

    describe('isSocketConnected', () => {
        it('should return true when socket is open', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.OPEN; } } as any;
            expect(isSocketConnected(socket)).toBe(true);
        });

        it('should return false when socket is connecting', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.CONNECTING; } } as any;
            expect(isSocketConnected(socket)).toBe(false);
        });

        it('should return false when socket is closing', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.CLOSING; } } as any;
            expect(isSocketConnected(socket)).toBe(false);
        });

        it('should return false when socket is closed', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.CLOSED; } } as any;
            expect(isSocketConnected(socket)).toBe(false);
        });
    });

    describe('sendPing', () => {
        it('should send ping when socket is open', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.OPEN; } } as any;
            const result = sendPing(socket);

            expect(socket.ping).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should return false when socket is not open', () => {
            const socket = { ...mockWebSocket, get readyState() { return WebSocket.CLOSED; } } as any;
            const result = sendPing(socket);

            expect(socket.ping).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should return false when ping throws error', () => {
            const socket = {
                ...mockWebSocket,
                get readyState() { return WebSocket.OPEN; },
                ping: jest.fn(() => { throw new Error('Ping failed'); })
            } as any;

            const result = sendPing(socket);
            expect(result).toBe(false);
        });
    });

    describe('MessageEnvelope structure', () => {
        it('should have consistent structure', () => {
            const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
            wrapper.emit('test_event', { data: 'value' });

            const sentMessage = mockWebSocket.send.mock.calls[0][0] as string;
            const envelope: MessageEnvelope = JSON.parse(sentMessage);

            expect(envelope).toHaveProperty('id');
            expect(envelope).toHaveProperty('type');
            expect(envelope).toHaveProperty('timestamp');
            expect(envelope).toHaveProperty('payload');
        });

        it('should generate unique message IDs', () => {
            const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);

            wrapper.emit('test1', {});
            wrapper.emit('test2', {});
            wrapper.emit('test3', {});

            const ids = mockWebSocket.send.mock.calls.map(call => {
                const envelope: MessageEnvelope = JSON.parse(call[0] as string);
                return envelope.id;
            });

            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(3);
        });

        it('should include accurate timestamps', () => {
            const wrapper = createSocketWrapper(mockWebSocket, 'socket-123', mockLogger);
            const beforeTime = Date.now();

            wrapper.emit('test_event', {});

            const afterTime = Date.now();
            const sentMessage = mockWebSocket.send.mock.calls[0][0] as string;
            const envelope: MessageEnvelope = JSON.parse(sentMessage);

            expect(envelope.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(envelope.timestamp).toBeLessThanOrEqual(afterTime);
        });
    });
});
