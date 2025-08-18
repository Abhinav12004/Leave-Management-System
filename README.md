# Leave Management System Backend 🏢

A comprehensive leave management system backend built with Node.js, Express.js, and Supabase, designed to handle employee leave applications, approvals, and balance tracking with robust validation and error handling.

## 📋 Project Overview

This Leave Management System provides a complete backend solution for organizations to manage employee leave requests efficiently. The system handles the entire leave lifecycle from application to approval/rejection, with built-in validations to prevent conflicts and ensure data integrity.

### Key Features
- 👥 Employee management with leave balance tracking
- 📝 Leave application with comprehensive validation
- ✅ Approval/rejection workflow for managers
- ❌ Leave cancellation (soft delete approach)
- ✏️ Leave modification for pending requests
- 📊 Leave balance calculation and tracking
- 🔍 Advanced validation for overlapping leaves, business rules
- 🧪 Interactive test interface for easy API testing

### Tech Stack
- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Environment Management**: dotenv
- **Development**: nodemon for auto-restart
- **API Design**: RESTful architecture with JSON responses

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager
- Supabase account and project

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd leave-management-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Example:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Database Setup
Run the SQL script in your Supabase SQL Editor:
```bash
# The database_setup.sql file contains all necessary tables and initial data
```

### 5. Start the Server
```bash
# Development mode (with auto-restart)
npm start

# or direct node execution
node index.js
```

The server will start on `http://localhost:3000` (or your configured PORT).

---

## 📡 API Endpoints Documentation

### Base URL
```
http://localhost:3000
```

### Health Check Endpoints

#### GET `/ping`
Simple health check to verify server is running.
```json
// Response
{
  "message": "pong! (yep, server is alive)"
}
```

#### GET `/ping-db`
Test database connectivity.
```json
// Success Response
{
  "message": "Database connection successful! 🎉",
  "timestamp": "2025-08-18T10:30:00Z",
  "employee_count": 3
}

// Error Response
{
  "error": "Database connection failed",
  "details": "Connection timeout"
}
```

### Employee Endpoints

#### GET `/employees`
Retrieve all employees in the system.
```json
// Response
{
  "message": "Here are all the employees in our system! 👥",
  "employees": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@company.com",
      "department": "Engineering",
      "joining_date": "2024-01-15",
      "leave_balance": 20
    }
  ]
}
```

#### GET `/employees/:id/balance`
Get leave balance for a specific employee.
```json
// Response
{
  "message": "Leave balance calculated successfully! 📊",
  "employee": {
    "id": 1,
    "name": "Alice Johnson",
    "total_leave_days": 20,
    "days_taken": 5,
    "remaining_balance": 15
  }
}
```

### Leave Request Endpoints

#### POST `/api/leaves/apply`
Apply for leave with comprehensive validation.

**Request Body:**
```json
{
  "employee_id": 1,
  "start_date": "2025-08-25",
  "end_date": "2025-08-27",
  "type": "annual",
  "reason": "Family vacation"
}
```

**Success Response:**
```json
{
  "message": "Leave request submitted successfully! 🎉",
  "leave_request": {
    "id": 1,
    "employee_name": "Alice Johnson",
    "start_date": "2025-08-25",
    "end_date": "2025-08-27",
    "days_requested": 3,
    "type": "annual",
    "reason": "Family vacation",
    "status": "pending"
  }
}
```

**Error Responses:**
```json
// Insufficient balance
{
  "error": "Insufficient leave balance",
  "details": "You requested 5 days but only have 3 days available",
  "current_balance": 3,
  "requested_days": 5
}

// Overlapping leave
{
  "error": "Leave request conflicts with existing leave",
  "conflicting_leave": {
    "start_date": "2025-08-26",
    "end_date": "2025-08-28",
    "status": "approved"
  }
}
```

#### GET `/api/leaves/employee/:employee_id`
Get all leave requests for a specific employee.
```json
// Response
{
  "message": "Leave requests retrieved successfully! 📋",
  "employee_name": "Alice Johnson",
  "leave_requests": [
    {
      "id": 1,
      "start_date": "2025-08-25",
      "end_date": "2025-08-27",
      "status": "pending",
      "reason": "Family vacation"
    }
  ]
}
```

#### GET `/api/leaves/pending`
Get all pending leave requests (for managers).
```json
// Response
{
  "message": "Pending leave requests retrieved successfully! 📋",
  "pending_requests": [
    {
      "id": 1,
      "employee_name": "Alice Johnson",
      "start_date": "2025-08-25",
      "end_date": "2025-08-27",
      "days": 3,
      "reason": "Family vacation",
      "applied_on": "2025-08-18T10:30:00Z"
    }
  ]
}
```

#### PUT `/api/leaves/:id/approve`
Approve or reject a leave request.

**Request Body:**
```json
{
  "status": "approved",  // or "rejected"
  "approved_by": 2,      // approver's employee ID
  "comments": "Approved for vacation"  // optional
}
```

**Success Response:**
```json
{
  "message": "Leave request approved successfully! ✅",
  "updated_leave": {
    "id": 1,
    "employee_name": "Alice Johnson",
    "status": "approved",
    "approved_by": "Bob Smith",
    "new_leave_balance": 17
  }
}
```

#### DELETE `/api/leaves/:id`
Cancel a leave request (soft delete).

**Request Body:**
```json
{
  "employee_id": 1,  // optional for validation
  "reason": "Plans changed"  // optional cancellation reason
}
```

**Success Response:**
```json
{
  "message": "Leave request cancelled successfully! 🗑️",
  "cancelled_leave": {
    "id": 1,
    "employee_name": "Alice Johnson",
    "original_dates": "2025-08-25 to 2025-08-27",
    "status": "cancelled (marked as rejected)",
    "cancellation_reason": "Plans changed"
  }
}
```

#### PATCH `/api/leaves/:id`
Modify a pending leave request.

**Request Body:**
```json
{
  "start_date": "2025-08-26",  // optional
  "end_date": "2025-08-28",    // optional
  "reason": "Updated vacation plans",  // optional
  "type": "annual"  // optional
}
```

**Success Response:**
```json
{
  "message": "Leave request updated successfully! ✏️",
  "updated_leave": {
    "id": 1,
    "employee_name": "Alice Johnson",
    "old_dates": "2025-08-25 to 2025-08-27",
    "new_dates": "2025-08-26 to 2025-08-28",
    "updated_reason": "Updated vacation plans"
  }
}
```

---

## 🛡️ Edge Cases and Validation Logic

### Date Validations
- **Past Dates**: Cannot apply for leave in the past
- **Weekend/Holiday Logic**: Business day calculations exclude weekends
- **Date Range**: End date must be >= start date
- **Joining Date**: Cannot apply for leave before employee joining date

### Leave Balance Validations
- **Insufficient Balance**: Prevents over-allocation of leave days
- **Real-time Calculation**: Balance calculated based on approved leaves
- **Negative Balance Prevention**: Strict validation against available days

### Conflict Detection
- **Overlapping Leaves**: Prevents double-booking of leave days
- **Status-based Logic**: Only pending leaves can be modified/cancelled
- **Approval Workflow**: Only pending leaves can be approved/rejected

### Business Rules
- **Soft Delete**: Cancelled leaves marked as 'rejected' for audit trail
- **Manager Validation**: Approver must exist in employee system
- **Modification Restrictions**: Only pending requests can be modified
- **Balance Recovery**: Cancelled approved leaves restore balance

### Error Handling
All errors return structured JSON with:
```json
{
  "error": "Human-readable error message",
  "details": "Additional context or technical details",
  "suggestion": "Helpful tip for resolution",
  "debug_info": "Information for debugging (development only)"
}
```

---

## 🧪 Testing

### Interactive Test Page
Access the built-in test interface at:
```
http://localhost:3000/test-page.html
```

The test page provides:
- ✅ Form-based testing for all endpoints
- 📊 Real-time response display
- 🎨 Formatted JSON output
- 🔍 Error handling demonstration

### Manual API Testing
Using curl or Postman:

```bash
# Test server health
curl http://localhost:3000/ping

# Get all employees
curl http://localhost:3000/employees

# Apply for leave
curl -X POST http://localhost:3000/api/leaves/apply \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "start_date": "2025-08-25",
    "end_date": "2025-08-27",
    "type": "annual",
    "reason": "Family vacation"
  }'

# Cancel a leave request
curl -X DELETE http://localhost:3000/api/leaves/1 \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "reason": "Plans changed"
  }'
```

### Test Scenarios
1. **Happy Path**: Complete leave lifecycle (apply → approve → balance update)
2. **Validation Tests**: Invalid dates, insufficient balance, overlapping leaves
3. **Edge Cases**: Weekend dates, past dates, non-existent employees
4. **Error Handling**: Invalid JSON, missing fields, server errors
5. **Business Logic**: Manager approval workflow, balance calculations

### Automated Testing
```bash
# Run test suite (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

---

## 🚀 Potential Improvements

### Authentication & Authorization
- [ ] JWT-based authentication system
- [ ] Role-based access control (Employee, Manager, HR, Admin)
- [ ] API rate limiting and security headers

### Enhanced Features
- [ ] Email notifications for leave applications/approvals
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Leave type management (sick, annual, personal, etc.)
- [ ] Bulk operations for managers
- [ ] Leave history and analytics dashboard
- [ ] **Holiday Management System**:
  - [ ] `GET /api/leaves/holidays` - Get all public holidays
  - [ ] `POST /api/leaves/holidays` - Add new public holiday
  - [ ] Holiday-aware leave calculations (exclude public holidays from business days)
  - [ ] Regional holiday support
  - [ ] Holiday calendar integration

### Database Optimizations
- [ ] Database indexing for performance
- [ ] Query optimization for large datasets
- [ ] Audit logging for all operations
- [ ] Soft delete for employees

### API Enhancements
- [ ] GraphQL endpoint option
- [ ] API versioning (/api/v1/, /api/v2/)
- [ ] Pagination for large result sets
- [ ] Advanced filtering and sorting
- [ ] Webhook support for integrations

### Monitoring & Observability
- [ ] Application logging with Winston
- [ ] Health check endpoints with detailed metrics
- [ ] Error tracking (Sentry integration)
- [ ] Performance monitoring (APM tools)

### Frontend Development
- [ ] React/Vue.js admin dashboard
- [ ] Employee self-service portal
- [ ] Mobile-responsive design
- [ ] Real-time notifications

---

## 🌐 Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=80
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_key
```

### Platform Options
- **Heroku**: Simple deployment with Procfile
- **Vercel**: Serverless deployment option
- **AWS**: EC2, Lambda, or Elastic Beanstalk
- **Digital Ocean**: App Platform or Droplets
- **Railway**: Modern deployment platform

### Docker Support (Future)
```dockerfile
# Dockerfile example for containerized deployment
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

---

## 📞 Support & Contributing

### Getting Help
- 📧 Email: support@yourcompany.com
- 📚 Documentation: [API Docs](http://localhost:3000/)
- 🐛 Issues: Create GitHub issues for bugs
- 💡 Feature Requests: Use GitHub discussions

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation for API changes
- Use meaningful commit messages

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎉 Acknowledgments

- Built with ❤️ using Node.js and Express.js
- Database powered by Supabase
- Testing interface for developer-friendly API exploration
- Comprehensive validation for enterprise-ready deployment

---

**Happy Leave Management! 🏖️**

*For questions or support, please refer to the documentation or contact the development team.*
