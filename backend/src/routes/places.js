import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { searchPlaces, getPlaceDetails, findNearbyPlaces, autocompletePlaces } from '../services/placesService.js';
import logger from '../services/logger.js';

const router = express.Router();

/**
 * Safety-relevant place categories understood by the search and nearby endpoints.
 * These categories match the type values accepted by Google Places / Overpass APIs.
 */
const PLACE_CATEGORIES = [
  { id: 'restaurant',      label: 'Restaurants',       icon: '🍽️', group: 'food_drink' },
  { id: 'cafe',            label: 'Cafes',              icon: '☕', group: 'food_drink' },
  { id: 'bar',             label: 'Bars',               icon: '🍺', group: 'food_drink' },
  { id: 'atm',             label: 'ATMs',               icon: '🏧', group: 'finance' },
  { id: 'bank',            label: 'Banks',              icon: '🏦', group: 'finance' },
  { id: 'pharmacy',        label: 'Pharmacies',         icon: '💊', group: 'health_safety' },
  { id: 'hospital',        label: 'Hospitals',          icon: '🏥', group: 'health_safety' },
  { id: 'doctor',          label: 'Doctors / Clinics',  icon: '🩺', group: 'health_safety' },
  { id: 'police',          label: 'Police Stations',    icon: '🚔', group: 'health_safety' },
  { id: 'embassy',         label: 'Embassies / Consulates', icon: '🏛️', group: 'health_safety' },
  { id: 'fire_station',    label: 'Fire Stations',      icon: '🚒', group: 'health_safety' },
  { id: 'transit_station', label: 'Transport Hubs',     icon: '🚉', group: 'transport' },
  { id: 'bus_station',     label: 'Bus Stations',       icon: '🚌', group: 'transport' },
  { id: 'train_station',   label: 'Train Stations',     icon: '🚆', group: 'transport' },
  { id: 'airport',         label: 'Airports',           icon: '✈️', group: 'transport' },
  { id: 'subway_station',  label: 'Metro / Subway',     icon: '🚇', group: 'transport' },
  { id: 'taxi_stand',      label: 'Taxi Stands',        icon: '🚕', group: 'transport' },
  { id: 'supermarket',     label: 'Supermarkets',       icon: '🛒', group: 'shopping' },
  { id: 'convenience_store', label: 'Convenience Stores', icon: '🏪', group: 'shopping' },
  { id: 'lodging',         label: 'Accommodation',      icon: '🏨', group: 'accommodation' },
  { id: 'tourist_attraction', label: 'Tourist Attractions', icon: '🗺️', group: 'sightseeing' },
  { id: 'museum',          label: 'Museums',            icon: '🏛️', group: 'sightseeing' },
];

router.use(authenticate);

/**
 * GET /places/categories
 * Return the list of predefined place categories (including safety-relevant ones).
 */
router.get('/categories', (req, res) => {
  // Group categories for easier consumption by the UI
  const grouped = PLACE_CATEGORIES.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push({ id: cat.id, label: cat.label, icon: cat.icon });
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      all: PLACE_CATEGORIES,
      grouped,
    },
  });
});

/**
 * GET /places/search?q=restaurants near London&lat=51.5&lng=-0.12&radius=5000
 * Search for places
 */
router.get('/search', async (req, res) => {
  try {
    const { q, query, lat, lng, radius, type, category } = req.query;

    const searchQuery = q || query;
    if (!searchQuery) {
      return res.status(400).json({
        error: 'Missing search query',
        message: 'Please provide a "q" or "query" parameter'
      });
    }

    const results = await searchPlaces(searchQuery, {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: radius ? parseInt(radius) : 5000,
      type,
      category
    });

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error(`[Places] Search failed: ${error.message}`);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /places/nearby?lat=51.5&lng=-0.12&type=restaurant&radius=5000
 * Find nearby places
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, type, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing coordinates',
        message: 'Please provide "lat" and "lng" parameters'
      });
    }

    const results = await findNearbyPlaces(
      parseFloat(lat),
      parseFloat(lng),
      type || 'tourist_attraction',
      radius ? parseInt(radius) : 5000
    );

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error(`[Places] Nearby search failed: ${error.message}`);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /places/details?place_id=ChIJ...
 * Get place details
 */
router.get('/details', async (req, res) => {
  try {
    const { place_id } = req.query;

    if (!place_id) {
      return res.status(400).json({
        error: 'Missing place ID',
        message: 'Please provide a "place_id" parameter'
      });
    }

    const result = await getPlaceDetails(place_id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[Places] Details fetch failed: ${error.message}`);
    res.status(500).json({
      error: 'Details fetch failed',
      message: error.message
    });
  }
});

/**
 * GET /places/:placeId/details
 * Get place details by placeId path param
 */
router.get('/:placeId/details', async (req, res) => {
  try {
    const { placeId } = req.params;
    if (!placeId) {
      return res.status(400).json({
        error: 'Missing place ID',
        message: 'Place ID is required'
      });
    }
    const result = await getPlaceDetails(placeId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[Places] Details by ID fetch failed: ${error.message}`);
    res.status(500).json({
      error: 'Details fetch failed',
      message: error.message
    });
  }
});

/**
 * GET /places/autocomplete?input=London&lat=51.5&lng=-0.12
 * Autocomplete place search
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { input, lat, lng, radius } = req.query;

    if (!input) {
      return res.status(400).json({
        error: 'Missing input',
        message: 'Please provide an "input" parameter'
      });
    }

    const results = await autocompletePlaces(input, {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: radius ? parseInt(radius) : 50000
    });

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error(`[Places] Autocomplete failed: ${error.message}`);
    res.status(500).json({
      error: 'Autocomplete failed',
      message: error.message
    });
  }
});

export default router;
