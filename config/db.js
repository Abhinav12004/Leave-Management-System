// DB connect script for Supabase Postgres (using pg)
// Not using an ORM, just good ol' SQL. KISS principle!
require('dotenv').config();
const { Pool } = require('pg');

// Pool is better for real apps than Client (handles more connections)
// Supabase connection string goes here - make sure to keep it secret in .env!
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Get this from Supabase dashboard
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Let's confirm the DB is talking back!
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Oops! Database connection failed:', err.message);
  } else {
    console.log('✅ DB connected! Current time is:', res.rows[0].now);
  }
});

// Handle pool errors gracefully (connection drops, etc.)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  // TODO: handle disconnects gracefully - maybe retry logic?
});

module.exports = pool;
