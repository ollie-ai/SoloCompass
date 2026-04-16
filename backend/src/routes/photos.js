import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { supabaseStorage } from '../services/supabaseStorage.js';

const router = express.Router();

const PHOTOS_BUCKET = 'journal-photos';
const MAX_PHOTOS_PER_TRIP = 100;

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed.'), false);
    }
  },
});

// Ensure photos table exists
async function ensurePhotosTable() {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS trip_photos (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        day_number INTEGER,
        activity_id TEXT,
        caption TEXT,
        file_url TEXT NOT NULL,
        thumbnail_url TEXT,
        file_size INTEGER,
        mime_type TEXT,
        width INTEGER,
        height INTEGER,
        taken_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    // Table likely already exists, that's fine
    logger.debug('[Photos] Table check:', err.message);
  }
}

// Initialize table on first load
ensurePhotosTable();

// POST /api/trips/:tripId/photos — Upload one or more photos
router.post('/:tripId/photos', requireAuth, upload.array('photos', 10), async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    // Verify trip ownership
    const trip = await db.prepare('SELECT id, user_id FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }
    if (trip.user_id !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your trip' } });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'No photos uploaded' } });
    }

    // Check photo limit
    const existing = await db.prepare('SELECT COUNT(*) as count FROM trip_photos WHERE trip_id = ?').get(tripId);
    if ((existing?.count || 0) + req.files.length > MAX_PHOTOS_PER_TRIP) {
      return res.status(400).json({
        success: false,
        error: { code: 'LIMIT_EXCEEDED', message: `Maximum ${MAX_PHOTOS_PER_TRIP} photos per trip` },
      });
    }

    const { dayNumber, activityId, caption } = req.body;
    const uploaded = [];

    for (const file of req.files) {
      const photoId = crypto.randomUUID();
      const ext = file.originalname.split('.').pop().toLowerCase();
      const filePath = `trips/${tripId}/${photoId}.${ext}`;

      // Upload original to Supabase Storage
      const { fileUrl, error: uploadError } = await supabaseStorage.uploadFile(
        filePath,
        file.buffer,
        file.mimetype,
        PHOTOS_BUCKET
      );

      if (uploadError) {
        logger.error(`[Photos] Upload failed for ${filePath}:`, uploadError);
        continue; // Skip this file, try others
      }

      // Generate a lightweight thumbnail path (same image for now; sharp compression can be added later)
      const thumbnailUrl = fileUrl; // TODO: Generate actual thumbnail with sharp when available

      // Save to database
      await db.prepare(`
        INSERT INTO trip_photos (id, trip_id, user_id, day_number, activity_id, caption, file_url, thumbnail_url, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        photoId,
        tripId,
        userId,
        dayNumber ? parseInt(dayNumber, 10) : null,
        activityId || null,
        caption || null,
        fileUrl,
        thumbnailUrl,
        file.size,
        file.mimetype
      );

      uploaded.push({
        id: photoId,
        fileUrl,
        thumbnailUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        dayNumber: dayNumber ? parseInt(dayNumber, 10) : null,
        activityId: activityId || null,
        caption: caption || null,
      });
    }

    if (uploaded.length === 0) {
      return res.status(500).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'All photo uploads failed' },
      });
    }

    logger.info(`[Photos] ${uploaded.length} photos uploaded for trip ${tripId}`);

    res.status(201).json({
      success: true,
      data: {
        photos: uploaded,
        count: uploaded.length,
      },
    });
  } catch (error) {
    logger.error('[Photos] Upload error:', error.message);
    if (error.message?.includes('Invalid file type')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: error.message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload photos' } });
  }
});

// GET /api/trips/:tripId/photos — List photos for a trip
router.get('/:tripId/photos', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;
    const { dayNumber, activityId, limit = 50, offset = 0 } = req.query;

    // Verify trip access
    const trip = await db.prepare('SELECT id, user_id, share_code FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }
    if (trip.user_id !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your trip' } });
    }

    let query = 'SELECT * FROM trip_photos WHERE trip_id = ?';
    const params = [tripId];

    if (dayNumber) {
      query += ' AND day_number = ?';
      params.push(parseInt(dayNumber, 10));
    }
    if (activityId) {
      query += ' AND activity_id = ?';
      params.push(activityId);
    }

    query += ' ORDER BY day_number ASC, created_at ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const photos = await db.prepare(query).all(...params);

    const total = await db.prepare(
      'SELECT COUNT(*) as count FROM trip_photos WHERE trip_id = ?'
    ).get(tripId);

    res.json({
      success: true,
      data: {
        photos: photos || [],
        total: total?.count || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (error) {
    logger.error('[Photos] List error:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list photos' } });
  }
});

// DELETE /api/trips/:tripId/photos/:photoId — Delete a photo
router.delete('/:tripId/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const { tripId, photoId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const photo = await db.prepare(
      'SELECT tp.*, t.user_id as trip_owner FROM trip_photos tp JOIN trips t ON t.id = tp.trip_id WHERE tp.id = ? AND tp.trip_id = ?'
    ).get(photoId, tripId);

    if (!photo) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Photo not found' } });
    }
    if (photo.trip_owner !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your photo' } });
    }

    // Delete from storage
    if (photo.file_url) {
      const urlParts = photo.file_url.split(`/${PHOTOS_BUCKET}/`);
      if (urlParts.length === 2) {
        await supabaseStorage.deleteFile(urlParts[1], PHOTOS_BUCKET);
      }
    }

    // Delete from database
    await db.prepare('DELETE FROM trip_photos WHERE id = ?').run(photoId);

    logger.info(`[Photos] Photo ${photoId} deleted from trip ${tripId}`);
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    logger.error('[Photos] Delete error:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete photo' } });
  }
});

// PATCH /api/trips/:tripId/photos/:photoId — Update photo caption/metadata
router.patch('/:tripId/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const { tripId, photoId } = req.params;
    const userId = req.user.id;
    const { caption, dayNumber, activityId } = req.body;

    // Verify ownership
    const photo = await db.prepare(
      'SELECT tp.*, t.user_id as trip_owner FROM trip_photos tp JOIN trips t ON t.id = tp.trip_id WHERE tp.id = ? AND tp.trip_id = ?'
    ).get(photoId, tripId);

    if (!photo) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Photo not found' } });
    }
    if (photo.trip_owner !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your photo' } });
    }

    const updates = [];
    const params = [];

    if (caption !== undefined) {
      updates.push('caption = ?');
      params.push(caption);
    }
    if (dayNumber !== undefined) {
      updates.push('day_number = ?');
      params.push(dayNumber ? parseInt(dayNumber, 10) : null);
    }
    if (activityId !== undefined) {
      updates.push('activity_id = ?');
      params.push(activityId || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
    }

    updates.push('updated_at = NOW()');
    params.push(photoId);

    await db.prepare(`UPDATE trip_photos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await db.prepare('SELECT * FROM trip_photos WHERE id = ?').get(photoId);
    res.json({ success: true, data: { photo: updated } });
  } catch (error) {
    logger.error('[Photos] Update error:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update photo' } });
  }
});

export default router;
