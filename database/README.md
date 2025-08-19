# Database Setup Guide

## Overview
This folder contains SQL scripts to set up the Leave Management System database.

## Files Description

### 1. `01_create_tables.sql`
- Creates the main tables: `employees` and `leave_requests`
- Defines relationships between tables
- Adds data validation constraints

### 2. `02_insert_sample_data.sql`
- Adds sample employees for testing
- Includes sample leave requests with different statuses
- Helps demonstrate system functionality

### 3. `03_create_indexes.sql`
- Creates database indexes for better performance
- Optimizes common query patterns

### 4. `setup_database.sql`
- Master script that runs all setup files in order
- Use this for complete database setup

## How to Setup Database

### Option 1: Complete Setup (Recommended)
```sql
\i setup_database.sql
```

### Option 2: Step by Step
```sql
\i 01_create_tables.sql
\i 02_insert_sample_data.sql
\i 03_create_indexes.sql
```

### Option 3: Production Setup (No Sample Data)
```sql
\i 01_create_tables.sql
\i 03_create_indexes.sql
```

## Database Schema

### Tables
- **employees**: Store employee information and leave balances
- **leave_requests**: Store all leave applications and their status

### Key Features
- Foreign key relationships ensure data integrity
- Constraints prevent invalid data entry
- Indexes optimize query performance
- Sample data included for immediate testing

## Notes
- Default leave balance: 20 days per employee
- Leave types: annual, sick, personal, emergency
- Leave status: pending, approved, rejected
