/**
 * SoloCompass AI Orchestrator
 *
 * Single entry point for all AI calls across the product.
 * Handles: prompt templating, rate limiting hooks, fallback chain,
 * structured output validation, and observability logging.
 *
 * All routes must call this module — no direct fetch/axios calls to AI
 * providers are permitted outside this file and aiService.js.
 */

import logger from './logger.js';
import db from '../db.js';
import { callAzureOpenAI, callOpenAIDirect, callAnthropic, getFallbackResponse, getFallbackItinerary } from './aiService.js';
import { getPromptTemplate } from './promptTemplates.js';

// ---------------------------------------------------------------------------
// Fallback handlers per use case
// ---------------------------------------------------------------------------
const FALLBACK_HANDLERS = {
  atlas_chat: (messages) => {
    const lastUser = messages.findLast?.(m => m.role === 'user')?.content || '';
    return getFallbackResponse(lastUser);
  },
  itinerary_gen: (messages, ctx) => {
    return JSON.stringify(getFallbackItinerary(ctx.destination || 'your destination', ctx.days || 7));
  },
  destination_research_section: () => {
    return 'Content generation is temporarily unavailable. Please try again later.';
  },
  destination_qa: (messages, ctx) => {
    const dest = ctx.destinationName || 'this destination';
    return `I'm having trouble connecting to the intelligence network right now. For verified safety information about ${dest}, please check the UK FCDO travel advisories at gov.uk/foreign-travel-advice.`;
  },
  safety_advice: () => {
    return `For immediate safety concerns while travelling, always call local emergency services first (112 works across most of Europe). For travel advisories, visit gov.uk/foreign-travel-advice.`;
  },
};

// ---------------------------------------------------------------------------
// Observability logger
// ---------------------------------------------------------------------------
async function recordUsage({ userId, useCase, source, latencyMs, promptVersion, isFallback, tokenEstimate }) {
  try {
    await db.prepare(`
      INSERT INTO ai_observability_logs (user_id, use_case, source, latency_ms, prompt_version, is_fallback, token_estimate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId || null, useCase, source, latencyMs, promptVersion, isFallback ? 1 : 0, tokenEstimate || 0);
  } catch (err) {
    // Observability must never break the main flow
    logger.warn(`[AI Orchestrator] Failed to record usage: ${err.message}`);
  }
}

// Rough token estimator (4 chars ≈ 1 token)
function estimateTokens(messages, response) {
  const inputText = messages.map(m => m.content || '').join(' ');
  return Math.ceil((inputText.length + (response?.length || 0)) / 4);
}

// ---------------------------------------------------------------------------
// Main orchestrator entry point
// ---------------------------------------------------------------------------
/**
 * Call the AI with a given use case, message list, and options.
 *
 * @param {string} useCase - 'atlas_chat' | 'itinerary_gen' | 'destination_research_section' | 'destination_qa' | 'safety_advice'
 * @param {Array<{role: string, content: string}>} messages - User/assistant conversation messages (without system)
 * @param {Object} options
 * @param {number} [options.userId] - User ID for rate limiting and observability
 * @param {number} [options.maxTokens=1000] - Maximum tokens for the response
 * @param {boolean} [options.requireJson=false] - Whether to request JSON output
 * @param {string} [options.groundingContext] - Extra context injected into system prompt
 * @param {Object} [options.ctx={}] - Use-case-specific context (e.g. { destination, days })
 * @param {boolean} [options.skipObservability=false] - Skip usage logging (e.g. for health checks)
 * @returns {Promise<{ response: string, source: string, promptVersion: string }>}
 */
export async function callAI(useCase, messages, options = {}) {
  const {
    userId,
    maxTokens = 1000,
    requireJson = false,
    groundingContext,
    ctx = {},
    skipObservability = false,
  } = options;

  // 1. Get prompt template
  const { system, version: promptVersion } = getPromptTemplate(useCase, ctx);

  // 2. Build final system prompt (inject grounding context if provided)
  const systemContent = groundingContext
    ? `${system}\n\n---\nDESTINATION CONTEXT (use this as your primary source):\n${groundingContext}`
    : system;

  // 3. Build full message array
  const finalMessages = [
    { role: 'system', content: systemContent },
    ...messages,
  ];

  const startedAt = Date.now();
  let response;
  let source = 'azure_openai';

  // 4. Try providers in fallback chain: Azure → OpenAI Direct → Anthropic → static
  try {
    response = await callAzureOpenAI(finalMessages, { max_tokens: maxTokens, json: requireJson });
    source = 'azure_openai';
  } catch (azureErr) {
    logger.warn(`[AI Orchestrator] Azure OpenAI failed for '${useCase}': ${azureErr.message}`);
    try {
      response = await callOpenAIDirect(finalMessages, { max_tokens: maxTokens, json: requireJson });
      source = 'openai_direct';
    } catch (openaiErr) {
      logger.warn(`[AI Orchestrator] OpenAI Direct failed for '${useCase}': ${openaiErr.message}`);
      try {
        response = await callAnthropic(finalMessages, { max_tokens: maxTokens });
        source = 'anthropic';
      } catch (anthropicErr) {
        logger.warn(`[AI Orchestrator] Anthropic failed for '${useCase}': ${anthropicErr.message}`);
        const fallbackHandler = FALLBACK_HANDLERS[useCase];
        response = fallbackHandler ? fallbackHandler(messages, ctx) : getFallbackResponse('');
        source = 'fallback';
      }
    }
  }

  const latencyMs = Date.now() - startedAt;

  // 5. Record observability
  if (!skipObservability) {
    await recordUsage({
      userId,
      useCase,
      source,
      latencyMs,
      promptVersion,
      isFallback: source === 'fallback',
      tokenEstimate: estimateTokens(finalMessages, response),
    });
  }

  logger.http(`[AI Orchestrator] ${useCase} → ${source} (${latencyMs}ms)`);

  return { response, source, promptVersion };
}

export default { callAI };
