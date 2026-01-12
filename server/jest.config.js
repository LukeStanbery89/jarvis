module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/test/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/index.ts',
        '!src/test/**',
        '!src/**/*.test.{ts,js}',
        '!src/**/testUtils.{ts,js}',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    modulePathIgnorePatterns: ['<rootDir>/dist'],
    clearMocks: true,
    verbose: false,
    maxWorkers: '50%', // Use half available CPU cores for better performance
    // Use manual mocks for workspace packages
    moduleNameMapper: {
        '^@jarvis/server-utils$': '<rootDir>/__mocks__/@jarvis/server-utils.ts'
    }
};