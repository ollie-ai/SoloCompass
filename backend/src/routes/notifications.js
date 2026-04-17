import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadCount,
  updateNotificationPreferences,
  getNotificationPreferences
} from '../services/notificationService.js';
import db from '../db.js';
import {
  subscribeUser,
  unsubscribeUser,
  sendPushNotification
} from '../services/pushService.js';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { dispatchNotification } from '../services/notificationDispatcher.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await getUserNotifications(req.userId, { limit, offset, unreadOnly });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Notifications] Fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await getUnreadCount(req.userId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error('[Notifications] Unread count error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const success = await markNotificationRead(req.params.id, req.userId);
    if (success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

router.put('/read-all', authenticate, async (req, res) => {
  try {
    await markAllNotificationsRead(req.userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const success = await deleteNotification(req.params.id, req.userId);
    if (success) {
      res.json({ success: true, message: 'Notification deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

router.get('/preferences', authenticate, async (req, res) => {
  try {
    const prefs = await getNotificationPreferences(req.userId);
    res.json({ success: true, data: prefs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

router.put('/preferences', authenticate, async (req, res) => {
  try {
    const prefs = await updateNotificationPreferences(req.userId, req.body);
    if (prefs) {
      res.json({ success: true, data: prefs });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
  } catch (err) {
    console.error('[Preferences] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

router.post('/push/subscribe', authenticate, [
  body('token').notEmpty().withMessage('Token is required')
], validate, async (req, res) => {
  try {
    const { token } = req.body;
    const result = await subscribeUser(req.userId, token);
    
    if (result.success) {
      res.json({ success: true, message: 'Push subscription saved' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to subscribe' });
    }
  } catch (err) {
    console.error('[Notifications] Push subscribe error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to subscribe to push' });
  }
});

router.post('/push/unsubscribe', authenticate, [
  body('token').notEmpty().withMessage('Token is required')
], validate, async (req, res) => {
  try {
    const { token } = req.body;
    const result = await unsubscribeUser(req.userId, token);
    
    if (result.success) {
      res.json({ success: true, message: 'Push subscription removed' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to unsubscribe' });
    }
  } catch (err) {
    console.error('[Notifications] Push unsubscribe error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to unsubscribe from push' });
  }
});

router.post('/push/test', authenticate, async (req, res) => {
  try {
    const result = await sendPushNotification(req.userId, {
      title: 'Test Notification',
      body: 'Push notifications are working!',
      priority: 'P3',
      tag: 'test',
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Notifications] Push test error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send test notification' });
  }
});

router.post('/send', requireAdmin, [
  body('userId').isInt().withMessage('userId is required'),
  body('type').isString().notEmpty().withMessage('type is required'),
], validate, async (req, res) => {
  try {
    const { userId, type, data = {} } = req.body;
    const summary = await dispatchNotification(Number(userId), type, data);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[Notifications] internal send error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to dispatch notification' });
  }
});

router.get('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }
    // TODO: Replace this placeholder parser with signed JWT verification.
    const userIdFromToken = String(token).startsWith('user-') ? Number(String(token).replace('user-', '')) : null;
    if (userIdFromToken) {
      await db.prepare(`
        UPDATE notification_preferences
        SET email_notifications = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(userIdFromToken);
    }
    res.json({ success: true, message: 'You have been unsubscribed from marketing/non-critical emails.' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to process unsubscribe request' });
  }
});

export default router;
