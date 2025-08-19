// Authentication routes - Login and token management
const express = require('express');
const jwtAuth = require('../middleware/jwtAuth');
const employeeModel = require('../models/employeeModel');

const router = express.Router();

// Login endpoint - Generate JWT token
router.post('/login', async (req, res) => {
  try {
    const { email, employee_id } = req.body;

    if (!email && !employee_id) {
      return res.status(400).json({
        error: 'Email or employee ID required',
        message: 'Please provide either email or employee_id to login'
      });
    }

    // For this demo, we'll use a simple authentication
    // In production, you'd verify password hash
    let employee;
    
    if (employee_id) {
      const result = await employeeModel.getEmployeeById(req, employee_id);
      if (result.success) {
        employee = result.data;
      }
    } else {
      // Find employee by email (simplified for demo)
      const allEmployees = await employeeModel.getAllEmployees(req);
      if (allEmployees.success) {
        employee = allEmployees.data.find(emp => emp.email === email);
      }
    }

    if (!employee) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Employee not found'
      });
    }

    // Generate JWT token
    const token = jwtAuth.generateToken({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role || 'employee',
      department: employee.department
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role || 'employee',
        department: employee.department
      },
      expires_in: '24h'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error during authentication'
    });
  }
});

// Token verification endpoint
router.get('/verify', jwtAuth.verifyToken, (req, res) => {
  res.json({
    message: 'Token is valid',
    user: req.user,
    authenticated: true
  });
});

// Refresh token endpoint
router.post('/refresh', jwtAuth.verifyToken, (req, res) => {
  try {
    // Generate new token with same payload
    const newToken = jwtAuth.generateToken({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department
    });

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      expires_in: '24h'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Unable to generate new token'
    });
  }
});

// Logout endpoint (for completeness - client should discard token)
router.post('/logout', jwtAuth.verifyToken, (req, res) => {
  res.json({
    message: 'Logout successful',
    note: 'Please discard the token on client side'
  });
});

module.exports = router;
