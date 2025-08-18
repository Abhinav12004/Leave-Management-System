// Leave controller - business logic for leave management
import employeeModel from '../models/employeeModel.js';
import leaveModel from '../models/leaveModel.js';
import dateUtils from '../utils/dateUtils.js';

const leaveController = {
  // Apply for leave - main endpoint with all business validations
  async applyForLeave(req, res) {
    try {
      const { employee_id, start_date, end_date, type, reason } = req.body;
      
      // Step 1: Check all required fields are present
      if (!employee_id || !start_date || !end_date || !type) {
        return res.status(400).json({ 
          error: "Missing required info. Please provide employee_id, start_date, end_date, and leave type." 
        });
      }

      // Basic date format validation
      if (!dateUtils.isValidDate(start_date) || !dateUtils.isValidDate(end_date)) {
        return res.status(400).json({
          error: "Invalid date format. Please use YYYY-MM-DD format."
        });
      }

      // Date logic validation
      if (new Date(start_date) > new Date(end_date)) {
        return res.status(400).json({
          error: "Start date cannot be after end date. Please check your dates."
        });
      }

      // Check if dates are in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      
      if (new Date(start_date) < today) {
        return res.status(400).json({
          error: "Cannot apply for leave in the past. Please select a future date."
        });
      }

      console.log(`📝 Processing leave application for employee ${employee_id} from ${start_date} to ${end_date}`);

      // Step 2: Verify employee exists and get their info
      const employeeResult = await employeeModel.getById(req.supabase, employee_id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found. Please check the employee ID.",
          debug: employeeResult.error 
        });
      }

      const employee = employeeResult.data;
      console.log(`✅ Employee found: ${employee.name} (${employee.email})`);

      // Step 3: Calculate requested days (business days only)
      const requestedDays = dateUtils.calculateBusinessDays(start_date, end_date);
      console.log(`📊 Requested days: ${requestedDays} business days`);

      // Step 3b: Get current leave balance
      const balanceResult = await employeeModel.getLeaveBalance(req.supabase, employee_id);
      if (!balanceResult.success) {
        return res.status(500).json({ 
          error: "Failed to fetch leave balance",
          debug: balanceResult.error 
        });
      }

      const currentBalance = balanceResult.data.remaining_leave;
      console.log(`💰 Current leave balance: ${currentBalance} days`);

      // Step 3c: Check if requested days exceed available balance
      if (requestedDays > currentBalance) {
        return res.status(400).json({
          error: "Insufficient leave balance",
          details: `You requested ${requestedDays} days but only have ${currentBalance} days available`,
          current_balance: currentBalance,
          requested_days: requestedDays,
          suggestion: "Please reduce the number of days or check your leave balance"
        });
      }

      // Step 4: Check for overlapping leave requests
      const overlapResult = await leaveModel.checkOverlappingLeave(req.supabase, employee_id, start_date, end_date);
      if (!overlapResult.success) {
        return res.status(500).json({ 
          error: "Failed to check for overlapping leaves",
          debug: overlapResult.error 
        });
      }

      if (overlapResult.data.length > 0) {
        const conflictingLeave = overlapResult.data[0];
        return res.status(409).json({
          error: "Leave request conflicts with existing leave",
          conflicting_leave: {
            start_date: conflictingLeave.start_date,
            end_date: conflictingLeave.end_date,
            status: conflictingLeave.status,
            reason: conflictingLeave.reason
          },
          suggestion: "Please choose different dates or modify your existing leave request"
        });
      }

      // Step 5: Create the leave request
      const leaveData = {
        employee_id,
        start_date,
        end_date,
        type,
        reason: reason || 'No reason provided',
        status: 'pending',
        days_requested: requestedDays,
        applied_on: new Date().toISOString()
      };

      const result = await leaveModel.applyForLeave(req.supabase, leaveData);
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to submit leave request",
          debug: result.error 
        });
      }

      console.log(`🎉 Leave request created successfully with ID: ${result.data.id}`);

      // Return success response
      res.status(201).json({
        message: "Leave request submitted successfully! 🎉",
        leave_request: {
          id: result.data.id,
          employee_name: employee.name,
          start_date: result.data.start_date,
          end_date: result.data.end_date,
          days_requested: requestedDays,
          type: result.data.type,
          reason: result.data.reason,
          status: result.data.status,
          applied_on: result.data.applied_on
        },
        next_steps: "Your request is pending approval. You'll be notified once a manager reviews it."
      });

    } catch (error) {
      console.error('Error in applyForLeave:', error);
      res.status(500).json({ 
        error: "Something went wrong while processing your leave request. Please try again later.",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  },

  // Get leave requests for a specific employee
  async getEmployeeLeaves(req, res) {
    try {
      const { employee_id } = req.params;
      
      if (!employee_id) {
        return res.status(400).json({ 
          error: "Employee ID is required" 
        });
      }

      console.log(`📋 Fetching leave requests for employee ${employee_id}`);

      // First, verify employee exists
      const employeeResult = await employeeModel.getById(req.supabase, employee_id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found",
          debug: employeeResult.error 
        });
      }

      const employee = employeeResult.data;

      // Get all leave requests for the employee
      const result = await leaveModel.getEmployeeLeaves(req.supabase, employee_id);
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to fetch leave requests",
          debug: result.error 
        });
      }

      console.log(`✅ Found ${result.data.length} leave requests for ${employee.name}`);

      res.json({
        message: "Leave requests retrieved successfully! 📋",
        employee_name: employee.name,
        employee_email: employee.email,
        total_requests: result.data.length,
        leave_requests: result.data.map(leave => ({
          id: leave.id,
          start_date: leave.start_date,
          end_date: leave.end_date,
          type: leave.type,
          reason: leave.reason,
          status: leave.status,
          days_requested: leave.days_requested,
          applied_on: leave.applied_on,
          approved_on: leave.approved_on,
          approved_by: leave.approved_by
        }))
      });

    } catch (error) {
      console.error('Error in getEmployeeLeaves:', error);
      res.status(500).json({ 
        error: "Something went wrong while fetching leave requests",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  },

  // Get all pending leave requests (for managers to approve)
  async getPendingLeaveRequests(req, res) {
    try {
      console.log('📋 Fetching all pending leave requests...');

      const result = await leaveModel.getPendingLeaveRequests(req.supabase);
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to fetch pending leave requests",
          debug: result.error 
        });
      }

      console.log(`✅ Found ${result.data.length} pending leave requests`);

      res.json({
        message: "Pending leave requests retrieved successfully! 📋",
        total_pending: result.data.length,
        pending_requests: result.data.map(leave => ({
          id: leave.id,
          employee_id: leave.employee_id,
          employee_name: leave.employee_name,
          employee_email: leave.employee_email,
          start_date: leave.start_date,
          end_date: leave.end_date,
          type: leave.type,
          reason: leave.reason,
          days_requested: leave.days_requested,
          applied_on: leave.applied_on
        }))
      });

    } catch (error) {
      console.error('Error in getPendingLeaveRequests:', error);
      res.status(500).json({ 
        error: "Something went wrong while fetching pending requests",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  },

  // Approve or reject a leave request
  async approveRejectLeave(req, res) {
    try {
      const { id } = req.params;
      const { status, approved_by, comments } = req.body;

      // Validation
      if (!status || !approved_by) {
        return res.status(400).json({ 
          error: "Missing required fields. Please provide status and approved_by." 
        });
      }

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status. Must be 'approved' or 'rejected'." 
        });
      }

      console.log(`📝 Processing ${status} for leave request ${id} by manager ${approved_by}`);

      // Step 1: Get the leave request details
      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found",
          debug: leaveResult.error 
        });
      }

      const leave = leaveResult.data;

      // Check if leave is still pending
      if (leave.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot modify leave request. Current status: ${leave.status}`,
          suggestion: "Only pending leave requests can be approved or rejected"
        });
      }

      // Step 2: Verify approver exists
      const approverResult = await employeeModel.getById(req.supabase, approved_by);
      if (!approverResult.success) {
        return res.status(404).json({ 
          error: "Approver not found. Please check the approved_by employee ID.",
          debug: approverResult.error 
        });
      }

      const approver = approverResult.data;

      // Step 3: Update the leave status
      const updateResult = await leaveModel.updateLeaveStatus(req.supabase, id, status, approved_by, comments);
      if (!updateResult.success) {
        return res.status(500).json({ 
          error: "Failed to update leave status",
          debug: updateResult.error 
        });
      }

      console.log(`✅ Leave request ${id} ${status} successfully by ${approver.name}`);

      // Step 4: Get employee info for response
      const employeeResult = await employeeModel.getById(req.supabase, leave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

      // Step 5: If approved, get updated leave balance
      let newBalance = null;
      if (status === 'approved') {
        const balanceResult = await employeeModel.getLeaveBalance(req.supabase, leave.employee_id);
        if (balanceResult.success) {
          newBalance = balanceResult.data.remaining_leave;
        }
      }

      res.json({
        message: `Leave request ${status} successfully! ${status === 'approved' ? '✅' : '❌'}`,
        updated_leave: {
          id: leave.id,
          employee_name: employee.name,
          start_date: leave.start_date,
          end_date: leave.end_date,
          days_requested: leave.days_requested,
          type: leave.type,
          reason: leave.reason,
          status: status,
          approved_by: approver.name,
          approved_on: new Date().toISOString(),
          comments: comments || null,
          ...(newBalance !== null && { new_leave_balance: newBalance })
        },
        note: status === 'approved' ? 
          "The leave has been approved and the employee's balance has been updated." :
          "The leave has been rejected. No changes made to the employee's balance."
      });

    } catch (error) {
      console.error('Error in approveRejectLeave:', error);
      res.status(500).json({ 
        error: "Something went wrong while processing the approval/rejection",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  },

  // Cancel a leave request (soft delete - marks as rejected)
  async cancelLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { employee_id, reason } = req.body;

      console.log(`🗑️ Processing cancellation for leave request ${id}`);

      // Step 1: Get the leave request details
      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found",
          debug: leaveResult.error 
        });
      }

      const leave = leaveResult.data;

      // Step 2: Optional validation - check if the employee owns this leave request
      if (employee_id && leave.employee_id !== parseInt(employee_id)) {
        return res.status(403).json({
          error: "You can only cancel your own leave requests",
          suggestion: "Please check the employee_id or leave request ID"
        });
      }

      // Step 3: Check if leave can be cancelled (should be pending or approved)
      if (!['pending', 'approved'].includes(leave.status)) {
        return res.status(400).json({
          error: `Cannot cancel leave request. Current status: ${leave.status}`,
          suggestion: "Only pending or approved leave requests can be cancelled"
        });
      }

      // Step 4: Cancel the leave (mark as rejected with cancellation reason)
      const cancelResult = await leaveModel.updateLeaveStatus(
        req.supabase, 
        id, 
        'rejected',  // Use 'rejected' status for cancelled leaves
        leave.employee_id, // Self-cancelled
        reason ? `Cancelled by employee: ${reason}` : 'Cancelled by employee'
      );

      if (!cancelResult.success) {
        return res.status(500).json({ 
          error: "Failed to cancel leave request",
          debug: cancelResult.error 
        });
      }

      console.log(`✅ Leave request ${id} cancelled successfully`);

      // Step 5: Get employee info for response
      const employeeResult = await employeeModel.getById(req.supabase, leave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

      res.json({
        message: "Leave request cancelled successfully! 🗑️",
        cancelled_leave: {
          id: leave.id,
          employee_name: employee.name,
          original_dates: `${leave.start_date} to ${leave.end_date}`,
          type: leave.type,
          reason: leave.reason,
          status: 'cancelled (marked as rejected)',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'No reason provided'
        },
        note: "The leave request has been marked as cancelled and will not affect your leave balance."
      });

    } catch (error) {
      console.error('Error in cancelLeaveRequest:', error);
      res.status(500).json({ 
        error: "Something went wrong while cancelling the leave request",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  },

  // Modify a pending leave request
  async modifyLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { employee_id, start_date, end_date, type, reason } = req.body;

      console.log(`✏️ Processing modification for leave request ${id}`);

      // Step 1: Get the current leave request
      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found",
          debug: leaveResult.error 
        });
      }

      const currentLeave = leaveResult.data;

      // Step 2: Check if leave can be modified (must be pending)
      if (currentLeave.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot modify leave request. Current status: ${currentLeave.status}`,
          suggestion: "Only pending leave requests can be modified"
        });
      }

      // Step 3: Optional validation - check if the employee owns this leave request
      if (employee_id && currentLeave.employee_id !== parseInt(employee_id)) {
        return res.status(403).json({
          error: "You can only modify your own leave requests",
          suggestion: "Please check the employee_id or leave request ID"
        });
      }

      // Step 4: Prepare updated data (only update provided fields)
      const updatedData = {};
      let hasChanges = false;

      if (start_date && start_date !== currentLeave.start_date) {
        if (!dateUtils.isValidDate(start_date)) {
          return res.status(400).json({
            error: "Invalid start_date format. Please use YYYY-MM-DD format."
          });
        }
        updatedData.start_date = start_date;
        hasChanges = true;
      }

      if (end_date && end_date !== currentLeave.end_date) {
        if (!dateUtils.isValidDate(end_date)) {
          return res.status(400).json({
            error: "Invalid end_date format. Please use YYYY-MM-DD format."
          });
        }
        updatedData.end_date = end_date;
        hasChanges = true;
      }

      if (type && type !== currentLeave.type) {
        updatedData.type = type;
        hasChanges = true;
      }

      if (reason && reason !== currentLeave.reason) {
        updatedData.reason = reason;
        hasChanges = true;
      }

      if (!hasChanges) {
        return res.status(400).json({
          error: "No changes detected",
          suggestion: "Please provide at least one field to update (start_date, end_date, type, or reason)"
        });
      }

      // Step 5: Validate dates if they're being changed
      const finalStartDate = updatedData.start_date || currentLeave.start_date;
      const finalEndDate = updatedData.end_date || currentLeave.end_date;

      if (new Date(finalStartDate) > new Date(finalEndDate)) {
        return res.status(400).json({
          error: "Start date cannot be after end date",
          suggestion: "Please check your dates"
        });
      }

      // Check if dates are in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (new Date(finalStartDate) < today) {
        return res.status(400).json({
          error: "Cannot modify leave to start in the past",
          suggestion: "Please select a future date"
        });
      }

      // Step 6: Check for overlapping leaves (exclude current leave from check)
      if (updatedData.start_date || updatedData.end_date) {
        const overlapResult = await leaveModel.checkOverlappingLeave(
          req.supabase, 
          currentLeave.employee_id, 
          finalStartDate, 
          finalEndDate,
          id // Exclude current leave from overlap check
        );

        if (!overlapResult.success) {
          return res.status(500).json({ 
            error: "Failed to check for overlapping leaves",
            debug: overlapResult.error 
          });
        }

        if (overlapResult.data.length > 0) {
          const conflictingLeave = overlapResult.data[0];
          return res.status(409).json({
            error: "Modified dates conflict with existing leave",
            conflicting_leave: {
              start_date: conflictingLeave.start_date,
              end_date: conflictingLeave.end_date,
              status: conflictingLeave.status
            },
            suggestion: "Please choose different dates"
          });
        }
      }

      // Step 7: Calculate new days if dates changed
      if (updatedData.start_date || updatedData.end_date) {
        const newDays = dateUtils.calculateBusinessDays(finalStartDate, finalEndDate);
        updatedData.days_requested = newDays;

        // Check leave balance for new duration
        const balanceResult = await employeeModel.getLeaveBalance(req.supabase, currentLeave.employee_id);
        if (balanceResult.success) {
          const availableBalance = balanceResult.data.remaining_leave + currentLeave.days_requested; // Add back current request days
          if (newDays > availableBalance) {
            return res.status(400).json({
              error: "Insufficient leave balance for modified dates",
              details: `New request requires ${newDays} days but you only have ${availableBalance} days available`,
              suggestion: "Please reduce the number of days or choose different dates"
            });
          }
        }
      }

      // Step 8: Update the leave request
      updatedData.modified_on = new Date().toISOString();

      const { data, error } = await req.supabase
        .from('leave_requests')
        .update(updatedData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ 
          error: "Failed to update leave request",
          debug: error.message 
        });
      }

      console.log(`✅ Leave request ${id} modified successfully`);

      // Step 9: Get employee info for response
      const employeeResult = await employeeModel.getById(req.supabase, currentLeave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

      res.json({
        message: "Leave request modified successfully! ✏️",
        modified_leave: {
          id: data.id,
          employee_name: employee.name,
          changes: {
            ...(updatedData.start_date && {
              dates: {
                before: `${currentLeave.start_date} to ${currentLeave.end_date}`,
                after: `${finalStartDate} to ${finalEndDate}`
              }
            }),
            ...(updatedData.type && {
              type: {
                before: currentLeave.type,
                after: updatedData.type
              }
            }),
            ...(updatedData.reason && {
              reason: {
                before: currentLeave.reason,
                after: updatedData.reason
              }
            })
          },
          current_details: {
            start_date: finalStartDate,
            end_date: finalEndDate,
            type: updatedData.type || currentLeave.type,
            reason: updatedData.reason || currentLeave.reason,
            status: data.status,
            days_requested: updatedData.days_requested || currentLeave.days_requested
          },
          modified_at: updatedData.modified_on
        },
        note: "The leave request has been updated and is still pending approval."
      });

    } catch (error) {
      console.error('Error in modifyLeaveRequest:', error);
      res.status(500).json({ 
        error: "Something went wrong while modifying the leave request. Please try again later.",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  }
};

export default leaveController;
