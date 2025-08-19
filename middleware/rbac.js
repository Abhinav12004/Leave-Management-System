const { Pool } = require('pg');
const db = require('../config/db');
const { logger } = require('../utils/errorHandler');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides comprehensive permission management for the Leave Management System
 */

// Define roles and their permissions
const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR: 'hr',
  ADMIN: 'admin'
};

const PERMISSIONS = {
  // Leave permissions
  CREATE_LEAVE: 'create_leave',
  VIEW_OWN_LEAVE: 'view_own_leave',
  VIEW_ALL_LEAVES: 'view_all_leaves',
  APPROVE_LEAVE: 'approve_leave',
  REJECT_LEAVE: 'reject_leave',
  CANCEL_LEAVE: 'cancel_leave',
  
  // Employee permissions
  VIEW_OWN_PROFILE: 'view_own_profile',
  VIEW_ALL_EMPLOYEES: 'view_all_employees',
  UPDATE_EMPLOYEE: 'update_employee',
  DELETE_EMPLOYEE: 'delete_employee',
  
  // System permissions
  VIEW_REPORTS: 'view_reports',
  MANAGE_HOLIDAYS: 'manage_holidays',
  MANAGE_LEAVE_TYPES: 'manage_leave_types',
  SYSTEM_ADMIN: 'system_admin'
};

// Role-Permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.CREATE_LEAVE,
    PERMISSIONS.VIEW_OWN_LEAVE,
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.CANCEL_LEAVE
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.CREATE_LEAVE,
    PERMISSIONS.VIEW_OWN_LEAVE,
    PERMISSIONS.VIEW_ALL_LEAVES,
    PERMISSIONS.APPROVE_LEAVE,
    PERMISSIONS.REJECT_LEAVE,
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.CANCEL_LEAVE
  ],
  [ROLES.HR]: [
    PERMISSIONS.CREATE_LEAVE,
    PERMISSIONS.VIEW_OWN_LEAVE,
    PERMISSIONS.VIEW_ALL_LEAVES,
    PERMISSIONS.APPROVE_LEAVE,
    PERMISSIONS.REJECT_LEAVE,
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.UPDATE_EMPLOYEE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_HOLIDAYS,
    PERMISSIONS.MANAGE_LEAVE_TYPES,
    PERMISSIONS.CANCEL_LEAVE
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS) // Admin has all permissions
};

/**
 * Get user role from database
 */
async function getUserRole(employeeId) {
  try {
    const result = await db.query(
      'SELECT role FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Employee not found');
    }
    
    return result.rows[0].role || ROLES.EMPLOYEE; // Default to employee if no role set
  } catch (error) {
    logger.error('Error fetching user role:', { employeeId, error: error.message });
    throw error;
  }
}

/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user can access another user's data
 */
async function canAccessUserData(currentUserId, targetUserId, permission) {
  try {
    // User can always access their own data
    if (currentUserId === targetUserId) {
      return true;
    }
    
    const userRole = await getUserRole(currentUserId);
    
    // Check if user has permission to view all employees
    if (hasPermission(userRole, PERMISSIONS.VIEW_ALL_EMPLOYEES)) {
      return true;
    }
    
    // For managers, check if target user reports to them
    if (userRole === ROLES.MANAGER) {
      const result = await db.query(
        'SELECT 1 FROM employees WHERE employee_id = $1 AND manager_id = $2',
        [targetUserId, currentUserId]
      );
      return result.rows.length > 0;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking user data access:', { currentUserId, targetUserId, error: error.message });
    return false;
  }
}

/**
 * Check if user can approve/reject leave for another user
 */
async function canManageLeave(managerId, employeeId) {
  try {
    const managerRole = await getUserRole(managerId);
    
    // HR and Admin can manage all leaves
    if (managerRole === ROLES.HR || managerRole === ROLES.ADMIN) {
      return true;
    }
    
    // Managers can only manage leaves of their direct reports
    if (managerRole === ROLES.MANAGER) {
      const result = await db.query(
        'SELECT 1 FROM employees WHERE employee_id = $1 AND manager_id = $2',
        [employeeId, managerId]
      );
      return result.rows.length > 0;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking leave management permission:', { managerId, employeeId, error: error.message });
    return false;
  }
}

/**
 * Middleware factory for checking permissions
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const employeeId = req.user?.employee_id || req.headers['x-employee-id'];
      
      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const userRole = await getUserRole(employeeId);
      
      if (!hasPermission(userRole, permission)) {
        logger.warn('Access denied - insufficient permissions:', {
          employeeId,
          role: userRole,
          requiredPermission: permission
        });
        
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required_permission: permission
        });
      }
      
      // Add user role to request for further use
      req.userRole = userRole;
      req.userPermissions = ROLE_PERMISSIONS[userRole];
      
      next();
    } catch (error) {
      logger.error('Error in permission check middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
}

/**
 * Middleware for checking data access permissions
 */
function requireDataAccess() {
  return async (req, res, next) => {
    try {
      const currentUserId = req.user?.employee_id || req.headers['x-employee-id'];
      const targetUserId = req.params.employee_id || req.params.id;
      
      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const canAccess = await canAccessUserData(currentUserId, targetUserId, PERMISSIONS.VIEW_ALL_EMPLOYEES);
      
      if (!canAccess) {
        logger.warn('Access denied - cannot access user data:', {
          currentUserId,
          targetUserId
        });
        
        return res.status(403).json({
          success: false,
          message: 'Access denied. Cannot access this user\'s data.'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error in data access middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during data access check'
      });
    }
  };
}

/**
 * Middleware for checking leave management permissions
 */
function requireLeaveManagementAccess() {
  return async (req, res, next) => {
    try {
      const managerId = req.user?.employee_id || req.headers['x-employee-id'];
      const leaveId = req.params.leave_id || req.params.id;
      
      if (!managerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Get the employee_id from the leave record
      const leaveResult = await db.query(
        'SELECT employee_id FROM leaves WHERE leave_id = $1',
        [leaveId]
      );
      
      if (leaveResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Leave request not found'
        });
      }
      
      const employeeId = leaveResult.rows[0].employee_id;
      const canManage = await canManageLeave(managerId, employeeId);
      
      if (!canManage) {
        logger.warn('Access denied - cannot manage leave:', {
          managerId,
          employeeId,
          leaveId
        });
        
        return res.status(403).json({
          success: false,
          message: 'Access denied. Cannot manage this leave request.'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error in leave management access middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during leave management check'
      });
    }
  };
}

/**
 * Helper function to get all permissions for a role
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Helper function to check multiple permissions
 */
function hasAnyPermission(role, permissions) {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some(permission => rolePermissions.includes(permission));
}

/**
 * Audit logging for permission-sensitive operations
 */
async function logPermissionAction(action, employeeId, targetResource, result) {
  try {
    await db.query(
      `INSERT INTO audit_logs (employee_id, action, resource, result, timestamp) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [employeeId, action, targetResource, result]
    );
  } catch (error) {
    logger.error('Error logging permission action:', error);
  }
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getUserRole,
  hasPermission,
  canAccessUserData,
  canManageLeave,
  requirePermission,
  requireDataAccess,
  requireLeaveManagementAccess,
  getRolePermissions,
  hasAnyPermission,
  logPermissionAction
};
