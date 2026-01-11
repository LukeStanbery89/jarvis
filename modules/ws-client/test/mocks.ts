/**
 * Mock utilities for WebSocketClient tests
 * Provides mocks for WebSocket, storage adapter, and device identity
 */

import { IDeviceIdentity, IStorageAdapter } from '@jarvis/device-identity';

/**
 * Mock CloseEvent for Node.js environment
 */
class MockCloseEvent extends Event {
    public code: number;
    public reason: string;

    constructor(type: string, options: { code: number; reason: string }) {
        super(type);
        this.code = options.code;
        this.reason = options.reason;
    }
}

// Make CloseEvent available globally in test environment
(global as any).CloseEvent = MockCloseEvent;

/**
 * Mock WebSocket implementation
 */
export class MockWebSocket {
    public onopen: ((event: Event) => void) | null = null;
    public onclose: ((event: CloseEvent) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onmessage: ((event: MessageEvent) => void) | null = null;

    public readyState: number = 0; // CONNECTING
    public url: string;

    private listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map();
    private sentMessages: string[] = [];

    // WebSocket ready states
    public static readonly CONNECTING = 0;
    public static readonly OPEN = 1;
    public static readonly CLOSING = 2;
    public static readonly CLOSED = 3;

    constructor(url: string) {
        this.url = url;
    }

    send(data: string): void {
        // Validate readyState like real WebSocket
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error('WebSocket is not open: readyState ' + this.readyState + ' (OPEN = 1)');
        }
        this.sentMessages.push(data);
    }

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
    }

    // Test helper: Get all sent messages
    getSentMessages(): string[] {
        return [...this.sentMessages];
    }

    // Test helper: Clear sent messages
    clearSentMessages(): void {
        this.sentMessages = [];
    }

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);
    }

    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject
    ): void {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
        }
    }

    // Test helper methods
    triggerOpen(): void {
        this.readyState = MockWebSocket.OPEN;
        const event = new Event('open');

        // Fire addEventListener listeners first
        const listeners = this.listeners.get('open');
        if (listeners) {
            listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            });
        }

        // Fire onopen handler
        if (this.onopen) {
            this.onopen(event);
        }
    }

    triggerClose(code: number = 1000, reason: string = ''): void {
        this.readyState = MockWebSocket.CLOSED;
        const event = new CloseEvent('close', { code, reason });

        // Fire addEventListener listeners first
        const listeners = this.listeners.get('close');
        if (listeners) {
            listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            });
        }

        // Fire onclose handler
        if (this.onclose) {
            this.onclose(event);
        }
    }

    triggerError(): void {
        const event = new Event('error');

        // Fire addEventListener listeners first
        const listeners = this.listeners.get('error');
        if (listeners) {
            listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            });
        }

        // Fire onerror handler
        if (this.onerror) {
            this.onerror(event);
        }
    }

    triggerMessage(data: any): void {
        const event = new MessageEvent('message', {
            data: JSON.stringify(data)
        });

        // Fire addEventListener listeners first
        const listeners = this.listeners.get('message');
        if (listeners) {
            listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            });
        }

        // Fire onmessage handler
        if (this.onmessage) {
            this.onmessage(event);
        }
    }
}

/**
 * Mock storage adapter
 */
export class MockStorageAdapter implements IStorageAdapter {
    private storage: Map<string, string> = new Map();

    async get(key: string): Promise<string | null> {
        return this.storage.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.storage.delete(key);
    }

    async has(key: string): Promise<boolean> {
        return this.storage.has(key);
    }

    // Test helper methods
    clear(): void {
        this.storage.clear();
    }

    getAll(): Map<string, string> {
        return new Map(this.storage);
    }
}

/**
 * Mock device identity
 */
export function createMockDeviceIdentity(): IDeviceIdentity {
    return {
        deviceId: 'test-device-id-12345',
        deviceType: 'browser_extension',
        capabilities: ['test_capability_1', 'test_capability_2'],
        metadata: {
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            browserName: 'chrome',
            browserVersion: '120.0.0.0',
            extensionVersion: '1.0.0',
            userAgent: 'Mozilla/5.0 (Test) Chrome/120.0.0.0'
        }
    };
}

/**
 * Helper to flush pending promises
 * Resolves microtasks without advancing timers
 */
export function flushPromises(): Promise<void> {
    return Promise.resolve();
}
