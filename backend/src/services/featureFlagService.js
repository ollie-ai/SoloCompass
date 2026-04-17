import db from '../db.js';
import logger from './logger.js';

// In-memory cache with TTL
let flagCache = {};
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Get all feature flags from DB, with in-memory cache
 */
async function getAllFlags() {
  const now = Date.now();
  if (now < cacheExpiry && Object.keys(flagCache).length > 0) {
    return flagCache;
  }

  try {
    const rows = await db.all(`SELECT * FROM feature_flags WHERE is_enabled = true`);
    const flags = {};
    for (const row of rows) {
      flags[row.flag_key] = {
        isEnabled: row.is_enabled,
        enabledForTiers: JSON.parse(row.enabled_for_tiers || '[]'),
        enabledForUserIds: JSON.parse(row.enabled_for_user_ids || '[]'),
        rolloutPercentage: row.rollout_percentage || 0,
        metadata: JSON.parse(row.metadata || '{}'),
      };
    }
    flagCache = flags;
    cacheExpiry = now + CACHE_TTL_MS;
    return flags;
  } catch (err) {
    logger.error(`[FeatureFlags] Failed to load flags: ${err.message}`);
    return {};
  }
}

/**
 * Evaluate whether a flag is enabled for a user
 */
export async function evaluateFlag(flagKey, userId, userTier = 'explorer') {
  try {
    const flags = await getAllFlags();
    const flag = flags[flagKey];
    if (!flag) return false;
    if (!flag.isEnabled) return false;

    // Check user-specific override
    if (flag.enabledForUserIds.length > 0 && flag.enabledForUserIds.includes(String(userId))) {
      return true;
    }

    // Check tier-based access
    if (flag.enabledForTiers.length > 0 && flag.enabledForTiers.includes(userTier)) {
      return true;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage > 0) {
      // Deterministic hash based on user ID + flag key
      const hash = (userId * 31 + flagKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 100;
      return hash < flag.rolloutPercentage;
    }

    // If no tier/user restrictions, it's globally enabled
    if (flag.enabledForTiers.length === 0 && flag.enabledForUserIds.length === 0) {
      return flag.isEnabled;
    }

    return false;
  } catch (err) {
    logger.error(`[FeatureFlags] Evaluation error for ${flagKey}: ${err.message}`);
    return false;
  }
}

/**
 * Invalidate cache (call after flag updates)
 */
export function invalidateFlagCache() {
  flagCache = {};
  cacheExpiry = 0;
}

export default { evaluateFlag, invalidateFlagCache, getAllFlags };
