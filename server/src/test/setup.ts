import 'reflect-metadata';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_MODEL = 'gpt-4.1-mini';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'silent';
process.env.VERBOSE_LOGGING = 'false';

// Note: @jarvis/server-utils is mocked via manual mock in __mocks__/@jarvis/server-utils.ts
// This ensures the mock is loaded before any modules import it (important for workspace packages)

// Suppress console logs during tests unless explicitly needed
global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};