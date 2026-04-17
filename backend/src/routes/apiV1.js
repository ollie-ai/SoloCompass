import express from 'express';
import helpArticles from '../data/helpArticles.json' with { type: 'json' };
import featuresRoutes from './features.js';

const router = express.Router();

router.get('/help/articles', (_req, res) => {
  res.json({
    success: true,
    data: helpArticles,
    count: helpArticles.length
  });
});

router.use('/features', featuresRoutes);

export default router;
