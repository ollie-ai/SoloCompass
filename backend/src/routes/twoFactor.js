import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const twoFaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many 2FA requests, please try again later' } },
});

// Generate 10 single-use backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
  }
  return codes;
};

// Hash backup codes for storage
const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

// POST /api/users/me/2fa/enable
router.post('/enable', twoFaLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', userId);
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    // Check if 2FA already enabled
    const existing = await db.get('SELECT id, enabled FROM user_2fa WHERE user_id = ?', userId);
    if (existing?.enabled) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_ENABLED', message: '2FA is already enabled' } });
    }

    const secret = speakeasy.generateSecret({
      name: `SoloCompass (${user.email})`,
      issuer: 'SoloCompass',
      length: 32,
    });

    const backupCodes = generateBackupCodes();
    const hashedCodes = backupCodes.map(hashCode);

    if (existing) {
      await db.run('UPDATE user_2fa SET secret = ?, backup_codes = ?, enabled = false WHERE user_id = ?',
        secret.base32, JSON.stringify(hashedCodes), userId);
    } else {
      await db.run('INSERT INTO user_2fa (user_id, secret, backup_codes, enabled) VALUES (?, ?, ?, false)',
        userId, secret.base32, JSON.stringify(hashedCodes));
    }

    const otpauthUrl = secret.otpauth_url;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        otpauthUrl,
        qrCode: qrCodeDataUrl,
        backupCodes, // Return unhashed codes to user once only
      }
    });
  } catch (error) {
    logger.error(`[2FA] Enable failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/users/me/2fa/verify
router.post('/verify', twoFaLimiter, authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } });

    const userId = req.user.userId;
    const twoFa = await db.get('SELECT id, secret, enabled FROM user_2fa WHERE user_id = ?', userId);
    if (!twoFa) return res.status(400).json({ success: false, error: { code: 'NOT_FOUND', message: '2FA setup not initiated' } });

    const verified = speakeasy.totp.verify({
      secret: twoFa.secret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid 2FA code' } });
    }

    await db.run('UPDATE user_2fa SET enabled = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', userId);
    await db.run('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', userId);

    res.json({ success: true, data: { message: '2FA enabled successfully' } });
  } catch (error) {
    logger.error(`[2FA] Verify failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/users/me/2fa/disable
router.post('/disable', twoFaLimiter, authenticate, async (req, res) => {
  try {
    const { token, backupCode } = req.body;
    const userId = req.user.userId;
    
    const twoFa = await db.get('SELECT id, secret, backup_codes, enabled FROM user_2fa WHERE user_id = ?', userId);
    if (!twoFa?.enabled) {
      return res.status(400).json({ success: false, error: { code: 'NOT_ENABLED', message: '2FA is not enabled' } });
    }

    let valid = false;
    if (token) {
      valid = speakeasy.totp.verify({ secret: twoFa.secret, encoding: 'base32', token: String(token), window: 1 });
    } else if (backupCode) {
      const hashedInput = hashCode(backupCode.toUpperCase());
      const codes = JSON.parse(twoFa.backup_codes || '[]');
      const idx = codes.indexOf(hashedInput);
      if (idx !== -1) {
        valid = true;
        codes.splice(idx, 1); // Remove used code
        await db.run('UPDATE user_2fa SET backup_codes = ? WHERE id = ?', JSON.stringify(codes), twoFa.id);
      }
    }

    if (!valid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid 2FA code or backup code' } });
    }

    await db.run('DELETE FROM user_2fa WHERE user_id = ?', userId);

    res.json({ success: true, data: { message: '2FA disabled successfully' } });
  } catch (error) {
    logger.error(`[2FA] Disable failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/users/me/2fa/status
router.get('/status', twoFaLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const twoFa = await db.get('SELECT enabled FROM user_2fa WHERE user_id = ?', userId);
    res.json({ success: true, data: { enabled: twoFa?.enabled || false } });
  } catch (error) {
    logger.error(`[2FA] Status failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

export default router;
