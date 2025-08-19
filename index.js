// Main server file for Leave Management System
// Author: Abhinav - Assignment Project
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
dotenv.config();

// Error handlers (learned this from stackoverflow)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately in development
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately in development
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup Supabase connection
let supabase;
try {
  console.log('Connecting to Supabase database...');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('Database client initialized');
} catch (error) {
  console.error('Failed to create Supabase client:', error.message);
  console.log('Warning: Server will start but database features may not work properly');
}

// Middleware setup
app.use(cors()); // Allow all origins for development
app.use(express.json());

// Add supabase to request object
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Import route files
const employeeRoutes = require('./routes/employees.js');
const leaveRoutes = require('./routes/leaves.js');
const authRoutes = require('./routes/auth.js');

console.log('Loading employee routes...');
console.log('Loading leave routes...');
console.log('Routes loaded');

// Serve static files
console.log('Setting up static file serving...');
app.use(express.static('.'));

// Test page routes
app.get('/test', (req, res) => {
  res.sendFile('test-page.html', { root: '.' });
});

app.get('/test-page.html', (req, res) => {
  res.sendFile('test-page.html', { root: '.' });
});

// Main API info endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: "Leave Management API is running",
    status: "healthy",
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /employees - List all employees',
      'POST /employees - Create new employee', 
      'GET /employees/:id - Get employee by ID',
      'GET /employees/:id/leave-balance - Get employee leave balance',
      'POST /api/leaves/apply - Apply for leave',
      'GET /api/leaves/employee/:employee_id - Get employee leave requests',
      'GET /api/leaves/pending - Get all pending leave requests',
      'PUT /api/leaves/:id/approve - Approve or reject leave request',
      'DELETE /api/leaves/:id - Cancel a leave request',
      'PATCH /api/leaves/:id - Modify a pending leave request',
      'POST /auth/login - Authenticate and get JWT token',
      'GET /auth/verify - Verify JWT token validity',
      'GET /ping - Health check',
      'GET /ping-db - Database connection test',
      'GET /test - Interactive API test page'
    ]
  });
});

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ message: "pong - server is alive" });
});

// Setup API routes
app.use('/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/auth', authRoutes);

// Test database connection with Supabase
app.get('/ping-db', async (req, res) => {
  try {
    // Check if Supabase client is available
    if (!supabase) {
      return res.status(500).json({ 
        error: "Supabase client not initialized",
        details: "Check your SUPABASE_URL and SUPABASE_KEY in .env file"
      });
    }

    // Let's try a simple query to check if we can talk to the database
    const { data, error } = await supabase
      .from('employees')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database ping failed:', error.message);
      return res.status(500).json({ 
        error: "Oops! Database connection failed.",
        details: error.message,
        hint: "Make sure you've created the 'employees' table in Supabase"
      });
    }
    
    res.json({
      message: "Database connection successful",
      status: "connected",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Unexpected error during DB ping:', error);
    res.status(500).json({ 
      error: "Something went wrong with the database test",
      details: error.message 
    });
  }
});

// Catch all unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/ping`);
  console.log(`🌐 Test Page: http://localhost:${PORT}/test-page.html`);
  console.log(`🗄️ Database Test: http://localhost:${PORT}/ping-db`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🔧 Process ID: ${process.pid}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Try a different port.`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});