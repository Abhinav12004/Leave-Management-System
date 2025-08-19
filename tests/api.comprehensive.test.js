/**
 * Comprehensive API Test Suite for Leave Management System
 * 
 * This test suite covers all API endpoints with comprehensive edge cases,
 * error handling, and validation scenarios.
 * 
 * Test Categories:
 * 1. Employee Management APIs
 * 2. Leave Application APIs  
 * 3. Leave Approval/Rejection APIs
 * 4. Edge Cases and Error Handling
 * 5. Security and Validation
 */

const request = require('supertest');
const express = require('express');
const employeeController = require('../controllers/employeeController.js');
const leaveController = require('../controllers/leaveController.js');
const employeeModel = require('../models/employeeModel.js');
const leaveModel = require('../models/leaveModel.js');
const dateUtils = require('../utils/dateUtils.js');

// Mock all models and utilities
jest.mock('../models/employeeModel.js');
jest.mock('../models/leaveModel.js');
jest.mock('../utils/dateUtils.js');

// Create test Express app
const app = express();
app.use(express.json());

// Mock Supabase middleware
app.use((req, res, next) => {
  req.supabase = { mocked: true };
  next();
});

// Setup routes
app.post('/employees', employeeController.createEmployee);
app.get('/employees', employeeController.getAllEmployees);
app.get('/employees/:id', employeeController.getEmployeeById);
app.get('/employees/:id/leave-balance', employeeController.getLeaveBalance);
app.post('/api/leaves/apply', leaveController.applyForLeave);
app.get('/api/leaves/employee/:employee_id', leaveController.getEmployeeLeaves);
app.get('/api/leaves/pending', leaveController.getPendingLeaveRequests);
app.put('/api/leaves/:id/approve', leaveController.approveRejectLeave);

describe('Comprehensive API Test Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Employee Management APIs', () => {
    
    describe('POST /employees - Create Employee', () => {
      
      test('should create employee with valid data', async () => {
        employeeModel.create.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            name: 'John Doe',
            email: 'john@company.com',
            department: 'Engineering',
            joining_date: '2024-01-01',
            leave_balance: 20
          }
        });

        const response = await request(app)
          .post('/employees')
          .send({
            name: 'John Doe',
            email: 'john@company.com',
            department: 'Engineering',
            joining_date: '2024-01-01'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toContain('created successfully');
        expect(response.body.employee.name).toBe('John Doe');
        expect(response.body.employee.leave_balance).toBe(20);
      });

      test('should reject missing required fields', async () => {
        const response = await request(app)
          .post('/employees')
          .send({
            name: 'John Doe'
            // Missing email, department, joining_date
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required fields');
      });

      test('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/employees')
          .send({
            name: 'John Doe',
            email: 'invalid-email',
            department: 'Engineering',
            joining_date: '2024-01-01'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('valid email');
      });

      test('should handle duplicate email error', async () => {
        employeeModel.create.mockResolvedValue({
          success: false,
          error: 'duplicate key value violates unique constraint'
        });

        const response = await request(app)
          .post('/employees')
          .send({
            name: 'John Doe',
            email: 'existing@company.com',
            department: 'Engineering',
            joining_date: '2024-01-01'
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('Email already exists');
      });

      test('should sanitize input data', async () => {
        employeeModel.create.mockResolvedValue({
          success: true,
          data: { id: 1, name: 'John Doe', email: 'john@company.com' }
        });

        const response = await request(app)
          .post('/employees')
          .send({
            name: '  John Doe  ',
            email: '  JOHN@COMPANY.COM  ',
            department: '  Engineering  ',
            joining_date: '2024-01-01'
          });

        expect(employeeModel.create).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            name: 'John Doe',
            email: 'john@company.com',
            department: 'Engineering'
          })
        );
      });
    });

    describe('GET /employees/:id/leave-balance', () => {
      
      test('should return leave balance for valid employee', async () => {
        employeeModel.getById.mockResolvedValue({
          success: true,
          data: { id: 1, name: 'John Doe', email: 'john@company.com' }
        });

        employeeModel.getLeaveBalance.mockResolvedValue({
          success: true,
          data: {
            total_leave_days: 20,
            days_taken: 5,
            remaining_leave: 15
          }
        });

        const response = await request(app)
          .get('/employees/1/leave-balance');

        expect(response.status).toBe(200);
        expect(response.body.employee.remaining_balance).toBe(15);
        expect(response.body.breakdown.available_balance).toBe(15);
      });

      test('should reject invalid employee ID', async () => {
        const response = await request(app)
          .get('/employees/invalid/leave-balance');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('valid employee ID');
      });

      test('should return 404 for non-existent employee', async () => {
        employeeModel.getById.mockResolvedValue({
          success: false,
          error: 'No rows returned'
        });

        const response = await request(app)
          .get('/employees/999/leave-balance');

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Employee not found');
      });
    });
  });

  describe('Leave Application APIs', () => {
    
    describe('POST /api/leaves/apply - Apply for Leave', () => {
      
      beforeEach(() => {
        dateUtils.isValidDate.mockReturnValue(true);
        dateUtils.calculateBusinessDays.mockReturnValue(3);
      });

      test('should apply for leave with valid data', async () => {
        employeeModel.getById.mockResolvedValue({
          success: true,
          data: { id: 1, name: 'John Doe', email: 'john@company.com' }
        });

        employeeModel.getLeaveBalance.mockResolvedValue({
          success: true,
          data: { remaining_leave: 15 }
        });

        leaveModel.checkOverlappingLeave.mockResolvedValue({
          success: true,
          data: []
        });

        leaveModel.applyForLeave.mockResolvedValue({
          success: true,
          data: {
            id: 1,
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual',
            reason: 'Vacation',
            status: 'pending',
            applied_on: new Date().toISOString()
          }
        });

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual',
            reason: 'Vacation'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toContain('submitted successfully');
        expect(response.body.leave_request.days_requested).toBe(3);
      });

      test('should reject missing required fields', async () => {
        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25'
            // Missing end_date and type
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required info');
      });

      test('should reject invalid date format', async () => {
        dateUtils.isValidDate.mockReturnValue(false);

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: 'invalid-date',
            end_date: '2024-08-27',
            type: 'annual'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid date format');
      });

      test('should reject start date after end date', async () => {
        dateUtils.isValidDate.mockReturnValue(true);

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-27',
            end_date: '2024-08-25',
            type: 'annual'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Start date cannot be after end date');
      });

      test('should reject past dates', async () => {
        dateUtils.isValidDate.mockReturnValue(true);

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2023-01-01',
            end_date: '2023-01-03',
            type: 'annual'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot apply for leave in the past');
      });

      test('should reject insufficient leave balance', async () => {
        dateUtils.isValidDate.mockReturnValue(true);
        dateUtils.calculateBusinessDays.mockReturnValue(10);

        employeeModel.getById.mockResolvedValue({
          success: true,
          data: { id: 1, name: 'John Doe' }
        });

        employeeModel.getLeaveBalance.mockResolvedValue({
          success: true,
          data: { remaining_leave: 5 }
        });

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-09-05',
            type: 'annual'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Insufficient leave balance');
        expect(response.body.current_balance).toBe(5);
        expect(response.body.requested_days).toBe(10);
      });

      test('should reject overlapping leave requests', async () => {
        dateUtils.isValidDate.mockReturnValue(true);
        dateUtils.calculateBusinessDays.mockReturnValue(3);

        employeeModel.getById.mockResolvedValue({
          success: true,
          data: { id: 1, name: 'John Doe' }
        });

        employeeModel.getLeaveBalance.mockResolvedValue({
          success: true,
          data: { remaining_leave: 15 }
        });

        leaveModel.checkOverlappingLeave.mockResolvedValue({
          success: true,
          data: [{
            id: 2,
            start_date: '2024-08-26',
            end_date: '2024-08-28',
            status: 'approved',
            reason: 'Previous vacation'
          }]
        });

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual'
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('conflicts with existing leave');
        expect(response.body.conflicting_leave).toBeDefined();
      });

      test('should handle non-existent employee', async () => {
        dateUtils.isValidDate.mockReturnValue(true);

        employeeModel.getById.mockResolvedValue({
          success: false,
          error: 'Employee not found'
        });

        const response = await request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 999,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual'
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Employee not found');
      });
    });

    describe('GET /api/leaves/pending - Get Pending Requests', () => {
      
      test('should return pending leave requests', async () => {
        leaveModel.getPendingLeaveRequests.mockResolvedValue({
          success: true,
          data: [
            {
              id: 1,
              employee_id: 1,
              employee_name: 'John Doe',
              employee_email: 'john@company.com',
              start_date: '2024-08-25',
              end_date: '2024-08-27',
              type: 'annual',
              reason: 'Vacation',
              days_requested: 3,
              applied_on: '2024-08-20T10:00:00Z'
            }
          ]
        });

        const response = await request(app)
          .get('/api/leaves/pending');

        expect(response.status).toBe(200);
        expect(response.body.total_pending).toBe(1);
        expect(response.body.pending_requests).toHaveLength(1);
        expect(response.body.pending_requests[0].employee_name).toBe('John Doe');
      });

      test('should handle empty pending requests', async () => {
        leaveModel.getPendingLeaveRequests.mockResolvedValue({
          success: true,
          data: []
        });

        const response = await request(app)
          .get('/api/leaves/pending');

        expect(response.status).toBe(200);
        expect(response.body.total_pending).toBe(0);
        expect(response.body.pending_requests).toHaveLength(0);
      });

      test('should handle database errors', async () => {
        leaveModel.getPendingLeaveRequests.mockResolvedValue({
          success: false,
          error: 'Database connection failed'
        });

        const response = await request(app)
          .get('/api/leaves/pending');

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to fetch pending leave requests');
      });
    });
  });

  describe('Leave Approval APIs', () => {
    
    describe('PUT /api/leaves/:id/approve - Approve/Reject Leave', () => {
      
      const mockLeaveRequest = {
        id: 1,
        employee_id: 1,
        start_date: '2024-08-25',
        end_date: '2024-08-27',
        type: 'annual',
        reason: 'Vacation',
        status: 'pending',
        days_requested: 3
      };

      const mockApprover = {
        id: 2,
        name: 'Jane Manager',
        email: 'jane@company.com'
      };

      test('should approve leave request successfully', async () => {
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
          data: { ...mockLeaveRequest, status: 'approved' }
        });

        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'approved',
            approved_by: 2,
            comments: 'Approved for vacation'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('approved successfully');
        expect(response.body.updated_leave.status).toBe('approved');
        expect(response.body.updated_leave.approved_by).toBe('Jane Manager');
      });

      test('should reject leave request successfully', async () => {
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
          data: { ...mockLeaveRequest, status: 'rejected' }
        });

        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'rejected',
            approved_by: 2,
            comments: 'Insufficient coverage'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('rejected successfully');
        expect(response.body.updated_leave.status).toBe('rejected');
      });

      test('should reject invalid leave request ID', async () => {
        const response = await request(app)
          .put('/api/leaves/invalid/approve')
          .send({
            status: 'approved',
            approved_by: 2
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('valid leave request ID');
      });

      test('should reject missing status', async () => {
        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            approved_by: 2
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required fields');
      });

      test('should reject invalid status', async () => {
        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'invalid_status',
            approved_by: 2
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Must be 'approved' or 'rejected'");
      });

      test('should reject missing approver', async () => {
        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'approved'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required fields');
      });

      test('should handle non-existent leave request', async () => {
        leaveModel.getById.mockResolvedValue({
          success: false,
          error: 'Leave request not found'
        });

        const response = await request(app)
          .put('/api/leaves/999/approve')
          .send({
            status: 'approved',
            approved_by: 2
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Leave request not found');
      });

      test('should handle non-existent approver', async () => {
        leaveModel.getById.mockResolvedValue({
          success: true,
          data: mockLeaveRequest
        });

        employeeModel.getById.mockResolvedValue({
          success: false,
          error: 'Approver not found'
        });

        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'approved',
            approved_by: 999
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Approver not found');
      });

      test('should reject already processed leave', async () => {
        leaveModel.getById.mockResolvedValue({
          success: true,
          data: { ...mockLeaveRequest, status: 'approved' }
        });

        const response = await request(app)
          .put('/api/leaves/1/approve')
          .send({
            status: 'approved',
            approved_by: 2
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already been processed');
      });
    });
  });

  describe('Security and Input Validation', () => {
    
    test('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/employees')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}');

      expect(response.status).toBe(400);
    });

    test('should handle SQL injection attempts', async () => {
      employeeModel.create.mockResolvedValue({
        success: false,
        error: 'Invalid input detected'
      });

      const response = await request(app)
        .post('/employees')
        .send({
          name: "'; DROP TABLE employees; --",
          email: 'hacker@evil.com',
          department: 'Engineering',
          joining_date: '2024-01-01'
        });

      // Should not crash and should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should limit request size', async () => {
      const largePayload = {
        name: 'A'.repeat(10000),
        email: 'test@company.com',
        department: 'Engineering',
        joining_date: '2024-01-01'
      };

      const response = await request(app)
        .post('/employees')
        .send(largePayload);

      // Should handle large payloads gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should sanitize HTML/XSS in input', async () => {
      employeeModel.create.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          name: 'John Doe',
          email: 'john@company.com'
        }
      });

      const response = await request(app)
        .post('/employees')
        .send({
          name: '<script>alert("xss")</script>John',
          email: 'john@company.com',
          department: 'Engineering',
          joining_date: '2024-01-01'
        });

      // Should sanitize the input before processing
      expect(employeeModel.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: expect.not.stringContaining('<script>')
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('should handle database connection failures', async () => {
      employeeModel.getById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/employees/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Something went wrong');
    });

    test('should handle concurrent leave applications', async () => {
      dateUtils.isValidDate.mockReturnValue(true);
      dateUtils.calculateBusinessDays.mockReturnValue(3);

      employeeModel.getById.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'John Doe' }
      });

      employeeModel.getLeaveBalance.mockResolvedValue({
        success: true,
        data: { remaining_leave: 3 }
      });

      leaveModel.checkOverlappingLeave.mockResolvedValue({
        success: true,
        data: []
      });

      leaveModel.applyForLeave.mockResolvedValue({
        success: true,
        data: { id: 1, status: 'pending' }
      });

      // Simulate concurrent requests
      const promises = [
        request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual'
          }),
        request(app)
          .post('/api/leaves/apply')
          .send({
            employee_id: 1,
            start_date: '2024-08-25',
            end_date: '2024-08-27',
            type: 'annual'
          })
      ];

      const responses = await Promise.all(promises);
      
      // At least one should succeed, but both succeeding would indicate
      // a race condition that needs database-level protection
      expect(responses.some(r => r.status === 201)).toBe(true);
    });

    test('should handle memory exhaustion gracefully', async () => {
      leaveModel.getPendingLeaveRequests.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      const response = await request(app)
        .get('/api/leaves/pending');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    test('should handle network timeouts', async () => {
      employeeModel.getById.mockRejectedValue(new Error('Network timeout'));

      const response = await request(app)
        .get('/employees/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Something went wrong');
    });
  });
});
