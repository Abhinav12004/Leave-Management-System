// Employee model - handles all employee-related database operations
const employeeModel = {
  // Create a new employee
  async create(supabase, employeeData) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([employeeData])
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all employees
  async getAll(supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get employee by ID
  async getById(supabase, id) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update employee
  async update(supabase, id, updateData) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update employee's leave balance (used when approving leave requests)
  async updateLeaveBalance(supabase, employeeId, newBalance) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({ 
          leave_balance: newBalance
        })
        .eq('id', employeeId)
        .select();
      
      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default employeeModel;
