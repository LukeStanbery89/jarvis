import 'reflect-metadata';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_MODEL = 'gpt-4.1-mini';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'silent';
process.env.VERBOSE_LOGGING = 'false';

// Mock Winston logger at module level to prevent initialization
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        verbose: jest.fn()
    }
}));

// Suppress console logs during tests unless explicitly needed
global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};