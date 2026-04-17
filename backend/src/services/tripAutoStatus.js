/**
 * Trip Auto-Status service
 * Runs every 30 minutes to auto-transition trip statuses:
 *   planning → upcoming   when start_date is within 7 days
 *   upcoming → active     on start_date
 *   active   → completed  on end_date
 * Also sends 24h reminder notification before trip start.
 */
import db from '../db.js';
import logger from './logger.js';
import { createNotification } from './notificationService.js';
import * as pushService from './pushService.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000;
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const HOURS_25_MS = 25 * 60 * 60 * 1000;

async function sendTripNotification(userId, type, title, message, data = {}) {
  try {
    await createNotification(userId, type, title, message, data);
    await pushService.sendPushNotification(userId, { title, body: message, ...data });
  } catch (err) {
    logger.error(`[TripAutoStatus] Notification failed: ${err.message}`);
  }
}

async function runAutoStatusUpdate() {
  const now = new Date();
  const nowIso = now.toISOString();
  const in7DaysIso = new Date(now.getTime() + DAYS_7_MS).toISOString();
  const in25hIso = new Date(now.getTime() + HOURS_25_MS).toISOString();
  const in24hIso = new Date(now.getTime() + HOURS_24_MS).toISOString();

  // planning → upcoming: start date within 7 days
  try {
    const toUpcoming = await db.prepare(`
      SELECT id, user_id, name, destination, start_date
      FROM trips
      WHERE status = 'planning'
        AND start_date IS NOT NULL
        AND start_date <= ?
        AND start_date > ?
    `).all(in7DaysIso, nowIso);

    for (const trip of toUpcoming) {
      await db.prepare(`
        UPDATE trips SET status = 'upcoming', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(trip.id);

      await sendTripNotification(
        trip.user_id,
        'trip_reminder',
        'Trip Coming Up Soon',
        `Your trip to ${trip.destination || trip.name} starts in less than 7 days! Time to finalise your plans.`,
        { tripId: trip.id, tripName: trip.name }
      );

      logger.info(`[TripAutoStatus] Trip ${trip.id} → upcoming`);
    }
  } catch (err) {
    logger.error(`[TripAutoStatus] planning→upcoming failed: ${err.message}`);
  }

  // upcoming → active: start_date has passed
  try {
    const toActive = await db.prepare(`
      SELECT id, user_id, name, destination, start_date
      FROM trips
      WHERE status = 'upcoming'
        AND start_date IS NOT NULL
        AND start_date <= ?
    `).all(nowIso);

    for (const trip of toActive) {
      await db.prepare(`
        UPDATE trips SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(trip.id);

      await sendTripNotification(
        trip.user_id,
        'trip_started',
        '✈️ Trip Started!',
        `Your trip to ${trip.destination || trip.name} has begun. Safe travels!`,
        { tripId: trip.id, tripName: trip.name }
      );

      logger.info(`[TripAutoStatus] Trip ${trip.id} → active`);
    }
  } catch (err) {
    logger.error(`[TripAutoStatus] upcoming→active failed: ${err.message}`);
  }

  // active → completed: end_date has passed
  try {
    const toCompleted = await db.prepare(`
      SELECT id, user_id, name, destination, end_date
      FROM trips
      WHERE status = 'active'
        AND end_date IS NOT NULL
        AND end_date <= ?
    `).all(nowIso);

    for (const trip of toCompleted) {
      await db.prepare(`
        UPDATE trips SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(trip.id);

      await sendTripNotification(
        trip.user_id,
        'trip_completed',
        '🏁 Trip Completed',
        `Welcome back! Your trip to ${trip.destination || trip.name} is now complete. How was it?`,
        { tripId: trip.id, tripName: trip.name }
      );

      logger.info(`[TripAutoStatus] Trip ${trip.id} → completed`);
    }
  } catch (err) {
    logger.error(`[TripAutoStatus] active→completed failed: ${err.message}`);
  }

  // 24h reminder: upcoming trips that start in the next 24–25 hours (avoid re-sending)
  try {
    const upcoming24h = await db.prepare(`
      SELECT id, user_id, name, destination, start_date
      FROM trips
      WHERE status IN ('upcoming', 'planning')
        AND start_date IS NOT NULL
        AND start_date > ?
        AND start_date <= ?
        AND (reminder_24h_sent IS NULL OR reminder_24h_sent = false)
    `).all(in24hIso, in25hIso);

    for (const trip of upcoming24h) {
      // Mark reminder sent
      await db.prepare(`
        UPDATE trips SET reminder_24h_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(trip.id);

      await sendTripNotification(
        trip.user_id,
        'trip_reminder',
        '⏰ Trip Tomorrow!',
        `Your trip to ${trip.destination || trip.name} starts tomorrow. Don't forget to check in when you arrive!`,
        { tripId: trip.id, tripName: trip.name }
      );

      logger.info(`[TripAutoStatus] 24h reminder sent for trip ${trip.id}`);
    }
  } catch (err) {
    logger.error(`[TripAutoStatus] 24h reminder failed: ${err.message}`);
  }
}

export function startTripAutoStatusService() {
  logger.info('[TripAutoStatus] Starting trip auto-status service');
  runAutoStatusUpdate();
  setInterval(runAutoStatusUpdate, CHECK_INTERVAL_MS);
}
