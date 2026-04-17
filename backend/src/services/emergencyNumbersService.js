import emergencyNumbers from '../data/emergencyNumbers.json' with { type: 'json' };
import axios from 'axios';
import logger from './logger.js';

const EMERGENCY_TYPES = ['police', 'ambulance', 'fire', 'general'];

let emergencyNumbersData = emergencyNumbers;
let refreshTimer = null;
let refreshMetadata = {
  source: 'static-json',
  lastSuccessfulRefreshAt: null,
  nextScheduledRefreshAt: null,
  lastAttemptAt: null,
  lastError: null,
};

function normalizeCountryCode(countryCode) {
  if (!countryCode) return null;
  const normalized = countryCode.toUpperCase().trim();
  if (emergencyNumbersData[normalized]) {
    return normalized;
  }
  
  const regionMap = {
    'UK': 'GB',
    'ENGLAND': 'GB-ENG',
    'SCOTLAND': 'GB-SCT',
    'WALES': 'GB-WLS',
    'NORTHERN IRELAND': 'GB-NIR',
  };
  
  return regionMap[normalized] || null;
}

function getCountryByName(destination) {
  if (!destination) return null;
  
  const nameToCode = {
    'united kingdom': 'GB',
    'england': 'GB-ENG',
    'scotland': 'GB-SCT',
    'wales': 'GB-WLS',
    'northern ireland': 'GB-NIR',
    'united states': 'US',
    'usa': 'US',
    'canada': 'CA',
    'mexico': 'MX',
    'germany': 'DE',
    'france': 'FR',
    'spain': 'ES',
    'italy': 'IT',
    'portugal': 'PT',
    'netherlands': 'NL',
    'belgium': 'BE',
    'switzerland': 'CH',
    'austria': 'AT',
    'greece': 'GR',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'poland': 'PL',
    'hungary': 'HU',
    'japan': 'JP',
    'thailand': 'TH',
    'indonesia': 'ID',
    'bali': 'ID',
    'singapore': 'SG',
    'vietnam': 'VN',
    'india': 'IN',
    'china': 'CN',
    'south korea': 'KR',
    'korea': 'KR',
    'malaysia': 'MY',
    'philippines': 'PH',
    'australia': 'AU',
    'new zealand': 'NZ',
    'uae': 'AE',
    'dubai': 'AE',
    'israel': 'IL',
    'turkey': 'TR',
    'south africa': 'ZA',
    'egypt': 'EG',
    'morocco': 'MA',
    'kenya': 'KE',
    'brazil': 'BR',
    'argentina': 'AR',
    'peru': 'PE',
    'chile': 'CL',
    'colombia': 'CO',
    'russia': 'RU',
    'ukraine': 'UA',
    'hong kong': 'HK',
    'taiwan': 'TW',
    'saudi arabia': 'SA',
  };
  
  const destLower = destination.toLowerCase().trim();
  return nameToCode[destLower] || null;
}

export async function getEmergencyNumbers(countryCode) {
  let normalizedCode = normalizeCountryCode(countryCode);
  
  if (!normalizedCode) {
    normalizedCode = getCountryByName(countryCode);
  }
  
  if (!normalizedCode || !emergencyNumbersData[normalizedCode]) {
    return null;
  }
  
  const data = emergencyNumbersData[normalizedCode];
  
  return {
    countryCode: normalizedCode,
    numbers: EMERGENCY_TYPES
      .filter(type => data[type])
      .map(type => ({
        type,
        number: data[type],
        available: true
      }))
  };
}

export async function getAllEmergencyNumbers() {
  return emergencyNumbersData;
}

export function isAvailable(countryCode) {
  let normalizedCode = normalizeCountryCode(countryCode);
  if (!normalizedCode) {
    normalizedCode = getCountryByName(countryCode);
  }
  return !!(normalizedCode && emergencyNumbersData[normalizedCode]);
}

// Fetch emergency numbers from external API as fallback
async function fetchEmergencyNumbersFromAPI(countryCode) {
  try {
    // Try to get numbers from a public API or authoritative source
    // This is a placeholder - you could integrate with services like:
    // - numverify.com (phone validation)
    // - Custom scraped data
    // - Government APIs
    
    // For now, return null to indicate fallback not available
    // In production, you would integrate real APIs here
    logger.info(`[EmergencyNumbers] Checking external API for ${countryCode}`);
    return null;
  } catch (error) {
    logger.warn(`[EmergencyNumbers] External API failed for ${countryCode}: ${error.message}`);
    return null;
  }
}

export async function getEmergencyNumbersWithFallback(countryCode) {
  // First try local data
  let normalizedCode = normalizeCountryCode(countryCode);
  
  if (!normalizedCode) {
    normalizedCode = getCountryByName(countryCode);
  }
  
  // Check local data first
  if (normalizedCode && emergencyNumbersData[normalizedCode]) {
    const data = emergencyNumbersData[normalizedCode];
    return {
      countryCode: normalizedCode,
      source: 'local',
      numbers: EMERGENCY_TYPES
        .filter(type => data[type])
        .map(type => ({
          type,
          number: data[type],
          available: true
        }))
    };
  }
  
  // Try external API as fallback
  const apiResult = await fetchEmergencyNumbersFromAPI(countryCode);
  
  if (apiResult) {
    return {
      countryCode: normalizedCode || countryCode,
      source: 'api',
      numbers: apiResult
    };
  }
  
  return null;
}

function computeNextMonthlyRefreshDate(fromDate = new Date()) {
  const next = new Date(fromDate);
  next.setUTCDate(1);
  next.setUTCHours(3, 0, 0, 0);
  if (next <= fromDate) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

function scheduleNextMonthlyRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const nextRun = computeNextMonthlyRefreshDate();
  refreshMetadata.nextScheduledRefreshAt = nextRun.toISOString();
  const delay = Math.max(1_000, nextRun.getTime() - Date.now());

  refreshTimer = setTimeout(async () => {
    await refreshEmergencyNumbersDataset();
    scheduleNextMonthlyRefresh();
  }, delay);

  if (refreshTimer.unref) {
    refreshTimer.unref();
  }
}

export async function refreshEmergencyNumbersDataset({ force = false } = {}) {
  const sourceUrl = process.env.EMERGENCY_NUMBERS_SOURCE_URL;
  refreshMetadata.lastAttemptAt = new Date().toISOString();

  if (!sourceUrl) {
    if (force) {
      logger.warn('[EmergencyNumbers] Forced refresh skipped; EMERGENCY_NUMBERS_SOURCE_URL is not configured');
    } else {
      logger.info('[EmergencyNumbers] Monthly refresh check skipped; EMERGENCY_NUMBERS_SOURCE_URL is not configured');
    }
    return {
      refreshed: false,
      reason: 'source_url_not_configured',
      metadata: getEmergencyNumbersRefreshMetadata(),
    };
  }

  try {
    const response = await axios.get(sourceUrl, {
      timeout: Number(process.env.EMERGENCY_NUMBERS_REFRESH_TIMEOUT_MS) || 15000,
      headers: { Accept: 'application/json' },
    });

    const incoming = response.data;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new Error('Invalid emergency numbers payload received');
    }

    emergencyNumbersData = incoming;
    refreshMetadata = {
      ...refreshMetadata,
      source: sourceUrl,
      lastSuccessfulRefreshAt: new Date().toISOString(),
      lastError: null,
    };

    logger.info(`[EmergencyNumbers] Dataset refreshed successfully (${Object.keys(incoming).length} country entries)`);
    return {
      refreshed: true,
      count: Object.keys(incoming).length,
      metadata: getEmergencyNumbersRefreshMetadata(),
    };
  } catch (error) {
    refreshMetadata.lastError = error.message;
    logger.error(`[EmergencyNumbers] Dataset refresh failed: ${error.message}`);
    return {
      refreshed: false,
      reason: 'refresh_failed',
      error: error.message,
      metadata: getEmergencyNumbersRefreshMetadata(),
    };
  }
}

export function startMonthlyEmergencyNumbersRefresh() {
  if (refreshMetadata.lastSuccessfulRefreshAt == null) {
    refreshMetadata.lastSuccessfulRefreshAt = new Date().toISOString();
  }

  scheduleNextMonthlyRefresh();
  logger.info(`[EmergencyNumbers] Monthly refresh schedule enabled; next run at ${refreshMetadata.nextScheduledRefreshAt}`);
}

export function getEmergencyNumbersRefreshMetadata() {
  const nextRefreshAt = refreshMetadata.nextScheduledRefreshAt
    ? new Date(refreshMetadata.nextScheduledRefreshAt).getTime()
    : null;
  const now = Date.now();

  return {
    ...refreshMetadata,
    refreshInterval: 'monthly',
    nextRefreshInMs: nextRefreshAt ? Math.max(0, nextRefreshAt - now) : null,
    sourceRecordCount: Object.keys(emergencyNumbersData || {}).length,
  };
}
