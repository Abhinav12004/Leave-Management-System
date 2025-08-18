/**
 * Unit and Integration Tests for Approve/Reject Leave API Endpoint
 * 
 * Endpoint: PUT /api/leaves/:id/approve
 * Controller: leaveController.approveRejectLeave
 * 
 * This test suite covers:
 * 1. Successful approval/rejection scenarios
 * 2. Error handling for invalid inputs
 * 3. Business logic validations
 * 4. Database state changes
 * 5. Edge cases and concurrency scenarios
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import leaveController from '../controllers/leaveController.js';
import leaveModel from '../models/leaveModel.js';
import employeeModel from '../models/employeeModel.js';
import dateUtils from '../utils/dateUtils.js';

// Mock the models and utilities
jest.mock('../models/leaveModel.js');
jest.mock('../models/employeeModel.js');
jest.mock('../utils/dateUtils.js');

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock Supabase middleware
app.use((req, res, next) => {
  req.supabase = {
    from: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn()
  };
  next();
});

// Setup route
app.put('/api/leaves/:id/approve', leaveController.approveRejectLeave);

describe('PUT /api/leaves/:id/approve - Approve/Reject Leave API', () => {
  
  // Sample test data
  const mockLeaveRequest = {
    id: 1,
    employee_id: 1,
    start_date: '2024-01-15',
    end_date: '2024-01-19',
    type: 'paid',
    reason: 'Vacation',
    status: 'pending',
    created_at: '2024-01-01T10:00:00Z',
    employee: {
      id: 1,
      name: 'John Doe',
      email: 'john@company.com',
      leave_balance: 15
    }
  };

  const mockApprover = {
    id: 2,
    name: 'Jane Manager',
    email: 'jane@company.com',
    leave_balance: 20
  };

  const mockEmployee = {
    id: 1,
    name: 'John Doe',
    email: 'john@company.com',
    leave_balance: 15
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    dateUtils.calculateBusinessDays.mockReturnValue(5);
    dateUtils.formatDate.mockImplementation(date => date);
  });

  describe('Successful Approval Tests', () => {
    
    test('should successfully approve a pending leave request', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockEmployee
      });
      
      employeeModel.updateLeaveBalance.mockResolvedValue({
        success: true,
        data: { ...mockEmployee, leave_balance: 10 }
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved',
          approved_by: 2,
          updated_at: '2024-01-02T10:00:00Z'
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('approved successfully');
      expect(response.body.leave_request.status).toBe('approved');
      expect(response.body.leave_request.approved_by).toBe('Jane Manager');
      expect(response.body.employee_balance_update.new_balance).toBe(10);
      expect(response.body.employee_balance_update.days_deducted).toBe(5);
      
      // Verify model calls
      expect(leaveModel.getById).toHaveBeenCalledWith(expect.anything(), '1');
      expect(employeeModel.updateLeaveBalance).toHaveBeenCalledWith(expect.anything(), 1, 10);
      expect(leaveModel.updateLeaveStatus).toHaveBeenCalledWith(expect.anything(), '1', 'approved', '2');
    });

    test('should successfully reject a pending leave request', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'rejected',
          approved_by: 2,
          updated_at: '2024-01-02T10:00:00Z'
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'rejected',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rejected successfully');
      expect(response.body.leave_request.status).toBe('rejected');
      expect(response.body.leave_request.approved_by).toBe('Jane Manager');
      
      // Verify balance was NOT updated for rejection
      expect(employeeModel.updateLeaveBalance).not.toHaveBeenCalled();
      expect(leaveModel.updateLeaveStatus).toHaveBeenCalledWith(expect.anything(), '1', 'rejected', '2');
    });

  });

  describe('Input Validation Tests', () => {
    
    test('should return 400 for invalid leave request ID', async () => {
      const response = await request(app)
        .put('/api/leaves/invalid/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid leave request ID');
    });

    test('should return 400 for missing status', async () => {
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          approved_by: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approved or rejected');
    });

    test('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'invalid_status',
          approved_by: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approved or rejected');
    });

    test('should return 400 for missing approver ID', async () => {
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approving this request');
    });

    test('should return 400 for invalid approver ID', async () => {
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approving this request');
    });

  });

  describe('Business Logic Error Tests', () => {
    
    test('should return 404 for non-existent leave request', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: false,
        error: 'Leave request not found'
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/999/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Leave request not found');
      expect(response.body.debug_info).toContain('999');
    });

    test('should return 400 for already processed leave request', async () => {
      // Arrange
      const processedLeave = {
        ...mockLeaveRequest,
        status: 'approved'
      };
      
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: processedLeave
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been approved');
      expect(response.body.current_status).toBe('approved');
    });

    test('should return 404 for non-existent approver', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: false,
        error: 'Employee not found'
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 999
        });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Approver not found');
      expect(response.body.debug_info).toContain('999');
    });

  });

  describe('Edge Cases and Balance Validation', () => {
    
    test('should handle approval when employee would have negative balance', async () => {
      // Arrange
      const lowBalanceEmployee = {
        ...mockEmployee,
        leave_balance: 3 // Less than requested days (5)
      };
      
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: lowBalanceEmployee
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('negative balance');
      expect(response.body.error).toContain('Current balance: 3');
      expect(employeeModel.updateLeaveBalance).not.toHaveBeenCalled();
    });

    test('should handle approval when employee has exactly enough balance', async () => {
      // Arrange
      const exactBalanceEmployee = {
        ...mockEmployee,
        leave_balance: 5 // Exactly the requested days
      };
      
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: exactBalanceEmployee
      });
      
      employeeModel.updateLeaveBalance.mockResolvedValue({
        success: true,
        data: { ...exactBalanceEmployee, leave_balance: 0 }
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved',
          approved_by: 2
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.employee_balance_update.new_balance).toBe(0);
      expect(employeeModel.updateLeaveBalance).toHaveBeenCalledWith(expect.anything(), 1, 0);
    });

  });

  describe('Database Error Handling', () => {
    
    test('should handle database error when fetching leave request', async () => {
      // Arrange
      leaveModel.getById.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Something went wrong');
    });

    test('should handle database error when updating leave balance', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockEmployee
      });
      
      employeeModel.updateLeaveBalance.mockResolvedValue({
        success: false,
        error: 'Database update failed'
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('update employee leave balance');
    });

    test('should handle database error when updating leave status', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: false,
        error: 'Database update failed'
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'rejected',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('update leave request status');
    });

  });

  describe('Case Sensitivity Tests', () => {
    
    test('should handle uppercase status values', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved',
          approved_by: 2
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'APPROVED',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(200);
      expect(leaveModel.updateLeaveStatus).toHaveBeenCalledWith(expect.anything(), '1', 'approved', '2');
    });

    test('should handle mixed case status values', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'rejected',
          approved_by: 2
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'Rejected',
          approved_by: 2
        });

      // Assert
      expect(response.status).toBe(200);
      expect(leaveModel.updateLeaveStatus).toHaveBeenCalledWith(expect.anything(), '1', 'rejected', '2');
    });

  });

  describe('Concurrency Simulation Tests', () => {
    
    test('should handle concurrent approval attempts (race condition)', async () => {
      // Arrange - Simulate two simultaneous approval requests
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockEmployee
      });
      
      employeeModel.updateLeaveBalance.mockResolvedValue({
        success: true,
        data: { ...mockEmployee, leave_balance: 10 }
      });
      
      // First request succeeds
      leaveModel.updateLeaveStatus.mockResolvedValueOnce({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved',
          approved_by: 2
        }
      });
      
      // Second request should fail (already processed)
      leaveModel.getById.mockResolvedValueOnce({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved' // Already processed
        }
      });

      // Act - Make two concurrent requests
      const [response1, response2] = await Promise.all([
        request(app)
          .put('/api/leaves/1/approve')
          .send({ status: 'approved', approved_by: 2 }),
        request(app)
          .put('/api/leaves/1/approve')
          .send({ status: 'approved', approved_by: 3 })
      ]);

      // Assert - First should succeed, second should fail
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('already been approved');
    });

  });

  describe('Response Format Validation', () => {
    
    test('should return properly formatted success response for approval', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockApprover
      });
      
      employeeModel.getById.mockResolvedValueOnce({
        success: true,
        data: mockEmployee
      });
      
      employeeModel.updateLeaveBalance.mockResolvedValue({
        success: true,
        data: { ...mockEmployee, leave_balance: 10 }
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'approved',
          approved_by: 2,
          updated_at: '2024-01-02T10:00:00Z'
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'approved',
          approved_by: 2
        });

      // Assert response structure
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('leave_request');
      expect(response.body).toHaveProperty('employee_balance_update');
      
      expect(response.body.leave_request).toHaveProperty('id');
      expect(response.body.leave_request).toHaveProperty('employee_name');
      expect(response.body.leave_request).toHaveProperty('status');
      expect(response.body.leave_request).toHaveProperty('approved_by');
      expect(response.body.leave_request).toHaveProperty('approved_by_id');
      
      expect(response.body.employee_balance_update).toHaveProperty('previous_balance');
      expect(response.body.employee_balance_update).toHaveProperty('new_balance');
      expect(response.body.employee_balance_update).toHaveProperty('days_deducted');
    });

    test('should return properly formatted success response for rejection', async () => {
      // Arrange
      leaveModel.getById.mockResolvedValue({
        success: true,
        data: mockLeaveRequest
      });
      
      employeeModel.getById.mockResolvedValue({
        success: true,
        data: mockApprover
      });
      
      leaveModel.updateLeaveStatus.mockResolvedValue({
        success: true,
        data: {
          ...mockLeaveRequest,
          status: 'rejected',
          approved_by: 2,
          updated_at: '2024-01-02T10:00:00Z'
        }
      });

      // Act
      const response = await request(app)
        .put('/api/leaves/1/approve')
        .send({
          status: 'rejected',
          approved_by: 2
        });

      // Assert response structure
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('leave_request');
      expect(response.body).not.toHaveProperty('employee_balance_update'); // Should not exist for rejections
      
      expect(response.body.leave_request.status).toBe('rejected');
      expect(response.body.leave_request.approved_by).toBe('Jane Manager');
    });

  });

});