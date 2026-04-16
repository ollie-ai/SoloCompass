/**
 * AI Service - Multi-provider Fallback Chain
 * Providers: Azure OpenAI → OpenAI Direct → Anthropic → Static Fallback
 */

import logger from './logger.js';

// ── Provider Configurations ──────────────────────────────────────

const getAzureConfig = () => ({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
});

const getOpenAIConfig = () => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
});

const getAnthropicConfig = () => ({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'
});

// ── Individual Provider Calls ────────────────────────────────────

/**
 * Call Azure OpenAI API directly
 */
export async function callAzureOpenAI(messages, options = {}) {
  const { temperature = 0.7, max_tokens = 1000, json = false } = options;
  const config = getAzureConfig();

  if (!config.endpoint || !config.apiKey) {
    throw new Error('Azure OpenAI not configured');
  }

  let baseUrl = config.endpoint;
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }
  if (!baseUrl.endsWith('/')) {
    baseUrl = `${baseUrl}/`;
  }
  const url = `${baseUrl}openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  logger.http(`[AI] Calling Azure OpenAI: ${config.deployment} @ ${baseUrl}`);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages,
        temperature,
        max_tokens,
        ...(json && { response_format: { type: 'json_object' } })
      })
    });
  } catch (fetchErr) {
    const cause = fetchErr.cause?.message || fetchErr.cause?.code || fetchErr.message;
    logger.error(`[AI] Network fetch failed — URL: ${url} — Cause: ${cause}`);
    throw new Error(`Azure OpenAI network error: ${cause}`);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error('Invalid response from Azure OpenAI');
  }

  logger.http(`[AI] Azure OpenAI response received`);
  return data.choices[0].message.content;
}

/**
 * Call OpenAI API directly (non-Azure)
 */
export async function callOpenAIDirect(messages, options = {}) {
  const { temperature = 0.7, max_tokens = 1000, json = false } = options;
  const config = getOpenAIConfig();

  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  logger.http(`[AI] Calling OpenAI Direct: ${config.model}`);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        max_tokens,
        ...(json && { response_format: { type: 'json_object' } })
      })
    });
  } catch (fetchErr) {
    const cause = fetchErr.cause?.message || fetchErr.cause?.code || fetchErr.message;
    logger.error(`[AI] OpenAI Direct fetch failed: ${cause}`);
    throw new Error(`OpenAI network error: ${cause}`);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error('Invalid response from OpenAI');
  }

  logger.http(`[AI] OpenAI Direct response received`);
  return data.choices[0].message.content;
}

/**
 * Call Anthropic Claude API
 */
export async function callAnthropic(messages, options = {}) {
  const { temperature = 0.7, max_tokens = 1000 } = options;
  const config = getAnthropicConfig();

  if (!config.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const url = 'https://api.anthropic.com/v1/messages';
  logger.http(`[AI] Calling Anthropic: ${config.model}`);

  // Convert OpenAI message format to Anthropic format
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens,
        ...(systemMsg && { system: systemMsg.content }),
        messages: nonSystemMsgs,
        temperature
      })
    });
  } catch (fetchErr) {
    const cause = fetchErr.cause?.message || fetchErr.cause?.code || fetchErr.message;
    logger.error(`[AI] Anthropic fetch failed: ${cause}`);
    throw new Error(`Anthropic network error: ${cause}`);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.content || !data.content[0]) {
    throw new Error('Invalid response from Anthropic');
  }

  logger.http(`[AI] Anthropic response received`);
  return data.content[0].text;
}

// ── Orchestrator (fallback chain) ────────────────────────────────

/**
 * Call AI with automatic fallback chain:
 *   Azure OpenAI → OpenAI Direct → Anthropic → static fallback
 * Returns { content, source } where source indicates which provider succeeded.
 */
export async function callAI(messages, options = {}) {
  const providers = [
    { name: 'azure_openai', fn: callAzureOpenAI, check: () => getAzureConfig().endpoint && getAzureConfig().apiKey },
    { name: 'openai_direct', fn: callOpenAIDirect, check: () => !!getOpenAIConfig().apiKey },
    { name: 'anthropic', fn: callAnthropic, check: () => !!getAnthropicConfig().apiKey }
  ];

  for (const provider of providers) {
    if (!provider.check()) continue;
    try {
      const content = await provider.fn(messages, options);
      return { content, source: provider.name };
    } catch (err) {
      logger.warn(`[AI] Provider ${provider.name} failed: ${err.message}`);
    }
  }

  // All providers exhausted → static fallback
  const userMsg = messages.find(m => m.role === 'user')?.content || '';
  return { content: getFallbackResponse(userMsg), source: 'fallback' };
}

/**
 * Get per-user AI usage stats for the current billing month
 */
export async function getAIUsageStats(db, userId) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const rows = await db.all(
    'SELECT type, COALESCE(SUM(count),0) as total FROM ai_usage WHERE user_id = $1 AND month = $2 GROUP BY type',
    userId, currentMonth
  );
  const usage = { chat: 0, itinerary: 0, safety: 0, other: 0, month: currentMonth };
  for (const r of rows) {
    usage[r.type] = parseInt(r.total, 10) || 0;
  }
  return usage;
}

/**
 * Fallback responses when AI is not available
 */
export function getFallbackResponse(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('safe') || lower.includes('danger') || lower.includes('scam')) {
    return `Safety is always the top priority when traveling solo! Here are some essential tips:

1. **Share your itinerary** - Always let someone know your plans and check in regularly
2. **Use SoloCompass Safety Features** - Set up scheduled check-ins and emergency contacts
3. **Stay aware** - Be mindful of your surroundings, especially at night
4. **Trust your instincts** - If something feels wrong, leave immediately
5. **Keep copies of documents** - Store digital copies of your passport and important papers

For real-time safety data, check our FCDO advisories integration in the app.`;
  }
  
  if (lower.includes('budget') || lower.includes('cheap') || lower.includes('money')) {
    return `Great question! Here are my top budget tips for solo travelers:

1. **Accommodation** - Hostels are fantastic for solo travelers (great social atmosphere!) or consider Airbnb for private rooms
2. **Food** - Eat where locals eat! Street food and local markets offer authentic experiences at a fraction of restaurant prices
3. **Transport** - Use public transport, walk when possible, or look for day passes
4. **Activities** - Many museums have free entry days, walking tours by donation, and city cards offer discounted access
5. **Use SoloCompass Budget Tracker** - Keep track of spending in real-time

Pro tip: Set a daily budget and try to stick to it!`;
  }
  
  if (lower.includes('meet') || lower.includes('people') || lower.includes('social')) {
    return `Solo travel doesn't mean being alone! Here are the best ways to meet fellow travelers:

1. **Hostels** - Social common areas and organized events
2. **Free walking tours** - Great for meeting people AND learning about the destination
3. **Food tours or cooking classes** - Bond over shared experiences
4. **Solo traveler meetups** - Check apps like Meetup or local Facebook groups
5. **Use SoloCompass Travel Buddies** - Find compatible travelers heading to the same destination!`;
  }
  
  if (lower.includes('pack') || lower.includes('luggage')) {
    return `Packing smart is an art! Here are my solo travel essentials:

**Documents:** Passport + copies, travel insurance, emergency contacts
**Essentials:** Universal adapter, portable charger, basic first aid, water bottle
**Clothing:** Pack light! 7 days = 7 items, quick-dry fabrics, comfortable shoes
**Tech:** Offline maps, noise-canceling headphones, power bank

Pro tip: Use packing cubes to stay organized!`;
  }
  
  if (lower.includes('where') || lower.includes('destination')) {
    return `Here are some great destinations for solo travelers:

**Beginner Friendly:** Portugal (Lisbon), Japan, Netherlands (Amsterdam)
**Social Vibes:** Thailand, Barcelona, Bali
**Adventure:** Costa Rica, New Zealand, Iceland

Use SoloCompass Destinations to explore safety ratings and personalized recommendations!`;
  }
  
  if (lower.includes('emergency') || lower.includes('lost')) {
    return `I hope you never need this, but here's what to do in an emergency abroad:

**Stay Calm** - Take a deep breath and assess the situation
**Emergency Contacts:** 112 works in most countries, your embassy, SoloCompass SOS
**If lost:** Find a business, use offline maps, look for tourist info centers
**If sick:** Ask accommodation for nearest medical center, contact travel insurance

Keep emergency contacts in the SoloCompass Safety Vault!`;
  }
  
  return `Thanks for your question about solo travel! I can help with safety tips, budget planning, meeting people, packing advice, and destination recommendations.

For real-time safety data and official travel advisories, check out our FCDO integration in the app!`;
}

/**
 * Get safety-specific fallback advice
 */
export function getSafetyFallback(destination) {
  return `Safety is crucial when traveling to ${destination}. Here are general tips:

1. **Research your destination** - Check FCDO advisories for ${destination}
2. **Keep emergency numbers saved** - Local emergency (112), your embassy
3. **Stay connected** - Use SoloCompass check-ins to let contacts know you're safe
4. **Trust your instincts** - If something feels wrong, leave
5. **Blend in** - Learn local customs to avoid standing out as a tourist target

For detailed safety data, check the FCDO advisories in the Safety section of the app.`;
}

/**
 * Get fallback itinerary when AI is unavailable
 */
export function getFallbackItinerary(destination, days) {
  return {
    days: Array.from({ length: Math.min(days, 7) }, (_, i) => ({
      day: i + 1,
      date: `Day ${i + 1}`,
      title: `Day ${i + 1} in ${destination}`,
      activities: [
        { time: '09:00', name: 'Breakfast at local café', location: 'City Center', duration: '1 hour', cost_estimate: '£10-15', notes: 'Ask hotel staff for recommendations' },
        { time: '10:30', name: 'Explore main attractions', location: 'Historic Quarter', duration: '2-3 hours', cost_estimate: '£0-20', notes: 'Check for free entry days' },
        { time: '13:30', name: 'Lunch at local restaurant', location: 'Near attractions', duration: '1.5 hours', cost_estimate: '£15-25', notes: 'Look for "menu of the day" deals' },
        { time: '15:00', name: 'Walking tour or museum', location: 'Various', duration: '2-3 hours', cost_estimate: '£10-25', notes: 'Free walking tours by donation' },
        { time: '18:30', name: 'Solo-friendly dinner', location: 'Safe neighborhood', duration: '1.5 hours', cost_estimate: '£20-35', notes: 'Choose busy, well-lit establishments' }
      ]
    }))
  };
}

export default {
  callAzureOpenAI,
  callOpenAIDirect,
  callAnthropic,
  callAI,
  getAIUsageStats,
  getFallbackResponse,
  getSafetyFallback,
  getFallbackItinerary
};
