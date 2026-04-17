import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { generateToken, generateRefreshToken, verifyRefreshToken, getJWTSecret, hashToken, authenticate } from '../middleware/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail, sendMagicLinkEmail } from '../services/email.js';
import logger from '../services/logger.js';

const router = express.Router();

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'dispostable.com', 'mailnull.com', 'spamgourmet.com', 'tempr.email',
  'discard.email', 'fakeinbox.com', 'mailnesia.com', '10minutemail.com',
  'tempinbox.com', 'throwam.com', 'spamherelots.com', 'binkmail.com', 'bob.email',
  'clrmail.com', 'dcctb.com', 'drdrb.net',
]);

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
  max: 3,
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

// IP-level lockout: tracks failed login attempts per IP address across all accounts.
// After IP_MAX_FAILURES failed attempts within the window the IP is blocked for
// IP_LOCKOUT_MS milliseconds. This complements the per-account lockout.
const IP_MAX_FAILURES = 20;
const IP_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
const ipFailures = new Map(); // ip -> { count, lockedUntil }

const checkIpLockout = (ip) => {
  const entry = ipFailures.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    ipFailures.delete(ip);
  }
  return false;
};

const recordIpFailure = (ip) => {
  const entry = ipFailures.get(ip) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= IP_MAX_FAILURES) {
    entry.lockedUntil = Date.now() + IP_LOCKOUT_MS;
    logger.warn(`[Auth] IP lockout triggered for ${ip} after ${entry.count} failures`);
  }
  ipFailures.set(ip, entry);
};

const clearIpFailure = (ip) => {
  ipFailures.delete(ip);
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
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
    .custom((email) => {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
        throw new Error('Disposable email addresses are not allowed');
      }
      return true;
    }),
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
      'INSERT INTO users (email, password, name, role, email_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)',
      email, hashedPassword, name || null, 'user', isVerified, verificationToken
    );

    const userId = result.lastInsertRowid;
    
    // Fetch user for token generation - explicitly select only needed columns to prevent exposing sensitive data
    const user = await db.get('SELECT id, email, name, role, email_verified, is_premium, subscription_tier, premium_expires_at, created_at, theme_preference, admin_level FROM users WHERE id = ?', userId);
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });
    const sessionId = uuidv4();
    const refreshHash = hashToken(refreshToken);

    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    await db.run(
      'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
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
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    const user = await db.get('SELECT id, email, password, name, role, email_verified, is_premium, subscription_tier, premium_expires_at, failed_attempts, locked_until, admin_level FROM users WHERE email = ?', email); // FIXED: was SELECT * which exposed sensitive fields
    if (!user) {
      recordIpFailure(ipAddress);
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
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
      recordIpFailure(ipAddress);
      if (newFailedAttempts >= 5) {
        // Lock account for 30 minutes
        const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await db.run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
          newFailedAttempts, lockedUntil, user.id);
        return res.status(423).json({
          success: false,
          error: { code: 'ACCOUNT_LOCKED', message: 'Too many failed attempts. Account locked for 30 minutes.' }
        });
      }
      await db.run('UPDATE users SET failed_attempts = ? WHERE id = ?', newFailedAttempts, user.id);
      // Log failed attempt
      try {
        await db.run('INSERT INTO login_attempts (ip_address, user_id, email, success) VALUES (?, ?, ?, ?)', ipAddress, user.id, email, false);
      } catch {}
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
      });
    }

    // Reset failed attempts on successful login
    if (user.failed_attempts > 0 || user.locked_until) {
      await db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', user.id);
    }
    clearIpFailure(ipAddress);

    if (!user.email_verified && user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before logging in.' }
      });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });
    const sessionId = uuidv4();
    const refreshHash = hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    try {
      await db.run(
        'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent, expiresAt
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
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
    
    // Log successful attempt
    try {
      await db.run('INSERT INTO login_attempts (ip_address, user_id, email, success) VALUES (?, ?, ?, ?)', ipAddress, user.id, email, true);
    } catch {}

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
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const deviceInfo = parseUserAgent(userAgent);

      await tx.run(
        'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newSessionId, user.id, newRefreshHash, deviceInfo, ipAddress, userAgent, newExpiresAt
      );

      const newToken = generateToken({ id: user.id, email: user.email, role: user.role }, newSessionId);

      return { newToken, newRefreshToken };
    });

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', result.newToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', result.newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
    const user = await db.get('SELECT id, email, name, role, email_verified, is_premium, subscription_tier, premium_expires_at, created_at, theme_preference, admin_level FROM users WHERE id = ?', decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    user.admin_level = user.admin_level || 'support';

    // Map email_verified to emailVerified for frontend compatibility
    user.emailVerified = !!user.email_verified;

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
    res.json({ success: true, data: { message: 'Session revoked' } });
  } catch (error) {
    logger.error(`[Auth] Delete session failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
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
    const user = await db.get('SELECT id, email_verified, verification_token FROM users WHERE email = ?', email);

    if (!user) {
      // Don't reveal if user exists, but say we sent it if they do
      return res.json({ success: true, data: { message: 'If the account exists and is not verified, a new verification email has been sent.' } });
    }

    if (user.email_verified) {
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

// Magic link login - request
router.post('/magic-link', [
  passwordResetLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get('SELECT id, email, name, email_verified FROM users WHERE email = ?', email);
    
    // Always return success to avoid email enumeration
    if (!user) {
      return res.json({ success: true, data: { message: 'If an account exists, a magic link has been sent.' } });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Invalidate old unused tokens for this user
    await db.run('DELETE FROM magic_link_tokens WHERE user_id = ? AND used = false', user.id);
    
    await db.run(
      'INSERT INTO magic_link_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      user.id, token, expiresAt
    );

    const magicLinkUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/magic-link?token=${token}`;
    
    // Send magic link email
    try {
      await sendMagicLinkEmail(email, magicLinkUrl, user.name || 'Explorer');
    } catch (emailError) {
      logger.error(`[Auth] Magic link email failed: ${emailError.message}`);
    }

    res.json({ success: true, data: { message: 'If an account exists, a magic link has been sent.' } });
  } catch (error) {
    logger.error(`[Auth] Magic link request failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// Magic link verify
router.post('/magic-link/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } });
    }

    const now = new Date().toISOString();
    const record = await db.get(
      'SELECT ml.id, ml.user_id, ml.used, u.id as uid, u.email, u.name, u.role, u.is_premium, u.subscription_tier, u.admin_level FROM magic_link_tokens ml JOIN users u ON u.id = ml.user_id WHERE ml.token = ? AND ml.expires_at > ? AND ml.used = false',
      token, now
    );

    if (!record) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired magic link' } });
    }

    // Mark token as used
    await db.run('UPDATE magic_link_tokens SET used = true WHERE id = ?', record.id);
    
    // Ensure email is verified
    await db.run('UPDATE users SET email_verified = true WHERE id = ?', record.user_id);

    const user = { id: record.uid, email: record.email, name: record.name, role: record.role, is_premium: record.is_premium, subscription_tier: record.subscription_tier, admin_level: record.admin_level };
    
    const sessionId = uuidv4();
    const refreshToken = generateRefreshToken(user);
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);

    await db.run(
      'INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sessionId, user.id, refreshHash, deviceInfo, ipAddress, userAgent, expiresAt
    );

    const tokenWithSession = generateToken(user, sessionId);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', tokenWithSession, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, data: { user, message: 'Logged in via magic link' } });
  } catch (error) {
    logger.error(`[Auth] Magic link verify failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
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

    await db.run('UPDATE users SET email_verified = true, verification_token = NULL WHERE id = ?', user.id);

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
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        'INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
        sessionId, user.id, refreshHash, expiresAt
      );

      const tokenWithSession = generateToken({ id: user.id, email: user.email, role: user.role }, sessionId);

      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('token', tokenWithSession, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
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
