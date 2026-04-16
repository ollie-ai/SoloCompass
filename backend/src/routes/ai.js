import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { callAI, callAzureOpenAI, getFallbackResponse, getFallbackItinerary, getAIUsageStats } from '../services/aiService.js';
import { requireFeature, checkAILimits, FEATURES } from '../middleware/paywall.js';

const router = express.Router();

/**
 * GET /api/ai/quick-prompts
 * Get suggested prompts for the AI chat
 */
router.get('/quick-prompts', (req, res) => {
  try {
    const prompts = [
      { id: 1, text: 'Best solo destinations for beginners', category: 'destinations' },
      { id: 2, text: 'How to stay safe while traveling alone', category: 'safety' },
      { id: 3, text: 'Budget tips for solo travelers', category: 'budget' },
      { id: 4, text: 'How to meet people while traveling solo', category: 'social' },
      { id: 5, text: 'Packing essentials for a 2-week trip', category: 'packing' },
      { id: 6, text: 'Best times to visit Europe solo', category: 'planning' },
      { id: 7, text: 'What to do if I get lost abroad?', category: 'safety' },
      { id: 8, text: 'How to handle culture shock', category: 'culture' },
    ];
    res.json({ success: true, data: prompts });
  } catch (error) {
    logger.error(`[AI] Failed to fetch prompts: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

/**
 * POST /api/ai/chat
 * AI chat endpoint using Azure OpenAI
 */
router.post('/chat', authenticate, requireFeature(FEATURES.AI_CHAT), checkAILimits, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.http(`[AI] Chat request: "${message.substring(0, 50)}..." - User: ${req.userId}`);

    let response;
    let source = 'azure_openai';
    
    // Use AI orchestrator with automatic fallback chain
    try {
      const systemPrompt = {
        role: 'system',
        content: `You are SoloCompass AI, a knowledgeable and friendly travel advisor specializing in solo travel. 

Your expertise includes:
- Solo travel planning and itinerary creation
- Safety tips and destination-specific advice
- Budget optimization for travelers
- Cultural etiquette and local customs
- Meeting people while traveling alone
- Packing tips and travel essentials
- Emergency procedures abroad

Guidelines:
- Be concise but informative (aim for 2-4 paragraphs max)
- Be encouraging and supportive
- Prioritize safety in all advice
- Suggest specific actions when possible
- Be honest about limitations (e.g., "I recommend checking the FCDO website for the latest advisories")
- If asked about health/medical issues, recommend consulting professionals`
      };

      const conversationHistory = (context || []).slice(-6).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      const messages = [systemPrompt, ...conversationHistory, { role: 'user', content: message }];
      const result = await callAI(messages);
      response = result.content;
      source = result.source;
    } catch (error) {
      logger.warn(`[AI] All providers failed: ${error.message}`);
      response = getFallbackResponse(message);
      source = 'fallback';
    }

    logger.http(`[AI] Chat response received (${source}) - User: ${req.userId}`);

    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString(),
        source
      },
    });
  } catch (error) {
    logger.error(`[AI] Chat failed: ${error.message}`);
    res.json({
      success: true,
      data: {
        response: getFallbackResponse('error'),
        timestamp: new Date().toISOString(),
        source: 'fallback',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
    });
  }
});

/**
 * POST /api/ai/generate-itinerary
 * Generate a travel itinerary using AI
 */
router.post('/generate-itinerary', authenticate, checkAILimits, async (req, res) => {
  try {
    const { destination, days, interests, pace, budget, travelStyle, soloVibe } = req.body;
    
    if (!destination || !days) {
      return res.status(400).json({ error: 'Destination and days are required' });
    }

    logger.http(`[AI] Itinerary request: ${destination}, ${days} days - User: ${req.userId}`);

    const paceNormalized = pace || 'moderate';
    const soloVibeNormalized = soloVibe || 'balanced';
    const travelStyleNormalized = travelStyle || 'standard';

    // 1. Check Cache
    try {
      const cached = await db.prepare(`
        SELECT itinerary_json, created_at FROM ai_itinerary_cache 
        WHERE destination = ? 
          AND days = ? 
          AND pace = ? 
          AND solo_vibe = ? 
          AND travel_style = ?
        LIMIT 1
      `).get(destination.toLowerCase(), days, paceNormalized, soloVibeNormalized, travelStyleNormalized);

      if (cached) {
        logger.info(`[AI] Cache hit for itinerary: ${destination}`);
        return res.json({
          success: true,
          data: {
            itinerary: JSON.parse(cached.itinerary_json),
            timestamp: cached.created_at,
            source: 'cache'
          }
        });
      }
    } catch (cacheError) {
      logger.warn(`[AI] Cache lookup failed: ${cacheError.message}`);
    }

    let response;
    let source = 'azure_openai';

    try {
      const systemPrompt = {
        role: 'system',
        content: `You are SoloCompass AI, an expert solo travel planner. Generate a detailed day-by-day itinerary for solo travelers.

Output format: JSON object with a "days" array, each day having:
- day: number
- date: suggested date
- title: day theme
- activities: array of {time, name, location, duration, cost_estimate, notes}

Consider:
- Solo-friendly venues and restaurants
- Safety considerations
- Mix of activities and relaxation
- Local culture and authentic experiences
- Practical logistics (travel times between locations)`
      };

      const userPrompt = `Generate a ${days}-day solo travel itinerary for ${destination}.

Preferences:
${interests ? `- Interests: ${interests.join(', ')}` : ''}
${paceNormalized ? `- Pace: ${paceNormalized}` : ''}
${budget ? `- Budget: ${budget} GBP` : ''}
${travelStyleNormalized ? `- Travel Style: ${travelStyleNormalized}` : ''}
${soloVibeNormalized ? `- Solo Vibe: ${soloVibeNormalized}` : ''}

Return ONLY valid JSON in this exact format:
{"days": [{"day": 1, "date": "Day 1", "title": "...", "activities": [...]}]}

Do not include any text outside the JSON.`;

      const result = await callAI([systemPrompt, { role: 'user', content: userPrompt }], { json: true, max_tokens: 4000 });
      response = result.content;
      source = result.source;

      // Save to Cache if successful from a live provider
      if (source !== 'fallback') {
        try {
          await db.prepare(`
            INSERT INTO ai_itinerary_cache (destination, days, pace, solo_vibe, travel_style, itinerary_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(destination.toLowerCase(), days, paceNormalized, soloVibeNormalized, travelStyleNormalized, response);
          logger.info(`[AI] Cached new itinerary for: ${destination}`);
        } catch (saveError) {
          logger.warn(`[AI] Failed to save itinerary to cache: ${saveError.message}`);
        }
      }
    } catch (error) {
      logger.warn(`[AI] Itinerary generation failed: ${error.message}`);
      response = JSON.stringify(getFallbackItinerary(destination, days));
      source = 'fallback';
    }

    // Try to parse as JSON
    try {
      const itinerary = JSON.parse(response);
      res.json({
        success: true,
        data: {
          itinerary,
          timestamp: new Date().toISOString(),
          source
        },
      });
    } catch {
      res.json({
        success: true,
        data: {
          response,
          timestamp: new Date().toISOString(),
          source
        },
      });
    }
  } catch (error) {
    logger.error(`[AI] Itinerary generation failed: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate itinerary' 
    });
  }
});

/**
 * POST /api/ai/safety-advice
 * Get safety advice for a specific destination
 */
router.post('/safety-advice', authenticate, requireFeature(FEATURES.AI_SAFETY_ADVICE), checkAILimits, async (req, res) => {
  try {
    const { destination, activity, hour } = req.body;
    
    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    logger.http(`[AI] Safety advice request: ${destination} - User: ${req.userId}`);

    let response;
    let source = 'azure_openai';

    try {
      const systemPrompt = {
        role: 'system',
        content: `You are SoloCompass AI, a safety expert for solo travelers. Provide practical, actionable safety advice.

Include:
- General safety tips for the destination
- Specific precautions for solo travelers
- Areas to avoid if applicable
- Emergency contacts and procedures
- Cultural considerations that affect safety

Be specific and helpful, not alarmist.`
      };

      let userPrompt = `Provide safety advice for a solo traveler visiting ${destination}.`;
      if (activity) userPrompt += `\n\nSpecifically regarding: ${activity}`;
      if (hour) userPrompt += `\n\nTime of day: ${hour}:00`;

      const result = await callAI([systemPrompt, { role: 'user', content: userPrompt }]);
      response = result.content;
      source = result.source;
    } catch (error) {
      logger.warn(`[AI] Safety advice failed: ${error.message}`);
      response = getFallbackResponse('safety');
      source = 'fallback';
    }

    res.json({
      success: true,
      data: {
        response,
        destination,
        timestamp: new Date().toISOString(),
        source
      },
    });
  } catch (error) {
    logger.error(`[AI] Safety advice failed: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get safety advice' 
    });
  }
});

/**
 * GET /api/ai/usage
 * Get current user's AI usage stats for the billing period
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const usage = await getAIUsageStats(db, req.userId);

    // Determine limits based on plan
    const user = await db.get('SELECT subscription_tier, is_premium FROM users WHERE id = $1', req.userId);
    const plan = user?.subscription_tier || 'explorer';
    const limits = plan === 'navigator' || plan === 'guardian' || user?.is_premium
      ? { chat: Infinity, itinerary: Infinity }
      : { chat: 5, itinerary: 1 };

    res.json({
      success: true,
      data: {
        ...usage,
        limits,
        plan
      }
    });
  } catch (error) {
    logger.error(`[AI] Usage stats failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch AI usage' });
  }
});

export default router;
