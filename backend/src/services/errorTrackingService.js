import axios from 'axios';
import logger from './logger.js';

function getWebhookUrl() {
  return process.env.ERROR_TRACKING_WEBHOOK_URL || process.env.SENTRY_INGEST_WEBHOOK || null;
}

export async function forwardErrorTrackingEvent(payload) {
  const webhook = getWebhookUrl();
  if (!webhook) return false;

  try {
    await axios.post(webhook, payload, { timeout: 5000 });
    return true;
  } catch (error) {
    logger.warn(`[ErrorTracking] Forwarding failed: ${error.message}`);
    return false;
  }
}

export async function captureBackendError(error, context = {}) {
  return forwardErrorTrackingEvent({
    source: 'backend',
    message: error?.message || 'Unknown backend error',
    stack: error?.stack || null,
    context,
    timestamp: new Date().toISOString()
  });
}
