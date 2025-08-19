/**
 * Test Fixtures and Mock Data
 * 
 * This file contains reusable test data, mock objects, and helper functions
 * for testing the Leave Management System API endpoints.
 */

export const employees = {
  john: {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@company.com',
    department: 'Engineering',
    joining_date: '2024-01-01',
    leave_balance: 20
  },
  
  jane: {
    id: 2,
    name: 'Jane Manager',
    email: 'jane.manager@company.com',
    department: 'Management',
    joining_date: '2023-01-01',
    leave_balance: 25
  },
  
  alice: {
    id: 3,
    name: 'Alice Smith',
    email: 'alice.smith@company.com',
    department: 'HR',
    joining_date: '2023-06-01',
    leave_balance: 18
  },
  
  lowBalance: {
    id: 4,
    name: 'Low Balance Employee',
    email: 'low.balance@company.com',
    department: 'Engineering',
    joining_date: '2024-01-01',
    leave_balance: 3
  },
  
  zeroBalance: {
    id: 5,
    name: 'Zero Balance Employee',
    email: 'zero.balance@company.com',
    department: 'Engineering',
    joining_date: '2024-01-01',
    leave_balance: 0
  }
};

export const leaveRequests = {
  pending: {
    id: 1,
    employee_id: 1,
    start_date: '2024-03-15',
    end_date: '2024-03-19',
    type: 'paid',
    reason: 'Vacation',
    status: 'pending',
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2024-03-01T10:00:00Z',
    approved_by: null
  },
  
  approved: {
    id: 2,
    employee_id: 1,
    start_date: '2024-02-15',
    end_date: '2024-02-19',
    type: 'paid',
    reason: 'Medical appointment',
    status: 'approved',
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2024-02-05T14:30:00Z',
    approved_by: 2
  },
  
  rejected: {
    id: 3,
    employee_id: 1,
    start_date: '2024-04-15',
    end_date: '2024-04-19',
    type: 'paid',
    reason: 'Personal',
    status: 'rejected',
    created_at: '2024-04-01T10:00:00Z',
    updated_at: '2024-04-02T09:15:00Z',
    approved_by: 2
  },
  
  longDuration: {
    id: 4,
    employee_id: 1,
    start_date: '2024-05-01',
    end_date: '2024-05-15', // 11 business days
    type: 'paid',
    reason: 'Extended vacation',
    status: 'pending',
    created_at: '2024-04-15T10:00:00Z',
    updated_at: '2024-04-15T10:00:00Z',
    approved_by: null
  },
  
  singleDay: {
    id: 5,
    employee_id: 1,
    start_date: '2024-06-15',
    end_date: '2024-06-15', // 1 day
    type: 'paid',
    reason: 'Personal appointment',
    status: 'pending',
    created_at: '2024-06-01T10:00:00Z',
    updated_at: '2024-06-01T10:00:00Z',
    approved_by: null
  }
};

export const apiResponses = {
  approvalSuccess: {
    message: 'Leave request approved successfully',
    leave_request: {
      id: 1,
      employee_name: 'John Doe',
      employee_id: 1,
      start_date: '2024-03-15',
      end_date: '2024-03-19',
      days_requested: 5,
      type: 'paid',
      reason: 'Vacation',
      status: 'approved',
      approved_by: 'Jane Manager',
      approved_by_id: 2,
      processed_on: '2024-03-05T10:00:00Z'
    },
    employee_balance_update: {
      previous_balance: 20,
      new_balance: 15,
      days_deducted: 5
    }
  },
  
  rejectionSuccess: {
    message: 'Leave request rejected successfully! ���',
    leave_request: {
      id: 1,
      employee_name: 'John Doe',
      employee_id: 1,
      start_date: '2024-03-15',
      end_date: '2024-03-19',
      days_requested: 5,
      type: 'paid',
      reason: 'Vacation',
      status: 'rejected',
      approved_by: 'Jane Manager',
      approved_by_id: 2,
      processed_on: '2024-03-05T10:00:00Z'
    }
  }
};

export const errorResponses = {
  invalidLeaveId: {
    error: 'Please provide a valid leave request ID'
  },
  
  invalidStatus: {
    error: "Status must be either 'approved' or 'rejected'"
  },
  
  missingApprover: {
    error: 'Please provide the ID of the person approving this request'
  },
  
  leaveNotFound: {
    error: 'Leave request not found. Please check the ID and try again.',
    debug_info: 'Searched for leave request ID: 999',
    suggestion: 'Try getting all leave requests for an employee first to see available IDs'
  },
  
  alreadyProcessed: {
    error: 'This leave request has already been approved. Cannot change status again.',
    current_status: 'approved',
    leave_id: 1,
    suggestion: 'Only pending leave requests can be approved or rejected'
  },
  
  approverNotFound: {
    error: 'Approver not found. Please check the approver ID.',
    debug_info: 'Searched for approver ID: 999',
    suggestion: 'Make sure the approver employee exists in the system. Try ID 1 for Alice Johnson.'
  },
  
  insufficientBalance: {
    error: 'Cannot approve: Employee would have negative balance (-2 days). Current balance: 3 days, requesting: 5 days.'
  }
};

export const testScenarios = {
  // Valid approval scenarios
  validApproval: {
    leaveId: '1',
    requestBody: {
      status: 'approved',
      approved_by: 2
    },
    expectedStatus: 200
  },
  
  validRejection: {
    leaveId: '1',
    requestBody: {
      status: 'rejected',
      approved_by: 2
    },
    expectedStatus: 200
  },
  
  // Invalid input scenarios
  invalidLeaveId: {
    leaveId: 'invalid',
    requestBody: {
      status: 'approved',
      approved_by: 2
    },
    expectedStatus: 400
  },
  
  missingStatus: {
    leaveId: '1',
    requestBody: {
      approved_by: 2
    },
    expectedStatus: 400
  },
  
  invalidStatus: {
    leaveId: '1',
    requestBody: {
      status: 'invalid_status',
      approved_by: 2
    },
    expectedStatus: 400
  },
  
  missingApprover: {
    leaveId: '1',
    requestBody: {
      status: 'approved'
    },
    expectedStatus: 400
  },
  
  invalidApprover: {
    leaveId: '1',
    requestBody: {
      status: 'approved',
      approved_by: 'invalid'
    },
    expectedStatus: 400
  },
  
  // Business logic error scenarios
  nonExistentLeave: {
    leaveId: '999',
    requestBody: {
      status: 'approved',
      approved_by: 2
    },
    expectedStatus: 404
  },
  
  alreadyProcessed: {
    leaveId: '2', // Assuming this is already approved
    requestBody: {
      status: 'approved',
      approved_by: 2
    },
    expectedStatus: 400
  },
  
  nonExistentApprover: {
    leaveId: '1',
    requestBody: {
      status: 'approved',
      approved_by: 999
    },
    expectedStatus: 404
  },
  
  insufficientBalance: {
    leaveId: '4', // Long duration leave for low balance employee
    requestBody: {
      status: 'approved',
      approved_by: 2
    },
    expectedStatus: 400
  }
};

// Helper functions for creating mock data
export const createMockLeaveRequest = (overrides = {}) => ({
  ...leaveRequests.pending,
  ...overrides
});

export const createMockEmployee = (overrides = {}) => ({
  ...employees.john,
  ...overrides
});

export const createMockApprover = (overrides = {}) => ({
  ...employees.jane,
  ...overrides
});

// Database operation mocks
export const mockDatabaseOperations = {
  getLeaveById: {
    success: (leaveData = leaveRequests.pending) => ({
      success: true,
      data: {
        ...leaveData,
        employee: employees.john
      }
    }),
    
    notFound: () => ({
      success: false,
      error: 'Leave request not found'
    })
  },
  
  getEmployeeById: {
    success: (employeeData = employees.jane) => ({
      success: true,
      data: employeeData
    }),
    
    notFound: () => ({
      success: false,
      error: 'Employee not found'
    })
  },
  
  updateLeaveBalance: {
    success: (newBalance = 15) => ({
      success: true,
      data: {
        ...employees.john,
        leave_balance: newBalance
      }
    }),
    
    failure: () => ({
      success: false,
      error: 'Database update failed'
    })
  },
  
  updateLeaveStatus: {
    success: (status = 'approved', approvedBy = 2) => ({
      success: true,
      data: {
        ...leaveRequests.pending,
        status,
        approved_by: approvedBy,
        updated_at: new Date().toISOString(),
        employee: employees.john
      }
    }),
    
    failure: () => ({
      success: false,
      error: 'Database update failed'
    })
  }
};

export default {
  employees,
  leaveRequests,
  apiResponses,
  errorResponses,
  testScenarios,
  createMockLeaveRequest,
  createMockEmployee,
  createMockApprover,
  mockDatabaseOperations
};