import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requireFeature, FEATURES } from '../middleware/paywall.js';
import { sanitizeAll } from '../middleware/validate.js';
import { requireFeature, FEATURES } from '../middleware/paywall.js';
import { stripe } from '../services/stripe.js';
import { supabaseStorage } from '../services/supabaseStorage.js';
import logger from '../services/logger.js';

// sharp is optional — gracefully degrade if not installed
let sharp;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default;
} catch {
  logger.warn('[Users] sharp not installed — avatar resizing disabled');
}

const AVATAR_SIZES = [
  { key: 'thumbnail', size: 50,  suffix: 'thumb' },
  { key: 'medium',    size: 200, suffix: 'med'   },
  { key: 'full',      size: 800, suffix: 'full'  },
];

/**
 * Resize an image buffer to a given square size via sharp.
 * Falls back to the original buffer if sharp is unavailable.
 */
async function resizeAvatar(buffer, size) {
  if (!sharp) return buffer;
  return sharp(buffer)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer();
}

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
      const hashedPassword = await bcrypt.hash(newPassword, 12);
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
             p.avatar_url, p.bio, p.phone, p.company, p.website, p.travel_style, p.home_city, p.pronouns
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(id);

    // 2. Trips - batch fetch all trips
    const trips = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at FROM trips WHERE user_id = ?').all(id);
    
    // 3. Batch fetch all itinerary_days for these trips (FIXED: was 'itineraries' which doesn't exist)
    const tripIds = trips.map(t => parseInt(t.id, 10)).filter(id => Number.isInteger(id) && id > 0);
    let itineraryDays = [];
    let activities = [];
    
    if (tripIds.length > 0) {
      // Use parameterized IN clause for batch query
      const placeholders = tripIds.map(() => '?').join(',');
      itineraryDays = await db.prepare(`SELECT id, trip_id, day_number, date, notes FROM itinerary_days WHERE trip_id IN (${placeholders})`).all(...tripIds);
      
      // 4. Batch fetch all activities for these itinerary days
      const dayIds = itineraryDays.map(d => parseInt(d.id, 10)).filter(id => Number.isInteger(id) && id > 0);
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
    userData.active_sessions = await db.prepare('SELECT id, device_info, ip_address, location, created_at FROM sessions WHERE user_id = ?').all(id);

    // 8. Notifications
    try {
      userData.notifications = await db.prepare('SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(id);
    } catch { userData.notifications = []; }

    // 9. Login audit trail
    try {
      userData.login_history = await db.prepare('SELECT ip_address, email, success, created_at FROM login_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(id);
    } catch { userData.login_history = []; }

    // 10. Billing history from Stripe (if available)
    try {
      const userRow = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', id);
      if (userRow?.stripe_customer_id && stripe) {
        const charges = await stripe.charges.list({ customer: userRow.stripe_customer_id, limit: 50 });
        userData.billing_history = charges.data.map(c => ({
          amount: c.amount / 100,
          currency: c.currency,
          status: c.status,
          description: c.description,
          created: new Date(c.created * 1000).toISOString(),
        }));
      } else {
        userData.billing_history = [];
      }
    } catch { userData.billing_history = []; }

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

    // Soft delete with 30-day grace period deletion request
    await db.run(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?',
      req.userId, id
    );
    const scheduledPurgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await db.run(
        'INSERT INTO account_deletion_requests (user_id, status, scheduled_purge_date) VALUES (?, ?, ?)',
        id, 'pending', scheduledPurgeDate
      );
    } catch (e) {
      logger.warn(`[Users] Could not create deletion request record: ${e.message}`);
    }
    logger.info(`[Admin] User ${id} soft-deleted by ${req.userId}, purge scheduled for ${scheduledPurgeDate}`);
    res.json({ success: true, data: { message: 'Account deletion initiated. Data will be permanently removed in 30 days.' } });
  } catch (error) {
    logger.error(`[Users] Failed to delete user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' }
    });
  }
});

// GET /api/users/me/stats
router.get('/me/stats', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [tripsResult, countriesResult, activitiesResult] = await Promise.all([
      db.get('SELECT COUNT(*) as total FROM trips WHERE user_id = ? AND deleted_at IS NULL', userId),
      db.get('SELECT COUNT(DISTINCT destination_id) as total FROM trips WHERE user_id = ? AND deleted_at IS NULL', userId),
      db.get('SELECT COUNT(*) as total FROM activities a JOIN itinerary_days id ON a.day_id = id.id JOIN trips t ON t.id = id.trip_id WHERE t.user_id = ? AND t.deleted_at IS NULL', userId),
    ]);

    const checkInsResult = await db.get('SELECT COUNT(*) as total FROM check_ins WHERE user_id = ?', userId);

    res.json({
      success: true,
      data: {
        trips_total: tripsResult?.total || 0,
        countries_visited: countriesResult?.total || 0,
        activities_completed: activitiesResult?.total || 0,
        check_ins: checkInsResult?.total || 0,
      }
    });
  } catch (error) {
    logger.error(`[Users] Stats failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/users/me/profile
router.get('/me/profile', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.get(
      `SELECT u.id, u.email, u.name, u.role, u.is_premium, u.subscription_tier, u.created_at,
              p.display_name, p.avatar_url, p.bio, p.phone, p.home_city, p.home_base,
              p.travel_style, p.pronouns, p.solo_travel_experience, p.budget_level,
              p.pace, p.interests, p.visible
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`,
      userId
    );
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ success: true, data: { profile: user } });
  } catch (error) {
    logger.error(`[Users] Me profile failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/users/me/profile
router.put('/me/profile', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const allowed = ['display_name', 'bio', 'phone', 'home_city', 'home_base', 'travel_style', 'pronouns', 'solo_travel_experience', 'budget_level', 'pace', 'interests', 'visible'];
    const nameAllowed = ['name'];
    
    const profileUpdates = {};
    const userUpdates = {};
    
    for (const key of allowed) {
      if (req.body[key] !== undefined) profileUpdates[key] = req.body[key];
    }
    for (const key of nameAllowed) {
      if (req.body[key] !== undefined) userUpdates[key] = req.body[key];
    }

    if (Object.keys(profileUpdates).length > 0) {
      const setParts = Object.keys(profileUpdates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(profileUpdates), userId];
      await db.run(`UPDATE profiles SET ${setParts}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, ...values);
    }
    
    if (Object.keys(userUpdates).length > 0) {
      const setParts = Object.keys(userUpdates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(userUpdates), userId];
      await db.run(`UPDATE users SET ${setParts}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, ...values);
    }

    res.json({ success: true, data: { message: 'Profile updated successfully' } });
  } catch (error) {
    logger.error(`[Users] Me profile update failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/users/me/password
router.put('/me/password', apiLimiter, authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Current and new passwords are required' } });
    }
    
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters with uppercase, number, and special character' } });
    }

    const user = await db.get('SELECT id, password FROM users WHERE id = ?', userId);
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hashed, userId);

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    logger.error(`[Users] Password change failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/users/:id/public
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.get(
      `SELECT u.id, u.name, u.created_at,
              p.display_name, p.avatar_url, p.bio, p.travel_style, p.home_city, p.pronouns, p.solo_travel_experience, p.visible
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      id
    );

    if (!user || user.visible === false) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found or not public' } });
    }

    const { visible: _, ...publicProfile } = user;
    res.json({ success: true, data: { profile: publicProfile } });
  } catch (error) {
    logger.error(`[Users] Public profile failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/users/me/deactivate  
router.post('/me/deactivate', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.run('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', userId);
    res.json({ success: true, data: { message: 'Account deactivated. You can reactivate by logging in again.' } });
  } catch (error) {
    logger.error(`[Users] Deactivate failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/users/me/completeness — profile completeness score for the user's own profile
router.get('/me/completeness', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [user, profile, quizResult] = await Promise.all([
      db.get('SELECT name, email FROM users WHERE id = ?', userId),
      db.get('SELECT bio, avatar_url, home_city, travel_style, interests, phone, pronouns FROM profiles WHERE user_id = ?', userId),
      db.get('SELECT dominant_style, travel_persona FROM quiz_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', userId),
    ]);

    const steps = [
      { field: 'name',          label: 'Display name',     weight: 15, value: !!user?.name },
      { field: 'email',         label: 'Email',             weight: 5,  value: !!user?.email },
      { field: 'bio',           label: 'Bio',               weight: 10, value: !!(profile?.bio?.trim()) },
      { field: 'avatar',        label: 'Profile photo',     weight: 20, value: !!profile?.avatar_url },
      { field: 'home_city',     label: 'Home city',         weight: 10, value: !!profile?.home_city },
      { field: 'travel_style',  label: 'Travel style',      weight: 10, value: !!profile?.travel_style },
      { field: 'interests',     label: 'Interests (3+)',    weight: 15, value: (() => { try { return JSON.parse(profile?.interests || '[]').length >= 3; } catch { return false; } })() },
      { field: 'quiz',          label: 'Travel DNA quiz',   weight: 15, value: !!quizResult?.dominant_style },
    ];

    const percentage = steps.reduce((acc, s) => acc + (s.value ? s.weight : 0), 0);
    const missing = steps.filter(s => !s.value).map(s => ({ field: s.field, label: s.label, weight: s.weight }));

    const label = percentage >= 90 ? 'Complete' : percentage >= 60 ? 'Good' : percentage >= 30 ? 'Getting started' : 'Incomplete';

    res.json({
      success: true,
      data: { percentage, label, missing, steps: steps.map(({ field, label, weight, value }) => ({ field, label, weight, complete: value })) }
    });
  } catch (error) {
    logger.error(`[Users] Completeness failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/users/me/privacy — get per-field privacy settings
router.get('/me/privacy', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await db.get('SELECT privacy_settings FROM profiles WHERE user_id = ?', userId);
    const defaults = { bio: 'public', home_city: 'public', phone: 'private', interests: 'public', travel_style: 'public', pronouns: 'public' };
    let settings = defaults;
    try {
      if (profile?.privacy_settings) {
        settings = { ...defaults, ...JSON.parse(profile.privacy_settings) };
      }
    } catch { /* keep defaults */ }
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`[Users] Privacy get failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/users/me/privacy — update per-field privacy settings
router.put('/me/privacy', apiLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const ALLOWED_FIELDS = new Set(['bio', 'home_city', 'phone', 'interests', 'travel_style', 'pronouns']);
    const ALLOWED_LEVELS = new Set(['public', 'buddies', 'private']);

    const incoming = req.body || {};
    const clean = {};
    for (const [field, level] of Object.entries(incoming)) {
      if (ALLOWED_FIELDS.has(field) && ALLOWED_LEVELS.has(level)) {
        clean[field] = level;
      }
    }

    // Fetch current settings and merge
    const profile = await db.get('SELECT privacy_settings FROM profiles WHERE user_id = ?', userId);
    let current = {};
    try { if (profile?.privacy_settings) current = JSON.parse(profile.privacy_settings); } catch { /* ignore */ }
    const updated = { ...current, ...clean };

    await db.run(
      'UPDATE profiles SET privacy_settings = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      JSON.stringify(updated), userId
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`[Users] Privacy update failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

export default router;
