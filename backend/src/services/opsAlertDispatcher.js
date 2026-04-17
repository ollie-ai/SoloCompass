/**
 * Outbound ops-alert dispatcher
 *
 * Fires when a new alert row is persisted in `ops_alerts` (called by
 * `opsAlertService.createOpsAlert`). Sends an HTTP POST to any combination
 * of the three supported channels that have been configured via env vars:
 *
 *   OPS_ALERT_SLACK_WEBHOOK_URL   — Slack Incoming Webhook URL
 *   OPS_ALERT_PAGERDUTY_ROUTING_KEY — PagerDuty Events API v2 routing key
 *   OPS_ALERT_DISCORD_WEBHOOK_URL — Discord channel webhook URL
 *
 * Only `critical` and `high` severity alerts are dispatched by default; set
 *   OPS_ALERT_MIN_SEVERITY=info   to lower the threshold (not recommended in prod).
 *
 * The dispatcher is best-effort — a failed delivery is logged but never
 * re-throws so it cannot crash the main request path.
 */

import logger from './logger.js';

const TIMEOUT_MS = 8000;

// Severity hierarchy (lower index = more severe)
const SEVERITY_ORDER = ['critical', 'high', 'warning', 'info'];
const DEFAULT_MIN_SEVERITY = 'high';

function severityAboveThreshold(severity) {
  const minSev = process.env.OPS_ALERT_MIN_SEVERITY || DEFAULT_MIN_SEVERITY;
  const alertIdx = SEVERITY_ORDER.indexOf(severity?.toLowerCase());
  const minIdx = SEVERITY_ORDER.indexOf(minSev.toLowerCase());
  if (alertIdx === -1 || minIdx === -1) return false;
  return alertIdx <= minIdx; // lower index = more severe
}

async function postWithTimeout(url, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    logger.warn(`[OpsAlertDispatcher] Request failed: ${err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── Slack ────────────────────────────────────────────────────────────────────
async function dispatchSlack(alertId, type, severity, errorDetails) {
  const url = process.env.OPS_ALERT_SLACK_WEBHOOK_URL;
  if (!url) return;

  const emoji = severity === 'critical' ? ':rotating_light:' : ':warning:';
  const body = {
    text: `${emoji} *SoloCompass Alert* — \`${type}\` (severity: *${severity}*)`,
    attachments: [
      {
        color: severity === 'critical' ? '#FF0000' : '#FFA500',
        fields: [
          { title: 'Alert ID', value: String(alertId), short: true },
          { title: 'Type', value: type, short: true },
          { title: 'Severity', value: severity, short: true },
          { title: 'Time', value: new Date().toISOString(), short: true },
          ...(errorDetails
            ? [{ title: 'Details', value: JSON.stringify(errorDetails, null, 2), short: false }]
            : []),
        ],
      },
    ],
  };

  const ok = await postWithTimeout(url, body);
  if (ok) {
    logger.info(`[OpsAlertDispatcher] Slack notified for alert ${alertId}`);
  } else {
    logger.warn(`[OpsAlertDispatcher] Slack delivery failed for alert ${alertId}`);
  }
}

// ── PagerDuty (Events API v2) ────────────────────────────────────────────────
async function dispatchPagerDuty(alertId, type, severity, errorDetails) {
  const routingKey = process.env.OPS_ALERT_PAGERDUTY_ROUTING_KEY;
  if (!routingKey) return;

  // Map internal severity to PagerDuty severity enum
  const pdSeverity = severity === 'critical' ? 'critical'
    : severity === 'high' ? 'error'
    : severity === 'warning' ? 'warning'
    : 'info';

  const body = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: `solocompass-alert-${alertId}`,
    payload: {
      summary: `SoloCompass ${severity.toUpperCase()} alert: ${type}`,
      source: 'solocompass-backend',
      severity: pdSeverity,
      custom_details: {
        alertId,
        type,
        ...(errorDetails || {}),
        timestamp: new Date().toISOString(),
      },
    },
  };

  const ok = await postWithTimeout('https://events.pagerduty.com/v2/enqueue', body);
  if (ok) {
    logger.info(`[OpsAlertDispatcher] PagerDuty notified for alert ${alertId}`);
  } else {
    logger.warn(`[OpsAlertDispatcher] PagerDuty delivery failed for alert ${alertId}`);
  }
}

// ── Discord ──────────────────────────────────────────────────────────────────
async function dispatchDiscord(alertId, type, severity, errorDetails) {
  const url = process.env.OPS_ALERT_DISCORD_WEBHOOK_URL;
  if (!url) return;

  const color = severity === 'critical' ? 0xff0000 : 0xffa500;
  const body = {
    embeds: [
      {
        title: `🚨 SoloCompass Alert — ${type}`,
        color,
        fields: [
          { name: 'Alert ID', value: String(alertId), inline: true },
          { name: 'Severity', value: severity, inline: true },
          { name: 'Time', value: new Date().toISOString(), inline: false },
          ...(errorDetails
            ? [{ name: 'Details', value: `\`\`\`json\n${JSON.stringify(errorDetails, null, 2)}\n\`\`\``, inline: false }]
            : []),
        ],
      },
    ],
  };

  const ok = await postWithTimeout(url, body);
  if (ok) {
    logger.info(`[OpsAlertDispatcher] Discord notified for alert ${alertId}`);
  } else {
    logger.warn(`[OpsAlertDispatcher] Discord delivery failed for alert ${alertId}`);
  }
}

/**
 * Dispatch an ops alert to all configured channels.
 * Safe to call from anywhere — never throws.
 *
 * @param {object} params
 * @param {number} params.alertId  — DB id of the newly-inserted ops_alert row
 * @param {string} params.type     — alert type constant
 * @param {string} params.severity — 'critical' | 'high' | 'warning' | 'info'
 * @param {object} [params.errorDetails] — optional structured error payload
 */
export async function dispatchOpsAlert({ alertId, type, severity, errorDetails }) {
  if (!severityAboveThreshold(severity)) {
    logger.debug(`[OpsAlertDispatcher] Skipping dispatch for severity=${severity} (below threshold)`);
    return;
  }

  // Fire all channels concurrently; ignore individual failures
  await Promise.allSettled([
    dispatchSlack(alertId, type, severity, errorDetails),
    dispatchPagerDuty(alertId, type, severity, errorDetails),
    dispatchDiscord(alertId, type, severity, errorDetails),
  ]);
}
