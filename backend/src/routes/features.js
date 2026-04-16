import express from 'express';

const router = express.Router();

const PLAN_FEATURES = {
  free: [
    'reviews',
    'packing',
    'weather',
    'checkin',
  ],
  explorer: [
    'reviews',
    'packing',
    'weather',
    'checkin',
    'budget',
    'flights',
    'matching',
  ],
  pro: [
    'reviews',
    'packing',
    'weather',
    'checkin',
    'budget',
    'flights',
    'matching',
    'guardian',
    'priority_support',
    'advanced_safety_alerts',
  ],
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      plans: PLAN_FEATURES,
      generatedAt: new Date().toISOString(),
    },
  });
});

export default router;
