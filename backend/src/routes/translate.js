import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../services/logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, FEATURES } from '../middleware/paywall.js';

const router = express.Router();

/**
 * @route POST /api/translate
 * @desc Translate text using Azure AI Translator
 * @access Private
 */
router.post('/', authenticate, requireFeature(FEATURES.QUICK_TRANSLATOR), async (req, res) => {
  const { text, to, from = null } = req.body;
  const apiKey = process.env.AZURE_TRANSLATOR_KEY;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com/';
  const region = process.env.AZURE_TRANSLATOR_REGION;

  if (!text) {
    return res.status(400).json({ error: { message: 'Text is required' } });
  }

  if (!to) {
    return res.status(400).json({ error: { message: 'Target language (to) is required' } });
  }

  if (!apiKey) {
    logger.warn('[Translate] API Key not configured — falling back to mock response');
    return res.json({ 
      data: { 
        translations: [{ text: `[MOCK] ${text}`, to }] 
      }
    });
  }

  try {
    const response = await axios({
      baseURL: endpoint,
      url: '/translate',
      method: 'post',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-type': 'application/json',
        'X-ClientTraceId': uuidv4().toString()
      },
      params: {
        'api-version': '3.0',
        'from': from,
        'to': to
      },
      data: [{
        'text': text
      }],
      responseType: 'json'
    });

    res.json({ data: { translations: response.data[0].translations } });
  } catch (error) {
    logger.error('[Translate] API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: { 
        message: 'Translation failed',
        details: error.response?.data?.[0]?.message || error.message 
      } 
    });
  }
});

export default router;
