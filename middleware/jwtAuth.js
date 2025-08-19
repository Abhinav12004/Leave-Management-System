// JWT Authentication Middleware
const jwt = require('jsonwebtoken');

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const jwtAuth = {
  // Generate JWT token
  generateToken(payload) {
    try {
      return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'leave-management-system',
        audience: 'leave-management-users'
      });
    } catch (error) {
      console.error('Error generating JWT token:', error);
      throw new Error('Token generation failed');
    }
  },

  // Verify JWT token middleware
  verifyToken(req, res, next) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ 
          error: 'Access denied. No token provided.',
          message: 'Please include Authorization header with Bearer token'
        });
      }

      // Extract token from "Bearer TOKEN_HERE" format
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        return res.status(401).json({ 
          error: 'Access denied. Invalid token format.',
          message: 'Token must be in format: Authorization: Bearer <token>'
        });
      }

      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'leave-management-system',
        audience: 'leave-management-users'
      });

      // Add user info to request object
      req.user = decoded;
      req.userId = decoded.id;
      req.userRole = decoded.role;

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired.',
          message: 'Please login again to get a new token'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token.',
          message: 'Token is malformed or tampered with'
        });
      }

      console.error('JWT verification error:', error);
      return res.status(401).json({ 
        error: 'Token verification failed.',
        message: 'Please provide a valid token'
      });
    }
  },

  // Optional: Middleware to verify token but don't fail if missing (for optional auth)
  optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    try {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
      
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      req.userId = decoded.id;
      req.userRole = decoded.role;
    } catch (error) {
      req.user = null;
    }
    
    next();
  }
};

module.exports = jwtAuth;
