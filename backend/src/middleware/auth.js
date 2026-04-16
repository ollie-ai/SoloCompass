import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import logger from '../services/logger.js';

// Lazy secret accessor - exported for use in other modules
export const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.warn('[Auth] JWT_SECRET not available');
    return null;
  }
  return secret;
};

export const hashToken = (token) => {
  const pepper = process.env.REFRESH_TOKEN_PEPPER || '';
  return crypto.createHmac('sha256', pepper).update(token).digest('hex');
};

// Session validation against database - enabled by default
const isSessionValidationEnabled = () => process.env.SESSION_VALIDATION_ENABLED !== 'false';

const validateSession = async (userId, sessionId) => {
  if (!isSessionValidationEnabled()) {
    return true; // Skip validation if not enabled
  }
  
  try {
    const now = new Date().toISOString();
    const session = await db.prepare(`
      SELECT id FROM sessions 
      WHERE id = ? AND user_id = ? AND expires_at > ?
      LIMIT 1
    `).get(sessionId, userId, now);
    
    return !!session;
  } catch (error) {
    logger.error(`[Auth] Session validation error: ${error.message}`);
    return false; // Fail closed to protect the system on DB errors
  }
};

const normalizeIp = (ip = '') => ip.replace(/^::ffff:/, '');

const enforceAdminSessionSecurity = async (req, res) => {
  const allowlistRaw = process.env.ADMIN_IP_ALLOWLIST || '';
  const allowlist = allowlistRaw
    .split(',')
    .map((entry) => normalizeIp(entry.trim()))
    .filter(Boolean);

  if (allowlist.length > 0) {
    const requestIp = normalizeIp(req.ip || req.headers['x-forwarded-for']?.split(',')?.[0] || '');
    if (!allowlist.includes(requestIp)) {
      return res.status(403).json({
        success: false,
        error: { code: 'ADMIN_IP_RESTRICTED', message: 'Admin access is not allowed from this IP address' }
      });
    }
  }

  const shouldRequire2FA = process.env.ADMIN_REQUIRE_2FA !== 'false';
  if (!shouldRequire2FA) {
    return null;
  }

  try {
    const adminUser = await db.get('SELECT is_2fa_enabled FROM users WHERE id = ?', req.userId);
    if (!adminUser?.is_2fa_enabled) {
      return res.status(428).json({
        success: false,
        error: { code: 'ADMIN_2FA_REQUIRED', message: 'Admin account must enable 2FA before accessing admin routes' }
      });
    }
  } catch (error) {
    logger.error(`[Auth] Failed admin security check: ${error.message}`);
    return res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Unable to verify admin security requirements' }
    });
  }

  return null;
};

export const authenticate = async (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
    });
  }

  try {
    const secret = getJWTSecret();
    if (!secret) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Authentication not configured' }
      });
    }
    const decoded = jwt.verify(token, secret);
    
    // Optional: Validate session against database
    if (isSessionValidationEnabled()) {
      const isValidSession = await validateSession(decoded.userId, decoded.sid);
      if (!isValidSession) {
        return res.status(401).json({
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' }
        });
      }
      
      // Update last activity timestamp
      try {
        await db.run(
          'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ? AND expires_at > ?',
          decoded.sid, new Date().toISOString()
        );
      } catch (err) {
        logger.warn(`[Auth] Failed to update last_activity: ${err.message}`);
      }
    }
    
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'user';
    req.adminLevel = decoded.admin_level || 'support';
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_SECRET')) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Security not initialized' }
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
    });
  }
};

export const requireAuth = authenticate;
export const VALID_USER_ROLES = ['user', 'viewer', 'admin'];

// Admin role levels: 'support', 'moderator', 'super_admin'
// All admin roles have basic admin access

export const requireAdmin = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    return Promise.resolve()
      .then(async () => {
        const securityRejection = await enforceAdminSessionSecurity(req, res);
        if (securityRejection) return null;
        // Grant basic admin access - specific permissions checked separately
        req.adminLevel = req.user?.admin_level || 'support';
        return next();
      })
      .catch((error) => {
        logger.error(`[Auth] requireAdmin error: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed admin authorization' }
        });
      });
  });
};

// Super admin only - can access sensitive operations
export const requireSuperAdmin = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    const adminLevel = req.user?.admin_level || 'support';
    if (adminLevel !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Super admin access required' }
      });
    }
    next();
  });
};

// Moderator - can approve/reject content, manage destinations
export const requireModerator = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    const adminLevel = req.user?.admin_level || 'support';
    if (!['moderator', 'super_admin'].includes(adminLevel)) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Moderator access required' }
      });
    }
    next();
  });
};

export const requireViewerOrAbove = async (req, res, next) => {
  await authenticate(req, res, () => {
    if (!VALID_USER_ROLES.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Viewer access required' }
      });
    }
    next();
  });
};

// Permission definitions for RBAC
export const PERMISSIONS = {
  // Support level (basic)
  support: [
    'view_users',
    'view_sessions',
    'view_analytics',
    'view_audit_logs',
    'view_system_health'
  ],
  // Moderator level (content management)
  moderator: [
    'view_users',
    'view_sessions',
    'view_analytics', 
    'view_audit_logs',
    'view_system_health',
    'approve_content',
    'reject_content',
    'manage_destinations',
    'view_errors'
  ],
  // Super admin (full access)
  super_admin: [
    'view_users',
    'view_sessions',
    'view_analytics',
    'view_audit_logs',
    'view_system_health',
    'approve_content',
    'reject_content',
    'manage_destinations',
    'view_errors',
    'delete_users',
    'manage_billing',
    'system_config',
    'view_sensitive_data',
    'manage_admin_roles'
  ]
};

// Check if admin has specific permission
export const hasPermission = (adminLevel, permission) => {
  const level = adminLevel || 'support';
  return PERMISSIONS[level]?.includes(permission) || false;
};

export const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next();
  }
  
  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret);
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'user';
  } catch {
    // Token invalid or secret unavailable, continue without auth
  }
  next();
};

export const generateToken = (user, sessionId = null) => {
  const secret = getJWTSecret();
  if (!secret) throw new Error('JWT_SECRET not initialized');
  
  const payload = { userId: user.id, email: user.email, role: user.role, admin_level: user.admin_level || 'support' };
  if (sessionId) payload.sid = sessionId;

  return jwt.sign(
    payload,
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const generateRefreshToken = (user) => {
  const secret = getJWTSecret();
  if (!secret) throw new Error('JWT_SECRET not initialized');

  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    secret,
    { expiresIn: '30d' }
  );
};

export const verifyRefreshToken = (token) => {
  const secret = getJWTSecret();
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};
