export default {
    testEnvironment: 'node',
    setupFiles: ['./tests/setup.js'],
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    verbose: true,
    transform: {
        '^.+\\.js$': 'babel-jest'
    }
};
