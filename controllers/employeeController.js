// Employee controller - business logic for employee management
import employeeModel from '../models/employeeModel.js';

const employeeController = {
  // Create a new employee
  async createEmployee(req, res) {
    try {
      const { name, email, department, joining_date } = req.body;
      
      // Basic validation (keep it simple for now)
      if (!name || !email || !department || !joining_date) {
        return res.status(400).json({ 
          error: "Missing required fields: name, email, department, joining_date" 
        });
      }

      // Email format check (basic)
      if (!email.includes('@')) {
        return res.status(400).json({ error: "Please provide a valid email address" });
      }

      const employeeData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        department: department.trim(),
        joining_date,
        leave_balance: 20 // Default annual leave balance
      };

      const result = await employeeModel.create(req.supabase, employeeData);
      
      if (result.success) {
        res.status(201).json({
          message: "Employee created successfully! 🎉",
          employee: result.data
        });
      } else {
        // Handle duplicate email error gracefully
        if (result.error.includes('duplicate') || result.error.includes('unique')) {
          return res.status(409).json({ error: "Email already exists. Please use a different email." });
        }
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({ error: "Something went wrong while creating the employee" });
    }
  },

  // Get all employees
  async getAllEmployees(req, res) {
    try {
      const result = await employeeModel.getAll(req.supabase);
      
      if (result.success) {
        res.json({
          message: "Employees retrieved successfully",
          employees: result.data,
          count: result.data.length
        });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  },

  // Get employee by ID
  async getEmployeeById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Please provide a valid employee ID" });
      }

      const result = await employeeModel.getById(req.supabase, id);
      
      if (result.success) {
        res.json({
          message: "Employee found",
          employee: result.data
        });
      } else {
        if (result.error.includes('No rows returned')) {
          return res.status(404).json({ error: "Employee not found" });
        }
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  },

  // Get employee's leave balance
  async getLeaveBalance(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Please provide a valid employee ID" });
      }

      console.log(`📊 Calculating leave balance for employee ${id}`);

      // First, verify employee exists
      const employeeResult = await employeeModel.getById(req.supabase, id);
      if (!employeeResult.success) {
        return res.status(404).json({ 
          error: "Employee not found",
          debug: employeeResult.error 
        });
      }

      const employee = employeeResult.data;

      // Get detailed leave balance
      const balanceResult = await employeeModel.getLeaveBalance(req.supabase, id);
      if (!balanceResult.success) {
        return res.status(500).json({ 
          error: "Failed to calculate leave balance",
          debug: balanceResult.error 
        });
      }

      const balance = balanceResult.data;

      console.log(`✅ Leave balance calculated for ${employee.name}: ${balance.remaining_leave} days remaining`);

      res.json({
        message: "Leave balance calculated successfully! 📊",
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          joining_date: employee.joining_date,
          total_leave_days: balance.total_leave_days,
          days_taken: balance.days_taken,
          remaining_balance: balance.remaining_leave
        },
        breakdown: {
          annual_allocation: balance.total_leave_days,
          approved_leaves: balance.days_taken,
          available_balance: balance.remaining_leave
        }
      });

    } catch (error) {
      console.error('Error calculating leave balance:', error);
      res.status(500).json({ 
        error: "Something went wrong while calculating leave balance",
        debug_hint: "Check server logs for detailed error information"
      });
    }
  }
};

export default employeeController;
