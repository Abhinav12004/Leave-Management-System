-- Database setup script - runs all setup files in correct order
-- Run this file to set up the complete database

-- Step 1: Create tables
\i 01_create_tables.sql

-- Step 2: Insert sample data
\i 02_insert_sample_data.sql

-- Step 3: Create performance indexes
\i 03_create_indexes.sql

-- Display success message
SELECT 'Database setup completed successfully!' as status;
