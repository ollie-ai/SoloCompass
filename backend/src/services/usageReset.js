/**
 * Usage counter reset service.
 * Runs at midnight UTC daily to reset AI daily usage counters.
 * Also handles Stripe subscription renewal resets.
 */
import db from '../db.js';
import logger from './logger.js';

function msUntilNextMidnightUTC() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return midnight.getTime() - now.getTime();
}

async function resetDailyAICounters() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  try {
    const result = await db.prepare(`
      DELETE FROM ai_usage_daily WHERE usage_date < ?
    `).run(today);
    logger.info(`[UsageReset] Cleared ${result.changes} stale daily AI usage rows`);
  } catch (err) {
    // If ai_usage_daily table doesn't exist yet, silently ignore
    if (!err.message?.includes('no such table') && !err.message?.includes('does not exist')) {
      logger.error(`[UsageReset] Daily AI reset failed: ${err.message}`);
    }
  }
}

/**
 * Call this when a Stripe subscription renews to reset the user's counters.
 */
export async function resetUserAICounters(userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await db.prepare(`
      DELETE FROM ai_usage_daily WHERE user_id = ? AND usage_date < ?
    `).run(userId, today);
    logger.info(`[UsageReset] Cleared AI usage counters for user ${userId}`);
  } catch (err) {
    if (!err.message?.includes('no such table') && !err.message?.includes('does not exist')) {
      logger.error(`[UsageReset] Reset for user ${userId} failed: ${err.message}`);
    }
  }
}

export function startUsageResetService() {
  logger.info('[UsageReset] Scheduling daily AI usage reset at midnight UTC');

  const scheduleNext = () => {
    const delay = msUntilNextMidnightUTC();
    logger.info(`[UsageReset] Next reset in ${Math.round(delay / 60000)} minutes`);
    setTimeout(() => {
      resetDailyAICounters();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
