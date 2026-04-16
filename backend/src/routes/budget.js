import express from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();

const CATEGORIES = ['accommodation', 'transport', 'food', 'activities', 'shopping', 'health', 'communication', 'other'];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'THB', 'KRW', 'SGD', 'NZD', 'ZAR'];

async function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  
  try {
    const baseUrl = process.env.FRANKFURTER_BASE_URL || 'https://api.frankfurter.app';
    const response = await fetch(`${baseUrl}/latest?amount=${amount}&from=${from}&to=${to}`);
    if (!response.ok) throw new Error('Conversion failed');
    const data = await response.json();
    return data.rates ? data.rates[to] : amount;
  } catch (error) {
    logger.error('Currency conversion error:', error);
    return amount;
  }
}

router.get('/currencies', async (req, res) => {
  try {
    res.json({
      success: true,
      data: CURRENCIES
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch currencies' });
  }
});

router.get('/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { targetCurrency } = req.query;

    let budget = await db.prepare(`
      SELECT id, user_id, trip_id, total_budget, currency, created_at, updated_at FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.json({ success: true, data: null });
    }

    let items = await db.prepare(`
      SELECT id, budget_id, category, description, amount, original_amount, original_currency, type, created_at, updated_at FROM budget_items WHERE budget_id = ? ORDER BY created_at DESC
    `).all(budget.id);

    let totalSpent = 0;
    let totalIncome = 0;

    items = await Promise.all(items.map(async (item) => {
      let amount = item.amount;
      if (targetCurrency && item.original_currency !== targetCurrency) {
        amount = await convertCurrency(item.original_amount || item.amount, item.original_currency, targetCurrency);
      }
      
      if (item.type === 'expense') {
        totalSpent += Number(amount);
      } else {
        totalIncome += Number(amount);
      }

      return {
        id: item.id,
        category: item.category,
        description: item.description,
        amount: amount,
        originalAmount: item.original_amount || item.amount,
        originalCurrency: item.original_currency,
        type: item.type,
        createdAt: item.created_at
      };
    }));

    let convertedTotal = budget.total_budget;
    let targetCurrencyCode = budget.currency;
    
    if (targetCurrency && budget.currency !== targetCurrency) {
      convertedTotal = await convertCurrency(budget.total_budget, budget.currency, targetCurrency);
      targetCurrencyCode = targetCurrency;
    }

    res.json({
      success: true,
      data: {
        id: budget.id,
        tripId: budget.trip_id,
        totalBudget: convertedTotal,
        currency: targetCurrencyCode,
        originalCurrency: budget.currency,
        totalSpent: Number(totalSpent),
        totalIncome: Number(totalIncome),
        remaining: Number(convertedTotal) - Number(totalSpent) + Number(totalIncome),
        items
      }
    });
  } catch (error) {
    logger.error('Error fetching budget:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget' });
  }
});

router.post('/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { totalBudget, currency = 'USD', dailyTarget } = req.body;

    if (totalBudget === undefined || totalBudget < 0) {
      return res.status(400).json({ success: false, error: 'Valid total budget is required' });
    }

    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ success: false, error: 'Invalid currency' });
    }

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    let budget = await db.prepare('SELECT id, user_id, trip_id, total_budget, currency, daily_target, created_at, updated_at FROM budgets WHERE trip_id = ? AND user_id = ?').get(tripId, req.userId);

    if (budget) {
      await db.prepare(`
        UPDATE budgets SET total_budget = ?, currency = ?, daily_target = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(totalBudget, currency, dailyTarget || null, budget.id);
      budget = await db.prepare('SELECT id, user_id, trip_id, total_budget, currency, daily_target, created_at, updated_at FROM budgets WHERE id = ?').get(budget.id);
    } else {
      const result = await db.prepare(`
        INSERT INTO budgets (user_id, trip_id, total_budget, currency, daily_target) VALUES (?, ?, ?, ?, ?)
      `).run(req.userId, tripId, totalBudget, currency, dailyTarget || null);
      budget = await db.prepare('SELECT id, user_id, trip_id, total_budget, currency, daily_target, created_at, updated_at FROM budgets WHERE id = ?').get(result.lastInsertRowid);
    }

    // Sync trip budget
    await db.prepare('UPDATE trips SET budget = ? WHERE id = ?').run(totalBudget, tripId);

    res.json({
      success: true,
      data: {
        id: budget.id,
        tripId: budget.trip_id,
        totalBudget: budget.total_budget,
        currency: budget.currency,
        dailyTarget: budget.daily_target,
        totalSpent: 0,
        totalIncome: 0,
        remaining: budget.total_budget,
        items: []
      }
    });
  } catch (error) {
    logger.error('Error creating budget:', error);
    res.status(500).json({ success: false, error: 'Failed to create budget' });
  }
});

router.get('/:tripId/summary', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { targetCurrency } = req.query;

    const budget = await db.prepare(`
      SELECT id, user_id, trip_id, total_budget, currency, daily_target, created_at, updated_at FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.json({ success: true, data: null });
    }

    // Get trip dates to compute days elapsed / total
    const trip = await db.prepare('SELECT start_date, end_date FROM trips WHERE id = ?').get(tripId);
    const tripDays = trip?.start_date && trip?.end_date
      ? Math.max(1, Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)) + 1)
      : null;
    const daysElapsed = trip?.start_date
      ? Math.max(1, Math.ceil((new Date() - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)))
      : null;

    const items = await db.prepare(`
      SELECT category, type, amount, original_currency, original_amount 
      FROM budget_items WHERE budget_id = ?
    `).all(budget.id);

    let byCategory = {};
    let totalSpent = 0;
    let totalIncome = 0;

    for (const item of items) {
      let amount = item.amount;
      if (targetCurrency && item.original_currency !== targetCurrency) {
        amount = await convertCurrency(item.original_amount || item.amount, item.original_currency, targetCurrency);
      }

      if (!byCategory[item.category]) {
        byCategory[item.category] = { spent: 0, income: 0 };
      }

      if (item.type === 'expense') {
        byCategory[item.category].spent += Number(amount);
        totalSpent += Number(amount);
      } else {
        byCategory[item.category].income += Number(amount);
        totalIncome += Number(amount);
      }
    }

    let totalBudget = budget.total_budget;
    let dailyTarget = budget.daily_target;
    let displayCurrency = budget.currency;
    
    if (targetCurrency && budget.currency !== targetCurrency) {
      totalBudget = await convertCurrency(budget.total_budget, budget.currency, targetCurrency);
      if (dailyTarget) {
        dailyTarget = await convertCurrency(dailyTarget, budget.currency, targetCurrency);
      }
      displayCurrency = targetCurrency;
    }

    const dailyAverage = daysElapsed && totalSpent > 0 ? Number(totalSpent) / daysElapsed : null;

    res.json({
      success: true,
      data: {
        totalBudget,
        currency: displayCurrency,
        totalSpent: Number(totalSpent),
        totalIncome: Number(totalIncome),
        remaining: Number(totalBudget) - Number(totalSpent) + Number(totalIncome),
        dailyTarget,
        dailyAverage,
        tripDays,
        daysElapsed,
        byCategory
      }
    });
  } catch (error) {
    logger.error('Error fetching summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
});

router.post('/:tripId/items', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { category, description, amount, currency = 'USD', type = 'expense' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ success: false, error: 'Invalid currency' });
    }

    if (!['expense', 'income'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    const budget = await db.prepare(`
      SELECT id, user_id, trip_id, total_budget, currency FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found. Create a budget first.' });
    }

    const convertedAmount = await convertCurrency(amount, currency, budget.currency);

    const result = await db.prepare(`
      INSERT INTO budget_items (budget_id, category, description, amount, original_amount, original_currency, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(budget.id, category, description || null, convertedAmount, amount, currency, type);

    const item = await db.prepare('SELECT id, budget_id, category, description, amount, original_amount, original_currency, type, created_at FROM budget_items WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        category: item.category,
        description: item.description,
        amount: item.amount,
        originalAmount: item.original_amount,
        originalCurrency: item.original_currency,
        type: item.type,
        createdAt: item.created_at
      }
    });
  } catch (error) {
    logger.error('Error adding item:', error);
    res.status(500).json({ success: false, error: 'Failed to add item' });
  }
});

router.put('/:tripId/items/:id', authenticate, async (req, res) => {
  try {
    const { tripId, id } = req.params;
    const { category, description, amount, currency, type } = req.body;

    const budget = await db.prepare(`
      SELECT id, user_id, trip_id, total_budget, currency FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    const item = await db.prepare('SELECT id, budget_id, category, description, amount, original_amount, original_currency, type, created_at, updated_at FROM budget_items WHERE id = ? AND budget_id = ?').get(id, budget.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];

    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: 'Invalid category' });
      }
      updates.push('category = ?');
      params.push(category);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (amount !== undefined) {
      const useCurrency = currency && CURRENCIES.includes(currency) ? currency : item.original_currency;
      const convertedAmount = await convertCurrency(amount, useCurrency, budget.currency);
      updates.push('amount = ?, original_amount = ?, original_currency = ?');
      params.push(convertedAmount, amount, useCurrency);
    }

    if (type !== undefined) {
      if (!['expense', 'income'].includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid type' });
      }
      updates.push('type = ?');
      params.push(type);
    }

    params.push(id);
    await db.prepare(`UPDATE budget_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await db.prepare('SELECT id, budget_id, category, description, amount, original_amount, original_currency, type, created_at, updated_at FROM budget_items WHERE id = ?').get(id);

    res.json({
      success: true,
      data: {
        id: updated.id,
        category: updated.category,
        description: updated.description,
        amount: updated.amount,
        originalAmount: updated.original_amount,
        originalCurrency: updated.original_currency,
        type: updated.type,
        createdAt: updated.created_at
      }
    });
  } catch (error) {
    logger.error('Error updating item:', error);
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

router.delete('/:tripId/items/:id', authenticate, async (req, res) => {
  try {
    const { tripId, id } = req.params;

    const budget = await db.prepare(`
      SELECT id, user_id, trip_id, total_budget, currency FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    const item = await db.prepare('SELECT id, budget_id, category, description, amount, original_amount, original_currency, type, created_at, updated_at FROM budget_items WHERE id = ? AND budget_id = ?').get(id, budget.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await db.prepare('DELETE FROM budget_items WHERE id = ?').run(id);

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    logger.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// GET /:tripId/export-csv - Export budget items as CSV
router.get('/:tripId/export-csv', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const budget = await db.prepare(`
      SELECT id, currency FROM budgets WHERE trip_id = ? AND user_id = ?
    `).get(tripId, req.userId);

    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    const items = await db.prepare(`
      SELECT category, description, amount, original_amount, original_currency, type, created_at
      FROM budget_items WHERE budget_id = ? ORDER BY created_at ASC
    `).all(budget.id);

    const trip = await db.prepare('SELECT name FROM trips WHERE id = ?').get(tripId);
    const tripName = (trip?.name || 'trip').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    const csvRows = [
      ['Date', 'Category', 'Description', 'Amount', 'Currency', 'Original Amount', 'Original Currency', 'Type'],
      ...items.map(i => [
        new Date(i.created_at).toISOString().split('T')[0],
        i.category,
        `"${(i.description || '').replace(/"/g, '""')}"`,
        i.amount,
        budget.currency,
        i.original_amount || i.amount,
        i.original_currency,
        i.type,
      ])
    ];

    const csv = csvRows.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${tripName}_budget.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting budget CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to export budget' });
  }
});

export default router;
