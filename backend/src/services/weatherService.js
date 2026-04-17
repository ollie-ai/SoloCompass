import axios from 'axios';
import logger from './logger.js';
import db from '../db.js';

// OpenWeatherMap API
// Free tier: 1,000 calls/day
// Docs: https://openweathermap.org/api

const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// In-memory cache as a fast first-layer (avoids a DB round-trip on hot paths)
const weatherCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── In-memory helpers ─────────────────────────────────────────────────────

function getCached(key) {
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  weatherCache.delete(key);
  return null;
}

function setCache(key, data) {
  weatherCache.set(key, { data, timestamp: Date.now() });
}

// ─── DB persistence helpers ────────────────────────────────────────────────

async function getDbCached(key) {
  try {
    const row = await db.get(
      `SELECT data FROM weather_cache WHERE cache_key = ? AND expires_at > datetime('now')`,
      key
    );
    if (row?.data) {
      const parsed = JSON.parse(row.data);
      // Warm the in-memory cache so subsequent requests don't hit the DB
      setCache(key, parsed);
      return parsed;
    }
  } catch (err) {
    logger.warn(`[Weather] DB cache read failed for "${key}": ${err.message}`);
  }
  return null;
}

async function setDbCache(key, data) {
  try {
    const json = JSON.stringify(data);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await db.prepare(
      `INSERT INTO weather_cache (cache_key, data, cached_at, expires_at)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data,
         cached_at = excluded.cached_at,
         expires_at = excluded.expires_at`
    ).run(key, json, expiresAt);
  } catch (err) {
    logger.warn(`[Weather] DB cache write failed for "${key}": ${err.message}`);
  }
}

// ─── Background refresh scheduler ─────────────────────────────────────────

// Refresh weather entries that are within 5 minutes of expiry.
// Runs every 25 minutes so the 30-min window is always fresh.
const REFRESH_INTERVAL_MS = 25 * 60 * 1000;

async function refreshExpiringEntries() {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return;

  try {
    const nearExpiry = await db.all(
      `SELECT cache_key FROM weather_cache
       WHERE expires_at <= datetime('now', '+5 minutes') AND expires_at > datetime('now', '-5 minutes')`
    );

    for (const { cache_key } of (nearExpiry ?? [])) {
      try {
        if (cache_key.startsWith('current:')) {
          const city = cache_key.slice('current:'.length);
          await fetchAndCacheCurrentWeather(city, apiKey);
        } else if (cache_key.startsWith('forecast:')) {
          const city = cache_key.slice('forecast:'.length);
          await fetchAndCacheForecast(city, apiKey);
        }
      } catch (err) {
        logger.warn(`[Weather] Background refresh failed for "${cache_key}": ${err.message}`);
      }
    }
  } catch (err) {
    logger.warn(`[Weather] Background refresh scan failed: ${err.message}`);
  }
}

// Start the scheduler (called once on module load)
setInterval(refreshExpiringEntries, REFRESH_INTERVAL_MS);

// ─── Fetch helpers (used by both public API and background refresh) ────────

async function fetchAndCacheCurrentWeather(city, apiKey) {
  const cacheKey = `current:${city}`;
  const response = await axios.get(`${OWM_BASE_URL}/weather`, {
    params: { q: city, appid: apiKey, units: 'metric' }
  });

  const data = {
    city: response.data.name,
    country: response.data.sys.country,
    temp: Math.round(response.data.main.temp),
    feels_like: Math.round(response.data.main.feels_like),
    humidity: response.data.main.humidity,
    description: response.data.weather[0].description,
    icon: response.data.weather[0].icon,
    icon_url: `https://openweathermap.org/img/wn/${response.data.weather[0].icon}@2x.png`,
    wind_speed: response.data.wind.speed,
    visibility: response.data.visibility,
    sunrise: new Date(response.data.sys.sunrise * 1000).toLocaleTimeString(),
    sunset: new Date(response.data.sys.sunset * 1000).toLocaleTimeString()
  };

  setCache(cacheKey, data);
  await setDbCache(cacheKey, data);
  return data;
}

async function fetchAndCacheForecast(city, apiKey) {
  const cacheKey = `forecast:${city}`;
  const response = await axios.get(`${OWM_BASE_URL}/forecast`, {
    params: { q: city, appid: apiKey, units: 'metric', cnt: 40 }
  });

  const dailyForecasts = {};
  response.data.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toDateString();
    if (!dailyForecasts[dayKey]) {
      dailyForecasts[dayKey] = {
        date: date.toISOString().split('T')[0],
        day_name: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        temps: [], conditions: [], icons: []
      };
    }
    dailyForecasts[dayKey].temps.push(item.main.temp);
    dailyForecasts[dayKey].conditions.push(item.weather[0].description);
    dailyForecasts[dayKey].icons.push(item.weather[0].icon);
  });

  const forecast = Object.values(dailyForecasts).slice(0, 5).map(day => {
    const conditionCounts = {};
    day.conditions.forEach(c => { conditionCounts[c] = (conditionCounts[c] || 0) + 1; });
    const mainCondition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0][0];
    return {
      date: day.date,
      day_name: day.day_name,
      temp_min: Math.round(Math.min(...day.temps)),
      temp_max: Math.round(Math.max(...day.temps)),
      condition: mainCondition,
      icon: day.icons[Math.floor(day.icons.length / 2)]
    };
  });

  const result = {
    city: response.data.city.name,
    country: response.data.city.country,
    forecast
  };

  setCache(cacheKey, result);
  await setDbCache(cacheKey, result);
  return result;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get current weather for a city
 * @param {string} city - City name (e.g., "London,UK")
 * @param {string} apiKey - OpenWeatherMap API key
 */
export async function getCurrentWeather(city, apiKey) {
  const cacheKey = `current:${city}`;

  // 1. In-memory (fastest)
  const memCached = getCached(cacheKey);
  if (memCached) return memCached;

  // 2. DB cache (survives restarts)
  const dbCached = await getDbCached(cacheKey);
  if (dbCached) return dbCached;

  // 3. Live fetch
  try {
    return await fetchAndCacheCurrentWeather(city, apiKey);
  } catch (error) {
    logger.error('Weather API Error:', error.response?.data?.message || error.message);
    throw error;
  }
}

/**
 * Get 5-day forecast for a city
 * @param {string} city - City name
 * @param {string} apiKey - OpenWeatherMap API key
 */
export async function getForecast(city, apiKey) {
  const cacheKey = `forecast:${city}`;

  const memCached = getCached(cacheKey);
  if (memCached) return memCached;

  const dbCached = await getDbCached(cacheKey);
  if (dbCached) return dbCached;

  try {
    return await fetchAndCacheForecast(city, apiKey);
  } catch (error) {
    logger.error('Forecast API Error:', error.response?.data?.message || error.message);
    throw error;
  }
}

/**
 * Get weather by coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiKey - OpenWeatherMap API key
 */
export async function getWeatherByCoords(lat, lon, apiKey) {
  const cacheKey = `coords:${lat},${lon}`;

  const memCached = getCached(cacheKey);
  if (memCached) return memCached;

  const dbCached = await getDbCached(cacheKey);
  if (dbCached) return dbCached;

  try {
    const response = await axios.get(`${OWM_BASE_URL}/weather`, {
      params: { lat, lon, appid: apiKey, units: 'metric' }
    });

    const data = {
      city: response.data.name,
      country: response.data.sys.country,
      temp: Math.round(response.data.main.temp),
      feels_like: Math.round(response.data.main.feels_like),
      humidity: response.data.main.humidity,
      description: response.data.weather[0].description,
      icon: response.data.weather[0].icon,
      icon_url: `https://openweathermap.org/img/wn/${response.data.weather[0].icon}@2x.png`,
      wind_speed: response.data.wind.speed
    };

    setCache(cacheKey, data);
    await setDbCache(cacheKey, data);
    return data;
  } catch (error) {
    logger.error('Weather API Error:', error.response?.data?.message || error.message);
    throw error;
  }
}

// Clear in-memory and DB cache (useful for testing)
export async function clearWeatherCache() {
  weatherCache.clear();
  try {
    await db.prepare('DELETE FROM weather_cache').run();
  } catch (err) {
    logger.warn(`[Weather] DB cache clear failed: ${err.message}`);
  }
}
