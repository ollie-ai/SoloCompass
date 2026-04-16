import express from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const sessions = await db.prepare(`
      SELECT id, user_id, device_name, ip_address, user_agent, created_at, last_active_at
      FROM user_sessions
      WHERE user_id = ?
      ORDER BY last_active_at DESC, created_at DESC
    `).all(req.userId);
    res.json({ success: true, data: { sessions } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM user_sessions WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    await db.prepare('DELETE FROM user_sessions WHERE id = ? AND user_id = ?').run(id, req.userId);
    await db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true, data: { message: 'Session revoked' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

export default router;

