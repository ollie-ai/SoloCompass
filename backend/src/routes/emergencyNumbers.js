import express from 'express';
import {
  getEmergencyNumbers,
  getAllEmergencyNumbers,
  isAvailable,
  getEmergencyNumbersRefreshMetadata,
  refreshEmergencyNumbersDataset,
} from '../services/emergencyNumbersService.js';
import logger from '../services/logger.js';

const router = express.Router();

router.get('/refresh-status', (req, res) => {
  res.json({
    success: true,
    data: getEmergencyNumbersRefreshMetadata(),
  });
});

router.post('/refresh', async (req, res) => {
  try {
    const result = await refreshEmergencyNumbersDataset({ force: true });
    res.status(result.refreshed ? 200 : 202).json({
      success: result.refreshed,
      data: result,
    });
  } catch (error) {
    logger.error(`[EmergencyNumbers] Refresh Error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { country } = req.query;
    
    if (country) {
      const numbers = await getEmergencyNumbers(country);
      if (!numbers) {
        return res.status(404).json({ 
          error: 'Not available',
          country,
          available: false
        });
      }
      return res.json(numbers);
    }
    
    const allNumbers = await getAllEmergencyNumbers();
    res.json({ 
      count: Object.keys(allNumbers).length,
      countries: allNumbers
    });
  } catch (error) {
    logger.error(`[EmergencyNumbers] Error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    
    const numbers = await getEmergencyNumbers(countryCode);
    
    if (!numbers) {
      return res.status(404).json({ 
        error: 'Not available',
        countryCode,
        available: false,
        message: `Emergency numbers for ${countryCode} are not available in our dataset`
      });
    }
    
    res.json(numbers);
  } catch (error) {
    logger.error(`[EmergencyNumbers] Error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/check/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const available = isAvailable(countryCode);
    res.json({ countryCode, available });
  } catch (error) {
    logger.error(`[EmergencyNumbers] Error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
