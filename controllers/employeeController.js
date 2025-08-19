// Employee controller - handles employee related operations
const employeeModel = require('../models/employeeModel.js');
const { asyncHandler, sanitizeDatabaseError, sanitizeInput, IS_PRODUCTION } = require('../utils/errorHandler.js');

const employeeController = {
  // Create a new employee
  createEmployee: asyncHandler(async (req, res) => {
    // Sanitize input
    const sanitizedBody = sanitizeInput(req.body);
    const { name, email, department, joining_date } = sanitizedBody;
    
    // Basic validation (should probably be more thorough)
    if (!name || !email || !department || !joining_date) {
      return res.status(400).json({ 
        error: "Missing required fields: name, email, department, joining_date" 
      });
    }

    // Simple email validation - not perfect but works for now
    if (!email.includes('@')) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    const employeeData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      department: department.trim(),
      joining_date,
      leave_balance: 20 // Standard leave allocation
    };

    const result = await employeeModel.create(req.supabase, employeeData);
    const sanitizedResult = sanitizeDatabaseError(result);
    
    if (sanitizedResult.success) {
      res.status(201).json({
        message: "Employee created successfully",
        employee: sanitizedResult.data
      });
    } else {
      // Handle duplicate email error 
      if (sanitizedResult.error.includes('duplicate') || sanitizedResult.error.includes('unique') || sanitizedResult.error.includes('already exists')) {
        return res.status(409).json({ error: "Email already exists. Please use a different email." });
      }
      
      const statusCode = IS_PRODUCTION ? 500 : 500;
      res.status(statusCode).json({ 
        error: sanitizedResult.error,
        ...(IS_PRODUCTION ? {} : { debug: result.error })
      });
    }
  }),

  // Get all employees
  // Get all employees
  getAllEmployees: asyncHandler(async (req, res) => {
    const result = await employeeModel.getAll(req.supabase);
    const sanitizedResult = sanitizeDatabaseError(result);
    
    if (sanitizedResult.success) {
      res.json({
        message: "Employees retrieved successfully",
        employees: sanitizedResult.data,
        count: sanitizedResult.data.length
      });
    } else {
      res.status(500).json({ 
        error: sanitizedResult.error,
        ...(IS_PRODUCTION ? {} : { debug: result.error })
      });
    }
  }),

  // Get employee by ID
  getEmployeeById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Please provide a valid employee ID" });
    }

    const result = await employeeModel.getById(req.supabase, id);
    const sanitizedResult = sanitizeDatabaseError(result);
    
    if (sanitizedResult.success) {
      res.json({
        message: "Employee found",
        employee: sanitizedResult.data
      });
    } else {
      if (sanitizedResult.error.includes('No rows returned') || sanitizedResult.error.includes('not found')) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.status(500).json({ 
        error: sanitizedResult.error,
        ...(IS_PRODUCTION ? {} : { debug: result.error })
      });
    }
  }),

  // Get employee's leave balance
  getLeaveBalance: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Please provide a valid employee ID" });
    }

    console.log(`Calculating leave balance for employee ${id}`);

    // First, verify employee exists
    const employeeResult = await employeeModel.getById(req.supabase, id);
    const sanitizedEmployeeResult = sanitizeDatabaseError(employeeResult);
    
    if (!sanitizedEmployeeResult.success) {
      return res.status(404).json({ 
        error: "Employee not found",
        ...(IS_PRODUCTION ? {} : { debug: employeeResult.error })
      });
    }

    const employee = sanitizedEmployeeResult.data;

    // Get detailed leave balance
    const balanceResult = await employeeModel.getLeaveBalance(req.supabase, id);
    const sanitizedBalanceResult = sanitizeDatabaseError(balanceResult);
    
    if (!sanitizedBalanceResult.success) {
      return res.status(500).json({ 
        error: "Failed to calculate leave balance",
        ...(IS_PRODUCTION ? {} : { debug: balanceResult.error })
      });
    }

    const balance = sanitizedBalanceResult.data;

    console.log(`Leave balance calculated for ${employee.name}: ${balance.remaining_leave} days remaining`);

    res.json({
      message: "Leave balance calculated successfully",
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
  })
};

module.exports = employeeController;
