-- Create indexes for better query performance
-- These indexes will speed up common database operations

-- Index on employee email for faster lookups during login/authentication
CREATE INDEX idx_employees_email ON employees(email);

-- Index on employee department for department-wise queries
CREATE INDEX idx_employees_department ON employees(department);

-- Index on leave requests by employee for faster employee-specific queries
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);

-- Index on leave status for filtering pending/approved/rejected requests
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- Composite index on date range for efficient date-based searches
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
