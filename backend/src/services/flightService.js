import axios from 'axios';
import logger from './logger.js';
import { getAirportTimezoneByIata, formatAirportLocalTime } from './timezoneService.js';

const AVIATIONSTACK_BASE_URL = 'https://api.aviationstack.com/v1';

const flightCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key) {
  const cached = flightCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  flightCache.delete(key);
  return null;
}

function setCache(key, data) {
  flightCache.set(key, { data, timestamp: Date.now() });
}

export async function getFlightStatus(flightNumber, date, apiKey) {
  const cacheKey = `flight:${flightNumber}:${date}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      params: {
        access_key: apiKey,
        flight_iata: flightNumber.toUpperCase(),
        flight_date: date
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'Flight API error');
    }

    const flights = response.data.data || [];
    
    if (flights.length === 0) {
      return null;
    }

    const flight = flights[0];
    
    const result = {
      flight_id: flight.id,
      flight_number: flight.flight.iata,
      airline: flight.airline?.name || flight.airline?.iata,
      airline_iata: flight.airline?.iata,
      departure: {
        airport: flight.departure?.airport,
        iata: flight.departure?.iata,
        terminal: flight.departure?.terminal,
        gate: flight.departure?.gate,
        scheduled: flight.departure?.scheduled,
        estimated: flight.departure?.estimated,
        actual: flight.departure?.actual,
        delay: flight.departure?.delay,
        city: flight.departure?.city,
        country: flight.departure?.country,
        timezone: flight.departure?.timezone || getAirportTimezoneByIata(flight.departure?.iata)?.timezone || null,
        local_time_label: formatAirportLocalTime(flight.departure?.scheduled || flight.departure?.estimated, flight.departure?.iata),
      },
      arrival: {
        airport: flight.arrival?.airport,
        iata: flight.arrival?.iata,
        terminal: flight.arrival?.terminal,
        gate: flight.arrival?.gate,
        baggage: flight.arrival?.baggage,
        scheduled: flight.arrival?.scheduled,
        estimated: flight.arrival?.estimated,
        actual: flight.arrival?.actual,
        delay: flight.arrival?.delay,
        city: flight.arrival?.city,
        country: flight.arrival?.country,
        timezone: flight.arrival?.timezone || getAirportTimezoneByIata(flight.arrival?.iata)?.timezone || null,
        local_time_label: formatAirportLocalTime(flight.arrival?.scheduled || flight.arrival?.estimated, flight.arrival?.iata),
      },
      status: flight.flight_status,
      aircraft: flight.aircraft?.iata || flight.aircraft?.model,
      codeshare: flight.codeshare?.airline_name,
      updated: new Date().toISOString()
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('Flight Status API Error:', error.response?.data?.error?.message || error.message);
    throw error;
  }
}

export async function getFlightById(flightId, apiKey) {
  const cacheKey = `flight_id:${flightId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      params: {
        access_key: apiKey,
        flight_id: flightId
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'Flight API error');
    }

    const flights = response.data.data || [];
    
    if (flights.length === 0) {
      return null;
    }

    const flight = flights[0];
    
    const result = {
      flight_id: flight.id,
      flight_number: flight.flight.iata,
      airline: flight.airline?.name || flight.airline?.iata,
      airline_iata: flight.airline?.iata,
      departure: {
        airport: flight.departure?.airport,
        iata: flight.departure?.iata,
        terminal: flight.departure?.terminal,
        gate: flight.departure?.gate,
        scheduled: flight.departure?.scheduled,
        estimated: flight.departure?.estimated,
        actual: flight.departure?.actual,
        delay: flight.departure?.delay,
        city: flight.departure?.city,
        country: flight.departure?.country,
        timezone: flight.departure?.timezone || getAirportTimezoneByIata(flight.departure?.iata)?.timezone || null,
        local_time_label: formatAirportLocalTime(flight.departure?.scheduled || flight.departure?.estimated, flight.departure?.iata),
      },
      arrival: {
        airport: flight.arrival?.airport,
        iata: flight.arrival?.iata,
        terminal: flight.arrival?.terminal,
        gate: flight.arrival?.gate,
        baggage: flight.arrival?.baggage,
        scheduled: flight.arrival?.scheduled,
        estimated: flight.arrival?.estimated,
        actual: flight.arrival?.actual,
        delay: flight.arrival?.delay,
        city: flight.arrival?.city,
        country: flight.arrival?.country,
        timezone: flight.arrival?.timezone || getAirportTimezoneByIata(flight.arrival?.iata)?.timezone || null,
        local_time_label: formatAirportLocalTime(flight.arrival?.scheduled || flight.arrival?.estimated, flight.arrival?.iata),
      },
      status: flight.flight_status,
      aircraft: flight.aircraft?.iata || flight.aircraft?.model,
      codeshare: flight.codeshare?.airline_name,
      updated: new Date().toISOString()
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('Flight Status API Error:', error.response?.data?.error?.message || error.message);
    throw error;
  }
}

export function clearFlightCache() {
  flightCache.clear();
}
