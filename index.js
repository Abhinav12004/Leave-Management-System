// Main entry point for the Leave Management System
// Updated with better error handling and explicit localhost binding
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Add global error handlers to catch any unhandled issues
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Initialize Express first (before Supabase to avoid crashes)
const app = express();
const PORT = process.env.PORT || 3000; // Use port 3000 as default

// Initialize Supabase with error handling
let supabase;
try {
  console.log('🔄 Connecting to Supabase...');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('✅ Supabase client created successfully');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error.message);
  console.log('⚠️  Server will start but database features may not work');
}

// Middleware
app.use(cors()); // Allow all origins for now (maybe lock down later)
app.use(express.json()); // Parse JSON bodies

// Middleware to attach Supabase client to requests
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Import routes
import employeeRoutes from './routes/employees.js';
import leaveRoutes from './routes/leaves.js';

console.log('📦 Loading employee routes...');
console.log('📦 Loading leave routes...');
console.log('✅ All routes loaded successfully');

// Serve static files from current directory
console.log('📂 Setting up static file serving...');
app.use(express.static('.'));

// Serve static test page
app.get('/test', (req, res) => {
  res.sendFile('test-page.html', { root: '.' });
});

// Also serve test page directly at /test-page.html
app.get('/test-page.html', (req, res) => {
  res.sendFile('test-page.html', { root: '.' });
});

// Basic health check - let's make sure everything's working
app.get('/', (req, res) => {
  res.json({ 
    message: "Leave Management API is running! 🚀",
    status: "healthy",
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /employees - List all employees',
      'POST /employees - Create new employee', 
      'GET /employees/:id - Get employee by ID',
      'GET /employees/:id/leave-balance - Get employee leave balance summary',
      'POST /api/leaves/apply - Apply for leave',
      'GET /api/leaves/employee/:employee_id - Get employee leave requests',
      'GET /api/leaves/pending - Get all pending leave requests',
      'PUT /api/leaves/:id/approve - Approve or reject leave request',
      'DELETE /api/leaves/:id - Cancel a leave request',
      'PATCH /api/leaves/:id - Modify a pending leave request',
      'GET /ping - Health check',
      'GET /ping-db - Database connection test',
      'GET /test - Interactive API test page'
    ]
  });
});

// Simple ping endpoint
app.get('/ping', (req, res) => {
  res.json({ message: "pong! (yep, server is alive)" });
});

// API Routes
app.use('/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);

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
      message: "Database is connected and ready! 🎉",
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

// Catch-all for unknown routes (just in case)
app.use((req, res) => {
  res.status(404).json({ error: "Oops, nothing here! Check the endpoint." });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Server is up and running on http://localhost:${PORT}`);
  console.log(`💡 Pro tip: Visit /ping-db to test your database connection!`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🔍 Server process ID: ${process.pid}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Port ${PORT} is already in use. Try a different port.`);
  }
});