/**
 * WebSocketClient tests
 * Comprehensive test suite for all WebSocketClient functionality
 */

import { WebSocketClient } from '../src/WebSocketClient';
import { IWebSocketClientDependencies } from '../src/types';
import { IStorageAdapter } from '@jarvis/device-identity';
import {
    MockWebSocket,
    MockStorageAdapter,
    createMockDeviceIdentity,
    flushPromises
} from './mocks';

// Mock WebSocket globally
let mockWebSocketInstance: MockWebSocket | null = null;
(global as any).WebSocket = class {
    constructor(url: string) {
        mockWebSocketInstance = new MockWebSocket(url);
        return mockWebSocketInstance;
    }
} as any;

// Mock console methods to avoid test output noise
const originalConsole = { ...console };
beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
});

describe('WebSocketClient', () => {
    let client: WebSocketClient;
    let dependencies: IWebSocketClientDependencies;
    let mockStorage: MockStorageAdapter;

    beforeEach(() => {
        mockStorage = new MockStorageAdapter();
        dependencies = {
            deviceIdentity: createMockDeviceIdentity(),
            storage: mockStorage,
            capabilities: ['test_capability_1', 'test_capability_2']
        };
        mockWebSocketInstance = null;
    });

    afterEach(() => {
        if (client) {
            client.disconnect();
        }
    });

    // ========== Connection Lifecycle Tests ==========

    describe('Connection Lifecycle', () => {
        it('should connect successfully', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();

            // Simulate WebSocket open
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();

            const result = await connectPromise;
            expect(result).toBe(true);
            expect(client.connected).toBe(true);
        });

        it('should handle connection timeout', async () => {
            jest.useFakeTimers();
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();

            // Advance timers past connection timeout (10 seconds)
            jest.advanceTimersByTime(10000);

            await expect(connectPromise).rejects.toThrow('Connection timeout');
            expect(client.connected).toBe(false);

            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('should handle connection error', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();

            // Simulate WebSocket error
            await flushPromises();
            mockWebSocketInstance?.triggerError();

            await expect(connectPromise).rejects.toBeDefined();
            expect(client.connected).toBe(false);
        });

        it('should clean up existing socket before reconnecting', async () => {
            client = new WebSocketClient(dependencies);

            // First connection
            const firstConnect = client.connect();
            await flushPromises();
            const firstSocket = mockWebSocketInstance;
            firstSocket?.triggerOpen();
            await firstConnect;

            // Second connection should clean up first socket
            const secondConnect = client.connect();
            await flushPromises();

            expect(firstSocket?.onopen).toBeNull();
            expect(firstSocket?.onclose).toBeNull();
            expect(firstSocket?.onerror).toBeNull();
            expect(firstSocket?.onmessage).toBeNull();
        });

        it('should disconnect cleanly', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            client.disconnect();

            expect(client.connected).toBe(false);
            expect(mockWebSocketInstance?.onopen).toBeNull();
            expect(mockWebSocketInstance?.onclose).toBeNull();
            expect(mockWebSocketInstance?.onerror).toBeNull();
            expect(mockWebSocketInstance?.onmessage).toBeNull();
        });
    });

    // ========== Reconnection Logic Tests ==========

    describe('Reconnection Logic', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('should attempt reconnection on unexpected disconnect', async () => {
            client = new WebSocketClient(dependencies, {
                reconnectDelay: 1000,
                maxReconnectAttempts: 3
            });

            // Connect successfully
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            // Simulate unexpected disconnect (code 1006 = abnormal closure)
            mockWebSocketInstance?.triggerClose(1006, 'Connection lost');

            // Wait for reconnection attempt
            jest.advanceTimersByTime(1000);
            await flushPromises();

            // Should have created new WebSocket instance
            expect(mockWebSocketInstance).toBeDefined();
        });

        it('should use exponential backoff for reconnection', async () => {
            client = new WebSocketClient(dependencies, {
                reconnectDelay: 1000,
                maxReconnectAttempts: 3
            });

            // Connect and disconnect
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const originalSocket = mockWebSocketInstance;

            // First disconnect - should retry after 1 second (1000ms)
            mockWebSocketInstance?.triggerClose(1006);

            // Advance time and wait for reconnection attempt
            jest.advanceTimersByTime(1000);
            await flushPromises();

            // Should have created a new socket
            expect(mockWebSocketInstance).not.toBe(originalSocket);
            const firstReconnectSocket = mockWebSocketInstance;

            // Open the reconnected socket
            mockWebSocketInstance?.triggerOpen();
            await flushPromises();

            // Second disconnect - should retry after 2 seconds (1000ms * 2)
            mockWebSocketInstance?.triggerClose(1006);

            // Advance time and wait for reconnection attempt
            jest.advanceTimersByTime(2000);
            await flushPromises();

            // Should have created yet another socket
            expect(mockWebSocketInstance).not.toBe(firstReconnectSocket);
        });

        it('should stop reconnecting after max attempts', async () => {
            client = new WebSocketClient(dependencies, {
                reconnectDelay: 100,
                maxReconnectAttempts: 2,
                disconnectedPollInterval: 100000 // Very long interval to prevent polling interference
            });

            const maxAttemptsListener = jest.fn();
            client.on('max_reconnect_attempts_reached', maxAttemptsListener);

            // Initial connection succeeds
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;
            expect(client.connected).toBe(true);

            // First unexpected disconnect triggers first reconnection attempt
            mockWebSocketInstance?.triggerClose(1006, 'Network error');
            await flushPromises();

            // First reconnect attempt - after 100ms delay (attempt 1)
            jest.advanceTimersByTime(100);
            await flushPromises();
            // Simulate connection timeout (10000ms) - don't call triggerOpen()
            jest.advanceTimersByTime(10000);
            await flushPromises();
            // Allow .catch() handler to execute and call handleDisconnection
            await flushPromises();

            // Second reconnect attempt - after 200ms delay (attempt 2, exponential backoff)
            jest.advanceTimersByTime(200);
            await flushPromises();
            // Simulate connection timeout again (10000ms)
            jest.advanceTimersByTime(10000);
            await flushPromises();
            // Allow .catch() handler to execute and call handleDisconnection
            await flushPromises();

            // Should have reached max attempts (2) and emitted event
            expect(maxAttemptsListener).toHaveBeenCalled();
            expect(client.connected).toBe(false);
        });

        it('should not reconnect on normal closure (1000)', async () => {
            client = new WebSocketClient(dependencies, {
                disconnectedPollInterval: 100000 // Very long interval to prevent polling reconnection
            });

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const reconnectListener = jest.fn();
            client.on('connection_status_changed', reconnectListener);

            // Normal closure - should not reconnect
            mockWebSocketInstance?.triggerClose(1000, 'Normal closure');
            jest.advanceTimersByTime(5000);
            await flushPromises();

            // Should only have the disconnect event, not a reconnect event
            const connectEvents = reconnectListener.mock.calls.filter(
                call => call[0].connected === true
            );
            expect(connectEvents.length).toBe(0);
        });

        it('should not reconnect on going away closure (1001)', async () => {
            client = new WebSocketClient(dependencies, {
                disconnectedPollInterval: 100000 // Very long interval to prevent polling reconnection
            });

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const reconnectListener = jest.fn();
            client.on('connection_status_changed', reconnectListener);

            // Going away closure - should not reconnect
            mockWebSocketInstance?.triggerClose(1001, 'Server shutdown');
            jest.advanceTimersByTime(5000);
            await flushPromises();

            // Should only have the disconnect event, not a reconnect event
            const connectEvents = reconnectListener.mock.calls.filter(
                call => call[0].connected === true
            );
            expect(connectEvents.length).toBe(0);
        });
    });

    // ========== Session Management Tests ==========

    describe('Session Management', () => {
        it('should create new session', async () => {
            client = new WebSocketClient(dependencies);

            await client.createNewSession();

            const sessionId = client.getCurrentSessionId();
            expect(sessionId).toBeDefined();
            expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
        });

        it('should persist session to storage', async () => {
            client = new WebSocketClient(dependencies);

            await client.createNewSession();

            const sessionId = client.getCurrentSessionId();
            const storedSession = await mockStorage.get('chatSessionId');
            expect(storedSession).toBe(sessionId);
        });

        it('should load stored session on initialization', async () => {
            // Pre-populate storage with session
            await mockStorage.set('chatSessionId', 'existing-session-123');

            client = new WebSocketClient(dependencies);
            await flushPromises(); // Wait for async initialization

            expect(client.getCurrentSessionId()).toBe('existing-session-123');
        });

        it('should clear session', async () => {
            client = new WebSocketClient(dependencies);

            await client.createNewSession();
            expect(client.getCurrentSessionId()).toBeDefined();

            await client.clearSession();

            expect(client.getCurrentSessionId()).toBeNull();
            expect(await mockStorage.get('chatSessionId')).toBeNull();
        });

        it('should send clear message to server when connected', async () => {
            client = new WebSocketClient(dependencies);

            // Connect
            const connectPromise = client.connect();
            await flushPromises();
            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            await client.createNewSession();
            mockSend.mockClear();

            await client.clearSession();

            expect(mockSend).toHaveBeenCalled();
            const sentData = JSON.parse(mockSend.mock.calls[0][0]);
            expect(sentData.type).toBe('clear_conversation');
        });

        it('should throw error if session creation fails', async () => {
            // Create storage that fails on set
            const failingStorage: IStorageAdapter = {
                get: async () => null,
                set: async () => {
                    throw new Error('Storage error');
                },
                remove: async () => {},
                has: async () => false
            };

            client = new WebSocketClient({
                ...dependencies,
                storage: failingStorage
            });

            await expect(client.createNewSession()).rejects.toThrow();
            expect(client.getCurrentSessionId()).toBeNull();
        });
    });

    // ========== Messaging Tests ==========

    describe('Messaging', () => {
        beforeEach(async () => {
            client = new WebSocketClient(dependencies);
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;
        });

        it('should send chat message with session', async () => {
            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');

            await client.sendChatMessage('Hello, world!');

            expect(mockSend).toHaveBeenCalled();
            const sentData = JSON.parse(mockSend.mock.calls[0][0]);
            expect(sentData.type).toBe('chat_message');
            expect(sentData.content).toBe('Hello, world!');
            expect(sentData.sessionId).toBeDefined();
        });

        it('should create session automatically if none exists', async () => {
            expect(client.getCurrentSessionId()).toBeNull();

            await client.sendChatMessage('Test message');

            expect(client.getCurrentSessionId()).toBeDefined();
        });

        it('should throw error when sending message while disconnected', async () => {
            client.disconnect();

            await expect(client.sendChatMessage('Test')).rejects.toThrow('Cannot send message: not connected');
        });

        it('should send arbitrary message', () => {
            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');

            client.sendMessage('custom_event', { foo: 'bar' });

            expect(mockSend).toHaveBeenCalled();
            const sentData = JSON.parse(mockSend.mock.calls[0][0]);
            expect(sentData.type).toBe('custom_event');
            expect(sentData.foo).toBe('bar');
        });

        it('should register client on connection', async () => {
            // Create new client to test registration
            const newClient = new WebSocketClient(dependencies);
            const connectPromise = newClient.connect();
            await flushPromises();

            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            expect(mockSend).toHaveBeenCalled();
            const sentData = JSON.parse(mockSend.mock.calls[0][0]);
            expect(sentData.type).toBe('client_registration');
            expect(sentData.clientType).toBe('browser_extension');
            expect(sentData.capabilities).toEqual(['test_capability_1', 'test_capability_2']);
            expect(sentData.metadata.deviceId).toBe('test-device-id-12345');

            newClient.disconnect();
        });
    });

    // ========== Health Monitoring Tests ==========

    describe('Health Monitoring', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('should start polling after connection', async () => {
            client = new WebSocketClient(dependencies, {
                connectedPollInterval: 30000,
                disconnectedPollInterval: 5000
            });

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');

            // Advance to poll interval
            jest.advanceTimersByTime(30000);
            await flushPromises();

            expect(mockSend).toHaveBeenCalled();
            const sentData = JSON.parse(mockSend.mock.calls[0][0]);
            expect(sentData.type).toBe('ping');
        });

        it('should reset poll timer after sending message', async () => {
            client = new WebSocketClient(dependencies, {
                connectedPollInterval: 30000
            });

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');
            mockSend.mockClear();

            // Send a message
            await client.sendChatMessage('Test');

            // Advance almost to poll interval
            jest.advanceTimersByTime(29000);
            await flushPromises();

            // Should not have sent ping yet (timer was reset)
            const pingCalls = mockSend.mock.calls.filter(call => {
                const data = JSON.parse(call[0]);
                return data.type === 'ping';
            });
            expect(pingCalls.length).toBe(0);
        });

        it('should use faster polling when disconnected', async () => {
            client = new WebSocketClient(dependencies, {
                disconnectedPollInterval: 5000
            });

            // Don't connect, just observe polling behavior
            jest.advanceTimersByTime(5000);
            await flushPromises();

            // Should have attempted connection
            expect(mockWebSocketInstance).toBeDefined();
        });
    });

    // ========== Event System Tests ==========

    describe('Event System', () => {
        beforeEach(async () => {
            client = new WebSocketClient(dependencies);
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;
        });

        it('should emit connection status changed event', async () => {
            const listener = jest.fn();
            const newClient = new WebSocketClient(dependencies);
            newClient.on('connection_status_changed', listener);

            const connectPromise = newClient.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            expect(listener).toHaveBeenCalledWith({ connected: true });

            newClient.disconnect();
        });

        it('should emit agent response event', () => {
            const listener = jest.fn();
            client.on('agent_response', listener);

            mockWebSocketInstance?.triggerMessage({
                type: 'agent_response',
                content: 'Test response'
            });

            expect(listener).toHaveBeenCalledWith({
                type: 'agent_response',
                content: 'Test response'
            });
        });

        it('should remove event listener', () => {
            const listener = jest.fn();
            client.on('agent_response', listener);
            client.off('agent_response', listener);

            mockWebSocketInstance?.triggerMessage({
                type: 'agent_response',
                content: 'Test response'
            });

            expect(listener).not.toHaveBeenCalled();
        });

        it('should remove all listeners for event type', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            client.on('agent_response', listener1);
            client.on('agent_response', listener2);
            client.off('agent_response');

            mockWebSocketInstance?.triggerMessage({
                type: 'agent_response',
                content: 'Test response'
            });

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
        });

        it('should handle multiple listeners for same event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            client.on('agent_response', listener1);
            client.on('agent_response', listener2);

            mockWebSocketInstance?.triggerMessage({
                type: 'agent_response',
                content: 'Test response'
            });

            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
        });

        it('should handle errors in event listeners gracefully', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Listener error');
            });
            const goodListener = jest.fn();

            client.on('agent_response', errorListener);
            client.on('agent_response', goodListener);

            mockWebSocketInstance?.triggerMessage({
                type: 'agent_response',
                content: 'Test response'
            });

            // Both should be called despite error
            expect(errorListener).toHaveBeenCalled();
            expect(goodListener).toHaveBeenCalled();
        });
    });

    // ========== Memory Management Tests ==========

    describe('Memory Management', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('should clean up all event handlers on disconnect', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();
            await flushPromises();
            const socket = mockWebSocketInstance!;
            socket.triggerOpen();
            await connectPromise;

            client.disconnect();

            expect(socket.onopen).toBeNull();
            expect(socket.onclose).toBeNull();
            expect(socket.onerror).toBeNull();
            expect(socket.onmessage).toBeNull();
        });

        it('should clear connection timeout on successful connection', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            // Advance past timeout - should not reject
            jest.advanceTimersByTime(15000);
            await flushPromises();

            // Should still be connected
            expect(client.connected).toBe(true);
        });

        it('should clear all timers on disconnect', async () => {
            client = new WebSocketClient(dependencies);

            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            // Get number of pending timers
            const timersBefore = jest.getTimerCount();

            client.disconnect();

            // Should have fewer timers after disconnect
            const timersAfter = jest.getTimerCount();
            expect(timersAfter).toBeLessThan(timersBefore);
        });
    });

    // ========== Configuration Tests ==========

    describe('Configuration', () => {
        it('should use default configuration', () => {
            client = new WebSocketClient(dependencies);

            // Defaults should be applied (tested indirectly through behavior)
            expect(client).toBeDefined();
        });

        it('should accept custom configuration', async () => {
            client = new WebSocketClient(dependencies, {
                serverUrl: 'ws://custom-server:8080',
                maxReconnectAttempts: 10,
                reconnectDelay: 2000,
                connectedPollInterval: 60000,
                disconnectedPollInterval: 10000
            });

            const connectPromise = client.connect();
            await flushPromises();

            expect(mockWebSocketInstance?.url).toBe('ws://custom-server:8080');
        });

        it('should auto-connect if configured', async () => {
            client = new WebSocketClient(dependencies, {
                autoConnect: true
            });

            await flushPromises();

            expect(mockWebSocketInstance).toBeDefined();
        });
    });

    // ========== Utility Tests ==========

    describe('Utilities', () => {
        beforeEach(() => {
            client = new WebSocketClient(dependencies);
        });

        it('should generate unique message IDs', async () => {
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            const mockSend = jest.spyOn(mockWebSocketInstance!, 'send');

            await client.sendChatMessage('Message 1');
            await client.sendChatMessage('Message 2');

            const id1 = JSON.parse(mockSend.mock.calls[0][0]).id;
            const id2 = JSON.parse(mockSend.mock.calls[1][0]).id;

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^msg_\d+_[a-z0-9]+$/);
        });

        it('should use device ID for socket ID', async () => {
            const connectPromise = client.connect();
            await flushPromises();
            mockWebSocketInstance?.triggerOpen();
            await connectPromise;

            expect(client.socketId).toBe('test-device-id-12345');
        });

        it('should return undefined socket ID when disconnected', () => {
            expect(client.socketId).toBeUndefined();
        });
    });
});
