/**
 * Safety Data Refresh service
 * Runs daily to refresh safety scores for destinations that need updating.
 * Delegates to existing safetyScoringService.
 */
import db from '../db.js';
import logger from './logger.js';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STALE_HOURS = 24;

async function refreshSafetyData() {
  logger.info('[SafetyRefresh] Starting safety data refresh...');

  let refreshService;
  try {
    refreshService = await import('./safetyScoringService.js');
  } catch (err) {
    logger.warn('[SafetyRefresh] safetyScoringService not available, skipping');
    return;
  }

  const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  let destinations;
  try {
    destinations = await db.prepare(`
      SELECT id, name, country, country_code
      FROM destinations
      WHERE publication_status = 'live'
        AND (safety_refreshed_at IS NULL OR safety_refreshed_at < ?)
      ORDER BY safety_refreshed_at ASC NULLS FIRST
      LIMIT 50
    `).all(staleThreshold);
  } catch (err) {
    logger.error(`[SafetyRefresh] DB query failed: ${err.message}`);
    return;
  }

  let refreshed = 0;
  let failed = 0;

  for (const dest of destinations) {
    try {
      if (typeof refreshService.refreshDestinationSafetyScore === 'function') {
        await refreshService.refreshDestinationSafetyScore(dest.id, dest.country || dest.name);
      } else if (typeof refreshService.getSafetyScore === 'function') {
        await refreshService.getSafetyScore(dest.country || dest.name, { forceRefresh: true });
      }

      await db.prepare(`
        UPDATE destinations SET safety_refreshed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(dest.id);

      refreshed++;
    } catch (err) {
      logger.warn(`[SafetyRefresh] Failed for destination ${dest.id} (${dest.name}): ${err.message}`);
      failed++;
    }
  }

  logger.info(`[SafetyRefresh] Refreshed ${refreshed}, failed ${failed} out of ${destinations.length} destinations`);
}

export function startSafetyDataRefresh() {
  logger.info('[SafetyRefresh] Starting safety data refresh service');

  // Start with a slight delay to let the app fully initialize
  setTimeout(() => {
    refreshSafetyData();
    setInterval(refreshSafetyData, REFRESH_INTERVAL_MS);
  }, 5 * 60 * 1000);
}
