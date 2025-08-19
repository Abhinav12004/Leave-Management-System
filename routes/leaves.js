// Leave routes - API endpoints for leave management
const express = require('express');
const leaveController = require('../controllers/leaveController.js');

const router = express.Router();

// POST /api/leaves/apply - Apply for leave
router.post('/apply', leaveController.applyForLeave);

// GET /api/leaves/employee/:employee_id - Get all leave requests for an employee
router.get('/employee/:employee_id', leaveController.getEmployeeLeaves);

// GET /api/leaves/pending - Get all pending leave requests (for managers)
router.get('/pending', leaveController.getPendingLeaveRequests);

// PUT /api/leaves/:id/approve - Approve or reject a leave request
router.put('/:id/approve', leaveController.approveRejectLeave);

// DELETE /api/leaves/:id - Cancel a leave request (soft delete with status change)
// Only allows cancellation of pending leave requests
// Example: DELETE /api/leaves/1 with optional body: { "employee_id": 1, "reason": "Plans changed" }
router.delete('/:id', leaveController.cancelLeaveRequest);

// PATCH /api/leaves/:id - Modify a pending leave request
// Accepts partial updates: start_date, end_date, type, reason, leave_type
// Example: PATCH /api/leaves/1 with body: { "start_date": "2025-08-25", "end_date": "2025-08-27", "leave_type": "half_day_morning" }
router.patch('/:id', leaveController.modifyLeaveRequest);

module.exports = router;
