module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    testTimeout: 20000,
    setupFiles: ['<rootDir>/test/setup.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts'
    ],
    moduleNameMapper: {
        '^@jarvis/protocol$': '<rootDir>/../protocol/src/index.ts',
        '^@jarvis/server-utils$': '<rootDir>/../server-utils/src/index.ts',
        '^@jarvis/ws-server$': '<rootDir>/../ws-server/src/index.ts'
    }
};
