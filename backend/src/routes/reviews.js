import express from 'express';
import db from '../db.js';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();

const VENUE_TYPES = ['restaurant', 'hotel', 'attraction', 'transport', 'other'];

const PROFANITY_LIST = ['spam', 'scam', 'fake']; // Minimal list - expand as needed
const containsProfanity = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some(word => lower.includes(word));
};

// GET /reviews - List reviews with filters (public endpoint)
router.get('/', async (req, res) => {
  try {
    const {
      destination,
      venue_type,
      min_rating,
      solo_only,
      sort = 'newest',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['r.status = \'approved\''];
    const params = [];

    // Build conditions
    if (destination) {
      conditions.push(`LOWER(r.destination) LIKE LOWER(?)`);
      params.push(`%${destination}%`);
    }

    if (venue_type && VENUE_TYPES.includes(venue_type)) {
      conditions.push('r.venue_type = ?');
      params.push(venue_type);
    }

    if (min_rating) {
      conditions.push('r.overall_rating >= ?');
      params.push(parseInt(min_rating));
    }

    if (solo_only === 'true') {
      conditions.push('r.is_verified = true');
    }

    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Sort options
    let orderClause = 'ORDER BY r.created_at DESC';
    if (sort === 'helpful') {
      orderClause = 'ORDER BY r.helpful_count DESC, r.created_at DESC';
    } else if (sort === 'highest') {
      orderClause = 'ORDER BY r.overall_rating DESC, r.created_at DESC';
    }

    // Get reviews with user info
    const reviewsQuery = `
      SELECT 
        r.id, r.destination, r.venue_name, r.venue_address, r.venue_type,
        r.overall_rating, r.solo_friendly_rating, r.safety_rating, r.value_rating,
        r.title, r.content, r.tags, r.photos, r.is_verified, r.helpful_count,
        r.created_at, r.updated_at,
        u.name as author_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const reviews = await db.all(reviewsQuery, ...params, parseInt(limit), offset);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM reviews r ${whereClause}`;
    const countResult = await db.get(countQuery, ...params);
    const total = countResult?.total || 0;

    // Get stats
    const statsQuery = `
      SELECT 
        AVG(r.overall_rating) as avg_overall,
        AVG(r.solo_friendly_rating) as avg_solo_friendly,
        AVG(r.safety_rating) as avg_safety,
        AVG(r.value_rating) as avg_value,
        COUNT(*) as count
      FROM reviews r
      ${whereClause}
    `;
    const stats = await db.get(statsQuery, ...params);

    // Format reviews
    const formattedReviews = reviews.map(r => ({
      id: r.id,
      userId: r.user_id,
      destination: r.destination,
      venueName: r.venue_name,
      venueAddress: r.venue_address,
      venueType: r.venue_type,
      overallRating: r.overall_rating,
      soloFriendlyRating: r.solo_friendly_rating,
      safetyRating: r.safety_rating,
      valueRating: r.value_rating,
      title: r.title,
      content: r.content,
      tags: r.tags ? JSON.parse(r.tags) : [],
      photos: r.photos ? JSON.parse(r.photos) : [],
      isVerified: Boolean(r.is_verified),
      helpfulCount: r.helpful_count,
      author: {
        name: r.author_name
      },
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({
      success: true,
      data: {
        reviews: formattedReviews,
        stats: {
          averageRating: stats?.avg_overall ? Math.round(stats.avg_overall * 10) / 10 : 0,
          soloFriendlyAvg: stats?.avg_solo_friendly ? Math.round(stats.avg_solo_friendly * 10) / 10 : 0,
          safetyAvg: stats?.avg_safety ? Math.round(stats.avg_safety * 10) / 10 : 0,
          valueAvg: stats?.avg_value ? Math.round(stats.avg_value * 10) / 10 : 0,
          count: stats?.count || 0
        }
      },
      meta: {
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCount: total
      }
    });
  } catch (error) {
    logger.error(`[Reviews] Failed to fetch reviews: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

// GET /reviews/:id - Get single review
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const review = await db.get(`
      SELECT 
        r.id, r.destination, r.venue_name, r.venue_address, r.venue_type,
        r.overall_rating, r.solo_friendly_rating, r.safety_rating, r.value_rating,
        r.title, r.content, r.tags, r.photos, r.is_verified, r.helpful_count,
        r.created_at, r.updated_at,
        u.name as author_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, id);

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      data: {
        id: review.id,
        userId: review.user_id,
        destination: review.destination,
        venueName: review.venue_name,
        venueAddress: review.venue_address,
        venueType: review.venue_type,
        overallRating: review.overall_rating,
        soloFriendlyRating: review.solo_friendly_rating,
        safetyRating: review.safety_rating,
        valueRating: review.value_rating,
        title: review.title,
        content: review.content,
        tags: review.tags ? JSON.parse(review.tags) : [],
        photos: review.photos ? JSON.parse(review.photos) : [],
        isVerified: Boolean(review.is_verified),
        helpfulCount: review.helpful_count,
        author: {
          name: review.author_name
        },
        createdAt: review.created_at,
        updatedAt: review.updated_at
      }
    });
  } catch (error) {
    logger.error(`[Reviews] Failed to fetch review: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch review' });
  }
});

// POST /reviews - Create new review
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      destination,
      venueName,
      venueAddress,
      venueType = 'other',
      overallRating,
      soloFriendlyRating,
      safetyRating,
      valueRating,
      title,
      content,
      tags = [],
      photos = [],
      destinationId,
      visitedDate
    } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and content are required' 
      });
    }

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Overall rating must be between 1 and 5' 
      });
    }

    if (content.length < 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Review content must be at least 50 characters' 
      });
    }

    if (containsProfanity(content) || containsProfanity(title)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Review contains inappropriate content' 
      });
    }

    if (!VENUE_TYPES.includes(venueType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid venue type' 
      });
    }

    // One review per user per destination (when destination_id is provided)
    if (req.body.destinationId) {
      const existingReview = await pool.query(
        'SELECT id FROM reviews WHERE user_id = $1 AND destination_id = $2',
        [req.userId, parseInt(req.body.destinationId)]
      );
      if (existingReview.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'You have already reviewed this destination' });
      }
    }

    // Check if user has a completed trip to this destination (for verification)
    let isVerified = false;
    if (destination) {
      const completedTrip = await db.get(`
        SELECT id FROM trips 
        WHERE user_id = ? 
        AND LOWER(destination) LIKE LOWER(?) 
        AND status = 'completed'
        LIMIT 1
      `, req.userId, `%${destination}%`);
      
      isVerified = completedTrip ? true : false;
    }

    // Insert review
    const result = await db.run(`
      INSERT INTO reviews (
        user_id, destination, venue_name, venue_address, venue_type,
        overall_rating, solo_friendly_rating, safety_rating, value_rating,
        title, content, tags, photos, is_verified, status,
        destination_id, visited_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      req.userId,
      destination || null,
      venueName || null,
      venueAddress || null,
      venueType,
      overallRating,
      soloFriendlyRating || null,
      safetyRating || null,
      valueRating || null,
      title,
      content,
      JSON.stringify(tags),
      JSON.stringify(photos),
      isVerified,
      'pending',
      destinationId ? parseInt(destinationId) : null,
      visitedDate || null
    );

    const newReview = await db.get(`
      SELECT id, destination, venue_name, venue_address, venue_type,
        overall_rating, solo_friendly_rating, safety_rating, value_rating,
        title, content, tags, photos, is_verified, helpful_count,
        created_at, updated_at
      FROM reviews WHERE id = ?
    `, result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: {
        id: newReview.id,
        userId: newReview.user_id,
        destination: newReview.destination,
        venueName: newReview.venue_name,
        venueType: newReview.venue_type,
        overallRating: newReview.overall_rating,
        soloFriendlyRating: newReview.solo_friendly_rating,
        safetyRating: newReview.safety_rating,
        valueRating: newReview.value_rating,
        title: newReview.title,
        content: newReview.content,
        tags: newReview.tags ? JSON.parse(newReview.tags) : [],
        photos: newReview.photos ? JSON.parse(newReview.photos) : [],
        isVerified: Boolean(newReview.is_verified),
        helpfulCount: newReview.helpful_count,
        createdAt: newReview.created_at,
        updatedAt: newReview.updated_at
      }
    });
  } catch (error) {
    logger.error(`[Reviews] Failed to create review: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create review' });
  }
});

// POST /reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if review exists
    const review = await db.get('SELECT id FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    // Check if already marked helpful
    const existing = await db.get(`
      SELECT id FROM review_helpful WHERE review_id = ? AND user_id = ?
    `, id, req.userId);

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already marked this review as helpful' 
      });
    }

    // Add helpful vote
    await db.run(`
      INSERT INTO review_helpful (review_id, user_id) VALUES (?, ?)
    `, id, req.userId);

    // Update count
    await db.run(`
      UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?
    `, id);

    res.json({ success: true, message: 'Review marked as helpful' });
  } catch (error) {
    logger.error(`[Reviews] Failed to mark review helpful: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to mark review as helpful' });
  }
});

// DELETE /reviews/:id/helpful - Remove helpful mark
router.delete('/:id/helpful', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.run(`
      DELETE FROM review_helpful WHERE review_id = ? AND user_id = ?
    `, id, req.userId);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Helpful mark not found' 
      });
    }

    // Update count
    await db.run(`
      UPDATE reviews SET helpful_count = CASE WHEN helpful_count > 0 THEN helpful_count - 1 ELSE 0 END WHERE id = ?
    `, id);

    res.json({ success: true, message: 'Helpful mark removed' });
  } catch (error) {
    logger.error(`[Reviews] Failed to remove helpful mark: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to remove helpful mark' });
  }
});

// PUT /reviews/:id - Update own review
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // ... ratings check (omitted for brevity)
    
    // Check ownership
    const review = await db.get('SELECT user_id, created_at FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    if (review.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Check if within 30 days
    const createdAt = new Date(review.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (createdAt < thirtyDaysAgo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reviews can only be updated within 30 days of creation' 
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (overallRating !== undefined) {
      updates.push('overall_rating = ?');
      params.push(overallRating);
    }
    if (soloFriendlyRating !== undefined) {
      updates.push('solo_friendly_rating = ?');
      params.push(soloFriendlyRating);
    }
    if (safetyRating !== undefined) {
      updates.push('safety_rating = ?');
      params.push(safetyRating);
    }
    if (valueRating !== undefined) {
      updates.push('value_rating = ?');
      params.push(valueRating);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (photos !== undefined) {
      updates.push('photos = ?');
      params.push(JSON.stringify(photos));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(`
      UPDATE reviews SET ${updates.join(', ')} WHERE id = ?
    `, ...params);

    const updated = await db.get(`
      SELECT id, overall_rating, solo_friendly_rating, safety_rating, value_rating,
        title, content, tags, photos, created_at, updated_at
      FROM reviews WHERE id = ?
    `, id);

    res.json({
      success: true,
      data: {
        id: updated.id,
        overallRating: updated.overall_rating,
        soloFriendlyRating: updated.solo_friendly_rating,
        safetyRating: updated.safety_rating,
        valueRating: updated.value_rating,
        title: updated.title,
        content: updated.content,
        tags: updated.tags ? JSON.parse(updated.tags) : [],
        photos: updated.photos ? JSON.parse(updated.photos) : [],
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    logger.error(`[Reviews] Failed to update review: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
});

// DELETE /reviews/:id - Delete own review
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const review = await db.get('SELECT user_id FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    if (review.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.run('DELETE FROM reviews WHERE id = ?', id);

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    logger.error(`[Reviews] Failed to delete review: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// ADMIN - GET /reviews - List all reviews for moderation
router.get('/admin/list', authenticate, async (req, res) => {
  try {
    // Check admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { page = 1, limit = 50, status = 'pending' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const queryParams = [];
    if (status !== 'all') {
      whereClause = `WHERE r.status = ?`;
      queryParams.push(status);
    }

    const reviewsQuery = `
      SELECT 
        r.id, r.user_id, r.destination, r.venue_name, r.venue_address, r.venue_type,
        r.overall_rating, r.solo_friendly_rating, r.safety_rating, r.value_rating,
        r.title, r.content, r.tags, r.photos, r.is_verified, r.helpful_count,
        r.status, r.created_at, r.updated_at,
        u.name as author_name, u.email as author_email
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const reviews = await db.all(reviewsQuery, ...queryParams, parseInt(limit), offset);
    
    const countQuery = `SELECT COUNT(*) as total FROM reviews r ${whereClause}`;
    const countResult = await db.get(countQuery, ...queryParams);
    const total = countResult?.total || 0;

    // Get counts by status
    const statusCounts = await db.all(`
      SELECT status, COUNT(*) as count FROM reviews GROUP BY status
    `);
    const countsByStatus = { pending: 0, approved: 0, rejected: 0 };
    statusCounts.forEach(s => { countsByStatus[s.status] = parseInt(s.count); });

    res.json({
      success: true,
      data: {
        reviews: reviews.map(r => ({
          ...r,
          isVerified: Boolean(r.is_verified),
          author: { name: r.author_name, email: r.author_email }
        })),
        total,
        countsByStatus
      }
    });
  } catch (error) {
    logger.error(`[Reviews Admin] Fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Moderation queue unavailable' });
  }
});

// ADMIN - DELETE /reviews/:id
router.delete('/admin/:id', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    await db.run('DELETE FROM reviews WHERE id = ?', req.params.id);
    res.json({ success: true, message: 'Review purged' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Purge failed' });
  }
});

// ADMIN - POST /reviews/admin/:id/approve
router.post('/admin/:id/approve', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    const review = await db.get('SELECT id FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    await db.run(`
      UPDATE reviews SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, id);

    res.json({ success: true, message: 'Review approved' });
  } catch (error) {
    logger.error(`[Reviews Admin] Approve failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Approval failed' });
  }
});

// ADMIN - POST /reviews/admin/:id/reject
router.post('/admin/:id/reject', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    const review = await db.get('SELECT id FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    await db.run(`
      UPDATE reviews SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, id);

    res.json({ success: true, message: 'Review rejected' });
  } catch (error) {
    logger.error(`[Reviews Admin] Reject failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Rejection failed' });
  }
});

// POST /reviews/:id/report - report a review
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    const validReasons = ['spam', 'offensive', 'misleading', 'fake', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ success: false, error: `Reason must be one of: ${validReasons.join(', ')}` });
    }

    const review = await db.get('SELECT id FROM reviews WHERE id = ?', id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    // Use pool for the review_reports table (PostgreSQL)
    await pool.query(`
      INSERT INTO review_reports (user_id, review_id, reason, details)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, review_id) DO UPDATE SET reason = $3, details = $4
    `, [userId, parseInt(id), reason, details || null]);

    res.json({ success: true, message: 'Review reported. Thank you for your feedback.' });
  } catch (error) {
    logger.error(`[Reviews] Report failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to report review' });
  }
});

export default router;
