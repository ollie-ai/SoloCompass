import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../data/emergencyNumbers.json');
const META_PATH = path.join(__dirname, '../data/emergencyNumbers.meta.json');
// Approximate monthly cadence for scheduled refresh checks.
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      lastRefreshAt: null,
      nextRefreshAt: null,
      source: 'bundled',
      status: 'never_refreshed'
    };
  }
}

async function writeMeta(meta) {
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

async function refreshFromRemote() {
  const sourceUrl = process.env.EMERGENCY_NUMBERS_SOURCE_URL;
  if (!sourceUrl) {
    return { refreshed: false, reason: 'no_source_configured' };
  }

  const { data } = await axios.get(sourceUrl, { timeout: 10000 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid emergency data payload');
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  return { refreshed: true, source: sourceUrl };
}

export async function maybeRefreshEmergencyData(force = false) {
  const meta = await readMeta();
  const now = Date.now();
  const last = meta.lastRefreshAt ? new Date(meta.lastRefreshAt).getTime() : 0;
  const stale = !last || now - last >= MONTH_MS;

  if (!force && !stale) {
    return meta;
  }

  try {
    const result = await refreshFromRemote();
    const nextRefreshAt = new Date(now + MONTH_MS).toISOString();
    const updatedMeta = {
      ...meta,
      lastRefreshAt: new Date(now).toISOString(),
      nextRefreshAt,
      status: result.refreshed ? 'refreshed' : 'unchanged',
      source: result.source || meta.source || 'bundled',
      reason: result.reason || null
    };

    await writeMeta(updatedMeta);
    logger.info(`[EmergencyData] Refresh check complete: ${updatedMeta.status}`);
    return updatedMeta;
  } catch (error) {
    const failedMeta = {
      ...meta,
      lastAttemptAt: new Date(now).toISOString(),
      status: 'failed',
      error: error.message,
      nextRefreshAt: new Date(now + MONTH_MS).toISOString()
    };
    await writeMeta(failedMeta);
    logger.warn(`[EmergencyData] Refresh failed: ${error.message}`);
    return failedMeta;
  }
}

export async function getEmergencyDataRefreshStatus() {
  return readMeta();
}

export function startEmergencyDataRefreshSchedule() {
  maybeRefreshEmergencyData().catch((err) => logger.warn(`[EmergencyData] Initial refresh check failed: ${err.message}`));
  setInterval(() => {
    maybeRefreshEmergencyData().catch((err) => logger.warn(`[EmergencyData] Scheduled refresh failed: ${err.message}`));
  }, MONTH_MS);
}
