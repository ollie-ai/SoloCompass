import express from 'express';
import logger from '../services/logger.js';

const router = express.Router();

// Sourced from environment so ops can bump without a code deploy.
// Format: major.minor.patch  e.g. "1.4.2"
const CURRENT_VERSION = process.env.APP_VERSION || '1.0.0';

// The oldest client version that is still fully supported.
// Clients below this should display a "please update" prompt.
const MIN_SUPPORTED_VERSION = process.env.APP_MIN_VERSION || '1.0.0';

const CHANGELOG = [
  {
    version: '1.0.0',
    title: 'Welcome to SoloCompass',
    notes: [
      'AI-powered itinerary generation',
      'Real-time FCDO safety advisories',
      'Safety check-in scheduling',
      'Trip buddy matching',
    ],
    releasedAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * GET /api/v1/app/version
 * Returns current app version, minimum supported version, and changelog.
 */
router.get('/', (req, res) => {
  const clientVersion = req.query.v || req.headers['x-app-version'] || null;

  let updateRequired = false;
  if (clientVersion) {
    try {
      updateRequired = isUpdateRequired(clientVersion, MIN_SUPPORTED_VERSION);
    } catch {
      // Malformed semver from client — don't block, just ignore
    }
  }

  logger.http(`[AppVersion] GET / clientVersion=${clientVersion ?? 'unknown'} updateRequired=${updateRequired}`);

  res.json({
    success: true,
    data: {
      currentVersion: CURRENT_VERSION,
      minSupportedVersion: MIN_SUPPORTED_VERSION,
      updateRequired,
      changelog: CHANGELOG,
    },
  });
});

/**
 * Returns true if the running client version is strictly older than the minimum
 * supported version.
 *
 * Only compares [major, minor, patch] segments; pre-release suffixes are ignored.
 */
function isUpdateRequired(clientVersion, minVersion) {
  const parse = (v) => String(v).split('.').slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const client = parse(clientVersion);
  const min = parse(minVersion);
  for (let i = 0; i < 3; i++) {
    if (client[i] < min[i]) return true;
    if (client[i] > min[i]) return false;
  }
  return false;
}

export default router;
