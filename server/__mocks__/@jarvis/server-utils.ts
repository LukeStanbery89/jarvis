/**
 * Mock for @jarvis/server-utils
 * Used in tests to avoid real logger and memoization
 */

// Mock logger
export const logger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
};

// Mock memoize - just return the original function
export const memoize = (fn: any) => fn;

// Mock Memoization class
export class Memoization {
    clearCache() { }
    getStats() { return {}; }
}

// Mock Memoized type (for TypeScript)
export type Memoized<T> = T;
