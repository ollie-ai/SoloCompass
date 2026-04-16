import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import logger from '../services/logger.js';
import { deleteUserAccountCascade, generateUserDataExport } from '../services/dataExport.js';

const router = express.Router();
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);

router.get('/data-export', exportLimiter, async (req, res) => {
  try {
    const exportPayload = await generateUserDataExport(req.userId);
    const json = JSON.stringify(exportPayload, null, 2);
    const filename = `solocompass-data-export-${req.userId}-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(json);
  } catch (error) {
    logger.error(`[Account] Data export failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate account data export' }
    });
  }
});

router.delete('/', deleteLimiter, async (req, res) => {
  try {
    await deleteUserAccountCascade(req.userId);
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({
      success: true,
      data: { message: 'Account and associated data deleted' }
    });
  } catch (error) {
    logger.error(`[Account] Deletion failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete account' }
    });
  }
});

export default router;
