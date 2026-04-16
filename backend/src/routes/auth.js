import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { generateToken, generateRefreshToken, verifyRefreshToken, getJWTSecret, hashToken, authenticate } from '../middleware/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js';
import logger from '../services/logger.js';
import { generateTwoFactorSecret, verifyTwoFactorCode } from '../services/twoFactor.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again after 15 minutes' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again after 1 hour' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lazy JWT secret getter - avoids fatal throw on import
const getSecret = () => {
  const secret = getJWTSecret();
  if (!secret) {
    logger.error('FATAL: getSecret() environment variable is required');
    return null;
  }
  return secret;
};

// Helper to parse user agent into device info
const parseUserAgent = (userAgent) => {
  if (!userAgent) return 'Unknown Device';
  
  let device = 'Unknown Device';
  let os = '';
  let browser = '';
  
  if (userAgent.includes('Windows')) {
    os = 'Windows';
    if (userAgent.includes('Win64')) device = 'Windows PC';
    else device = 'Windows';
  } else if (userAgent.includes('Mac')) {
    os = 'macOS';
    device = 'Mac';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
    device = 'Linux PC';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    const match = userAgent.match(/Android ([0-9.]+)/);
    if (match) os = `Android ${match[1].split('.')[0]}`;
    device = 'Android';
  } else if (userAgent.includes('iPhone')) {
    os = 'iOS';
    const match = userAgent.match(/iPhone OS ([0-9_]+)/);
    if (match) os = `iOS ${match[1].replace(/_/g, '.')}`;
    device = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    os = 'iOS';
    device = 'iPad';
  }
  
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  if (browser && device !== 'Unknown Device') {
    return `${device} (${browser})`;
  }
  return device;
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors.array() }
    });
  }
  next();
};

router.post('/register', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  body('name').optional().isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email already registered' }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();
    
    // Auto-verify in development for smoother walkthroughs
    const isVerified = process.env.NODE_ENV === 'development' ? true : false;
    
    const result = await db.run(
      'INSERT INTO users (email, password, name, role, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)',
      email, hashedPassword, name || null, 'user', isVerified, verificationToken
    );

    const userId = result.lastInsertRowid;
    
    // Fetch user for token generation - explicitly select only needed columns to prevent exposing sensitive data
    const user = await db.get('SELECT id, email, name, role, is_verified, is_premium, subscription_tier, premium_expires_at, created_at, theme_preference, admin_level FROM users WHERE id = ?', userId);
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });
    const sessionId = uuidv4();
    const refreshHash = hashToken(refreshToken);

    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    await db.run(
      'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );
    await db.run(
      'INSERT INTO user_sessions (id, user_id, token_hash, device_name, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent
    );

    const tokenWithSession = generateToken({ id: user.id, email: user.email, role: user.role }, sessionId);

    await db.run(
      'INSERT INTO profiles (user_id) VALUES (?)',
      userId
    );

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', tokenWithSession, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...userWithoutPassword } = user;
    userWithoutPassword.quiz_completed = false;
    
    res.json({
      success: true,
      data: { 
        message: 'Account created and logged in!', 
        user: userWithoutPassword 
      }
    });
  } catch (error) {
    logger.error(`[Auth] Register failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/login', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.get('SELECT id, email, password, name, role, is_verified, is_premium, subscription_tier, premium_expires_at, failed_attempts, locked_until, admin_level, deleted_at, two_factor_enabled, two_factor_secret FROM users WHERE email = ?', email); // FIXED: was SELECT * which exposed sensitive fields
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
      });
    }

    if (user.deleted_at) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_PENDING_DELETION', message: 'Account is pending deletion. Restore your account to continue.' }
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: { code: 'ACCOUNT_LOCKED', message: `Account is locked. Try again in ${remainingMinutes} minutes.` }
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment failed attempts
      const newFailedAttempts = (user.failed_attempts || 0) + 1;
      if (newFailedAttempts >= 5) {
        // Lock account for 15 minutes
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await db.run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
          newFailedAttempts, lockedUntil, user.id);
        return res.status(423).json({
          success: false,
          error: { code: 'ACCOUNT_LOCKED', message: 'Too many failed attempts. Account locked for 15 minutes.' }
        });
      }
      await db.run('UPDATE users SET failed_attempts = ? WHERE id = ?', newFailedAttempts, user.id);
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
      });
    }

    // Reset failed attempts on successful login
    if (user.failed_attempts > 0 || user.locked_until) {
      await db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', user.id);
    }

    if (!user.is_verified && user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before logging in.' }
      });
    }

    if (user.two_factor_enabled) {
      const twoFactorCode = req.body?.twoFactorCode || req.body?.code;
      if (!twoFactorCode || !verifyTwoFactorCode(user.two_factor_secret, String(twoFactorCode))) {
        return res.status(401).json({
          success: false,
          error: { code: 'TWO_FACTOR_REQUIRED', message: 'Two-factor code required or invalid' }
        });
      }
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });
    const sessionId = uuidv4();
    const refreshHash = hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    try {
      await db.run(
        'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent, expiresAt
      );
      await db.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, device_name, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent
      );
    } catch (sessionError) {
      logger.error(`[Auth] Session creation failed: ${sessionError.message}`);
      logger.error(`[Auth] Session error details: ${sessionError.stack}`);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create session: ' + sessionError.message }
      });
    }

    const tokenWithSession = generateToken({ id: user.id, email: user.email, role: user.role }, sessionId);

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', tokenWithSession, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...userWithoutPassword } = user;
    
    userWithoutPassword.admin_level = user.admin_level || 'support';
    
    // Check quiz status for onboarding flow to prevent redirect loops
    let quizCompleted = false;
    try {
      const quiz = await db.get('SELECT id FROM quiz_responses WHERE user_id = ? AND result IS NOT NULL', user.id);
      quizCompleted = !!quiz;
    } catch (quizError) {
      logger.error(`[Auth] Quiz check failed: ${quizError.message}`);
    }
    userWithoutPassword.quiz_completed = quizCompleted;
    
    res.json({ success: true, data: { user: userWithoutPassword } });
  } catch (error) {
    logger.error(`[Auth] Login failed: ${error.message}`);
    logger.error(`[Auth] Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

// Refresh token with rotation - invalidates old token and creates new
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token required' }
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' }
      });
    }

    const refreshHash = hashToken(refreshToken);

    const result = await db.transaction(async (tx) => {
      const session = await tx.get(
        'SELECT id, user_id, device_info, ip_address, expires_at, created_at FROM sessions WHERE user_id = ? AND refresh_token = ? AND expires_at > ?',
        decoded.userId, refreshHash, new Date().toISOString()
      );

      if (!session) {
        throw new Error('SESSION_EXPIRED');
      }

      const user = await tx.get('SELECT id, email, name, role, is_premium, subscription_tier, premium_expires_at FROM users WHERE id = ?', decoded.userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      await tx.run('DELETE FROM sessions WHERE id = ?', session.id);

      const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });
      const newSessionId = uuidv4();
      const newRefreshHash = hashToken(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const deviceInfo = parseUserAgent(userAgent);

      await tx.run(
        'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newSessionId, user.id, newRefreshHash, deviceInfo, ipAddress, userAgent, newExpiresAt
      );
      await tx.run(
        'DELETE FROM user_sessions WHERE id = ?',
        session.id
      );
      await tx.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, device_name, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        newSessionId, user.id, newRefreshHash, deviceInfo, ipAddress, userAgent
      );

      const newToken = generateToken({ id: user.id, email: user.email, role: user.role }, newSessionId);

      return { newToken, newRefreshToken };
    });

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', result.newToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', result.newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: { message: 'Tokens refreshed successfully' } });
  } catch (error) {
    if (error.message === 'SESSION_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' }
      });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const refreshHash = hashToken(refreshToken);
      await db.run('DELETE FROM sessions WHERE refresh_token = ?', refreshHash);
      await db.run('DELETE FROM user_sessions WHERE token_hash = ?', refreshHash);
    }
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    logger.error(`[Auth] Logout failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

// POST /auth/logout-other-devices - Log out all other sessions except current
router.post('/logout-other-devices', authenticate, async (req, res) => {
  try {
    const currentSessionId = req.user?.sid;
    if (!currentSessionId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Session ID not found' }
      });
    }
    
    const result = await db.run(
      'DELETE FROM sessions WHERE user_id = ? AND id != ?',
      req.userId, currentSessionId
    );
    await db.run('DELETE FROM user_sessions WHERE user_id = ? AND id != ?', req.userId, currentSessionId);
    
    res.json({ 
      success: true, 
      data: { 
        message: `Logged out ${result.changes} other sessions`,
        sessionsTerminated: result.changes
      } 
    });
  } catch (error) {
    logger.error(`[Auth] Logout other devices failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to log out other sessions' }
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
    }

    const decoded = jwt.verify(token, getSecret());
    const user = await db.get('SELECT id, email, name, role, is_verified, is_premium, subscription_tier, premium_expires_at, created_at, theme_preference, admin_level FROM users WHERE id = ?', decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    user.admin_level = user.admin_level || 'support';

    // Map is_verified to emailVerified for frontend compatibility
    user.emailVerified = !!user.is_verified;

    // Check quiz status for onboarding flow
    const quiz = await db.get('SELECT id FROM quiz_responses WHERE user_id = ? AND result IS NOT NULL', user.id);
    user.quiz_completed = !!quiz;

    res.json({ success: true, data: { user } });
  } catch (error) {
    logger.error(`[Auth] Me endpoint failed: ${error.message}`);
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
    });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
    }

    const decoded = jwt.verify(token, getSecret());
    const now = new Date().toISOString();
    const sessions = await db.all(`
      SELECT id, device_info, ip_address, created_at, expires_at 
      FROM sessions 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC
    `, decoded.userId, now);

    res.json({ success: true, data: { sessions } });
  } catch (error) {
    logger.error(`[Auth] Get sessions failed: ${error.message}`);
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
    });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
    }

    const decoded = jwt.verify(token, getSecret());
    const { id } = req.params;

    const session = await db.get('SELECT id, user_id FROM sessions WHERE id = ? AND user_id = ?', id, decoded.userId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    await db.run('DELETE FROM sessions WHERE id = ?', id);
    await db.run('DELETE FROM user_sessions WHERE id = ?', id);
    res.json({ success: true, data: { message: 'Session revoked' } });
  } catch (error) {
    logger.error(`[Auth] Delete session failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    const user = await db.get('SELECT id, email FROM users WHERE id = ?', req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const { secret, otpauthUrl, qrCodeDataUri } = generateTwoFactorSecret(user.email);
    await db.run('UPDATE users SET two_factor_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', secret, user.id);
    res.json({ success: true, data: { secret, otpauthUrl, qrCodeDataUri } });
  } catch (error) {
    logger.error(`[Auth] 2FA setup failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to setup 2FA' } });
  }
});

router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await db.get('SELECT id, two_factor_secret FROM users WHERE id = ?', req.userId);
    if (!user?.two_factor_secret) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: '2FA setup not initialized' } });
    }
    if (!verifyTwoFactorCode(user.two_factor_secret, String(code || ''))) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid authentication code' } });
    }
    await db.run('UPDATE users SET two_factor_enabled = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?', user.id);
    res.json({ success: true, data: { enabled: true } });
  } catch (error) {
    logger.error(`[Auth] 2FA verify failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify 2FA' } });
  }
});

router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { code, password } = req.body;
    const user = await db.get('SELECT id, password, two_factor_secret FROM users WHERE id = ?', req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const passwordOk = await bcrypt.compare(String(password || ''), user.password || '');
    const codeOk = verifyTwoFactorCode(user.two_factor_secret, String(code || ''));
    if (!passwordOk || !codeOk) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid password or authentication code' } });
    }
    await db.run('UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', user.id);
    res.json({ success: true, data: { enabled: false } });
  } catch (error) {
    logger.error(`[Auth] 2FA disable failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to disable 2FA' } });
  }
});

router.patch('/theme', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
    }

    const decoded = jwt.verify(token, getSecret());
    const { theme_preference } = req.body;

    // Validate theme_preference
    const validThemes = ['solocompass', 'solocompass-dark', 'system'];
    if (!validThemes.includes(theme_preference)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_THEME', message: 'Invalid theme preference' }
      });
    }

    await db.run(
      'UPDATE users SET theme_preference = ? WHERE id = ?',
      theme_preference, decoded.userId
    );

    res.json({ success: true, data: { theme_preference } });
  } catch (error) {
    logger.error(`[Auth] Theme update failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/forgot-password', [
  passwordResetLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get('SELECT id FROM users WHERE email = ?', email);
    
    if (!user) {
      // Don't reveal if user exists or not for security, but return success
      return res.json({ success: true, data: { message: 'If an account exists with that email, a reset token has been generated.' } });
    }

    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await db.run(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      resetToken, expires, user.id
    );

    // Send Real Email securely
    await sendPasswordResetEmail(email, resetToken);

    res.json({ success: true, data: { message: 'If an account exists with that email, a reset token has been generated.' } });
  } catch (error) {
    logger.error(`[Auth] Forgot password failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/reset-password', [
  passwordResetLimiter,
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
], handleValidationErrors, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const now = new Date().toISOString();
    const user = await db.get(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?',
      token, now
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    await db.run(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      hashedPassword, user.id
    );

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (error) {
    logger.error(`[Auth] Reset password failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.post('/resend-verification', [
  passwordResetLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get('SELECT id, is_verified, verification_token FROM users WHERE email = ?', email);

    if (!user) {
      // Don't reveal if user exists, but say we sent it if they do
      return res.json({ success: true, data: { message: 'If the account exists and is not verified, a new verification email has been sent.' } });
    }

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Account is already verified' }
      });
    }

    let token = user.verification_token;
    if (!token) {
      token = uuidv4();
      await db.run('UPDATE users SET verification_token = ? WHERE id = ?', token, user.id);
    }

    await sendVerificationEmail(email, token);

    res.json({ success: true, data: { message: 'Verification email sent' } });
  } catch (error) {
    logger.error(`[Auth] Resend verification failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Token is required' }
    });

    const user = await db.get('SELECT id, email, name FROM users WHERE verification_token = ?', token);
    if (!user) return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' }
    });

    await db.run('UPDATE users SET is_verified = true, verification_token = NULL WHERE id = ?', user.id);

    // Send Welcome Email now that they are verified
    sendWelcomeEmail(user.email, user.name || 'Explorer').catch(err => logger.error(`[Auth] Welcome email failed: ${err.message}`));

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?verified=true`);
  } catch (error) {
    logger.error(`[Auth] Verification failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

// --- Google OAuth ---
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account' 
}));

router.get('/google/callback', async (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    try {
      if (err) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/google/callback?error=oauth_failed`);
      }
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/google/callback?error=user_not_found`);
      }

      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

      const sessionId = uuidv4();
      const refreshHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        'INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
        sessionId, user.id, refreshHash, expiresAt
      );

      const tokenWithSession = generateToken({ id: user.id, email: user.email, role: user.role }, sessionId);

      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('token', tokenWithSession, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`);
    } catch (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/google/callback?error=server_error`);
    }
  })(req, res, next);
});

// --- GitHub OAuth ---
// Disabled: GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable.
router.get('/github', (req, res) => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' } });
});

router.get('/github/callback', (req, res) => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'GitHub OAuth is not configured.' } });
});

export default router;
