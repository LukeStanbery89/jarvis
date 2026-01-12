try {
    // reflect-metadata is optional in test environments; require if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('reflect-metadata');
} catch (e) {
    // ignore if not installed
}

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_MODEL = 'gpt-4.1-mini';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'silent';
process.env.VERBOSE_LOGGING = 'false';
process.env.SERPER_API_KEY = 'test-serper-key';

jest.mock('@jarvis/server-utils', () => {
    const logger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        verbose: jest.fn()
    };

    const Memoization = {
        memoize: (fn: any) => fn,
        clearCache: jest.fn(),
        clearAllCaches: jest.fn(),
        getCacheStats: jest.fn(() => null),
        getAllCacheIds: jest.fn(() => [])
    };

    return {
        logger,
        memoize: Memoization.memoize,
        Memoization,
        Memoized: (opts: any) => (target: any, prop: string, desc: PropertyDescriptor) => desc
    };
});

global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
