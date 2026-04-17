import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { searchPlaces, getPlaceDetails, findNearbyPlaces, autocompletePlaces } from '../services/placesService.js';
import logger from '../services/logger.js';

const router = express.Router();

router.use(authenticate);

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
