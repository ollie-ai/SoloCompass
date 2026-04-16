import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const transportMutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many transport requests. Please slow down.' }
});

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
  }
  next();
};

const TRANSPORT_TYPES = ['flight', 'train', 'bus', 'ferry', 'car', 'taxi', 'other'];
const TRANSPORT_STATUSES = ['confirmed', 'pending', 'cancelled', 'completed'];

// GET /api/transport/:tripId - List all transport segments for a trip
router.get('/:tripId', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    const segments = await db.prepare(`
      SELECT id, trip_id, type, provider, reference_number, departure_location, arrival_location,
             departure_datetime, arrival_datetime, departure_timezone, arrival_timezone,
             seat, platform, cost, currency, status, flight_number, notes, created_at, updated_at
      FROM transport_segments WHERE trip_id = ? AND user_id = ?
      ORDER BY departure_datetime ASC NULLS LAST
    `).all(tripId, req.userId);

    res.json({
      success: true,
      data: segments.map(s => formatSegment(s))
    });
  } catch (error) {
    logger.error('[Transport] Get error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transport' } });
  }
});

// GET /api/transport/:tripId/:segmentId - Get single segment with boarding pass
router.get('/:tripId/:segmentId', requireAuth, async (req, res) => {
  try {
    const { tripId, segmentId } = req.params;

    const segment = await db.prepare(`
      SELECT id, trip_id, type, provider, reference_number, departure_location, arrival_location,
             departure_datetime, arrival_datetime, departure_timezone, arrival_timezone,
             seat, platform, cost, currency, status, flight_number, notes, created_at, updated_at
      FROM transport_segments WHERE id = ? AND trip_id = ? AND user_id = ?
    `).get(segmentId, tripId, req.userId);

    if (!segment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transport segment not found' } });
    }

    const boardingPass = await db.prepare(`
      SELECT id, file_url, barcode_data, passenger_name, seat, gate, boarding_time, created_at
      FROM boarding_passes WHERE transport_segment_id = ?
    `).get(segmentId);

    res.json({
      success: true,
      data: { ...formatSegment(segment), boardingPass: boardingPass ? formatBoardingPass(boardingPass) : null }
    });
  } catch (error) {
    logger.error('[Transport] Get segment error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transport segment' } });
  }
});

// POST /api/transport/:tripId - Create transport segment
router.post('/:tripId', transportMutateLimiter, requireAuth,
  sanitizeAll(['provider', 'referenceNumber', 'departureLocation', 'arrivalLocation', 'notes', 'flightNumber']),
  [
    body('type').notEmpty().isIn(TRANSPORT_TYPES).withMessage(`Type must be one of: ${TRANSPORT_TYPES.join(', ')}`),
    body('departureLocation').notEmpty().withMessage('Departure location is required'),
    body('arrivalLocation').notEmpty().withMessage('Arrival location is required'),
    body('departureDatetime').optional().isISO8601(),
    body('arrivalDatetime').optional().isISO8601(),
    body('cost').optional().isNumeric(),
    body('status').optional().isIn(TRANSPORT_STATUSES),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId } = req.params;
      const {
        type, provider, referenceNumber, departureLocation, arrivalLocation,
        departureDatetime, arrivalDatetime, departureTimezone, arrivalTimezone,
        seat, platform, cost, currency, status, flightNumber, notes
      } = req.body;

      const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
      if (!trip) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
      }

      const result = await db.prepare(`
        INSERT INTO transport_segments
          (trip_id, user_id, type, provider, reference_number, departure_location, arrival_location,
           departure_datetime, arrival_datetime, departure_timezone, arrival_timezone,
           seat, platform, cost, currency, status, flight_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tripId, req.userId, type, provider || null, referenceNumber || null,
        departureLocation, arrivalLocation,
        departureDatetime || null, arrivalDatetime || null,
        departureTimezone || null, arrivalTimezone || null,
        seat || null, platform || null, cost || null, currency || 'USD',
        status || 'confirmed', flightNumber || null, notes || null
      );

      const segment = await db.prepare(`
        SELECT id, trip_id, type, provider, reference_number, departure_location, arrival_location,
               departure_datetime, arrival_datetime, departure_timezone, arrival_timezone,
               seat, platform, cost, currency, status, flight_number, notes, created_at, updated_at
        FROM transport_segments WHERE id = ?
      `).get(result.lastInsertRowid);

      logger.info(`[Transport] Created segment ${segment.id} for trip ${tripId}`);
      res.status(201).json({ success: true, data: formatSegment(segment) });
    } catch (error) {
      logger.error('[Transport] Create error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create transport segment' } });
    }
  }
);

// PUT /api/transport/:tripId/:segmentId - Update transport segment
router.put('/:tripId/:segmentId', transportMutateLimiter, requireAuth,
  sanitizeAll(['provider', 'referenceNumber', 'departureLocation', 'arrivalLocation', 'notes', 'flightNumber']),
  [
    body('type').optional().isIn(TRANSPORT_TYPES),
    body('status').optional().isIn(TRANSPORT_STATUSES),
    body('cost').optional().isNumeric(),
    body('departureDatetime').optional().isISO8601(),
    body('arrivalDatetime').optional().isISO8601(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId, segmentId } = req.params;

      const existing = await db.prepare('SELECT id FROM transport_segments WHERE id = ? AND trip_id = ? AND user_id = ?').get(segmentId, tripId, req.userId);
      if (!existing) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transport segment not found' } });
      }

      const {
        type, provider, referenceNumber, departureLocation, arrivalLocation,
        departureDatetime, arrivalDatetime, departureTimezone, arrivalTimezone,
        seat, platform, cost, currency, status, flightNumber, notes
      } = req.body;

      const updates = ['updated_at = CURRENT_TIMESTAMP'];
      const params = [];
      const fieldMap = [
        ['type', type], ['provider', provider], ['reference_number', referenceNumber],
        ['departure_location', departureLocation], ['arrival_location', arrivalLocation],
        ['departure_datetime', departureDatetime], ['arrival_datetime', arrivalDatetime],
        ['departure_timezone', departureTimezone], ['arrival_timezone', arrivalTimezone],
        ['seat', seat], ['platform', platform], ['cost', cost], ['currency', currency],
        ['status', status], ['flight_number', flightNumber], ['notes', notes],
      ];
      for (const [col, val] of fieldMap) {
        if (val !== undefined) { updates.push(`${col} = ?`); params.push(val); }
      }

      params.push(segmentId);
      await db.prepare(`UPDATE transport_segments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const segment = await db.prepare(`
        SELECT id, trip_id, type, provider, reference_number, departure_location, arrival_location,
               departure_datetime, arrival_datetime, departure_timezone, arrival_timezone,
               seat, platform, cost, currency, status, flight_number, notes, created_at, updated_at
        FROM transport_segments WHERE id = ?
      `).get(segmentId);

      res.json({ success: true, data: formatSegment(segment) });
    } catch (error) {
      logger.error('[Transport] Update error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update transport segment' } });
    }
  }
);

// DELETE /api/transport/:tripId/:segmentId - Delete transport segment
router.delete('/:tripId/:segmentId', transportMutateLimiter, requireAuth, async (req, res) => {
  try {
    const { tripId, segmentId } = req.params;

    const existing = await db.prepare('SELECT id FROM transport_segments WHERE id = ? AND trip_id = ? AND user_id = ?').get(segmentId, tripId, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transport segment not found' } });
    }

    await db.prepare('DELETE FROM transport_segments WHERE id = ?').run(segmentId);
    logger.info(`[Transport] Deleted segment ${segmentId}`);
    res.json({ success: true, message: 'Transport segment deleted' });
  } catch (error) {
    logger.error('[Transport] Delete error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete transport segment' } });
  }
});

// GET /api/transport/:tripId/:segmentId/status - Get live status (delegates to flight service for flights)
router.get('/:tripId/:segmentId/status', requireAuth, async (req, res) => {
  try {
    const { tripId, segmentId } = req.params;

    const segment = await db.prepare(`
      SELECT id, type, flight_number, departure_datetime, status, departure_location, arrival_location
      FROM transport_segments WHERE id = ? AND trip_id = ? AND user_id = ?
    `).get(segmentId, tripId, req.userId);

    if (!segment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transport segment not found' } });
    }

    // For flights, attempt to get live flight status
    if (segment.type === 'flight' && segment.flight_number) {
      try {
        const { getFlightStatus } = await import('../services/flightService.js');
        const flightStatus = await getFlightStatus(segment.flight_number, segment.departure_datetime);
        return res.json({
          success: true,
          data: {
            segmentId: segment.id,
            type: segment.type,
            liveStatus: flightStatus,
            storedStatus: segment.status,
          }
        });
      } catch (flightErr) {
        logger.warn(`[Transport] Live flight status unavailable: ${flightErr.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        segmentId: segment.id,
        type: segment.type,
        storedStatus: segment.status,
        liveStatus: null,
      }
    });
  } catch (error) {
    logger.error('[Transport] Status error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transport status' } });
  }
});

// POST /api/transport/:tripId/:segmentId/boarding-pass - Store boarding pass info
router.post('/:tripId/:segmentId/boarding-pass', transportMutateLimiter, requireAuth,
  [body('fileUrl').optional(), body('barcodeData').optional()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId, segmentId } = req.params;
      const { fileUrl, barcodeData, passengerName, seat, gate, boardingTime } = req.body;

      const segment = await db.prepare('SELECT id FROM transport_segments WHERE id = ? AND trip_id = ? AND user_id = ?').get(segmentId, tripId, req.userId);
      if (!segment) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transport segment not found' } });
      }

      // Upsert boarding pass
      const existing = await db.prepare('SELECT id FROM boarding_passes WHERE transport_segment_id = ?').get(segmentId);

      let pass;
      if (existing) {
        await db.prepare(`
          UPDATE boarding_passes SET file_url = ?, barcode_data = ?, passenger_name = ?, seat = ?, gate = ?, boarding_time = ?
          WHERE transport_segment_id = ?
        `).run(fileUrl || null, barcodeData || null, passengerName || null, seat || null, gate || null, boardingTime || null, segmentId);
        pass = await db.prepare('SELECT id, file_url, barcode_data, passenger_name, seat, gate, boarding_time, created_at FROM boarding_passes WHERE transport_segment_id = ?').get(segmentId);
      } else {
        const result = await db.prepare(`
          INSERT INTO boarding_passes (transport_segment_id, user_id, file_url, barcode_data, passenger_name, seat, gate, boarding_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(segmentId, req.userId, fileUrl || null, barcodeData || null, passengerName || null, seat || null, gate || null, boardingTime || null);
        pass = await db.prepare('SELECT id, file_url, barcode_data, passenger_name, seat, gate, boarding_time, created_at FROM boarding_passes WHERE id = ?').get(result.lastInsertRowid);
      }

      res.json({ success: true, data: formatBoardingPass(pass) });
    } catch (error) {
      logger.error('[Transport] Boarding pass error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save boarding pass' } });
    }
  }
);

function formatSegment(s) {
  return {
    id: s.id,
    tripId: s.trip_id,
    type: s.type,
    provider: s.provider,
    referenceNumber: s.reference_number,
    departureLocation: s.departure_location,
    arrivalLocation: s.arrival_location,
    departureDatetime: s.departure_datetime,
    arrivalDatetime: s.arrival_datetime,
    departureTimezone: s.departure_timezone,
    arrivalTimezone: s.arrival_timezone,
    seat: s.seat,
    platform: s.platform,
    cost: s.cost,
    currency: s.currency,
    status: s.status,
    flightNumber: s.flight_number,
    notes: s.notes,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function formatBoardingPass(p) {
  return {
    id: p.id,
    fileUrl: p.file_url,
    barcodeData: p.barcode_data,
    passengerName: p.passenger_name,
    seat: p.seat,
    gate: p.gate,
    boardingTime: p.boarding_time,
    createdAt: p.created_at,
  };
}

export default router;
