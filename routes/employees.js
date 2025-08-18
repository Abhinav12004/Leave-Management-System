// Employee routes - API endpoints for employee management
import express from 'express';
import employeeController from '../controllers/employeeController.js';
import leaveController from '../controllers/leaveController.js';

const router = express.Router();

// Middleware to pass supabase client to controllers
router.use((req, res, next) => {
  // We'll pass supabase from the main app
  next();
});

// POST /employees - Create new employee
router.post('/', employeeController.createEmployee);

// GET /employees - Get all employees
router.get('/', employeeController.getAllEmployees);

// GET /employees/:id - Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// GET /employees/:id/leave-balance - Get employee's leave balance summary
// Example: GET /employees/1/leave-balance
// Returns: total leave allocation, leaves taken, remaining balance
router.get('/:id/leave-balance', employeeController.getLeaveBalance);

export default router;
