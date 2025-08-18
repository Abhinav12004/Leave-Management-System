/**
 * Integration Tests for Approve/Reject Leave API Endpoint
 * 
 * These tests use a real database connection (test database)
 * to verify end-to-end functionality including actual database operations.
 * 
 * Prerequisites:
 * - Test database should be set up with proper schema
 * - Environment variables should point to test database
 * - Test data should be seeded before running tests
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../index.js'; // Assuming your main app export

// Test database configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

describe('Integration Tests: PUT /api/leaves/:id/approve', () => {
  let supabase;
  let testEmployee;
  let testManager;
  let testLeaveRequest;

  beforeAll(async () => {
    // Initialize test database connection
    supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    
    // Verify database connection
    const { data, error } = await supabase.from('employees').select('count').limit(1);
    if (error) {
      console.error('Database connection failed:', error);
      throw new Error('Cannot connect to test database');
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData();
    
    // Create test employee
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .insert([{
        name: 'Test Employee',
        email: 'test.employee@company.com',
        department: 'Engineering',
        joining_date: '2024-01-01',
        leave_balance: 20
      }])
      .select()
      .single();
    
    if (employeeError) throw employeeError;
    testEmployee = employeeData;

    // Create test manager
    const { data: managerData, error: managerError } = await supabase
      .from('employees')
      .insert([{
        name: 'Test Manager',
        email: 'test.manager@company.com',
        department: 'Management',
        joining_date: '2023-01-01',
        leave_balance: 25
      }])
      .select()
      .single();
    
    if (managerError) throw managerError;
    testManager = managerData;

    // Create test leave request
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .insert([{
        employee_id: testEmployee.id,
        start_date: '2024-03-15',
        end_date: '2024-03-19',
        type: 'paid',
        reason: 'Integration test vacation',
        status: 'pending'
      }])
      .select()
      .single();
    
    if (leaveError) throw leaveError;
    testLeaveRequest = leaveData;
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Delete in correct order due to foreign key constraints
    await supabase.from('leave_requests').delete().like('reason', '%Integration test%');
    await supabase.from('employees').delete().like('email', '%test.%@company.com');
  }

  describe('Successful Database Operations', () => {
    
    test('should approve leave and update database correctly', async () => {
      // Act
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      // Assert API response
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('approved successfully');

      // Verify database changes
      const { data: updatedLeave } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', testLeaveRequest.id)
        .single();

      expect(updatedLeave.status).toBe('approved');
      expect(updatedLeave.approved_by).toBe(testManager.id);
      expect(updatedLeave.updated_at).not.toBe(testLeaveRequest.updated_at);

      // Verify employee balance was updated
      const { data: updatedEmployee } = await supabase
        .from('employees')
        .select('leave_balance')
        .eq('id', testEmployee.id)
        .single();

      expect(updatedEmployee.leave_balance).toBe(15); // 20 - 5 days
    });

    test('should reject leave without updating employee balance', async () => {
      // Act
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'rejected',
          approved_by: testManager.id
        });

      // Assert API response
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rejected successfully');

      // Verify database changes
      const { data: updatedLeave } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', testLeaveRequest.id)
        .single();

      expect(updatedLeave.status).toBe('rejected');
      expect(updatedLeave.approved_by).toBe(testManager.id);

      // Verify employee balance was NOT updated
      const { data: updatedEmployee } = await supabase
        .from('employees')
        .select('leave_balance')
        .eq('id', testEmployee.id)
        .single();

      expect(updatedEmployee.leave_balance).toBe(20); // Unchanged
    });

  });

  describe('Database Constraint Validations', () => {
    
    test('should handle non-existent leave request ID', async () => {
      const response = await request(app)
        .put('/api/leaves/99999/approve')
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Leave request not found');
    });

    test('should handle non-existent approver ID', async () => {
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: 99999
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Approver not found');
    });

    test('should prevent double approval', async () => {
      // First approval
      await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      // Second approval attempt
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been approved');
    });

  });

  describe('Balance Validation with Real Data', () => {
    
    test('should prevent approval when insufficient balance', async () => {
      // Create employee with low balance
      const { data: lowBalanceEmployee } = await supabase
        .from('employees')
        .insert([{
          name: 'Low Balance Employee',
          email: 'low.balance@company.com',
          department: 'Engineering',
          joining_date: '2024-01-01',
          leave_balance: 3 // Less than 5 days needed
        }])
        .select()
        .single();

      // Create leave request for 5 days
      const { data: leaveRequest } = await supabase
        .from('leave_requests')
        .insert([{
          employee_id: lowBalanceEmployee.id,
          start_date: '2024-03-15',
          end_date: '2024-03-19', // 5 business days
          type: 'paid',
          reason: 'Integration test - insufficient balance',
          status: 'pending'
        }])
        .select()
        .single();

      // Attempt approval
      const response = await request(app)
        .put(`/api/leaves/${leaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('negative balance');

      // Verify leave status unchanged
      const { data: unchangedLeave } = await supabase
        .from('leave_requests')
        .select('status')
        .eq('id', leaveRequest.id)
        .single();

      expect(unchangedLeave.status).toBe('pending');

      // Verify employee balance unchanged
      const { data: unchangedEmployee } = await supabase
        .from('employees')
        .select('leave_balance')
        .eq('id', lowBalanceEmployee.id)
        .single();

      expect(unchangedEmployee.leave_balance).toBe(3);
    });

    test('should handle exact balance scenario', async () => {
      // Update employee to have exactly 5 days
      await supabase
        .from('employees')
        .update({ leave_balance: 5 })
        .eq('id', testEmployee.id);

      // Approve the 5-day leave request
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      expect(response.status).toBe(200);

      // Verify employee balance is now 0
      const { data: updatedEmployee } = await supabase
        .from('employees')
        .select('leave_balance')
        .eq('id', testEmployee.id)
        .single();

      expect(updatedEmployee.leave_balance).toBe(0);
    });

  });

  describe('Data Integrity Tests', () => {
    
    test('should maintain referential integrity', async () => {
      // Approve leave
      await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      // Verify foreign key relationships are maintained
      const { data: leaveWithRelations } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey (name, email),
          approver:employees!leave_requests_approved_by_fkey (name, email)
        `)
        .eq('id', testLeaveRequest.id)
        .single();

      expect(leaveWithRelations.employee.name).toBe('Test Employee');
      expect(leaveWithRelations.approver.name).toBe('Test Manager');
    });

    test('should handle concurrent approval attempts with database locks', async () => {
      // This test simulates race conditions at the database level
      const approvalPromises = [
        request(app)
          .put(`/api/leaves/${testLeaveRequest.id}/approve`)
          .send({ status: 'approved', approved_by: testManager.id }),
        request(app)
          .put(`/api/leaves/${testLeaveRequest.id}/approve`)
          .send({ status: 'rejected', approved_by: testManager.id })
      ];

      const results = await Promise.allSettled(approvalPromises);
      
      // One should succeed, one should fail
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const failureCount = results.filter(r => r.status === 'fulfilled' && r.value.status >= 400).length;
      
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify final state in database
      const { data: finalLeave } = await supabase
        .from('leave_requests')
        .select('status')
        .eq('id', testLeaveRequest.id)
        .single();

      expect(['approved', 'rejected']).toContain(finalLeave.status);
      expect(finalLeave.status).not.toBe('pending');
    });

  });

  describe('Performance Tests', () => {
    
    test('should complete approval within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .put(`/api/leaves/${testLeaveRequest.id}/approve`)
        .send({
          status: 'approved',
          approved_by: testManager.id
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

  });

});