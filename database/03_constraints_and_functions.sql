-- Enhanced Database Schema with Race Condition Prevention
-- This script adds database-level constraints and indexes to prevent
-- race conditions and ensure data consistency

-- Add unique constraint to prevent overlapping leave requests
-- This prevents race conditions where two overlapping leaves could be approved simultaneously
CREATE OR REPLACE FUNCTION prevent_overlapping_leaves()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for overlapping approved or pending leaves for the same employee
    IF EXISTS (
        SELECT 1 FROM leave_requests 
        WHERE employee_id = NEW.employee_id 
        AND id != COALESCE(NEW.id, 0)  -- Exclude current record for updates
        AND status IN ('approved', 'pending')
        AND (
            -- Check for date range overlap
            (NEW.start_date <= end_date AND NEW.end_date >= start_date)
        )
    ) THEN
        RAISE EXCEPTION 'Overlapping leave request detected for employee %. Leave dates % to % conflict with existing request.', 
            NEW.employee_id, NEW.start_date, NEW.end_date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce no overlapping leaves
DROP TRIGGER IF EXISTS check_overlapping_leaves ON leave_requests;
CREATE TRIGGER check_overlapping_leaves
    BEFORE INSERT OR UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION prevent_overlapping_leaves();

-- Add constraint to ensure leave balance cannot go negative
ALTER TABLE employees 
DROP CONSTRAINT IF EXISTS employees_leave_balance_positive;

ALTER TABLE employees 
ADD CONSTRAINT employees_leave_balance_positive 
CHECK (leave_balance >= 0);

-- Add constraint to ensure valid date ranges
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_valid_date_range;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_valid_date_range 
CHECK (start_date <= end_date);

-- Add constraint to ensure future dates only (except for admin corrections)
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_future_dates;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_future_dates 
CHECK (start_date >= CURRENT_DATE - INTERVAL '30 days'); -- Allow 30-day correction window

-- Add constraint for valid status values
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_valid_status;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_valid_status 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- Add constraint for valid leave types
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_valid_type;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_valid_type 
CHECK (type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'emergency', 'unpaid'));

-- Create function for atomic leave balance updates
CREATE OR REPLACE FUNCTION update_leave_balance_atomic(
    p_employee_id INTEGER,
    p_days_to_deduct INTEGER,
    p_leave_request_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Lock the employee row for update to prevent race conditions
    SELECT leave_balance INTO current_balance 
    FROM employees 
    WHERE id = p_employee_id 
    FOR UPDATE;
    
    -- Check if employee exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee with ID % not found', p_employee_id;
    END IF;
    
    -- Calculate new balance
    new_balance := current_balance - p_days_to_deduct;
    
    -- Check if balance would go negative
    IF new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient leave balance. Current: %, Requested: %, Would result in: %', 
            current_balance, p_days_to_deduct, new_balance;
    END IF;
    
    -- Update the balance atomically
    UPDATE employees 
    SET leave_balance = new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_employee_id;
    
    -- Log the balance change for audit trail
    INSERT INTO leave_balance_audit (
        employee_id, 
        leave_request_id,
        previous_balance, 
        balance_change, 
        new_balance, 
        change_reason,
        changed_at
    ) VALUES (
        p_employee_id,
        p_leave_request_id,
        current_balance,
        -p_days_to_deduct,
        new_balance,
        'Leave approved',
        CURRENT_TIMESTAMP
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create audit table for leave balance changes
CREATE TABLE IF NOT EXISTS leave_balance_audit (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    leave_request_id INTEGER REFERENCES leave_requests(id),
    previous_balance INTEGER NOT NULL,
    balance_change INTEGER NOT NULL,
    new_balance INTEGER NOT NULL,
    change_reason VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES employees(id)
);

-- Create indexes for performance and constraint enforcement
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates 
ON leave_requests(employee_id, start_date, end_date) 
WHERE status IN ('approved', 'pending');

CREATE INDEX IF NOT EXISTS idx_leave_requests_status_dates 
ON leave_requests(status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leave_balance_audit_employee 
ON leave_balance_audit(employee_id, changed_at);

-- Create function for safe leave approval with balance check
CREATE OR REPLACE FUNCTION approve_leave_request(
    p_leave_request_id INTEGER,
    p_approved_by INTEGER,
    p_comments TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    leave_record RECORD;
    approver_record RECORD;
BEGIN
    -- Start transaction
    BEGIN
        -- Lock and get leave request
        SELECT * INTO leave_record 
        FROM leave_requests 
        WHERE id = p_leave_request_id 
        FOR UPDATE;
        
        -- Check if leave request exists
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Leave request with ID % not found', p_leave_request_id;
        END IF;
        
        -- Check if already processed
        IF leave_record.status != 'pending' THEN
            RAISE EXCEPTION 'Leave request % has already been % and cannot be changed', 
                p_leave_request_id, leave_record.status;
        END IF;
        
        -- Verify approver exists
        SELECT * INTO approver_record 
        FROM employees 
        WHERE id = p_approved_by;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Approver with ID % not found', p_approved_by;
        END IF;
        
        -- Update leave balance atomically
        PERFORM update_leave_balance_atomic(
            leave_record.employee_id, 
            leave_record.days_requested,
            p_leave_request_id
        );
        
        -- Update leave request status
        UPDATE leave_requests 
        SET status = 'approved',
            approved_by = p_approved_by,
            approved_on = CURRENT_TIMESTAMP,
            comments = p_comments,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_leave_request_id;
        
        RETURN TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        -- Re-raise the exception to rollback transaction
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function for safe leave rejection
CREATE OR REPLACE FUNCTION reject_leave_request(
    p_leave_request_id INTEGER,
    p_rejected_by INTEGER,
    p_comments TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    leave_record RECORD;
    approver_record RECORD;
BEGIN
    -- Start transaction
    BEGIN
        -- Lock and get leave request
        SELECT * INTO leave_record 
        FROM leave_requests 
        WHERE id = p_leave_request_id 
        FOR UPDATE;
        
        -- Check if leave request exists
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Leave request with ID % not found', p_leave_request_id;
        END IF;
        
        -- Check if already processed
        IF leave_record.status != 'pending' THEN
            RAISE EXCEPTION 'Leave request % has already been % and cannot be changed', 
                p_leave_request_id, leave_record.status;
        END IF;
        
        -- Verify approver exists
        SELECT * INTO approver_record 
        FROM employees 
        WHERE id = p_rejected_by;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Approver with ID % not found', p_rejected_by;
        END IF;
        
        -- Update leave request status (no balance change for rejection)
        UPDATE leave_requests 
        SET status = 'rejected',
            approved_by = p_rejected_by,
            approved_on = CURRENT_TIMESTAMP,
            comments = p_comments,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_leave_request_id;
        
        RETURN TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        -- Re-raise the exception to rollback transaction
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function to get current timestamp (for connection testing)
CREATE OR REPLACE FUNCTION select_current_timestamp()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Add row-level security policies for enhanced security (optional)
-- Enable RLS on tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balance_audit ENABLE ROW LEVEL SECURITY;

-- Create basic policies (customize based on your authentication system)
-- Policy for employees to see their own data
CREATE POLICY employee_own_data ON employees
    FOR ALL USING (auth.uid()::text = id::text);

-- Policy for employees to see their own leave requests
CREATE POLICY employee_own_leaves ON leave_requests
    FOR ALL USING (auth.uid()::text = employee_id::text);

-- Policy for managers/HR to see all data (customize based on role system)
CREATE POLICY manager_all_access ON employees
    FOR ALL USING (auth.jwt()->>'role' IN ('manager', 'hr', 'admin'));

CREATE POLICY manager_all_leaves ON leave_requests
    FOR ALL USING (auth.jwt()->>'role' IN ('manager', 'hr', 'admin'));

-- Comments for documentation
COMMENT ON FUNCTION prevent_overlapping_leaves() IS 'Prevents overlapping leave requests for the same employee';
COMMENT ON FUNCTION update_leave_balance_atomic() IS 'Atomically updates employee leave balance with race condition protection';
COMMENT ON FUNCTION approve_leave_request() IS 'Safely approves leave request with full transaction safety';
COMMENT ON FUNCTION reject_leave_request() IS 'Safely rejects leave request with audit trail';
COMMENT ON TABLE leave_balance_audit IS 'Audit trail for all leave balance changes';

-- Create view for easy leave balance reporting
CREATE OR REPLACE VIEW employee_leave_summary AS
SELECT 
    e.id as employee_id,
    e.name,
    e.email,
    e.department,
    e.leave_balance as current_balance,
    e.joining_date,
    COALESCE(pending_leaves.days, 0) as pending_leave_days,
    COALESCE(approved_leaves.days, 0) as approved_leave_days_this_year,
    e.leave_balance - COALESCE(pending_leaves.days, 0) as available_balance
FROM employees e
LEFT JOIN (
    SELECT employee_id, SUM(days_requested) as days
    FROM leave_requests 
    WHERE status = 'pending'
    GROUP BY employee_id
) pending_leaves ON e.id = pending_leaves.employee_id
LEFT JOIN (
    SELECT employee_id, SUM(days_requested) as days
    FROM leave_requests 
    WHERE status = 'approved' 
    AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY employee_id
) approved_leaves ON e.id = approved_leaves.employee_id;

COMMENT ON VIEW employee_leave_summary IS 'Comprehensive view of employee leave balances and usage';
