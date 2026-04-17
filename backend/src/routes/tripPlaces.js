import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
  }
  next();
};

const VALID_CATEGORIES = ['accommodation', 'restaurant', 'attraction', 'transport', 'other'];
const VALID_STATUSES = ['want_to_visit', 'planned', 'visited', 'skipped'];

const tripPlaceValidation = {
  create: [
    body('name').notEmpty().withMessage('Name is required'),
    body('place_id').optional(),
    body('address').optional(),
    body('category').optional().isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('status').optional().isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
    body('latitude').optional().isNumeric(),
    body('longitude').optional().isNumeric(),
    body('userRating').optional().isInt({ min: 1, max: 5 }),
    body('visitDate').optional().isISO8601(),
    body('notes').optional(),
  ],
  update: [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('place_id').optional(),
    body('address').optional(),
    body('category').optional().isIn(VALID_CATEGORIES),
    body('status').optional().isIn(VALID_STATUSES),
    body('latitude').optional().isNumeric(),
    body('longitude').optional().isNumeric(),
    body('userRating').optional().isInt({ min: 1, max: 5 }),
    body('visitDate').optional().isISO8601(),
    body('notes').optional(),
  ],
};

function formatPlace(p) {
  return {
    id: p.id,
    tripId: p.trip_id,
    placeId: p.place_id,
    name: p.name,
    address: p.address,
    category: p.category,
    status: p.status || 'want_to_visit',
    latitude: p.latitude,
    longitude: p.longitude,
    userRating: p.user_rating,
    notes: p.notes,
    visitDate: p.visit_date,
    createdAt: p.created_at,
  };
}

router.get('/:tripId/places', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    const places = await db.prepare(`
      SELECT id, trip_id, place_id, name, address, category, status, latitude, longitude,
             user_rating, notes, visit_date, created_at
      FROM trip_places WHERE trip_id = ? ORDER BY created_at DESC
    `).all(tripId);

    res.json({ success: true, data: places.map(formatPlace) });
  } catch (error) {
    logger.error('[TripPlaces] Get error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trip places' } });
  }
});

router.post('/:tripId/places', requireAuth, sanitizeAll(['name', 'address', 'notes']), tripPlaceValidation.create, handleValidationErrors, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, place_id, address, category, status, latitude, longitude, userRating, notes, visitDate } = req.body;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    const result = await db.prepare(`
      INSERT INTO trip_places (trip_id, user_id, name, place_id, address, category, status, latitude, longitude, user_rating, notes, visit_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tripId, req.userId, name, place_id || null, address || null,
      category || 'other', status || 'want_to_visit',
      latitude || null, longitude || null, userRating || null,
      notes || null, visitDate || null
    );

    const place = await db.prepare(`
      SELECT id, trip_id, place_id, name, address, category, status, latitude, longitude,
             user_rating, notes, visit_date, created_at
      FROM trip_places WHERE id = ?
    `).get(result.lastInsertRowid);

    logger.info(`[TripPlaces] Created place ${place.id} for trip ${tripId}`);
    res.status(201).json({ success: true, data: formatPlace(place) });
  } catch (error) {
    logger.error('[TripPlaces] Create error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create trip place' } });
  }
});

router.put('/:id', requireAuth, sanitizeAll(['name', 'address', 'notes']), tripPlaceValidation.update, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, place_id, address, category, status, latitude, longitude, userRating, notes, visitDate } = req.body;

    const existing = await db.prepare('SELECT * FROM trip_places WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip place not found' } });
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (place_id !== undefined) { updates.push('place_id = ?'); params.push(place_id); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
    if (userRating !== undefined) { updates.push('user_rating = ?'); params.push(userRating); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (visitDate !== undefined) { updates.push('visit_date = ?'); params.push(visitDate); }

    if (updates.length === 1) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No fields to update' } });
    }

    params.push(id);
    await db.prepare(`UPDATE trip_places SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const place = await db.prepare(`
      SELECT id, trip_id, place_id, name, address, category, status, latitude, longitude,
             user_rating, notes, visit_date, created_at
      FROM trip_places WHERE id = ?
    `).get(id);

    logger.info(`[TripPlaces] Updated place ${id}`);
    res.json({ success: true, data: formatPlace(place) });
  } catch (error) {
    logger.error('[TripPlaces] Update error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update trip place' } });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.prepare('SELECT * FROM trip_places WHERE id = ? AND user_id = ?').get(id, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip place not found' } });
    }

    await db.prepare('DELETE FROM trip_places WHERE id = ?').run(id);

    logger.info(`[TripPlaces] Deleted place ${id}`);
    res.json({ success: true, message: 'Trip place deleted' });
  } catch (error) {
    logger.error('[TripPlaces] Delete error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete trip place' } });
  }
});

export default router;

