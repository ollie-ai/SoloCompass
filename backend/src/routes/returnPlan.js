import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, FEATURES } from '../middleware/paywall.js';
import { createNotification } from '../services/notificationService.js';
import logger from '../services/logger.js';

const router = express.Router();

const returnPlanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many return plan requests. Please wait.' }
});

// POST /return-plan - Create a return plan (Guardian+ only)
router.post('/', authenticate, returnPlanLimiter, requireFeature(FEATURES.SAFE_RETURN_TIMER), async (req, res) => {
  try {
    const userId = req.userId;
    const {
      tripId,
      embassyName,
      embassyAddress,
      embassyPhone,
      embassyEmail,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      nearestAirport,
      airportCode,
      flightBack,
      flightBackDate,
      accommodationName,
      accommodationAddress,
      accommodationPhone,
      emergencyFundAmount,
      emergencyFundCurrency = 'USD',
      notes
    } = req.body;

    const result = await db.prepare(`
      INSERT INTO safe_return_plans (
        user_id, trip_id, embassy_name, embassy_address, embassy_phone, embassy_email,
        hospital_name, hospital_address, hospital_phone,
        nearest_airport, airport_code, flight_back, flight_back_date,
        accommodation_name, accommodation_address, accommodation_phone,
        emergency_fund_amount, emergency_fund_currency, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      userId, tripId || null,
      embassyName || null, embassyAddress || null, embassyPhone || null, embassyEmail || null,
      hospitalName || null, hospitalAddress || null, hospitalPhone || null,
      nearestAirport || null, airportCode || null, flightBack || null, flightBackDate || null,
      accommodationName || null, accommodationAddress || null, accommodationPhone || null,
      emergencyFundAmount || null, emergencyFundCurrency, notes || null
    );

    const plan = await db.prepare(`
      SELECT * FROM safe_return_plans WHERE id = ?
    `).get(result.lastInsertRowid);

    logger.info(`[ReturnPlan] Created plan ${result.lastInsertRowid} for user ${userId}`);

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error('[ReturnPlan] Error creating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to create return plan' });
  }
});

// GET /return-plan?tripId=X - Get return plan
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const { tripId } = req.query;

    let query = `SELECT * FROM safe_return_plans WHERE user_id = ?`;
    const params = [userId];

    if (tripId) {
      query += ' AND trip_id = ?';
      params.push(tripId);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const plan = await db.prepare(query).get(...params);

    res.json({ success: true, data: plan || null });
  } catch (error) {
    logger.error('[ReturnPlan] Error fetching plan:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch return plan' });
  }
});

// PUT /return-plan/:id - Update return plan
router.put('/:id', authenticate, returnPlanLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const plan = await db.prepare(`
      SELECT id FROM safe_return_plans WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Return plan not found' });
    }

    const allowedFields = [
      'embassy_name', 'embassy_address', 'embassy_phone', 'embassy_email',
      'hospital_name', 'hospital_address', 'hospital_phone',
      'nearest_airport', 'airport_code', 'flight_back', 'flight_back_date',
      'accommodation_name', 'accommodation_address', 'accommodation_phone',
      'emergency_fund_amount', 'emergency_fund_currency', 'notes', 'status'
    ];

    const fieldMap = {
      embassyName: 'embassy_name', embassyAddress: 'embassy_address',
      embassyPhone: 'embassy_phone', embassyEmail: 'embassy_email',
      hospitalName: 'hospital_name', hospitalAddress: 'hospital_address',
      hospitalPhone: 'hospital_phone', nearestAirport: 'nearest_airport',
      airportCode: 'airport_code', flightBack: 'flight_back', flightBackDate: 'flight_back_date',
      accommodationName: 'accommodation_name', accommodationAddress: 'accommodation_address',
      accommodationPhone: 'accommodation_phone', emergencyFundAmount: 'emergency_fund_amount',
      emergencyFundCurrency: 'emergency_fund_currency', notes: 'notes', status: 'status'
    };

    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (req.body[camel] !== undefined) {
        updates.push(`${snake} = ?`);
        params.push(req.body[camel]);
      }
    }

    if (updates.length === 1) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    await db.prepare(`
      UPDATE safe_return_plans SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    const updated = await db.prepare(`SELECT * FROM safe_return_plans WHERE id = ?`).get(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ReturnPlan] Error updating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to update return plan' });
  }
});

// POST /return-plan/:id/activate - Activate plan and notify guardians (Guardian+ only)
router.post('/:id/activate', authenticate, returnPlanLimiter, requireFeature(FEATURES.SAFE_RETURN_TIMER), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const plan = await db.prepare(`
      SELECT * FROM safe_return_plans WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Return plan not found' });
    }

    await db.prepare(`
      UPDATE safe_return_plans
      SET status = 'activated', activated_at = CURRENT_TIMESTAMP, shared_with_guardians = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    await createNotification(
      userId,
      'return_plan_activated',
      'Safe Return Plan Activated',
      'Your safe return plan has been activated and shared with your guardians.',
      { returnPlanId: id }
    );

    logger.info(`[ReturnPlan] Plan ${id} activated for user ${userId}`);

    res.json({ success: true, message: 'Return plan activated and shared with guardians' });
  } catch (error) {
    logger.error('[ReturnPlan] Error activating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to activate return plan' });
  }
});

export default router;
