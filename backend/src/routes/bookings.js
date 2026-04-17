import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { createNotification } from '../services/notificationService.js';
import { sendTemplateEmail } from '../services/resendClient.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/:tripId/bookings', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const bookings = await db.prepare(`
      SELECT id, trip_id, type, provider, confirmation_number, booking_reference, booking_date, travel_date, return_date, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, reference, notes, status, created_at, updated_at FROM bookings WHERE trip_id = ?
      ORDER BY departure_datetime ASC
    `).all(tripId);

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    logger.error('Get bookings error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings' } });
  }
});

router.post('/:tripId/bookings', requireAuth, sanitizeAll(['provider', 'departure_location', 'arrival_location', 'notes']), [
  body('type').notEmpty().withMessage('Booking type is required')
    .isIn(['flight', 'train', 'bus', 'ferry', 'activity', 'restaurant', 'other'])
    .withMessage('Invalid booking type'),
  body('provider').optional().isString(),
  body('departure_location').optional().isString(),
  body('arrival_location').optional().isString(),
  body('departure_datetime').optional().isISO8601().withMessage('Invalid departure datetime'),
  body('arrival_datetime').optional().isISO8601().withMessage('Invalid arrival datetime'),
  body('cost').optional().isNumeric().withMessage('Cost must be a number'),
  body('currency').optional().isString(),
], handleValidationErrors, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { type, provider, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, notes, reference, status } = req.body;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const result = await db.prepare(`
      INSERT INTO bookings (trip_id, type, provider, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, reference, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tripId,
      type,
      provider || null,
      departure_location || null,
      arrival_location || null,
      departure_datetime || null,
      arrival_datetime || null,
      cost || null,
      currency || 'GBP',
      reference || null,
      status || 'pending',
      notes || null
    );

    const booking = await db.prepare('SELECT id, trip_id, type, provider, confirmation_number, booking_reference, booking_date, travel_date, return_date, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, reference, notes, status, created_at, updated_at FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    // Send booking confirmation email (fire-and-forget)
    try {
      const userRow = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.userId);
      const tripRow = await db.prepare('SELECT name, destination FROM trips WHERE id = ?').get(tripId);
      if (userRow?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        await sendTemplateEmail(userRow.email, 'booking_confirmation', {
          name: userRow.name || 'Traveller',
          tripName: tripRow?.name || 'your trip',
          bookingType: type,
          provider: provider || 'N/A',
          departureLocation: departure_location || 'N/A',
          arrivalLocation: arrival_location || 'N/A',
          departureDate: departure_datetime ? new Date(departure_datetime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A',
          confirmationNumber: reference || '',
          tripUrl: `${frontendUrl}/trips/${tripId}`,
          year: new Date().getFullYear().toString(),
          unsubscribeUrl: `${frontendUrl}/settings?tab=notifications`,
        });
      }
    } catch (emailErr) {
      logger.warn(`[Bookings] Confirmation email failed: ${emailErr.message}`);
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    logger.error('Create booking error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' } });
  }
});

router.put('/:id', requireAuth, sanitizeAll(['provider', 'departure_location', 'arrival_location', 'notes']), [
  body('type').optional().isIn(['flight', 'train', 'bus', 'ferry', 'activity', 'restaurant', 'other']),
  body('provider').optional({ nullable: true, checkFalsy: true }).isString(),
  body('departure_location').optional({ nullable: true, checkFalsy: true }).isString(),
  body('arrival_location').optional({ nullable: true, checkFalsy: true }).isString(),
  body('departure_datetime').optional().isISO8601(),
  body('arrival_datetime').optional().isISO8601(),
  body('cost').optional().isNumeric(),
  body('currency').optional().isString(),
  body('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed']),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, provider, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, reference, status, notes } = req.body;

    const booking = await db.prepare(`
      SELECT b.id, b.trip_id, b.type FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      WHERE b.id = ? AND t.user_id = ?
    `).get(id, req.userId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updates = [];
    const params = [];

    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (provider !== undefined) { updates.push('provider = ?'); params.push(provider); }
    if (departure_location !== undefined) { updates.push('departure_location = ?'); params.push(departure_location); }
    if (arrival_location !== undefined) { updates.push('arrival_location = ?'); params.push(arrival_location); }
    if (departure_datetime !== undefined) { updates.push('departure_datetime = ?'); params.push(departure_datetime); }
    if (arrival_datetime !== undefined) { updates.push('arrival_datetime = ?'); params.push(arrival_datetime); }
    if (cost !== undefined) { updates.push('cost = ?'); params.push(cost); }
    if (currency !== undefined) { updates.push('currency = ?'); params.push(currency); }
    if (reference !== undefined) { updates.push('reference = ?'); params.push(reference); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await db.prepare('SELECT id, trip_id, type, provider, confirmation_number, booking_reference, booking_date, travel_date, return_date, departure_location, arrival_location, departure_datetime, arrival_datetime, cost, currency, reference, notes, status, created_at, updated_at FROM bookings WHERE id = ?').get(id);

    const trip = await db.prepare('SELECT user_id, type FROM trips WHERE id = ?').get(booking.trip_id);
    if (trip) {
      await createNotification(
        trip.user_id,
        'booking_change',
        'Booking Updated',
        `Your ${type || booking.type} booking has been updated`,
        { bookingId: id, tripId: booking.trip_id }
      );
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update booking error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' } });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await db.prepare(`
      SELECT b.id, b.trip_id, b.type FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      WHERE b.id = ? AND t.user_id = ?
    `).get(id, req.userId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.prepare('DELETE FROM bookings WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Booking deleted'
    });
  } catch (error) {
    logger.error('Delete booking error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete booking' } });
  }
});

export default router;
