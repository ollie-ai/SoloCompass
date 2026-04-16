import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { premiumOnly } from '../middleware/paywall.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import { generateItinerary } from '../services/itineraryAI.js';
import { getTripReadiness, generateChecklist } from '../services/readinessService.js';
import { getTimezoneInfo } from '../services/timezoneService.js';
import { getForecast } from '../services/weatherService.js';
import { createNotification, getNotificationPreferences, sendTripUpdate } from '../services/notificationService.js';
import { getChannelsForType, CHANNEL } from '../services/notificationRegistry.js';
import * as pushService from '../services/pushService.js';
import * as email from '../services/email.js';
import logger from '../services/logger.js';
import PDFDocument from 'pdfkit';
import { getEmergencyNumbersWithFallback } from '../services/emergencyNumbersService.js';

const router = express.Router();

// Rate limiter for AI-intensive regeneration operations
const regenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many regeneration requests. Please wait a few minutes.' }
});

// Rate limiter for general trip mutations (non-AI)
const tripMutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' }
});

// Standardized error response helper
function formatError(code, message) {
  return { success: false, error: { code, message } };
}

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function sendTripNotification(userId, notificationType, title, message, data = null, relatedId = null) {
  try {
    await createNotification(userId, notificationType, title, message, data, relatedId);
    
    const prefs = await getNotificationPreferences(userId);
    const channels = getChannelsForType(notificationType, prefs);
    
    if (channels.includes(CHANNEL.PUSH)) {
      await pushService.sendPushNotification(userId, { title, body: message, ...data });
    }
    
    if (channels.includes(CHANNEL.EMAIL)) {
      const user = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
      if (user?.email) {
        if (notificationType === 'trip_reminder') {
          await email.sendTripConfirmed(user.email, { name: user.name, ...data });
        }
      }
    }
  } catch (err) {
    logger.error(`[TripNotification] Failed to send ${notificationType}:`, err.message);
  }
}

// Get all trips for current user (or admin can filter by user_id) - with pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const targetUserId = req.userRole === 'admin' && req.query.user_id ? parseInt(req.query.user_id) : req.userId;
    
    // Pagination parameters with defaults and limits
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status; // Optional filter by status
    const autoComplete = req.query.autoComplete === 'true';

    // Only auto-complete past trips when explicitly requested via query param
    if (autoComplete) {
      const now = new Date().toISOString().split('T')[0];
      await db.prepare(`
        UPDATE trips 
        SET status = 'completed' 
        WHERE user_id = ? 
        AND status IN ('planning', 'confirmed') 
        AND end_date < ?
      `).run(targetUserId, now);
    }

    // Build query with optional status filter
    let whereClause = 'WHERE user_id = ?';
    const params = [targetUserId];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Get total count for pagination metadata
    const { total } = await db.prepare(`
      SELECT COUNT(*) as total FROM trips ${whereClause}
    `).get(...params);

    // Get paginated trips
    const trips = await db.prepare(`
      SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at FROM trips 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ 
      success: true, 
      data: { 
        trips,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + trips.length < total
        }
      }
    });
  } catch (error) {
    logger.error('Get trips error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trips' } });
  }
});

// Get single trip with itinerary
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await db.prepare(`
      SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at
      FROM trips WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Get itinerary days
    const days = await db.prepare(`
      SELECT id, trip_id, day_number, date, notes FROM itinerary_days 
      WHERE trip_id = ? 
      ORDER BY day_number ASC
    `).all(id);

    // Get activities for each day
    const daysWithActivities = await Promise.all(days.map(async day => {
      const activities = await db.prepare(`
        SELECT id, day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index
        FROM activities 
        WHERE day_id = ? 
        ORDER BY order_index ASC
      `).all(day.id);

      return {
        ...day,
        activities: activities
      };
    }));

    res.json({ 
      success: true, 
      data: {
        ...trip,
        itinerary: daysWithActivities
      }
    });
  } catch (error) {
    logger.error('Get trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch trip'));
  }
});

// Get itinerary versions for a trip
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify trip ownership
    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    const versions = await db.prepare(`
      SELECT id, version_number, notes, created_at
      FROM itinerary_versions
      WHERE trip_id = ?
      ORDER BY version_number DESC
    `).all(id);

    res.json({ 
      success: true, 
      data: versions
    });
  } catch (error) {
    logger.error('Get itinerary versions error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch versions'));
  }
});

// Restore a specific itinerary version
router.post('/:id/versions/:versionId/restore', requireAuth, async (req, res) => {
  try {
    const { id, versionId } = req.params;

    // Verify trip ownership
    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Get the version to restore
    const version = await db.prepare('SELECT id, version_number, days_json FROM itinerary_versions WHERE id = ? AND trip_id = ?').get(versionId, id);
    if (!version) {
      return res.status(404).json(formatError('NOT_FOUND', 'Version not found'));
    }

    // Archive current itinerary as a new version first
    const currentDays = await db.prepare('SELECT id FROM itinerary_days WHERE trip_id = ?').all(id);
    if (currentDays.length > 0) {
      const maxVersion = await db.prepare('SELECT MAX(version_number) as max FROM itinerary_versions WHERE trip_id = ?').get(id);
      const newVersion = (maxVersion?.max || 0) + 1;
      
      const allDays = await db.prepare('SELECT id, day_number, date, notes FROM itinerary_days WHERE trip_id = ? ORDER BY day_number').all(id);
      const daysJson = JSON.stringify(allDays.map(d => ({
        dayNumber: d.day_number,
        date: d.date,
        notes: d.notes
      })));
      
      await db.prepare(`
        INSERT INTO itinerary_versions (trip_id, version_number, days_json, notes)
        VALUES (?, ?, ?, ?)
      `).run(id, newVersion, daysJson, `Auto-saved before restoring version ${version.version_number}`);
    }

    // Delete current itinerary
    await db.prepare('DELETE FROM activities WHERE trip_id = ?').run(id);
    await db.prepare('DELETE FROM itinerary_days WHERE trip_id = ?').run(id);

    // Parse and restore the version
    const daysData = JSON.parse(version.days_json);
    for (const dayData of daysData) {
      const dayResult = await db.prepare(`
        INSERT INTO itinerary_days (trip_id, day_number, date, notes)
        VALUES (?, ?, ?, ?)
      `).run(id, dayData.dayNumber, dayData.date || null, dayData.notes || null);
    }

    res.json({ 
      success: true, 
      message: `Restored to version ${version.version_number}`
    });
  } catch (error) {
    logger.error('Restore itinerary version error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to restore version'));
  }
});

// Create new trip
router.post('/', requireAuth, sanitizeAll(['name', 'destination', 'notes']), [
  body('name').notEmpty().withMessage('Trip name is required'),
  body('destination').notEmpty().withMessage('Destination is required'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
], handleValidationErrors, async (req, res) => {
  try {
    const { name, destination, startDate, endDate, budget, notes } = req.body;

    const result = await db.prepare(`
      INSERT INTO trips (user_id, name, destination, start_date, end_date, budget, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planning')
    `).run(req.userId, name, destination, startDate || null, endDate || null, budget || null, notes || null);

    const trip = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget, notes, status FROM trips WHERE id = ?').get(result.lastInsertRowid);

    // Fire-and-forget: cache emergency numbers for the trip destination
    getEmergencyNumbersWithFallback(destination).then(emergencyData => {
      if (emergencyData) {
        // Attach cached emergency numbers to the trip response payload via a background log
        logger.info(`[Trips] Cached emergency numbers for ${destination} (${emergencyData.countryCode})`);
      }
    }).catch(() => {});

    res.json({ 
      success: true, 
      data: trip 
    });
  } catch (error) {
    logger.error('Create trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create trip'));
  }
});

// Update trip
router.put('/:id', requireAuth, sanitizeAll(['name', 'destination', 'notes']), [
  body('name').optional().notEmpty(),
  body('destination').optional().notEmpty(),
  body('status').optional().isIn(['planning', 'confirmed', 'completed', 'cancelled']),
  body('budget').optional().isNumeric(),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, destination, startDate, endDate, budget, status, notes } = req.body;

    // Check ownership
    const existing = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!existing) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (destination) { updates.push('destination = ?'); params.push(destination); }
    if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); params.push(endDate); }
    if (budget !== undefined) { 
      updates.push('budget = ?'); 
      params.push(budget); 
      
      // Sync with budgets table
      const existingBudget = await db.prepare('SELECT id FROM budgets WHERE trip_id = ?').get(id);
      if (existingBudget) {
        await db.prepare('UPDATE budgets SET total_budget = ? WHERE id = ?').run(budget, existingBudget.id);
      } else {
        await db.prepare('INSERT INTO budgets (user_id, trip_id, total_budget, currency) VALUES (?, ?, ?, ?)')
          .run(req.userId, id, budget, 'GBP'); // Default to GBP as requested
      }
    }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.userId);

    await db.prepare(`
      UPDATE trips SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...params);

    const trip = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at FROM trips WHERE id = ?').get(id);

    if (status) {
      const statusMessages = {
        confirmed: 'Your trip has been confirmed! Time to finalize your plans.',
        completed: 'Welcome back! Your trip has been marked as completed.',
        cancelled: 'Your trip has been cancelled. We hope to see you on your next adventure!',
        planning: 'Your trip is now in planning mode.'
      };
      if (statusMessages[status]) {
        await sendTripUpdate(req.userId, id, statusMessages[status]);
      }
    }

    res.json({ 
      success: true, 
      data: trip 
    });
  } catch (error) {
    logger.error('Update trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update trip'));
  }
});

// Delete trip
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    // Check if soft-delete columns exist
    let hasSoftDelete = false;
    try {
      const colCheck = await db.get(`SELECT column_name FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'deleted_at'`);
      hasSoftDelete = !!colCheck;
    } catch (e) {
      hasSoftDelete = false;
    }

    // Check current state
    const trip = await db.prepare('SELECT id, deleted_at FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // If already soft-deleted and not permanent, restore
    if (trip.deleted_at && permanent !== 'true') {
      await db.run('UPDATE trips SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', id);
      return res.json({ success: true, message: 'Trip restored' });
    }

    // Permanent delete or no soft-delete - do hard delete
    if (permanent === 'true' || !hasSoftDelete) {
      const result = await db.run('DELETE FROM trips WHERE id = ? AND user_id = ?', id, req.userId);
      if (result.changes === 0) {
        return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
      }
      return res.json({ success: true, message: 'Trip permanently deleted' });
    }

    // Soft delete (default)
    await db.run('UPDATE trips SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', req.userId, id);
    res.json({ success: true, message: 'Trip deleted. Use DELETE with ?permanent=true to remove permanently.' });
  } catch (error) {
    logger.error('Delete trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete trip'));
  }
});

// Get trip generation status
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const status = await db.prepare('SELECT generation_status FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!status) return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    res.json({ success: true, data: { status: status.generation_status } });
  } catch (error) {
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch status'));
  }
});

// Get trip readiness data
router.get('/:id/readiness', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(id);
    if (!trip) return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    if (trip.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json(formatError('FORBIDDEN', 'Access denied'));
    }
    
    const readinessData = await getTripReadiness(id, db);
    
    if (!readinessData) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }
    
    res.json({ success: true, data: readinessData });
  } catch (error) {
    logger.error('Get trip readiness error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch readiness data'));
  }
});

// Get checklist items for a trip
router.get('/:id/checklist', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trip = await db.prepare('SELECT user_id FROM trips WHERE id = ?').get(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const checklistItems = await db.prepare(`
      SELECT item_id, completed, completed_at, manually_confirmed, created_at
      FROM checklist_items
      WHERE trip_id = ? AND user_id = ?
    `).all(id, req.userId);
    
    const checklistMap = {};
    checklistItems.forEach(item => {
      checklistMap[item.item_id] = item;
    });
    
    const generatedChecklist = generateChecklist(trip);
    const mergedChecklist = generatedChecklist.map(item => {
      const saved = checklistMap[item.id];
      return {
        ...item,
        completed: saved?.completed ?? item.completed,
        completed_at: saved?.completed_at ?? null,
        manually_confirmed: saved?.manually_confirmed ?? false,
      };
    });
    
    res.json({ success: true, data: { checklist: mergedChecklist } });
  } catch (error) {
    logger.error('Get checklist error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch checklist'));
  }
});

// Update checklist item completion
router.put('/checklist/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { tripId, completed } = req.body;
    
    if (!tripId) {
      return res.status(400).json({ error: 'tripId is required' });
    }
    
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(tripId);
    if (!trip) return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    if (trip.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json(formatError('FORBIDDEN', 'Access denied'));
    }
    
    const completedAt = completed ? new Date().toISOString() : null;
    
    await db.prepare(`
      INSERT INTO checklist_items (user_id, trip_id, item_id, completed, completed_at, manually_confirmed)
      VALUES (?, ?, ?, ?, ?, true)
      ON CONFLICT (trip_id, item_id)
      DO UPDATE SET completed = ?, completed_at = ?, manually_confirmed = true
    `).run(req.userId, tripId, itemId, completed, completedAt, completed, completedAt);
    
    res.json({ 
      success: true, 
      data: { 
        id: itemId, 
        tripId, 
        completed, 
        completedAt,
        manually_confirmed: true 
      } 
    });
  } catch (error) {
    logger.error('Update checklist error:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Generate checklist for a trip
router.post('/:id/checklist/generate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trip = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    
    const generatedChecklist = generateChecklist(trip);
    
    for (const item of generatedChecklist) {
      const completedAt = item.completed ? new Date().toISOString() : null;
      
      await db.prepare(`
        INSERT INTO checklist_items (user_id, trip_id, item_id, completed, completed_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (trip_id, item_id)
        DO UPDATE SET completed = EXCLUDED.completed, completed_at = EXCLUDED.completed_at
      `).run(req.userId, id, item.id, item.completed, completedAt);
    }
    
    res.json({ 
      success: true, 
      data: { 
        tripId: id, 
        checklist: generatedChecklist 
      } 
    });
  } catch (error) {
    logger.error('Generate checklist error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to generate checklist'));
  }
});

// Generate AI itinerary (Async Background Job) with validation
router.post('/:id/generate', requireAuth, premiumOnly, [
  body('days').optional().isInt({ min: 1, max: 30 }).withMessage('Days must be between 1 and 30'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('pace').optional().isIn(['relaxed', 'moderate', 'intensive']).withMessage('Pace must be relaxed, moderate, or intensive'),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { days, interests, pace } = req.body;

    // Validate trip ID is a number
    const tripIdNum = parseInt(id, 10);
    if (isNaN(tripIdNum)) {
      return res.status(400).json(formatError('INVALID_ID', 'Invalid trip ID'));
    }

    // Get trip details
    const trip = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Get user profile for preferences
    const profile = await db.prepare('SELECT id, interests, pace, travel_style FROM profiles WHERE user_id = ?').get(req.userId);

    // Update trip to processing
    await db.prepare('UPDATE trips SET generation_status = \'processing\' WHERE id = ?').run(id);

    // Run AI in background
    (async () => {
      try {
        const itinerary = await generateItinerary({
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          days: days || 7,
          interests: interests || profile?.interests || [],
          pace: pace || profile?.pace || 'moderate',
          budget: trip.budget,
          travelStyle: profile?.travel_style || 'adventure',
          soloFriendly: true
        });

        // Save itinerary to database
        // First, archive any existing itinerary as a version before replacing
        const existingDays = await db.prepare('SELECT id FROM itinerary_days WHERE trip_id = ?').all(id);
        if (existingDays.length > 0) {
          // Get the current max version number
          const maxVersion = await db.prepare('SELECT MAX(version_number) as max FROM itinerary_versions WHERE trip_id = ?').get(id);
          const newVersion = (maxVersion?.max || 0) + 1;
          
          // Collect all current itinerary data for archiving
          const allDays = await db.prepare('SELECT id, trip_id, day_number, date, notes FROM itinerary_days WHERE trip_id = ? ORDER BY day_number').all(id);
          const daysJson = JSON.stringify(allDays.map(d => ({
            dayNumber: d.day_number,
            date: d.date,
            notes: d.notes
          })));
          
          // Save as a version before deleting
          await db.prepare(`
            INSERT INTO itinerary_versions (trip_id, version_number, days_json, notes)
            VALUES (?, ?, ?, ?)
          `).run(id, newVersion, daysJson, `Auto-saved before regeneration on ${new Date().toISOString()}`);
        }

        // Delete old itinerary
        await db.prepare('DELETE FROM itinerary_days WHERE trip_id = ?').run(id);
        await db.prepare('DELETE FROM activities WHERE trip_id = ?').run(id);

        for (const dayData of itinerary.days) {
          const dayResult = await db.prepare(`
            INSERT INTO itinerary_days (trip_id, day_number, date, notes)
            VALUES (?, ?, ?, ?)
          `).run(id, dayData.day, dayData.date || null, dayData.notes || null);

          const dayId = dayResult.lastInsertRowid;

          for (let i = 0; i < dayData.activities.length; i++) {
            const activity = dayData.activities[i];
            const bookingInfo = activity.booking_info || activity.bookingInfo || null;
            const notes = activity.safety_note || activity.notes || null;
            const duration = activity.duration || activity.duration_hours || 0;

            await db.prepare(`
              INSERT INTO activities (day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(dayId, id, activity.name, activity.type || 'Sightseeing', activity.location || null, activity.time || null, duration, activity.cost || 0, bookingInfo, notes, i);
          }
        }

        await db.prepare('UPDATE trips SET generation_status = \'completed\' WHERE id = ?').run(id);
        
        await sendTripNotification(
          trip.user_id,
          'itinerary_ready',
          'AI Itinerary Ready',
          `Your AI-generated itinerary for ${trip.destination} is ready!`,
          { tripId: trip.id, destination: trip.destination, tripName: trip.name },
          trip.id
        );
      } catch (bgError) {
        logger.error('[ITINERARY_BG] Background generation failed:', bgError);
        await db.prepare('UPDATE trips SET generation_status = \'failed\' WHERE id = ?').run(id);
        
        await sendTripNotification(
          trip.user_id,
          'itinerary_failed',
          'Itinerary Generation Failed',
          `We couldn't generate your itinerary for ${trip.destination}. Please try again.`,
          { tripId: trip.id, destination: trip.destination },
          trip.id
        );
      }
    })();

    res.status(202).json({ 
      success: true, 
      message: 'Itinerary generation started in background',
      data: { status: 'processing' }
    });
  } catch (error) {
    logger.error('Generate itinerary error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to initiate generation'));
  }
});

// Regenerate a single itinerary day (without replacing the entire itinerary)
router.post('/:id/regenerate-day/:dayId', requireAuth, premiumOnly, regenerateLimiter, async (req, res) => {
  try {
    const { id, dayId } = req.params;

    const trip = await db.prepare('SELECT id, user_id, name, destination, start_date, end_date, budget FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));

    const day = await db.prepare('SELECT id, trip_id, day_number, date FROM itinerary_days WHERE id = ? AND trip_id = ?').get(dayId, id);
    if (!day) return res.status(404).json(formatError('NOT_FOUND', 'Day not found'));

    const profile = await db.prepare('SELECT interests, pace, travel_style FROM profiles WHERE user_id = ?').get(req.userId);

    // Get existing days for context (so the regenerated day fits the overall plan)
    const allDays = await db.prepare('SELECT day_number, date FROM itinerary_days WHERE trip_id = ? ORDER BY day_number').all(id);
    const totalDays = allDays.length;

    const { generateItinerary } = await import('../services/itineraryAI.js');
    const partialItinerary = await generateItinerary({
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      days: 1,
      interests: profile?.interests || [],
      pace: profile?.pace || 'moderate',
      budget: trip.budget ? Math.round(trip.budget / totalDays) : undefined,
      travelStyle: profile?.travel_style || 'adventure',
      soloFriendly: true,
      dayContext: `This is day ${day.day_number} of ${totalDays} in ${trip.destination}. Generate only ONE day of activities.`,
    });

    if (!partialItinerary?.days?.length) {
      return res.status(500).json(formatError('GENERATION_FAILED', 'Failed to generate day activities'));
    }

    const newDayData = partialItinerary.days[0];

    // Delete existing activities for this day only
    await db.prepare('DELETE FROM activities WHERE day_id = ?').run(dayId);

    // Insert new activities
    const insertedActivities = [];
    for (let i = 0; i < (newDayData.activities || []).length; i++) {
      const activity = newDayData.activities[i];
      const result = await db.prepare(`
        INSERT INTO activities (day_id, trip_id, name, type, location, time, duration_hours, cost, notes, order_index,
          time_of_day, solo_friendly, solo_dining_ok, safety_note, travel_time_from_previous_minutes, booking_recommended, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dayId, id,
        activity.name, activity.category || activity.type || 'Sightseeing',
        activity.location || null, activity.time || null,
        activity.duration_minutes ? activity.duration_minutes / 60 : 0,
        activity.cost_estimate_gbp || activity.cost || 0,
        activity.notes || activity.safety_note || null, i,
        activity.time_of_day || null,
        activity.solo_friendly !== false ? 1 : 0,
        activity.solo_dining_ok !== false ? 1 : 0,
        activity.safety_note || null,
        activity.travel_time_from_previous_minutes || null,
        activity.booking_recommended ? 1 : 0,
        activity.category || null,
      );
      insertedActivities.push({ id: result.lastInsertRowid, ...activity });
    }

    // Update day title if provided
    if (newDayData.title) {
      await db.prepare('UPDATE itinerary_days SET notes = ? WHERE id = ?').run(newDayData.title, dayId);
    }

    res.json({
      success: true,
      message: `Day ${day.day_number} regenerated`,
      data: { day_id: dayId, day_number: day.day_number, activities: insertedActivities }
    });
  } catch (error) {
    logger.error('Regenerate day error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to regenerate day'));
  }
});

// Update a single activity (manual edit)
router.patch('/activities/:activityId', requireAuth, tripMutateLimiter, sanitizeAll(['name', 'location', 'notes']), async (req, res) => {
  try {
    const { activityId } = req.params;
    const { name, location, time, cost, notes, booking_recommended, solo_friendly } = req.body;

    // Verify ownership via trip
    const activity = await db.prepare(`
      SELECT a.id, a.trip_id FROM activities a
      JOIN trips t ON t.id = a.trip_id
      WHERE a.id = ? AND t.user_id = ?
    `).get(activityId, req.userId);
    if (!activity) return res.status(404).json(formatError('NOT_FOUND', 'Activity not found'));

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (time !== undefined) { updates.push('time = ?'); params.push(time); }
    if (cost !== undefined) { updates.push('cost = ?'); params.push(parseFloat(cost) || 0); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (booking_recommended !== undefined) { updates.push('booking_recommended = ?'); params.push(booking_recommended ? 1 : 0); }
    if (solo_friendly !== undefined) { updates.push('solo_friendly = ?'); params.push(solo_friendly ? 1 : 0); }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(activityId);

    if (updates.length > 1) {
      await db.prepare(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = await db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update activity error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update activity'));
  }
});

// Add activity to a day
router.post('/:id/activities', requireAuth, [
  body('dayId').isNumeric().withMessage('Day ID is required'),
  body('name').notEmpty().withMessage('Activity name is required'),
  body('type').optional().isIn(['Sightseeing', 'Food & Dining', 'Transport', 'Adventure', 'Cultural', 'Relaxation', 'Shopping', 'Nightlife']),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { dayId, name, type, location, time, durationHours, cost, bookingInfo, notes } = req.body;

    // Verify trip ownership
    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Get max order index
    const maxOrder = await db.prepare('SELECT MAX(order_index) as max FROM activities WHERE day_id = ?').get(dayId);
    const orderIndex = (maxOrder?.max || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO activities (day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(dayId, id, name, type || null, location || null, time || null, durationHours || null, cost || null, bookingInfo || null, notes || null, orderIndex);

    const activity = await db.prepare('SELECT id, day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index, created_at FROM activities WHERE id = ?').get(result.lastInsertRowid);

    res.json({ 
      success: true, 
      data: activity 
    });
  } catch (error) {
    logger.error('Add activity error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to add activity'));
  }
});

// Update activity
router.put('/activities/:activityId', requireAuth, sanitizeAll(['name', 'location', 'bookingInfo', 'notes']), [
  body('name').optional({ nullable: true, checkFalsy: true }).isString(),
  body('type').optional().isIn(['Sightseeing', 'Food & Dining', 'Transport', 'Adventure', 'Cultural', 'Relaxation', 'Shopping', 'Nightlife']),
], handleValidationErrors, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { name, type, location, time, durationHours, cost, bookingInfo, notes, orderIndex } = req.body;

    // Verify ownership through trip
    const activity = await db.prepare(`
      SELECT a.id, a.day_id, a.trip_id, a.name, a.type, a.location, a.time, a.duration_hours, a.cost, a.booking_info, a.notes, a.order_index FROM activities a
      JOIN trips t ON a.trip_id = t.id
      WHERE a.id = ? AND t.user_id = ?
    `).get(activityId, req.userId);

    if (!activity) {
      return res.status(404).json(formatError('NOT_FOUND', 'Activity not found'));
    }

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (time !== undefined) { updates.push('time = ?'); params.push(time); }
    if (durationHours !== undefined) { updates.push('duration_hours = ?'); params.push(durationHours); }
    if (cost !== undefined) { updates.push('cost = ?'); params.push(cost); }
    if (bookingInfo !== undefined) { updates.push('booking_info = ?'); params.push(bookingInfo); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (orderIndex !== undefined) { updates.push('order_index = ?'); params.push(orderIndex); }

    if (updates.length === 0) {
      return res.status(400).json(formatError('NO_FIELDS', 'No fields to update'));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(activityId);

    await db.prepare(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await db.prepare('SELECT id, day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index, created_at, updated_at FROM activities WHERE id = ?').get(activityId);

    res.json({ 
      success: true, 
      data: updated 
    });
  } catch (error) {
    logger.error('Update activity error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update activity'));
  }
});

// Delete activity
router.delete('/activities/:activityId', requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Verify ownership through trip
    const activity = await db.prepare(`
      SELECT a.id FROM activities a
      JOIN trips t ON a.trip_id = t.id
      WHERE a.id = ? AND t.user_id = ?
    `).get(activityId, req.userId);

    if (!activity) {
      return res.status(404).json(formatError('NOT_FOUND', 'Activity not found'));
    }

    await db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);

    res.json({ 
      success: true, 
      message: 'Activity deleted' 
    });
  } catch (error) {
    logger.error('Delete activity error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete activity'));
  }
});

// Export trip as PDF
router.get('/:id/export-pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch trip data - select specific columns instead of *
    const trip = await db.prepare(`
      SELECT id, user_id, name, destination, start_date, end_date, budget, status, notes, created_at, updated_at
      FROM trips WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    // Fetch itinerary days with activities
    const days = await db.prepare(`
      SELECT id, trip_id, day_number, date, notes FROM itinerary_days 
      WHERE trip_id = ? 
      ORDER BY day_number ASC
    `).all(id);

    const daysWithActivities = await Promise.all(days.map(async day => {
      const activities = await db.prepare(`
        SELECT id, day_id, trip_id, name, type, location, time, duration_hours, cost, booking_info, notes, order_index
        FROM activities 
        WHERE day_id = ? 
        ORDER BY order_index ASC
      `).all(day.id);

      return {
        ...day,
        activities
      };
    }));

    // Fetch accommodation
    const accommodations = await db.prepare(`
      SELECT id, trip_id, name, type, address, check_in_date, check_out_date, confirmation_number, cost, currency, notes
      FROM accommodations 
      WHERE trip_id = ?
    `).all(id);

    // Fetch emergency contacts for the user
    const emergencyContacts = await db.prepare(`
      SELECT id, name, phone, email, relationship FROM emergency_contacts 
      WHERE user_id = ?
    `).all(req.userId);

    // Fetch packing list
    const packingList = await db.prepare(`
      SELECT id, trip_id, name, category FROM packing_lists 
      WHERE trip_id = ?
    `).all(id);

    const packingItems = [];
    for (const list of packingList) {
      const items = await db.prepare(`
        SELECT id, packing_list_id, name, category, quantity, is_packed, is_essential, notes
        FROM packing_items 
        WHERE packing_list_id = ?
      `).all(list.id);
      packingItems.push(...items);
    }

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `SoloCompass - ${trip.name}`,
        Author: 'SoloCompass',
        Subject: `Trip details for ${trip.destination}`
      }
    });

    // Set response headers for PDF download
    const sanitizedFileName = trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="solocompass_${sanitizedFileName}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper functions for PDF generation
    const drawHeader = () => {
      // SoloCompass branding
      doc.fontSize(10).fillColor('#666666').text('SoloCompass', 50, 30);
      doc.fontSize(8).text('Your Solo Travel Companion', 50, 42);

      // Line separator
      doc.moveTo(50, 55).lineTo(doc.page.width - 50, 55).strokeColor('#cccccc').stroke();
    };

    const drawFooter = (pageNumber) => {
      const footerY = doc.page.height - 30;
      doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor('#cccccc').stroke();
      doc.fontSize(8).fillColor('#666666')
        .text(`SoloCompass - ${trip.name}`, 50, footerY + 8, { align: 'left' })
        .text(`Page ${pageNumber}`, doc.page.width - 100, footerY + 8, { align: 'right' });
    };

    const addSectionTitle = (title, y) => {
      doc.fontSize(16).fillColor('#2c3e50').text(title, 50, y || doc.y + 20);
      doc.moveTo(50, doc.y + 5).lineTo(doc.page.width - 50, doc.y + 5).strokeColor('#3498db').stroke();
      doc.y += 15;
    };

    const addSubSectionTitle = (title) => {
      doc.fontSize(12).fillColor('#2980b9').text(title, 50, doc.y + 10);
      doc.y += 15;
    };

    const addField = (label, value) => {
      doc.fontSize(10).fillColor('#666666').text(label, 50, doc.y, { width: 150 });
      doc.fillColor('#333333').text(value || 'N/A', 200, doc.y - 12, { width: 300 });
      doc.y += 18;
    };

    // Start PDF content
    let pageNumber = 1;

    // Header
    drawHeader();

    // Trip Overview
    doc.y = 70;
    doc.fontSize(24).fillColor('#2c3e50').text(trip.name, 50, doc.y, { align: 'center' });
    doc.fontSize(14).fillColor('#7f8c8d').text(trip.destination, 50, doc.y + 5, { align: 'center' });
    doc.y += 40;

    addSectionTitle('Trip Overview');
    addField('Destination:', trip.destination);
    addField('Start Date:', trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'Not set');
    addField('End Date:', trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'Not set');
    addField('Budget:', trip.budget ? `$${parseFloat(trip.budget).toFixed(2)}` : 'Not set');
    addField('Status:', trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : 'Planning');
    if (trip.notes) {
      addField('Notes:', trip.notes);
    }

    // Itinerary Section
    doc.addPage();
    pageNumber++;
    drawHeader();
    addSectionTitle('Itinerary');

    if (daysWithActivities.length > 0) {
      for (const day of daysWithActivities) {
        // Check if we need a new page
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
          pageNumber++;
          drawHeader();
        }

        addSubSectionTitle(`Day ${day.day_number}${day.date ? ` - ${new Date(day.date).toLocaleDateString()}` : ''}`);

        if (day.notes) {
          doc.fontSize(9).fillColor('#666666').text(day.notes, 50, doc.y, { width: 500 });
          doc.y += 15;
        }

        if (day.activities && day.activities.length > 0) {
          // Table header
          const tableTop = doc.y;
          const tableHeaders = ['Time', 'Activity', 'Type', 'Cost'];
          const colWidths = [80, 250, 120, 80];
          let xPos = 50;

          // Draw header background
          doc.rect(50, tableTop, 530, 20).fill('#ecf0f1');
          doc.fillColor('#2c3e50').fontSize(9);

          tableHeaders.forEach((header, i) => {
            doc.text(header, xPos, tableTop + 5, { width: colWidths[i] });
            xPos += colWidths[i];
          });

          doc.y = tableTop + 25;

          // Draw rows
          day.activities.forEach((activity, index) => {
            if (doc.y > doc.page.height - 80) {
              doc.addPage();
              pageNumber++;
              drawHeader();
              doc.y += 10;
            }

            const rowY = doc.y;
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
            doc.rect(50, rowY, 530, 20).fill(bgColor);
            doc.fillColor('#333333').fontSize(8);

            xPos = 50;
            doc.text(activity.time || '-', xPos, rowY + 5, { width: colWidths[0] });
            xPos += colWidths[0];
            doc.text(activity.name, xPos, rowY + 5, { width: colWidths[1] });
            xPos += colWidths[1];
            doc.text(activity.type || '-', xPos, rowY + 5, { width: colWidths[2] });
            xPos += colWidths[2];
            doc.text(activity.cost ? `$${parseFloat(activity.cost).toFixed(2)}` : '-', xPos, rowY + 5, { width: colWidths[3] });

            doc.y = rowY + 25;
          });
        } else {
          doc.fontSize(9).fillColor('#999999').text('No activities planned', 50, doc.y);
          doc.y += 20;
        }

        doc.y += 10;
      }
    } else {
      doc.fontSize(10).fillColor('#999999').text('No itinerary generated yet', 50, doc.y);
    }

    // Accommodations Section
    doc.addPage();
    pageNumber++;
    drawHeader();
    addSectionTitle('Accommodations');

    if (accommodations.length > 0) {
      accommodations.forEach(acc => {
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
          pageNumber++;
          drawHeader();
        }

        addSubSectionTitle(acc.name);
        addField('Type:', acc.type ? acc.type.charAt(0).toUpperCase() + acc.type.slice(1) : 'Other');
        addField('Address:', acc.address);
        addField('Check-in:', acc.check_in_date ? new Date(acc.check_in_date).toLocaleDateString() : 'Not set');
        addField('Check-out:', acc.check_out_date ? new Date(acc.check_out_date).toLocaleDateString() : 'Not set');
        addField('Confirmation:', acc.confirmation_number || 'Not set');
        addField('Cost:', acc.cost ? `${acc.currency || 'USD'} ${parseFloat(acc.cost).toFixed(2)}` : 'Not set');
        if (acc.notes) {
          addField('Notes:', acc.notes);
        }
        doc.y += 10;
      });
    } else {
      doc.fontSize(10).fillColor('#999999').text('No accommodations added', 50, doc.y);
    }

    // Emergency Contacts Section
    doc.addPage();
    pageNumber++;
    drawHeader();
    addSectionTitle('Emergency Contacts');

    if (emergencyContacts.length > 0) {
      // Table header
      const tableTop = doc.y;
      const headers = ['Name', 'Phone', 'Email', 'Relationship'];
      const colWidths = [150, 130, 180, 100];
      let xPos = 50;

      doc.rect(50, tableTop, 530, 20).fill('#ecf0f1');
      doc.fillColor('#2c3e50').fontSize(9);

      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop + 5, { width: colWidths[i] });
        xPos += colWidths[i];
      });

      doc.y = tableTop + 25;

      emergencyContacts.forEach((contact, index) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          pageNumber++;
          drawHeader();
          doc.y += 10;
        }

        const rowY = doc.y;
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        doc.rect(50, rowY, 530, 20).fill(bgColor);
        doc.fillColor('#333333').fontSize(8);

        xPos = 50;
        doc.text(contact.name, xPos, rowY + 5, { width: colWidths[0] });
        xPos += colWidths[0];
        doc.text(contact.phone || '-', xPos, rowY + 5, { width: colWidths[1] });
        xPos += colWidths[1];
        doc.text(contact.email || '-', xPos, rowY + 5, { width: colWidths[2] });
        xPos += colWidths[2];
        doc.text(contact.relationship || '-', xPos, rowY + 5, { width: colWidths[3] });

        doc.y = rowY + 25;
      });
    } else {
      doc.fontSize(10).fillColor('#999999').text('No emergency contacts added', 50, doc.y);
    }

    // Packing List Summary
    doc.addPage();
    pageNumber++;
    drawHeader();
    addSectionTitle('Packing List');

    if (packingItems.length > 0) {
      // Group by category
      const grouped = {};
      packingItems.forEach(item => {
        if (!grouped[item.category]) {
          grouped[item.category] = [];
        }
        grouped[item.category].push(item);
      });

      Object.keys(grouped).forEach(category => {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          pageNumber++;
          drawHeader();
        }

        addSubSectionTitle(category.charAt(0).toUpperCase() + category.slice(1));

        grouped[category].forEach((item, index) => {
          const checked = item.is_packed ? '[x]' : '[ ]';
          const essential = item.is_essential ? ' *' : '';
          doc.fontSize(9).fillColor('#333333')
            .text(`${checked} ${item.name}${essential} (x${item.quantity})`, 60, doc.y);
          if (item.notes) {
            doc.fontSize(8).fillColor('#666666').text(`   Note: ${item.notes}`, 60, doc.y);
          }
          doc.y += 16;
        });

        doc.y += 5;
      });

      doc.fontSize(8).fillColor('#999999').text('* indicates essential item', 50, doc.y);
    } else {
      doc.fontSize(10).fillColor('#999999').text('No packing list items', 50, doc.y);
    }

    // Final footer on last page
    drawFooter(pageNumber);

    // Finalize PDF
    doc.end();

    logger.info(`Trip ${id} exported as PDF for user ${req.userId}`);
  } catch (error) {
    logger.error('Export trip PDF error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to export trip as PDF'));
  }
});

// Get trip timezone and weather info for dashboard
router.get('/:id/time-weather', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await db.prepare('SELECT id, user_id, destination FROM trips WHERE id = ? AND user_id = ?').get(id, req.userId);

    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }

    const timezoneInfo = getTimezoneInfo(trip.destination, 'UTC');

    let weatherData = null;
    try {
      const OWM_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
      if (OWM_API_KEY && trip.destination) {
        const forecast = await getForecast(trip.destination, OWM_API_KEY);
        weatherData = forecast;
      }
    } catch (weatherErr) {
      logger.warn(`Weather fetch failed for ${trip.destination}:`, weatherErr.message);
    }

    res.json({
      success: true,
      data: {
        timezone: timezoneInfo,
        weather: weatherData,
        destination: trip.destination,
      }
    });
  } catch (error) {
    logger.error('Get trip time-weather error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to fetch timezone/weather data'));
  }
});

// Generate a shareable link for a trip
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(id);
    
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }
    
    if (trip.user_id !== req.userId) {
      return res.status(403).json(formatError('FORBIDDEN', 'You can only share your own trips'));
    }
    
    const shareCode = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await db.prepare(`
      INSERT INTO trip_shares (trip_id, share_code, expires_at, created_by)
      VALUES (?, ?, ?, ?)
    `).run(id, shareCode, expiresAt, req.userId);
    
    res.json({
      success: true,
      data: {
        shareUrl: `/trips/shared/${shareCode}`,
        expiresAt
      }
    });
  } catch (error) {
    logger.error('Share trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create share link'));
  }
});

// Access a shared trip (for non-logged in users)
router.get('/shared/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    
    const share = await db.prepare(`
      SELECT ts.*, t.name, t.destination, t.start_date, t.end_date, 
             t.budget, t.notes, t.vibe_check, u.name as owner_name
      FROM trip_shares ts
      JOIN trips t ON ts.trip_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE ts.share_code = ?
    `).get(shareCode);
    
    if (!share) {
      return res.status(404).json(formatError('NOT_FOUND', 'Share link not found'));
    }
    
    if (new Date(share.expires_at) < new Date()) {
      return res.status(410).json(formatError('GONE', 'Share link has expired'));
    }
    
    const itinerary = await db.prepare(`
      SELECT id, day_number, date, activities, notes
      FROM itinerary_days
      WHERE trip_id = ?
      ORDER BY day_number
    `).all(share.trip_id);
    
    res.json({
      success: true,
      data: {
        trip: {
          name: share.name,
          destination: share.destination,
          startDate: share.start_date,
          endDate: share.end_date,
          budget: share.budget,
          notes: share.notes,
          vibeCheck: share.vibe_check,
          ownerName: share.owner_name
        },
        itinerary
      }
    });
  } catch (error) {
    logger.error('Access shared trip error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to access shared trip'));
  }
});

// Add collaborator to a trip
router.post('/:id/collaborators', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(id);
    
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }
    
    if (trip.user_id !== req.userId) {
      return res.status(403).json(formatError('FORBIDDEN', 'You can only add collaborators to your own trips'));
    }
    
    if (userId === req.userId) {
      return res.status(400).json(formatError('BAD_REQUEST', 'Cannot add yourself as collaborator'));
    }
    
    const existing = await db.prepare(
      'SELECT id FROM trip_collaborators WHERE trip_id = ? AND user_id = ?'
    ).get(id, userId);
    
    if (existing) {
      return res.status(400).json(formatError('BAD_REQUEST', 'User is already a collaborator'));
    }
    
    await db.prepare(
      'INSERT INTO trip_collaborators (trip_id, user_id, role) VALUES (?, ?, ?)'
    ).run(id, userId, 'editor');
    
    res.json({ success: true, message: 'Collaborator added' });
  } catch (error) {
    logger.error('Add collaborator error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to add collaborator'));
  }
});

// Get collaborators for a trip
router.get('/:id/collaborators', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(id);
    
    if (!trip) {
      return res.status(404).json(formatError('NOT_FOUND', 'Trip not found'));
    }
    
    const isOwner = trip.user_id === req.userId;
    
    const collaborators = await db.prepare(`
      SELECT tc.user_id, tc.role, tc.added_at, u.name, u.email
      FROM trip_collaborators tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.trip_id = ?
    `).all(id);
    
    res.json({ success: true, data: collaborators });
  } catch (error) {
    logger.error('Get collaborators error:', error);
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to get collaborators'));
  }
});

export default router;
