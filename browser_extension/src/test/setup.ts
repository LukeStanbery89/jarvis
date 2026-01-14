// Test setup file for Jest

// Provide `jest` alias when running tests under Vitest (`vi` global)
if (typeof (global as any).jest === 'undefined' && typeof (global as any).vi !== 'undefined') {
    (global as any).jest = (global as any).vi;
}

// Mock Chrome APIs
global.chrome = {
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
        },
        sync: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
        },
    },
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
        create: jest.fn().mockResolvedValue({ id: 2 }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
    },
    scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: { title: 'Test', content: 'Mock content' } }]),
    },
    runtime: {
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        getURL: jest.fn().mockReturnValue('chrome-extension://test/'),
    },
} as any;



// Mock fetch to prevent real HTTP requests
global.fetch = jest.fn().mockImplementation((url: string) => {
    // Check if this is an unmocked endpoint that should fail
    if (url.includes('unknown-endpoint')) {
        return Promise.reject(new Error(`Unmocked fetch request to: ${url}`));
    }

    // Default mock responses based on URL patterns
    if (url.includes('/api/summarize')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                summary: 'Mock summary content',
                title: 'Mock Page Title',
                timestamp: new Date().toISOString(),
            }),
        });
    }

    if (url.includes('/api/chat')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                content: 'Mock agent response',
                sessionId: 'mock-session-id',
                timestamp: new Date().toISOString(),
            }),
        });
    }

    // Default fallback for other URLs
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    });
});

// Mock WebSocket to prevent real connections
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    url: string;
    readyState: number = 1; // OPEN
    send = jest.fn();
    close = jest.fn();
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    // Instance constants
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;

    constructor(url: string, protocols?: string | string[]) {
        this.url = url;
    }
}

global.WebSocket = MockWebSocket as any;

// Setup DOM environment
Object.defineProperty(window, 'location', {
    value: {
        href: 'https://example.com',
        origin: 'https://example.com',
        pathname: '/test',
        search: '',
        hash: '',
    },
    writable: true,
});

// Mock window.getSelection for content extraction tests
Object.defineProperty(window, 'getSelection', {
    value: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue(''),
        rangeCount: 0,
    }),
    writable: true,
});

// Suppress console warnings for cleaner test output
const originalWarn = console.warn;
console.warn = jest.fn().mockImplementation((message: string) => {
    // Only show warnings that don't relate to our intentional mocking
    if (!message.includes('🚫 Attempted to fetch')) {
        originalWarn(message);
    }
});