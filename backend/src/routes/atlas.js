import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { callAzureOpenAI, getFallbackResponse } from '../services/aiService.js';
import { requireFeature, checkAILimits, FEATURES } from '../middleware/paywall.js';
import { sendError } from '../lib/errorCodes.js';
import { atlasLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

// ─── Tool Definitions ────────────────────────────────────────────────────────
const ATLAS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_destinations',
      description: 'Search for travel destinations matching criteria',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query or destination name' },
          region: { type: 'string', description: 'Region or continent filter' },
          budget_level: { type: 'string', enum: ['budget', 'mid-range', 'luxury'] }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_safety_info',
      description: 'Get current safety information and advisories for a destination',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'City or country name' }
        },
        required: ['destination']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather and forecast for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or location' }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: 'Search for places of interest near a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Location to search near' },
          category: { type: 'string', description: 'Category: restaurant, hotel, attraction, cafe, etc.' },
          radius: { type: 'number', description: 'Search radius in meters' }
        },
        required: ['location']
      }
    }
  }
];

// ─── Tool Executor ────────────────────────────────────────────────────────────
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'search_destinations': {
        const rows = await db.all(
          `SELECT id, name, country, description, safety_rating, budget_level, image_url
           FROM destinations WHERE LOWER(name) LIKE ? OR LOWER(country) LIKE ? LIMIT 5`,
          `%${args.query.toLowerCase()}%`, `%${args.query.toLowerCase()}%`
        );
        return { destinations: rows };
      }
      case 'get_safety_info': {
        const dest = await db.get(
          `SELECT name, country, safety_rating, safety_intelligence, fcdo_alert_status
           FROM destinations WHERE LOWER(name) LIKE ? OR LOWER(country) LIKE ? LIMIT 1`,
          `%${args.destination.toLowerCase()}%`, `%${args.destination.toLowerCase()}%`
        );
        return dest || { message: `No specific safety data found for ${args.destination}` };
      }
      case 'get_weather': {
        return { message: `Weather data for ${args.location} would be fetched from weather service`, location: args.location };
      }
      case 'search_places': {
        return { message: `Place search results for ${args.location}`, location: args.location, category: args.category };
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    logger.error(`[Atlas] Tool execution error (${toolName}): ${err.message}`);
    return { error: err.message };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ATLAS_SYSTEM_PROMPT_DEFAULT = `You are Atlas, SoloCompass's intelligent travel companion. You specialize in solo travel planning, safety guidance, and personalised destination advice.

Your expertise:
- Solo travel planning and itinerary creation
- Real-time safety assessments and destination advisories
- Budget optimisation for solo travellers
- Cultural etiquette and local customs
- Meeting people while travelling alone
- Emergency procedures and safety protocols
- Packing tips and travel essentials

Guidelines:
- Be concise, warm, and encouraging
- Prioritise safety in all advice
- Use tools to fetch real data when appropriate
- Reference specific SoloCompass features (trips, check-ins, guardians) when helpful
- Be honest about uncertainty`;

// Cache the system prompt so we hit the DB at most once per process startup,
// then refresh every 10 minutes so edits propagate without a restart.
let _systemPromptCache = null;
let _systemPromptCachedAt = 0;
const PROMPT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getSystemPrompt() {
  const now = Date.now();
  if (_systemPromptCache && now - _systemPromptCachedAt < PROMPT_CACHE_TTL_MS) {
    return _systemPromptCache;
  }
  try {
    const row = await db.get(
      `SELECT content FROM atlas_prompt_templates WHERE name = 'atlas_system' AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`
    );
    _systemPromptCache = row?.content || ATLAS_SYSTEM_PROMPT_DEFAULT;
  } catch {
    _systemPromptCache = ATLAS_SYSTEM_PROMPT_DEFAULT;
  }
  _systemPromptCachedAt = now;
  return _systemPromptCache;
}

async function getConversationMessages(conversationId, limit = 10) {
  const msgs = await db.all(
    `SELECT role, content, tool_calls, tool_call_id FROM atlas_messages
     WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
    conversationId, limit
  );
  return msgs.reverse().map(m => {
    const msg = { role: m.role, content: m.content };
    if (m.tool_calls) msg.tool_calls = JSON.parse(m.tool_calls);
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    return msg;
  });
}

// ─── POST /api/v1/atlas/chat (SSE streaming) ─────────────────────────────────
router.post('/chat', authenticate, requireFeature(FEATURES.AI_CHAT), checkAILimits, atlasLimiter, async (req, res) => {
  const { message, conversationId, context } = req.body;
  if (!message) return sendError(res, 'SC_ERR_400', 'Message is required');

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await db.run(
        `INSERT INTO atlas_conversations (user_id, title, message_count) VALUES (?, ?, 1)`,
        req.userId, message.substring(0, 80)
      );
      convId = conv.lastInsertRowid;
    } else {
      // Verify ownership
      const conv = await db.get('SELECT id FROM atlas_conversations WHERE id = ? AND user_id = ?', convId, req.userId);
      if (!conv) {
        send({ error: { code: 'SC-ERR-404', message: 'Conversation not found' } });
        return res.end();
      }
    }

    send({ event: 'conversation_id', data: { conversationId: convId } });

    // Save user message
    await db.run(
      `INSERT INTO atlas_messages (conversation_id, user_id, role, content) VALUES (?, ?, 'user', ?)`,
      convId, req.userId, message
    );

    // Build message history
    const history = await getConversationMessages(convId, 10);
    const systemPrompt = await getSystemPrompt();
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    // context from client is already captured in DB history; no additional merge needed

    const startTime = Date.now();
    let fullResponse = '';
    let source = 'azure_openai';
    let promptTokens = 0;
    let completionTokens = 0;

    if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
      try {
        const { AzureOpenAI } = await import('openai');
        const client = new AzureOpenAI({
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
        });

        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

        const stream = await client.chat.completions.create({
          model: deployment,
          messages,
          tools: ATLAS_TOOLS,
          tool_choice: 'auto',
          stream: true,
          max_tokens: 2000,
          temperature: 0.7,
        });

        const toolCallsBuffer = [];

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullResponse += delta.content;
            send({ event: 'chunk', data: { content: delta.content } });
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCallsBuffer[tc.index]) {
                  toolCallsBuffer[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                }
                if (tc.id) toolCallsBuffer[tc.index].id = tc.id;
                if (tc.function?.name) toolCallsBuffer[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCallsBuffer[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }

          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
          }
        }

        // Handle tool calls
        if (toolCallsBuffer.length > 0) {
          send({ event: 'tool_calls_start', data: { tools: toolCallsBuffer.map(t => t.function.name) } });

          const toolResults = [];
          for (const tc of toolCallsBuffer) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* invalid JSON from model */ }
            const result = await executeTool(tc.function.name, args);
            toolResults.push({ tool_call_id: tc.id, name: tc.function.name, result });
            send({ event: 'tool_result', data: { tool: tc.function.name, result } });
          }

          // Second call with tool results
          const toolMessages = [
            ...messages,
            { role: 'assistant', content: fullResponse || null, tool_calls: toolCallsBuffer },
            ...toolResults.map(tr => ({
              role: 'tool',
              content: JSON.stringify(tr.result),
              tool_call_id: tr.tool_call_id
            }))
          ];

          const stream2 = await client.chat.completions.create({
            model: deployment,
            messages: toolMessages,
            stream: true,
            max_tokens: 2000,
          });

          let toolResponse = '';
          for await (const chunk of stream2) {
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              toolResponse += delta.content;
              send({ event: 'chunk', data: { content: delta.content } });
            }
          }
          fullResponse = toolResponse || fullResponse;
        }

      } catch (err) {
        logger.warn(`[Atlas] Azure OpenAI streaming failed: ${err.message} — trying OpenAI direct`);

        // Fallback: OpenAI direct API (if OPENAI_API_KEY is configured)
        if (process.env.OPENAI_API_KEY) {
          try {
            const { OpenAI } = await import('openai');
            const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const stream2 = await oai.chat.completions.create({
              model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
              messages,
              stream: true,
              max_tokens: 2000,
              temperature: 0.7,
            });
            source = 'openai_direct';
            for await (const chunk of stream2) {
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                fullResponse += delta.content;
                send({ event: 'chunk', data: { content: delta.content } });
              }
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens || 0;
                completionTokens = chunk.usage.completion_tokens || 0;
              }
            }
          } catch (oaiErr) {
            logger.warn(`[Atlas] OpenAI direct fallback failed: ${oaiErr.message}`);
            fullResponse = getFallbackResponse(message);
            source = 'fallback';
            send({ event: 'chunk', data: { content: fullResponse } });
          }
        } else {
          fullResponse = getFallbackResponse(message);
          source = 'fallback';
          send({ event: 'chunk', data: { content: fullResponse } });
        }
      }
    } else {
      fullResponse = getFallbackResponse(message);
      source = 'fallback';
      send({ event: 'chunk', data: { content: fullResponse } });
    }

    const latencyMs = Date.now() - startTime;

    // Save assistant message
    await db.run(
      `INSERT INTO atlas_messages (conversation_id, user_id, role, content, tokens_used, source) VALUES (?, ?, 'assistant', ?, ?, ?)`,
      convId, req.userId, fullResponse, completionTokens, source
    );

    // Update conversation metadata
    await db.run(
      `UPDATE atlas_conversations SET message_count = message_count + 2, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      convId
    );

    // Log usage (non-critical, swallow errors)
    await db.run(
      `INSERT INTO atlas_usage_logs (user_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, source, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      req.userId, convId, process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      promptTokens, completionTokens, promptTokens + completionTokens, source, latencyMs
    ).catch(e => logger.warn(`[Atlas] Usage log failed: ${e.message}`));

    send({ event: 'done', data: { conversationId: convId, source } });
    res.end();

  } catch (err) {
    logger.error(`[Atlas] Chat error: ${err.message}`);
    send({ event: 'error', data: { code: 'SC-ERR-500', message: 'Chat service error' } });
    res.end();
  }
});

// ─── GET /api/v1/atlas/conversations ─────────────────────────────────────────
router.get('/conversations', authenticate, atlasLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const conversations = await db.all(
      `SELECT id, title, message_count, last_message_at, created_at
       FROM atlas_conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT ? OFFSET ?`,
      req.userId, limit, offset
    );

    const total = await db.get('SELECT COUNT(*) as count FROM atlas_conversations WHERE user_id = ?', req.userId);

    res.json({
      success: true,
      data: conversations,
      pagination: { page, limit, total: total?.count || 0, pages: Math.ceil((total?.count || 0) / limit) }
    });
  } catch (err) {
    logger.error(`[Atlas] List conversations error: ${err.message}`);
    sendError(res, 'SC_ERR_500', 'Failed to list conversations');
  }
});

// ─── GET /api/v1/atlas/conversations/:id ─────────────────────────────────────
router.get('/conversations/:id', authenticate, atlasLimiter, async (req, res) => {
  try {
    const conv = await db.get(
      'SELECT * FROM atlas_conversations WHERE id = ? AND user_id = ?',
      req.params.id, req.userId
    );
    if (!conv) return sendError(res, 'SC_ERR_404', 'Conversation not found');

    const messages = await db.all(
      `SELECT id, role, content, tool_calls, tokens_used, source, created_at
       FROM atlas_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      req.params.id
    );

    res.json({ success: true, data: { ...conv, messages } });
  } catch (err) {
    logger.error(`[Atlas] Get conversation error: ${err.message}`);
    sendError(res, 'SC_ERR_500', 'Failed to get conversation');
  }
});

// ─── DELETE /api/v1/atlas/conversations/:id ───────────────────────────────────
router.delete('/conversations/:id', authenticate, atlasLimiter, async (req, res) => {
  try {
    const conv = await db.get(
      'SELECT id FROM atlas_conversations WHERE id = ? AND user_id = ?',
      req.params.id, req.userId
    );
    if (!conv) return sendError(res, 'SC_ERR_404', 'Conversation not found');

    await db.run('DELETE FROM atlas_conversations WHERE id = ?', req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error(`[Atlas] Delete conversation error: ${err.message}`);
    sendError(res, 'SC_ERR_500', 'Failed to delete conversation');
  }
});

// ─── POST /api/v1/atlas/tools/:toolName ──────────────────────────────────────
router.post('/tools/:toolName', authenticate, atlasLimiter, async (req, res) => {
  const { toolName } = req.params;
  const validTools = ATLAS_TOOLS.map(t => t.function.name);

  if (!validTools.includes(toolName)) {
    return sendError(res, 'SC_ERR_404', `Tool '${toolName}' not found`, { available: validTools });
  }

  try {
    const result = await executeTool(toolName, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[Atlas] Tool execution error: ${err.message}`);
    sendError(res, 'SC_ERR_500', 'Tool execution failed');
  }
});

// ─── GET /api/v1/atlas/suggestions ───────────────────────────────────────────
router.get('/suggestions', authenticate, atlasLimiter, async (req, res) => {
  try {
    const [activeTrips, recentMessages] = await Promise.all([
      db.all(
        `SELECT t.destination FROM trips t WHERE t.user_id = ? AND t.status IN ('planning', 'active') LIMIT 3`,
        req.userId
      ),
      db.all(
        `SELECT am.content FROM atlas_messages am
         JOIN atlas_conversations ac ON am.conversation_id = ac.id
         WHERE ac.user_id = ? AND am.role = 'user' ORDER BY am.created_at DESC LIMIT 5`,
        req.userId
      ).catch(() => [])
    ]);

    const suggestions = [];

    if (activeTrips.length > 0) {
      const dest = activeTrips[0].destination;
      suggestions.push(
        { id: 'ctx-1', text: `Safety tips for ${dest}`, category: 'safety', contextual: true },
        { id: 'ctx-2', text: `Best solo restaurants in ${dest}`, category: 'food', contextual: true },
        { id: 'ctx-3', text: `Local transport guide for ${dest}`, category: 'transport', contextual: true }
      );
    }

    suggestions.push(
      { id: 'gen-1', text: 'Best solo travel destinations for beginners', category: 'destinations' },
      { id: 'gen-2', text: 'How to stay safe while travelling alone', category: 'safety' },
      { id: 'gen-3', text: 'Budget tips for solo travellers', category: 'budget' },
      { id: 'gen-4', text: 'How to meet people while travelling solo', category: 'social' },
      { id: 'gen-5', text: 'Packing essentials for a 2-week trip', category: 'packing' },
      { id: 'gen-6', text: 'What to do if I get lost abroad?', category: 'safety' }
    );

    // recentMessages could be used for future contextual suggestions
    void recentMessages;

    res.json({ success: true, data: suggestions.slice(0, 8) });
  } catch (err) {
    logger.error(`[Atlas] Suggestions error: ${err.message}`);
    sendError(res, 'SC_ERR_500', 'Failed to get suggestions');
  }
});

export default router;
