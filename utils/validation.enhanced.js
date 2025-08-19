/**
 * Enhanced Input Validation and Date Utilities
 * 
 * This module provides comprehensive input validation including:
 * - Date validation with timezone support
 * - Input sanitization and XSS prevention
 * - Business day calculations
 * - Date range validation
 * - Holiday detection and exclusion
 */

import { sanitizeInput } from './errorHandler.js';

// Timezone configuration
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';
const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

// Holiday configuration (can be externalized to database)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: 'New Year\'s Day' },
  { month: 7, day: 4, name: 'Independence Day' },
  { month: 12, day: 25, name: 'Christmas Day' }
];

/**
 * Enhanced date validation with timezone support
 */
function isValidDate(dateString, timezone = DEFAULT_TIMEZONE) {
  if (!dateString) return false;
  
  // Check format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  try {
    const date = new Date(dateString + 'T00:00:00.000Z');
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // Check if the parsed date matches the input (handles invalid dates like 2024-02-30)
    const [year, month, day] = dateString.split('-').map(Number);
    return date.getUTCFullYear() === year && 
           date.getUTCMonth() === month - 1 && 
           date.getUTCDate() === day;
  } catch (error) {
    return false;
  }
}

/**
 * Enhanced business days calculation with holiday exclusion
 */
function calculateBusinessDays(startDate, endDate, excludeHolidays = true) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
  }
  
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');
  
  if (start > end) {
    throw new Error('Start date cannot be after end date');
  }
  
  let businessDays = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    
    // Check if it's a business day (Monday to Friday)
    if (BUSINESS_DAYS.includes(dayOfWeek)) {
      // Check if it's not a holiday
      if (!excludeHolidays || !isHoliday(current)) {
        businessDays++;
      }
    }
    
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return businessDays;
}

/**
 * Check if a date is a holiday
 */
function isHoliday(date) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  
  return FIXED_HOLIDAYS.some(holiday => 
    holiday.month === month && holiday.day === day
  );
}

/**
 * Get list of holidays in a date range
 */
function getHolidaysInRange(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return [];
  }
  
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');
  const holidays = [];
  
  const current = new Date(start);
  while (current <= end) {
    if (isHoliday(current)) {
      const month = current.getUTCMonth() + 1;
      const day = current.getUTCDate();
      const holiday = FIXED_HOLIDAYS.find(h => h.month === month && h.day === day);
      
      holidays.push({
        date: current.toISOString().split('T')[0],
        name: holiday.name
      });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return holidays;
}

/**
 * Validate date range for leave requests
 */
function validateDateRange(startDate, endDate, options = {}) {
  const {
    allowPastDates = false,
    maxAdvanceDays = 365,
    minAdvanceNotice = 0,
    maxLeaveDuration = 30
  } = options;
  
  const errors = [];
  
  // Basic date validation
  if (!isValidDate(startDate)) {
    errors.push('Invalid start date format. Please use YYYY-MM-DD format.');
  }
  
  if (!isValidDate(endDate)) {
    errors.push('Invalid end date format. Please use YYYY-MM-DD format.');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  // Check date order
  if (start > end) {
    errors.push('Start date cannot be after end date.');
  }
  
  // Check past dates
  if (!allowPastDates && start < today) {
    errors.push('Cannot apply for leave in the past. Please select a future date.');
  }
  
  // Check advance notice
  if (minAdvanceNotice > 0) {
    const minDate = new Date(today);
    minDate.setUTCDate(minDate.getUTCDate() + minAdvanceNotice);
    
    if (start < minDate) {
      errors.push(`Leave must be requested at least ${minAdvanceNotice} days in advance.`);
    }
  }
  
  // Check maximum advance booking
  const maxDate = new Date(today);
  maxDate.setUTCDate(maxDate.getUTCDate() + maxAdvanceDays);
  
  if (start > maxDate) {
    errors.push(`Leave cannot be requested more than ${maxAdvanceDays} days in advance.`);
  }
  
  // Check maximum duration
  const durationDays = calculateBusinessDays(startDate, endDate);
  if (durationDays > maxLeaveDuration) {
    errors.push(`Leave duration cannot exceed ${maxLeaveDuration} business days. Requested: ${durationDays} days.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    businessDays: errors.length === 0 ? durationDays : 0,
    holidays: errors.length === 0 ? getHolidaysInRange(startDate, endDate) : []
  };
}

/**
 * Enhanced input validation for leave requests
 */
function validateLeaveRequest(requestData) {
  const sanitizedData = sanitizeInput(requestData);
  const errors = [];
  const warnings = [];
  
  // Required fields validation
  const requiredFields = ['employee_id', 'start_date', 'end_date', 'type'];
  requiredFields.forEach(field => {
    if (!sanitizedData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Employee ID validation
  if (sanitizedData.employee_id) {
    if (!Number.isInteger(Number(sanitizedData.employee_id)) || Number(sanitizedData.employee_id) <= 0) {
      errors.push('Employee ID must be a positive integer');
    }
  }
  
  // Leave type validation
  const validTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'emergency', 'unpaid'];
  if (sanitizedData.type && !validTypes.includes(sanitizedData.type.toLowerCase())) {
    errors.push(`Invalid leave type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // Date validation
  if (sanitizedData.start_date && sanitizedData.end_date) {
    const dateValidation = validateDateRange(sanitizedData.start_date, sanitizedData.end_date, {
      allowPastDates: false,
      maxAdvanceDays: 365,
      minAdvanceNotice: 1,
      maxLeaveDuration: 30
    });
    
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    } else {
      // Add warnings for holidays
      if (dateValidation.holidays.length > 0) {
        warnings.push(`Your leave includes holidays: ${dateValidation.holidays.map(h => h.name).join(', ')}`);
      }
    }
  }
  
  // Reason validation
  if (sanitizedData.reason) {
    if (sanitizedData.reason.length > 500) {
      errors.push('Leave reason cannot exceed 500 characters');
    }
    
    // Check for suspicious content
    const suspiciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
    if (suspiciousPatterns.some(pattern => pattern.test(sanitizedData.reason))) {
      errors.push('Leave reason contains invalid content');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData,
    businessDays: errors.length === 0 && sanitizedData.start_date && sanitizedData.end_date 
      ? calculateBusinessDays(sanitizedData.start_date, sanitizedData.end_date) 
      : 0
  };
}

/**
 * Enhanced input validation for employee data
 */
function validateEmployeeData(employeeData) {
  const sanitizedData = sanitizeInput(employeeData);
  const errors = [];
  const warnings = [];
  
  // Required fields validation
  const requiredFields = ['name', 'email', 'department', 'joining_date'];
  requiredFields.forEach(field => {
    if (!sanitizedData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Name validation
  if (sanitizedData.name) {
    if (sanitizedData.name.length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    if (sanitizedData.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }
    if (!/^[a-zA-Z\s'-]+$/.test(sanitizedData.name)) {
      errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');
    }
  }
  
  // Email validation
  if (sanitizedData.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedData.email)) {
      errors.push('Please provide a valid email address');
    }
    if (sanitizedData.email.length > 255) {
      errors.push('Email address cannot exceed 255 characters');
    }
  }
  
  // Department validation
  if (sanitizedData.department) {
    const validDepartments = [
      'Engineering', 'Human Resources', 'Finance', 'Marketing', 
      'Sales', 'Operations', 'Legal', 'Management', 'IT', 'HR'
    ];
    if (!validDepartments.some(dept => 
      dept.toLowerCase() === sanitizedData.department.toLowerCase()
    )) {
      warnings.push(`Department '${sanitizedData.department}' is not in the standard list`);
    }
  }
  
  // Joining date validation
  if (sanitizedData.joining_date) {
    if (!isValidDate(sanitizedData.joining_date)) {
      errors.push('Invalid joining date format. Please use YYYY-MM-DD format');
    } else {
      const joiningDate = new Date(sanitizedData.joining_date + 'T00:00:00.000Z');
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      
      if (joiningDate > oneYearFromNow) {
        errors.push('Joining date cannot be more than 1 year in the future');
      }
      if (joiningDate < oneYearAgo) {
        warnings.push('Joining date is more than 1 year ago');
      }
    }
  }
  
  // Leave balance validation
  if (sanitizedData.leave_balance !== undefined) {
    const balance = Number(sanitizedData.leave_balance);
    if (!Number.isInteger(balance) || balance < 0 || balance > 50) {
      errors.push('Leave balance must be an integer between 0 and 50');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData
  };
}

/**
 * Format date for display in user's timezone
 */
function formatDateForTimezone(dateString, timezone = DEFAULT_TIMEZONE) {
  if (!isValidDate(dateString)) {
    return null;
  }
  
  try {
    const date = new Date(dateString + 'T00:00:00.000Z');
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (error) {
    return dateString; // Fallback to original format
  }
}

/**
 * Get business day information for a date range
 */
function getBusinessDayInfo(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return null;
  }
  
  const businessDays = calculateBusinessDays(startDate, endDate, false);
  const businessDaysExcludingHolidays = calculateBusinessDays(startDate, endDate, true);
  const holidays = getHolidaysInRange(startDate, endDate);
  
  return {
    total_business_days: businessDays,
    business_days_excluding_holidays: businessDaysExcludingHolidays,
    holidays_in_range: holidays,
    weekend_days: getTotalDays(startDate, endDate) - businessDays,
    holiday_count: holidays.length
  };
}

/**
 * Get total calendar days between dates
 */
function getTotalDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

export {
  isValidDate,
  calculateBusinessDays,
  validateDateRange,
  validateLeaveRequest,
  validateEmployeeData,
  formatDateForTimezone,
  getBusinessDayInfo,
  getTotalDays,
  isHoliday,
  getHolidaysInRange,
  FIXED_HOLIDAYS,
  DEFAULT_TIMEZONE
};
