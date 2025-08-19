const jwt = require('jsonwebtoken');
const { logger } = require('../utils/errorHandler');

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and extracts user information
 */

/**
 * Generate JWT token for user
 * @param {Object} payload - User data to encode in token
 * @returns {String} JWT token
 */
const generateToken = (payload) => {
  try {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    
    return jwt.sign(payload, secret, { expiresIn });
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw error;
  }
};

/**
 * Verify JWT token middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return res.status(401).json({
        error: 'Access denied. Invalid token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'JWT_CONFIG_ERROR'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, secret);
    
    // Add user info to request object
    req.user = decoded;
    
    logger.info(`JWT authenticated user: ${decoded.employee_id} (${decoded.role})`);
    next();
    
  } catch (error) {
    logger.error('JWT verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({
      error: 'Token verification failed',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

/**
 * Optional authentication middleware
 * Verifies token if present, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No token provided, continue without authentication
    req.user = null;
    return next();
  }
  
  // Use verifyToken but catch errors and continue
  verifyToken(req, res, (error) => {
    if (error) {
      // Token verification failed, continue without authentication
      req.user = null;
    }
    next();
  });
};

/**
 * Create a simple authentication endpoint for testing
 * In production, this would be more sophisticated
 */
const authenticateEmployee = async (req, res) => {
  try {
    const { employee_id, email, role = 'employee' } = req.body;
    
    if (!employee_id || !email) {
      return res.status(400).json({
        error: 'Employee ID and email are required'
      });
    }
    
    // In production, verify credentials against database
    // For now, create token with provided info
    const payload = {
      employee_id: parseInt(employee_id),
      email,
      role,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = generateToken(payload);
    
    res.json({
      message: 'Authentication successful',
      token,
      user: payload,
      expires_in: process.env.JWT_EXPIRES_IN || '24h'
    });
    
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  optionalAuth,
  authenticateEmployee
};
