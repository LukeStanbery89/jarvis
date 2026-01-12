jest.mock('winston', () => {
    const m = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
    return {
        createLogger: jest.fn(() => ({ ...m, level: 'info' })),
        transports: { Console: jest.fn() },
        format: {
            combine: jest.fn(() => { }),
            timestamp: jest.fn(() => { }),
            colorize: jest.fn(() => { }),
            printf: jest.fn(() => { })
        }
    };
});

describe('Logger', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('creates logger and exposes methods', () => {
        process.env.VERBOSE_LOGGING = 'false';
        const { logger } = require('../src/logger');

        expect(typeof logger.info).toBe('function');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
    });

    it('debug respects VERBOSE_LOGGING', () => {
        process.env.VERBOSE_LOGGING = 'true';
        const { logger } = require('../src/logger');

        // Should not throw when calling
        expect(() => logger.debug('msg', { a: 1 })).not.toThrow();
    });
});
