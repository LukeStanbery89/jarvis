// Test setup file for rag-tools-browser module

// Provide `jest` alias when running tests under Vitest (`vi` global)
if (typeof (global as any).jest === 'undefined' && typeof (global as any).vi !== 'undefined') {
    (global as any).jest = (global as any).vi;
}

// Suppress console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

console.log = () => {};
console.error = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

// Mock Chrome APIs
global.chrome = {
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
        },
    },
    tabs: {
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        onUpdated: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    runtime: {
        lastError: undefined,
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        getURL: jest.fn().mockReturnValue('chrome-extension://test/'),
    },
} as any;

// Setup DOM environment
Object.defineProperty(window, 'location', {
    value: {
        href: 'https://example.com/test',
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

// Mock window.getComputedStyle for visibility checks
Object.defineProperty(window, 'getComputedStyle', {
    value: jest.fn().mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
    }),
    writable: true,
});

// Mock document.title
Object.defineProperty(document, 'title', {
    value: 'Test Page',
    writable: true,
});
