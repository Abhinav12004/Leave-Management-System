/**
 * Jest Configuration for Leave Management System Tests
 * 
 * This configuration supports the Node.js/Express backend testing.
 */

module.exports = {
  // Use Node.js environment for backend testing
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/*.test.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Coverage directory and reporters
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};