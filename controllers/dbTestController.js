
const pool = require('../config/db');

// Simple DB ping to check if connection is alive
const pingDatabase = async (req, res) => {
  try {
    // Check if the pool is initialized
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    
    if (result.rows.length > 0) {
      res.json({
        message: "Database is alive and kicking",
        timestamp: result.rows[0].current_time,
        version: result.rows[0].db_version,
        status: "connected"
      });
    } else {
     

      res.status(500).json({ error: "Got empty response from DB (weird!)" });
    }
  } catch (error) {
    console.error('Database ping failed:', error.message);
    res.status(500).json({ 
      error: "Oops! Database connection failed.",
      details: error.message 
    });
  }
};

// Quick test to see if our tables exist
const checkTables = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('employees', 'leave_requests')
      ORDER BY table_name
    `);
    
    const tables = result.rows.map(row => row.table_name);
    
    if (tables.length === 2) {
      res.json({
        message: "All tables found! Database is ready",
        tables: tables
      });
    } else {
      res.status(404).json({
        message: "Some tables are missing. Did you run the SQL setup?",
        found_tables: tables,
        expected: ['employees', 'leave_requests']
      });
    }
  } catch (error) {
    console.error('Table check failed:', error.message);
    res.status(500).json({ 
      error: "Couldn't check tables",
      details: error.message 
    });
  }
};

module.exports = {
  pingDatabase,
  checkTables
};
