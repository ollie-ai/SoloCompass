import express from 'express';
import fetch from 'node-fetch';
import { authenticate } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();

router.use(authenticate);

// Simple proxy to Frankfurter Exchange Rates API
// Example: /api/exchange?base GBP&symbols EUR
router.get('/', async (req, res) => {
  const base = req.query.base || 'GBP';
  const symbols = req.query.symbols || 'EUR';
  const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols)}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json({ success: true, data: data.rates || {} });
  } catch (err) {
    logger.error(`[Exchange] Fetch failed: ${err.message}`);
    res.status(500).json({ success: false, error: 'Exchange fetch failed' });
  }
});

// GET /exchange-rates?base=GBP&symbols=EUR,USD
router.get('/rates', async (req, res) => {
  const base = req.query.base || 'GBP';
  const symbols = req.query.symbols || '';
  const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(base)}${symbols ? `&symbols=${encodeURIComponent(symbols)}` : ''}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json({
      success: true,
      data: {
        base: data.base || base,
        date: data.date || null,
        rates: data.rates || {}
      }
    });
  } catch (err) {
    logger.error(`[Exchange] Rates fetch failed: ${err.message}`);
    res.status(500).json({ success: false, error: 'Exchange rates fetch failed' });
  }
});

export default router;
