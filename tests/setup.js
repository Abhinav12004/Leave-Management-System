/**
 * Jest Test Setup File
 * 
 * This file runs before all tests and sets up common utilities,
 * mocks, and configurations needed across test suites.
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  // Uncomment the line below to suppress console.log during tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock Supabase client
  createMockSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn()
  }),

  // Helper to create mock request object
  createMockRequest: (params = {}, body = {}, query = {}) => ({
    params,
    body,
    query,
    supabase: global.testUtils.createMockSupabase()
  }),

  // Helper to create mock response object
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Common test data fixtures
  fixtures: {
    employee: {
      id: 1,
      name: 'John Doe',
      email: 'john@company.com',
      department: 'Engineering',
      joining_date: '2024-01-01',
      leave_balance: 20
    },
    
    manager: {
      id: 2,
      name: 'Jane Manager',
      email: 'jane@company.com',
      department: 'Management',
      joining_date: '2023-01-01',
      leave_balance: 25
    },
    
    leaveRequest: {
      id: 1,
      employee_id: 1,
      start_date: '2024-02-15',
      end_date: '2024-02-19',
      type: 'paid',
      reason: 'Vacation',
      status: 'pending',
      created_at: '2024-02-01T10:00:00Z',
      updated_at: '2024-02-01T10:00:00Z'
    }
  }
};

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {};