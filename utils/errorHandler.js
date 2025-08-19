/**
 * Environment-aware error handling utility
 * 
 * This module provides secure error handling that prevents
 * sensitive debug information from leaking in production.
 * 
 * Features:
 * - Environment-based error detail filtering
 * - Structured error logging
 * - Consistent error response formatting
 * - Security-focused error sanitization
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

/**
 * Sanitize error messages for production
 */
function sanitizeError(error) {
  if (IS_PRODUCTION) {
    // In production, return generic messages for common error types
    if (error.message?.includes('password') || error.message?.includes('token')) {
      return 'Authentication failed';
    }
    
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      return 'Database service temporarily unavailable';
    }
    
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('timeout')) {
      return 'Service temporarily unavailable';
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Service temporarily unavailable';
    }
    
    // Generic error for production
    return 'An unexpected error occurred';
  }
  
  // In development/test, return actual error message
  return error.message || 'Unknown error occurred';
}

/**
 * Create standardized error response
 */
function createErrorResponse(error, context = {}) {
  const sanitizedMessage = sanitizeError(error);
  
  const response = {
    error: sanitizedMessage,
    timestamp: new Date().toISOString(),
    ...(context.request_id && { request_id: context.request_id })
  };
  
  // Add debug information only in development
  if (!IS_PRODUCTION && !IS_TEST) {
    response.debug = {
      original_error: error.message,
      stack: error.stack,
      context: context
    };
  }
  
  return response;
}

/**
 * Log error with appropriate level based on environment
 */
function logError(error, context = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    context,
    environment: NODE_ENV
  };
  
  if (IS_PRODUCTION) {
    // In production, use structured logging (could integrate with external services)
    console.error('[ERROR]', JSON.stringify(logData));
  } else {
    // In development, use readable format
    console.error('Error occurred:', error.message);
    if (context.endpoint) {
      console.error('Endpoint:', context.endpoint);
    }
    if (!IS_TEST) {
      console.error('Stack:', error.stack);
    }
  }
}

/**
 * Express error handling middleware
 */
function errorHandler(error, req, res, next) {
  const context = {
    endpoint: `${req.method} ${req.path}`,
    request_id: req.headers['x-request-id'] || generateRequestId(),
    user_agent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  };
  
  // Log the error
  logError(error, context);
  
  // Determine status code
  let statusCode = 500;
  if (error.status) {
    statusCode = error.status;
  } else if (error.message?.includes('not found')) {
    statusCode = 404;
  } else if (error.message?.includes('unauthorized') || error.message?.includes('forbidden')) {
    statusCode = 403;
  } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    statusCode = 400;
  }
  
  // Create safe error response
  const errorResponse = createErrorResponse(error, context);
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate and sanitize database error responses
 */
function sanitizeDatabaseError(dbResponse) {
  if (!dbResponse.success && dbResponse.error) {
    const error = new Error(dbResponse.error);
    
    // Don't expose internal database details in production
    if (IS_PRODUCTION) {
      if (dbResponse.error.includes('duplicate key')) {
        error.message = 'Resource already exists';
      } else if (dbResponse.error.includes('foreign key')) {
        error.message = 'Invalid reference';
      } else if (dbResponse.error.includes('connection')) {
        error.message = 'Service temporarily unavailable';
      } else {
        error.message = 'Database operation failed';
      }
    }
    
    return { success: false, error: error.message };
  }
  
  return dbResponse;
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // Remove sensitive headers that might leak information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

/**
 * Generate unique request ID for tracking
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.requestId = requestId;
  
  const start = Date.now();
  
  if (!IS_TEST) {
    console.log(`[${requestId}] ${req.method} ${req.path} - Started`);
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    
    if (!IS_TEST) {
      console.log(`[${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
    
    if (IS_PRODUCTION && res.statusCode >= 400) {
      // Log errors in production for monitoring
      console.error(`[${logLevel}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
}

/**
 * Input validation and sanitization
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // Remove potential XSS and SQL injection patterns
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/['"`;\\]/g, '')
      .trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeInput(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return input;
}

module.exports = {
  errorHandler,
  asyncHandler,
  sanitizeDatabaseError,
  createErrorResponse,
  logError,
  securityHeaders,
  requestLogger,
  sanitizeInput,
  IS_PRODUCTION,
  IS_TEST
};
