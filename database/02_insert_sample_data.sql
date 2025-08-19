-- Insert sample employees for testing
-- This data helps demonstrate the system functionality

INSERT INTO employees (name, email, department, joining_date, leave_balance) VALUES
('Alice Johnson', 'alice@company.com', 'Engineering', '2024-01-15', 20),
('Bob Smith', 'bob@company.com', 'HR', '2023-03-10', 15),
('Charlie Brown', 'charlie@company.com', 'Engineering', '2024-02-01', 18),
('Diana Prince', 'diana@company.com', 'Marketing', '2023-11-20', 12),
('Emma Watson', 'emma@company.com', 'Finance', '2024-01-05', 19);

-- Insert some sample leave requests to test different scenarios
INSERT INTO leave_requests (employee_id, start_date, end_date, type, reason, status, days_requested, approved_by, approved_on) VALUES
(1, '2024-12-20', '2024-12-24', 'annual', 'Christmas vacation', 'approved', 5, 2, '2024-12-10 10:00:00'),
(3, '2025-01-15', '2025-01-17', 'sick', 'Medical appointment', 'approved', 3, 2, '2025-01-10 14:30:00'),
(1, '2025-02-10', '2025-02-14', 'annual', 'Family trip', 'pending', 5, NULL, NULL),
(4, '2025-01-20', '2025-01-22', 'personal', 'Personal work', 'rejected', 3, 2, '2025-01-15 09:15:00');
