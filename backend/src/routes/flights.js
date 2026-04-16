import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { getFlightStatus, getFlightById } from '../services/flightService.js';
import { searchFlights } from '../services/flightSearch.js';
import logger from '../services/logger.js';

const router = express.Router();

router.use(authenticate);

const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY;

const requireApiKey = (req, res, next) => {
  if (!AVIATIONSTACK_API_KEY) {
    return res.status(503).json({
      error: 'Flight API not configured',
      message: 'AviationStack API key not set in environment'
    });
  }
  next();
};

const flightSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.userId || 'anon'}:flight-search`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded', message: 'Maximum 5 flight searches per minute' },
});

/**
 * GET /flights/search?flight_number=BA123&date=2026-04-15
 * Search for flight status by flight number and date
 */
router.get('/search', async (req, res) => {
  try {
    const { flight_number, date, origin, destination, returnDate, passengers } = req.query;

    // Flight offers search mode
    if (origin || destination) {
      if (!origin || !destination || !date) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'origin, destination and date are required',
        });
      }
      return flightSearchLimiter(req, res, async () => {
        const options = await searchFlights({
          origin: String(origin).toUpperCase(),
          destination: String(destination).toUpperCase(),
          date: String(date),
          returnDate: returnDate ? String(returnDate) : undefined,
          passengers: passengers ? Math.max(1, parseInt(passengers, 10)) : 1,
        });
        return res.json({ success: true, data: options, count: options.length });
      });
    }

    if (!flight_number) {
      return res.status(400).json({
        error: 'Missing flight number',
        message: 'flight_number query parameter is required'
      });
    }

    if (!date) {
      return res.status(400).json({
        error: 'Missing date',
        message: 'date query parameter is required (format: YYYY-MM-DD)'
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    if (!AVIATIONSTACK_API_KEY) {
      return res.status(503).json({
        error: 'Flight API not configured',
        message: 'AviationStack API key not set in environment',
      });
    }

    const flight = await getFlightStatus(flight_number, date, AVIATIONSTACK_API_KEY);

    if (!flight) {
      return res.status(404).json({
        error: 'Flight not found',
        message: `No flight found for ${flight_number} on ${date}`
      });
    }

    res.json({ success: true, data: flight });
  } catch (error) {
    logger.error(`[Flights] Search failed: ${error.response?.data || error.message}`);

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Flight not found',
        message: 'No flight found matching the given criteria'
      });
    }

    if (error.response?.data?.error) {
      return res.status(400).json({
        error: 'Flight lookup failed',
        message: error.response.data.error.message
      });
    }

    res.status(500).json({
      error: 'Flight search failed',
      message: 'Failed to fetch flight information'
    });
  }
});

/**
 * GET /flights/:id/status
 * Get flight status by flight ID
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    if (!AVIATIONSTACK_API_KEY) {
      return res.status(503).json({
        error: 'Flight API not configured',
        message: 'AviationStack API key not set in environment'
      });
    }

    const flight = await getFlightById(id, AVIATIONSTACK_API_KEY);

    if (!flight) {
      return res.status(404).json({
        error: 'Flight not found',
        message: 'No flight found with the given ID'
      });
    }

    res.json({ success: true, data: flight });
  } catch (error) {
    logger.error(`[Flights] Status fetch failed: ${error.response?.data || error.message}`);

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Flight not found',
        message: 'No flight found with the given ID'
      });
    }

    res.status(500).json({
      error: 'Flight status fetch failed',
      message: 'Failed to fetch flight status'
    });
  }
});

export default router;
