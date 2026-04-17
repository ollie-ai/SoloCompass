import axios from 'axios';
import logger from './logger.js';

// Geoapify API for places search (FREE - 3,000 calls/day)
// Docs: https://www.geoapify.com/places-api
const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1';
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

const placesCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key) {
  const cached = placesCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  placesCache.delete(key);
  return null;
}

function setCache(key, data) {
  placesCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Search for places
 * @param {string} query - Search query
 * @param {object} options - lat, lng, radius, type
 */
export async function searchPlaces(query, options = {}) {
  const { lat, lng, radius = 5000, type, category } = options;
  const apiKey = GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    return [{
      place_id: 'stub-place-1',
      placeId: 'stub-place-1',
      name: `${query} Sample Place`,
      address: '123 Demo Street',
      location: { lat: lat || 51.5074, lng: lng || -0.1278 },
      lat: lat || 51.5074,
      lng: lng || -0.1278,
      lon: lng || -0.1278,
      type: category || type || 'poi',
      category: category || type || 'poi',
      categories: [category || type || 'poi'],
      rating: 4.4,
      photos: [],
      photo_url: null,
    }];
  }
  
  const cacheKey = `search:${query}:${lat}:${lng}:${radius}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = {
      text: query,
      apiKey,
      format: 'json',
      limit: 20,
    };
    
    if (lat && lng && options.countryCode) {
      // Combined filter
      params.filter = `circle:${lng},${lat},${radius},countrycode:${options.countryCode.toLowerCase()}`;
    } else if (lat && lng) {
      // Geoapify filter format: circle:lon,lat,radius
      params.filter = `circle:${lng},${lat},${radius}`;
    } else if (options.countryCode) {
      params.filter = `countrycode:${options.countryCode.toLowerCase()}`;
    }
    
    const response = await axios.get(`${GEOAPIFY_BASE_URL}/geocode/search`, { params });

    const results = (response.data.results || []).map(place => ({
      place_id: place.place_id?.toString() || place.id?.toString(),
      placeId: place.place_id?.toString() || place.id?.toString(),
      name: place.name,
      address: place.formatted || place.address,
      location: { lat: place.lat, lng: place.lon },
      lat: place.lat,
      lng: place.lon,
      lon: place.lon,
      type: place.result_type || place.type,
      category: place.result_type || place.type,
      categories: place.categories || [],
      country: place.country,
      city: place.city || place.town || place.village,
      distance: place.distance,
      rating: place.rank?.confidence ? Number((place.rank.confidence * 5).toFixed(1)) : null,
      photos: [],
      photo_url: null,
    }));

    setCache(cacheKey, results);
    return results;
  } catch (error) {
    logger.error('Places Search Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get place details by ID
 * @param {string} placeId - Geoapify place ID
 */
export async function getPlaceDetails(placeId) {
  const apiKey = GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }
  
  const cacheKey = `details:${placeId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${GEOAPIFY_BASE_URL}/geocode/search`, {
      params: {
        text: placeId,
        apiKey,
        format: 'json',
        limit: 1,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error('Place not found');
    }

    const place = response.data.results[0];
    const result = {
      place_id: place.place_id?.toString() || place.id?.toString(),
      name: place.name,
      address: place.formatted || place.address,
      location: { lat: place.lat, lng: place.lon },
      lat: place.lat,
      lon: place.lon,
      type: place.result_type || place.type,
      categories: place.categories || [],
      country: place.country,
      city: place.city || place.town || place.village,
      postcode: place.postcode,
      state: place.state,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('Place Details Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Find nearby places
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} type - Place type (restaurant, hotel, etc.)
 * @param {number} radius - Search radius in meters
 */
export async function findNearbyPlaces(lat, lng, type = 'catering.restaurant', radius = 5000, options = {}) {
  const apiKey = GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }
  
  const cacheKey = `nearby:${lat}:${lng}:${type}:${radius}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Map common types to Geoapify categories
    const categoryMap = {
      restaurant: 'catering.restaurant',
      hotel: 'accommodation.hotel',
      bar: 'catering.bar',
      cafe: 'catering.cafe',
      attraction: 'tourism.attraction',
      museum: 'entertainment.museum',
      park: 'leisure.park',
      bank: 'service.bank',
      hospital: 'healthcare.hospital',
      pharmacy: 'healthcare.pharmacy',
      police: 'office.government',
      tourist_attraction: 'tourism.attraction',
    };

    const category = categoryMap[type] || type;

    const params = {
      categories: category,
      apiKey,
      limit: 20,
    };

    if (options.countryCode) {
      params.filter = `circle:${lng},${lat},${radius},countrycode:${options.countryCode.toLowerCase()}`;
      params.bias = `proximity:${lng},${lat},countrycode:${options.countryCode.toLowerCase()}`;
    } else {
      params.filter = `circle:${lng},${lat},${radius}`;
      params.bias = `proximity:${lng},${lat}`;
    }

    const response = await axios.get(`${GEOAPIFY_BASE_URL}/places`, {
      params,
    });

    const results = (response.data.results || []).map(place => ({
      place_id: place.place_id?.toString() || place.id?.toString(),
      placeId: place.place_id?.toString() || place.id?.toString(),
      name: place.name,
      address: place.address || place.formatted,
      location: { lat: place.lat, lng: place.lon },
      lat: place.lat,
      lng: place.lon,
      lon: place.lon,
      type: place.categories?.[0] || type,
      category: place.categories?.[0] || type,
      categories: place.categories || [],
      distance: place.distance,
      opening_hours: place.properties?.opening_hours,
      phone: place.properties?.contact?.phone,
      website: place.properties?.contact?.website,
      rating: null,
      photos: [],
      photo_url: null,
    }));

    setCache(cacheKey, results);
    return results;
  } catch (error) {
    logger.error('Nearby Places Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Autocomplete place search (using geocoding)
 * @param {string} input - Search input
 * @param {object} options - lat, lng, radius
 */
export async function autocompletePlaces(input, options = {}) {
  const apiKey = GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    return [];
  }
  
  if (!input || input.length < 2) {
    return [];
  }

  try {
    const params = {
      text: input,
      apiKey,
      format: 'json',
      limit: 10,
    };

    if (options.lat && options.lng && options.countryCode) {
      params.bias = `proximity:${options.lng},${options.lat},countrycode:${options.countryCode.toLowerCase()}`;
      params.filter = `countrycode:${options.countryCode.toLowerCase()}`;
    } else if (options.lat && options.lng) {
      params.bias = `proximity:${options.lng},${options.lat}`;
    } else if (options.countryCode) {
      params.filter = `countrycode:${options.countryCode.toLowerCase()}`;
    }

    const response = await axios.get(`${GEOAPIFY_BASE_URL}/geocode/autocomplete`, {
      params,
    });

    return (response.data.results || []).map(prediction => ({
      place_id: prediction.place_id?.toString() || prediction.id?.toString(),
      placeId: prediction.place_id?.toString() || prediction.id?.toString(),
      description: prediction.formatted || prediction.address,
      structured_formatting: {
        main_text: prediction.name,
        secondary_text: [
          prediction.city || prediction.town || prediction.village,
          prediction.state,
          prediction.country,
        ].filter(Boolean).join(', '),
      },
      lat: prediction.lat,
      lng: prediction.lon,
      lon: prediction.lon,
      type: prediction.result_type,
      category: prediction.result_type,
    }));
  } catch (error) {
    logger.error('Autocomplete Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 */
export async function geocodeAddress(address) {
  const apiKey = GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  try {
    const response = await axios.get(`${GEOAPIFY_BASE_URL}/geocode/search`, {
      params: {
        text: address,
        apiKey,
        format: 'json',
        limit: 1,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error('Address not found');
    }

    const result = response.data.results[0];
    return {
      lat: result.lat,
      lon: result.lon,
      formatted: result.formatted,
      country: result.country,
      city: result.city || result.town || result.village,
      state: result.state,
      postcode: result.postcode,
    };
  } catch (error) {
    logger.error('Geocoding Error:', error.response?.data || error.message);
    throw error;
  }
}

export function clearPlacesCache() {
  placesCache.clear();
}
