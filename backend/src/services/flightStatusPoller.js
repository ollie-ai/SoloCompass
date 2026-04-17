/**
 * Flight Status Poller
 * Every 15 minutes, checks all flights within the next 24 hours for status changes.
 * If status / delay / gate changes, sends push/in-app notification to the user.
 */
import db from '../db.js';
import { getFlightStatus } from './flightService.js';
import { createNotification } from './notificationService.js';
import * as pushService from './pushService.js';
import logger from './logger.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const AVIATIONSTACK_API_KEY = () => process.env.AVIATIONSTACK_API_KEY;

async function notifyUser(userId, title, message, data = {}) {
  try {
    await createNotification(userId, 'flight_update', title, message, data);
    await pushService.sendPushNotification(userId, { title, body: message, ...data });
  } catch (err) {
    logger.error(`[FlightPoller] Notification failed: ${err.message}`);
  }
}

async function pollFlights() {
  const apiKey = AVIATIONSTACK_API_KEY();
  if (!apiKey) return;

  const now = new Date();
  const in24hIso = new Date(now.getTime() + HOURS_24_MS).toISOString();

  let trackedFlights;
  try {
    trackedFlights = await db.prepare(`
      SELECT
        fsc.id,
        fsc.flight_number,
        fsc.flight_date,
        fsc.status,
        fsc.gate,
        fsc.delay_minutes,
        fsc.terminal,
        fsc.user_id
      FROM flight_status_cache fsc
      WHERE fsc.flight_date <= ?
        AND fsc.flight_date > ?
        AND fsc.user_id IS NOT NULL
    `).all(in24hIso, now.toISOString());
  } catch (err) {
    logger.error(`[FlightPoller] DB query failed: ${err.message}`);
    return;
  }

  for (const tracked of trackedFlights) {
    try {
      const dateStr = tracked.flight_date.split('T')[0];
      const fresh = await getFlightStatus(tracked.flight_number, dateStr, apiKey);
      if (!fresh) continue;

      const newStatus = fresh.status;
      const newGate = fresh.departure?.gate || null;
      const newDelay = fresh.departure?.delay || 0;
      const newTerminal = fresh.departure?.terminal || null;

      const statusChanged = newStatus !== tracked.status;
      const gateChanged = newGate !== tracked.gate;
      const delayChanged = Math.abs((newDelay || 0) - (tracked.delay_minutes || 0)) >= 5;

      if (statusChanged || gateChanged || delayChanged) {
        // Update cache
        await db.prepare(`
          UPDATE flight_status_cache
          SET status = ?, gate = ?, delay_minutes = ?, terminal = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newStatus, newGate, newDelay, newTerminal, tracked.id);

        // Build notification message
        let message = `Flight ${tracked.flight_number}: `;
        const parts = [];
        if (statusChanged) parts.push(`Status → ${newStatus}`);
        if (delayChanged && newDelay > 0) parts.push(`Delayed ${newDelay}m`);
        if (gateChanged && newGate) parts.push(`Gate changed to ${newGate}`);
        message += parts.join(', ');

        await notifyUser(
          tracked.user_id,
          `✈️ Flight Update: ${tracked.flight_number}`,
          message,
          { flightNumber: tracked.flight_number, flightDate: dateStr, newStatus, newGate, newDelay }
        );

        logger.info(`[FlightPoller] Updated flight ${tracked.flight_number}: ${parts.join(', ')}`);
      } else {
        // Just refresh updated_at
        await db.prepare(`
          UPDATE flight_status_cache SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(tracked.id);
      }
    } catch (err) {
      logger.warn(`[FlightPoller] Failed polling ${tracked.flight_number}: ${err.message}`);
    }
  }
}

export function startFlightStatusPoller() {
  logger.info('[FlightPoller] Starting flight status poller');
  // Slight delay to avoid startup congestion
  setTimeout(() => {
    pollFlights();
    setInterval(pollFlights, POLL_INTERVAL_MS);
  }, 60000);
}
