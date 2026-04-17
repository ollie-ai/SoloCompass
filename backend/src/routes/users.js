import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import { stripe } from '../services/stripe.js';
import logger from '../services/logger.js';

const router = express.Router();

const userReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const userWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Whitelist of allowed profile fields
const ALLOWED_PROFILE_FIELDS = [
  'name', 'travel_style', 'bio', 'avatar_url', 'phone', 'home_city', 
  'interests', 'budget_level', 'pace', 'accommodation_type'
];

router.get('/', userReadLimiter, requireAuth, async (req, res) => {
  try {
    const { search, role, limit = 50, offset = 0, include_deleted } = req.query;
    const isAdmin = req.userRole === 'admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }

    let query = `
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at,
             p.avatar_url, p.bio, p.company, p.home_city, p.interests,
             u.deleted_at, u.deleted_by
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE 1=1
    `;
    const params = [];

    // Exclude soft-deleted by default
    if (include_deleted !== 'true') {
      query += ' AND (u.deleted_at IS NULL)';
    }

    if (search) {
      query += ' AND (u.email ILIKE ? OR u.name ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await db.prepare(query).all(...params);

    const countQuery = `
      SELECT COUNT(*) as total FROM users u WHERE 1=1
      ${search ? ' AND (u.email ILIKE ? OR u.name ILIKE ?)' : ''}
      ${role ? ' AND u.role = ?' : ''}
    `;
    const countParams = [];
    if (search) countParams.push(`%${search}%`, `%${search}%`);
    if (role) countParams.push(role);
    const { total } = await db.prepare(countQuery).get(...countParams);

    res.json({ success: true, data: { users, total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (error) {
    logger.error(`[Users] Failed to list users: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' }
    });
  }
});

router.get('/me', userReadLimiter, requireAuth, async (req, res) => {
  try {
    const user = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at, u.tour_seen,
             p.avatar_url, p.bio, p.phone, p.company, p.website, p.home_city, p.interests, p.travel_style
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    logger.error(`[Users] Failed to get current user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' }
    });
  }
});

router.put('/tour-seen', userWriteLimiter, requireAuth, async (req, res) => {
  try {
    await db.prepare('UPDATE users SET tour_seen = true WHERE id = ?').run(req.userId);
    res.json({ success: true });
  } catch (error) {
    logger.error(`[Users] Failed to mark tour as seen: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tour status' } });
  }
});

router.get('/:id', userReadLimiter, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.userRole === 'admin';

    if (parseInt(id) !== req.userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }

    const user = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at, u.tour_seen,
             p.avatar_url, p.bio, p.phone, p.company, p.website, p.home_city, p.interests, p.travel_style
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    logger.error(`[Users] Failed to get user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' }
    });
  }
});

router.put('/:id', userWriteLimiter, requireAuth, sanitizeAll(['name', 'bio', 'travel_style', 'phone', 'home_city']), async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.userRole === 'admin';

    if (parseInt(id) !== req.userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }

    // Extract allowed user fields and profile fields separately
    const { name, role, currentPassword, newPassword, ...unsanitizedProfileData } = req.body;

    // Filter profile data to only allow whitelisted fields
    const profileData = {};
    for (const [key, value] of Object.entries(unsanitizedProfileData)) {
      if (ALLOWED_PROFILE_FIELDS.includes(key)) {
        profileData[key] = value;
      }
    }

    if (role !== undefined && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required to change role' }
      });
    }

    if (role && isAdmin) {
      const validRoles = ['user', 'viewer', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid role' }
        });
      }
      await db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, id);
    }

    if (currentPassword && newPassword) {
      const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' }
        });
      }
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Current password is incorrect' }
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, id);
    }

    if (name) {
      await db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id);
    }

    const profileFields = [];
    const profileValues = [];

    for (const [key, value] of Object.entries(profileData)) {
      if (value !== undefined) {
        profileFields.push(`${key} = ?`);
        profileValues.push(value);
      }
    }

    if (profileFields.length > 0) {
      const existingProfile = await db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(id);
      if (existingProfile) {
        profileValues.push(id);
        await db.prepare(`UPDATE profiles SET ${profileFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(...profileValues);
      } else {
        const columns = profileFields.map(f => f.split(' ')[0]);
        await db.prepare(`INSERT INTO profiles (user_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`).run(id, ...profileValues);
      }
    }

    const user = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at,
             p.avatar_url, p.bio, p.phone, p.company, p.website
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(id);

    res.json({ success: true, data: { user } });
  } catch (error) {
    logger.error(`[Users] Failed to update user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' }
    });
  }
});

router.get('/:id/export', userReadLimiter, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.userRole === 'admin';

    if (parseInt(id) !== req.userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }

    const userData = {};

    // 1. User & Profile (single query with JOIN)
    userData.account = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
             p.avatar_url, p.bio, p.phone, p.company, p.website, p.travel_style, p.home_city
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(id);

    // 2. Trips - batch fetch all trips
    const trips = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at FROM trips WHERE user_id = ?').all(id);
    
    // 3. Batch fetch all itinerary_days for these trips (FIXED: was 'itineraries' which doesn't exist)
    const tripIds = trips.map(t => t.id);
    let itineraryDays = [];
    let activities = [];
    
    if (tripIds.length > 0) {
      // Use parameterized IN clause for batch query
      const placeholders = tripIds.map(() => '?').join(',');
      itineraryDays = await db.prepare(`SELECT id, trip_id, day_number, date, notes FROM itinerary_days WHERE trip_id IN (${placeholders})`).all(...tripIds);
      
      // 4. Batch fetch all activities for these itinerary days
      const dayIds = itineraryDays.map(d => d.id);
      if (dayIds.length > 0) {
        const activityPlaceholders = dayIds.map(() => '?').join(',');
        activities = await db.prepare(`SELECT id, day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index FROM activities WHERE day_id IN (${activityPlaceholders})`).all(...dayIds);
      }
    }
    
    // Group activities by day_id using Map for O(n) lookup
    const activitiesByDay = new Map();
    for (const activity of activities) {
      if (!activitiesByDay.has(activity.day_id)) {
        activitiesByDay.set(activity.day_id, []);
      }
      activitiesByDay.get(activity.day_id).push(activity);
    }
    
    // Group itinerary_days by trip_id using Map for O(n) lookup
    const daysByTrip = new Map();
    for (const day of itineraryDays) {
      if (!daysByTrip.has(day.trip_id)) {
        daysByTrip.set(day.trip_id, []);
      }
      daysByTrip.get(day.trip_id).push({
        ...day,
        activities: activitiesByDay.get(day.id) || []
      });
    }
    
    // Assemble trips with nested data
    userData.trips = trips.map(trip => ({
      ...trip,
      days: daysByTrip.get(trip.id) || []
    }));

    // 5. Quiz Responses (single batch query)
    userData.quiz_responses = await db.prepare('SELECT id, user_id, question_id, answer, created_at FROM quiz_responses WHERE user_id = ?').all(id);

    // 6. Emergency Contacts (single batch query)
    userData.emergency_contacts = await db.prepare('SELECT id, name, phone, email, relationship, is_primary FROM emergency_contacts WHERE user_id = ?').all(id);

    // 7. Active Sessions (single batch query)
    userData.active_sessions = await db.prepare('SELECT id, device_info, ip_address, created_at FROM sessions WHERE user_id = ?').all(id);

    res.json({ 
      success: true, 
      data: { 
        export_date: new Date().toISOString(),
        user_id: id,
        archive: userData 
      } 
    });
  } catch (error) {
    logger.error(`[Users] Failed to export data: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate data export' }
    });
  }
});

router.delete('/:id', userWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // ?permanent=true for hard delete
    const isAdmin = req.userRole === 'admin';
    const isOwner = parseInt(id) === req.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }

    // Admin cannot delete themselves via this endpoint (to avoid accidental lockout)
    if (isAdmin && isOwner && req.userId === 1) {
       return res.status(400).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Primary admin account cannot be deleted' }
      });
    }

    // Check if soft-delete columns exist
    let hasSoftDelete = false;
    try {
      const colCheck = await db.get(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted_at'
      `);
      hasSoftDelete = !!colCheck;
    } catch (e) {
      hasSoftDelete = false;
    }

    // Get current user state
    const user = await db.get('SELECT id, email, name, role, stripe_customer_id, deleted_at, deleted_by FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // If already soft-deleted and not permanent, restore instead
    if (user.deleted_at && permanent !== 'true') {
      // Restore user
      await db.run('UPDATE users SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', id);
      logger.info(`[Admin] User ${id} restored from soft-delete by ${req.userId}`);
      return res.json({ success: true, data: { message: 'User restored successfully' } });
    }

    // If permanent delete or no soft-delete available, do hard delete
    if (permanent === 'true' || !hasSoftDelete) {
      // 1. Get stripe customer ID before deletion for cleanup
      if (user.stripe_customer_id) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            status: 'active'
          });
          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id);
          }
          await stripe.customers.del(user.stripe_customer_id);
          logger.info(`[Stripe] Cleaned up data for deleted user ${id}`);
        } catch (stripeErr) {
          logger.error(`[Stripe] Account cleanup failed during deletion: ${stripeErr.message}`);
        }
      }

      // Hard delete
      await db.run('DELETE FROM users WHERE id = ?', id);
      logger.info(`[Admin] User ${id} permanently deleted by ${req.userId}`);
      return res.json({ success: true, data: { message: 'Account permanently deleted' } });
    }

    // Soft delete (default)
    await db.run(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?',
      req.userId, id
    );
    logger.info(`[Admin] User ${id} soft-deleted by ${req.userId}`);
    res.json({ success: true, data: { message: 'User soft-deleted. Use DELETE with ?permanent=true to remove permanently.' } });
  } catch (error) {
    logger.error(`[Users] Failed to delete user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' }
    });
  }
});

export default router;
