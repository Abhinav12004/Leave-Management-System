// Leave controller - business logic for leave management
import employeeModel from '../models/employeeModel.js';
import leaveModel from '../models/leaveModel.js';
import dateUtils from '../utils/dateUtils.js';

const leaveController = {
  // Apply for leave
  async applyForLeave(req, res) {
    try {
      const { employee_id, start_date, end_date, type, reason } = req.body;
      
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

      console.log(`📝 Processing leave application for employee ${employee_id} from ${start_date} to ${end_date}`);

      // Verify employee exists
      const employeeResult = await employeeModel.getById(req.supabase, employee_id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found. Please check the employee ID.",
          debug: employeeResult.error 
        });
      }

      const employee = employeeResult.data;
      console.log(`✅ Employee found: ${employee.name} (${employee.email})`);

      // Calculate requested days
      const requestedDays = dateUtils.calculateBusinessDays(start_date, end_date);
      console.log(`📊 Requested days: ${requestedDays} business days`);

      // Get current leave balance
      const balanceResult = await employeeModel.getLeaveBalance(req.supabase, employee_id);
      if (!balanceResult.success) {
        return res.status(500).json({ 
          error: "Failed to fetch leave balance",
          debug: balanceResult.error 
        });
      }

      const currentBalance = balanceResult.data.remaining_leave;
      console.log(`💰 Current leave balance: ${currentBalance} days`);

      // Check if requested days exceed available balance
      if (requestedDays > currentBalance) {
        return res.status(400).json({
          error: "Insufficient leave balance",
          details: `You requested ${requestedDays} days but only have ${currentBalance} days available`,
          current_balance: currentBalance,
          requested_days: requestedDays
        });
      }

      // Check for overlapping leave requests
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
          }
        });
      }

      // Create the leave request
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
        }
      });

    } catch (error) {
      console.error('Error in applyForLeave:', error);
      res.status(500).json({ 
        error: "Something went wrong while processing your leave request"
      });
    }
  },

  // Get leave balance for a specific employee
  async getLeaveBalance(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          error: "Please provide a valid employee ID" 
        });
      }

      console.log(`📊 Calculating leave balance for employee ${id}`);

      // Get employee details
      const employeeResult = await employeeModel.getById(req.supabase, id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found",
          debug: employeeResult.error 
        });
      }

      // Get leave balance
      const balanceResult = await employeeModel.getLeaveBalance(req.supabase, id);
      if (!balanceResult.success) {
        return res.status(500).json({ 
          error: "Failed to calculate leave balance",
          debug: balanceResult.error 
        });
      }

      console.log(`✅ Leave balance calculated for ${employeeResult.data.name}`);

      res.json({
        message: "Leave balance calculated successfully! 📊",
        leave_balance: balanceResult.data
      });

    } catch (error) {
      console.error('Error in getLeaveBalance:', error);
      res.status(500).json({ 
        error: "Something went wrong while calculating leave balance"
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

      const employeeResult = await employeeModel.getById(req.supabase, employee_id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found"
        });
      }

      const employee = employeeResult.data;
      const result = await leaveModel.getEmployeeLeaves(req.supabase, employee_id);
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to fetch leave requests"
        });
      }

      console.log(`✅ Found ${result.data.length} leave requests for ${employee.name}`);

      res.json({
        message: "Leave requests retrieved successfully! 📋",
        employee_name: employee.name,
        employee_email: employee.email,
        total_requests: result.data.length,
        leave_requests: result.data
      });

    } catch (error) {
      console.error('Error in getEmployeeLeaves:', error);
      res.status(500).json({ 
        error: "Something went wrong while fetching leave requests"
      });
    }
  },

  // Get all pending leave requests
  async getPendingLeaveRequests(req, res) {
    try {
      console.log('📋 Fetching all pending leave requests...');

      const result = await leaveModel.getPendingLeaveRequests(req.supabase);
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to fetch pending leave requests"
        });
      }

      console.log(`✅ Found ${result.data.length} pending leave requests`);

      res.json({
        message: "Pending leave requests retrieved successfully! 📋",
        total_pending: result.data.length,
        pending_requests: result.data
      });

    } catch (error) {
      console.error('Error in getPendingLeaveRequests:', error);
      res.status(500).json({ 
        error: "Something went wrong while fetching pending requests"
      });
    }
  },

  // Approve or reject a leave request
  async approveRejectLeave(req, res) {
    try {
      const { id } = req.params;
      const { status, approved_by, comments } = req.body;

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

      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found"
        });
      }

      const leave = leaveResult.data;

      if (leave.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot modify leave request. Current status: ${leave.status}`
        });
      }

      const approverResult = await employeeModel.getById(req.supabase, approved_by);
      if (!approverResult.success) {
        return res.status(404).json({ 
          error: "Approver not found"
        });
      }

      const approver = approverResult.data;
      const updateResult = await leaveModel.updateLeaveStatus(req.supabase, id, status, approved_by, comments);
      if (!updateResult.success) {
        return res.status(500).json({ 
          error: "Failed to update leave status"
        });
      }

      console.log(`✅ Leave request ${id} ${status} successfully by ${approver.name}`);

      const employeeResult = await employeeModel.getById(req.supabase, leave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

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
          status: status,
          approved_by: approver.name,
          ...(newBalance !== null && { new_leave_balance: newBalance })
        }
      });

    } catch (error) {
      console.error('Error in approveRejectLeave:', error);
      res.status(500).json({ 
        error: "Something went wrong while processing the approval/rejection"
      });
    }
  },

  // Cancel a leave request
  async cancelLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { employee_id, reason } = req.body;

      console.log(`🗑️ Processing cancellation for leave request ${id}`);

      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found"
        });
      }

      const leave = leaveResult.data;

      if (employee_id && leave.employee_id !== parseInt(employee_id)) {
        return res.status(403).json({
          error: "You can only cancel your own leave requests"
        });
      }

      if (!['pending', 'approved'].includes(leave.status)) {
        return res.status(400).json({
          error: `Cannot cancel leave request. Current status: ${leave.status}`
        });
      }

      const cancelResult = await leaveModel.updateLeaveStatus(
        req.supabase, 
        id, 
        'rejected',
        leave.employee_id,
        reason ? `Cancelled by employee: ${reason}` : 'Cancelled by employee'
      );

      if (!cancelResult.success) {
        return res.status(500).json({ 
          error: "Failed to cancel leave request"
        });
      }

      console.log(`✅ Leave request ${id} cancelled successfully`);

      const employeeResult = await employeeModel.getById(req.supabase, leave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

      res.json({
        message: "Leave request cancelled successfully! 🗑️",
        cancelled_leave: {
          id: leave.id,
          employee_name: employee.name,
          original_dates: `${leave.start_date} to ${leave.end_date}`,
          status: 'cancelled (marked as rejected)',
          cancellation_reason: reason || 'No reason provided'
        }
      });

    } catch (error) {
      console.error('Error in cancelLeaveRequest:', error);
      res.status(500).json({ 
        error: "Something went wrong while cancelling the leave request"
      });
    }
  },

  // Modify a pending leave request
  async modifyLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { employee_id, start_date, end_date, type, reason } = req.body;

      console.log(`✏️ Processing modification for leave request ${id}`);

      const leaveResult = await leaveModel.getById(req.supabase, id);
      if (!leaveResult.success) {
        return res.status(404).json({ 
          error: "Leave request not found"
        });
      }

      const currentLeave = leaveResult.data;

      if (currentLeave.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot modify leave request. Current status: ${currentLeave.status}`
        });
      }

      if (employee_id && currentLeave.employee_id !== parseInt(employee_id)) {
        return res.status(403).json({
          error: "You can only modify your own leave requests"
        });
      }

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
          error: "No changes detected"
        });
      }

      const finalStartDate = updatedData.start_date || currentLeave.start_date;
      const finalEndDate = updatedData.end_date || currentLeave.end_date;

      if (new Date(finalStartDate) > new Date(finalEndDate)) {
        return res.status(400).json({
          error: "Start date cannot be after end date"
        });
      }

      if (updatedData.start_date || updatedData.end_date) {
        const newDays = dateUtils.calculateBusinessDays(finalStartDate, finalEndDate);
        updatedData.days_requested = newDays;
      }

      updatedData.modified_on = new Date().toISOString();

      const { data, error } = await req.supabase
        .from('leave_requests')
        .update(updatedData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ 
          error: "Failed to update leave request"
        });
      }

      console.log(`✅ Leave request ${id} modified successfully`);

      const employeeResult = await employeeModel.getById(req.supabase, currentLeave.employee_id);
      const employee = employeeResult.success ? employeeResult.data : { name: 'Unknown Employee' };

      res.json({
        message: "Leave request modified successfully! ✏️",
        modified_leave: {
          id: data.id,
          employee_name: employee.name,
          current_details: {
            start_date: finalStartDate,
            end_date: finalEndDate,
            type: updatedData.type || currentLeave.type,
            reason: updatedData.reason || currentLeave.reason,
            status: data.status
          }
        }
      });

    } catch (error) {
      console.error('Error in modifyLeaveRequest:', error);
      res.status(500).json({ 
        error: "Something went wrong while modifying the leave request"
      });
    }
  }
};

export default leaveController;
