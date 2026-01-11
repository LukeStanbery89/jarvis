module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts'
    ],
    moduleNameMapper: {
        '^@jarvis/protocol$': '<rootDir>/../protocol/src/index.ts'
    }
};
