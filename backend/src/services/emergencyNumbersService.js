import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../data/emergencyNumbers.json');

function readEmergencyNumbers() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

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
  const emergencyNumbers = readEmergencyNumbers();
  if (emergencyNumbers[normalized]) {
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
  
  const emergencyNumbers = readEmergencyNumbers();
  if (!normalizedCode || !emergencyNumbers[normalizedCode]) {
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
  return readEmergencyNumbers();
}

export function isAvailable(countryCode) {
  let normalizedCode = normalizeCountryCode(countryCode);
  if (!normalizedCode) {
    normalizedCode = getCountryByName(countryCode);
  }
  const emergencyNumbers = readEmergencyNumbers();
  return !!(normalizedCode && emergencyNumbers[normalizedCode]);
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
  const emergencyNumbers = readEmergencyNumbers();
  if (normalizedCode && emergencyNumbers[normalizedCode]) {
    const data = emergencyNumbers[normalizedCode];
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
