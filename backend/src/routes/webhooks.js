import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import {
  createSubscription,
  getSubscriptions,
  deleteSubscription,
  toggleSubscription,
  testWebhook,
  VALID_EVENTS
} from '../services/webhookService.js';
import { handleEmailWebhook } from '../services/notificationLogger.js';
import logger from '../services/logger.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const urlValidation = body('url')
  .isURL({ require_tld: true, protocols: ['https'] })
  .withMessage('URL must be a valid HTTPS URL');

const eventsValidation = body('events')
  .isArray({ min: 1 })
  .withMessage('Events must be a non-empty array')
  .custom(events => {
    const invalid = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalid.length > 0) {
      throw new Error(`Invalid events: ${invalid.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`);
    }
    return true;
  });

router.get('/', requireAuth, async (req, res) => {
  try {
    const subscriptions = await getSubscriptions(req.userId);
    res.json({ success: true, data: subscriptions });
  } catch (error) {
    logger.error('Get webhooks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch webhooks' });
  }
});

router.post('/',
  requireAuth,
  urlValidation,
  eventsValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { url, events, active = true } = req.body;

      const subscription = await createSubscription(req.userId, url, events, active);

      res.status(201).json({
        success: true,
        data: {
          id: subscription.id,
          url: subscription.url,
          events: subscription.events,
          active: subscription.active,
          secret: subscription.secret
        }
      });
    } catch (error) {
      logger.error('Create webhook error:', error);
      res.status(500).json({ success: false, error: 'Failed to create webhook' });
    }
  }
);

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteSubscription(id, req.userId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Webhook subscription not found' });
    }

    res.json({ success: true, message: 'Webhook subscription deleted' });
  } catch (error) {
    logger.error('Delete webhook error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete webhook' });
  }
});

router.patch('/:id/toggle',
  requireAuth,
  body('active').isBoolean().withMessage('active must be a boolean'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { active } = req.body;

      const updated = await toggleSubscription(id, req.userId, active);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Webhook subscription not found' });
      }

      res.json({ success: true, data: { id, active } });
    } catch (error) {
      logger.error('Toggle webhook error:', error);
      res.status(500).json({ success: false, error: 'Failed to toggle webhook' });
    }
  }
);

router.post('/test',
  requireAuth,
  body('subscriptionId').isInt().withMessage('subscriptionId must be an integer'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { subscriptionId } = req.body;
      const result = await testWebhook(subscriptionId, req.userId);

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: 'Test webhook failed',
          details: result.error
        });
      }

      res.json({
        success: true,
        message: 'Test webhook delivered successfully',
        attempts: result.attempt
      });
    } catch (error) {
      logger.error('Test webhook error:', error);
      res.status(500).json({ success: false, error: 'Failed to test webhook' });
    }
  }
);

router.get('/events', (req, res) => {
  res.json({
    success: true,
    data: VALID_EVENTS.map(event => ({
      name: event,
      description: getEventDescription(event)
    }))
  });
});

// Resend email delivery webhooks (no auth — called by Resend servers)
router.post('/email', async (req, res) => {
  try {
    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
    }

    const result = await handleEmailWebhook(event);
    if (!result.success) {
      logger.error('[EmailWebhook] Processing failed:', result.error);
      return res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[EmailWebhook] Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function getEventDescription(event) {
  const descriptions = {
    'trip.created': 'Triggered when a new trip is created',
    'trip.completed': 'Triggered when a trip is marked as completed',
    'checkin.sent': 'Triggered when a safety check-in is sent',
    'emergency.triggered': 'Triggered when an emergency alert is triggered'
  };
  return descriptions[event] || 'Custom webhook event';
}

export default router;
