/**
 * Jest setup file
 * Suppress console output during tests
 */

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};

// Mock console methods to suppress output during tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

// Optionally, you can restore console for specific tests if needed
// by accessing originalConsole
(global as any).originalConsole = originalConsole;
