-- Create core tables for Leave Management System
-- Author: Abhinav (Assignment Project)
-- Date: August 2025

-- Employees table to store employee information
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    joining_date DATE DEFAULT CURRENT_DATE,
    leave_balance INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave requests table to store all leave applications
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    reason TEXT,
    status VARCHAR(10) DEFAULT 'pending',
    days_requested INTEGER NOT NULL,
    applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES employees(id),
    approved_on TIMESTAMP,
    comments TEXT
);

-- Add constraints for data integrity
ALTER TABLE leave_requests 
ADD CONSTRAINT check_valid_dates CHECK (end_date >= start_date);

ALTER TABLE leave_requests 
ADD CONSTRAINT check_valid_status CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE leave_requests 
ADD CONSTRAINT check_valid_type CHECK (type IN ('annual', 'sick', 'personal', 'emergency'));
