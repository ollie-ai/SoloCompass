import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.delete('/', async (req, res) => {
  try {
    await db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?').run(req.userId, req.userId);
    res.json({ success: true, data: { message: 'Account scheduled for deletion. You can restore within 30 days.' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to schedule account deletion' });
  }
});

router.post('/restore', async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, deleted_at FROM users WHERE id = ?').get(req.userId);
    if (!user?.deleted_at) {
      return res.status(400).json({ success: false, error: 'Account is not pending deletion' });
    }
    const deletedAt = new Date(user.deleted_at);
    const windowEnd = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (new Date() > windowEnd) {
      return res.status(400).json({ success: false, error: 'Restore window has expired' });
    }
    await db.prepare('UPDATE users SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(req.userId);
    res.json({ success: true, data: { message: 'Account restored' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to restore account' });
  }
});

export default router;

