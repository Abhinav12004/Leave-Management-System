// Leave model - handles all leave-related database operations
const leaveModel = {
  // Apply for leave - creates a new leave request
  async applyForLeave(supabase, leaveData) {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([leaveData])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Check for overlapping leave requests for an employee
  async checkOverlappingLeave(supabase, employee_id, start_date, end_date, excludeId = null) {
    try {
      let query = supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee_id)
        .in('status', ['pending', 'approved']) // Only check active requests
        .or(`start_date.lte.${end_date},end_date.gte.${start_date}`); // Overlap logic
      
      // If we're updating an existing request, exclude it from overlap check
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all leave requests for an employee
  async getEmployeeLeaves(supabase, employee_id) {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee_id)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get leave request by ID
  async getById(supabase, id) {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey (
            id,
            name,
            email,
            department,
            leave_balance
          ),
          approver:employees!leave_requests_approved_by_fkey (
            id,
            name,
            email
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Approve or reject a leave request (the main approval endpoint logic)
  async updateLeaveStatus(supabase, leaveId, status, approvedBy) {
    try {
      // We gotta make sure we're only setting valid statuses!
      if (!['approved', 'rejected'].includes(status)) {
        return { success: false, error: 'Invalid status. Must be approved or rejected.' };
      }

      const updateData = {
        status: status,
        approved_by: approvedBy,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', leaveId)
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey (
            id,
            name,
            email,
            department,
            leave_balance
          ),
          approver:employees!leave_requests_approved_by_fkey (
            id,
            name,
            email
          )
        `)
        .single();

      if (error) {
        console.error('Database error updating leave status:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in updateLeaveStatus:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all pending leave requests (for managers to see what needs approval)
  async getPendingLeaveRequests(supabase) {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey (
            id,
            name,
            email,
            department,
            leave_balance
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }); // Oldest first

      if (error) {
        console.error('Database error fetching pending leaves:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in getPendingLeaveRequests:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = leaveModel;
