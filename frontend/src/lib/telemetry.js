/**
 * SoloCompass — Analytics
 *
 * Tracks page views, events, and session engagement metrics
 * (session duration, active days) to the backend analytics endpoint.
 * Falls back to console logging in development.
 */

import api from './api';

const isProd = import.meta.env.PROD;

// ─── Session duration tracking ────────────────────────────────────────────
// Uses sessionStorage so each browser tab has its own session window.

const SESSION_KEY = 'sc_session_start';

function getOrStartSession() {
  let start = sessionStorage.getItem(SESSION_KEY);
  if (!start) {
    start = Date.now().toString();
    sessionStorage.setItem(SESSION_KEY, start);
  }
  return parseInt(start, 10);
}

function getSessionDurationMs() {
  const start = sessionStorage.getItem(SESSION_KEY);
  return start ? Date.now() - parseInt(start, 10) : 0;
}

/** Send session-end event with accumulated duration (called on beforeunload). */
function flushSessionDuration() {
  const durationMs = getSessionDurationMs();
  if (durationMs < 1000) return; // Ignore sub-second bounces

  const payload = JSON.stringify({
    type: 'event',
    eventType: 'session_end',
    properties: {
      duration_ms: durationMs,
      duration_s: Math.round(durationMs / 1000),
      page_count: parseInt(sessionStorage.getItem('sc_page_count') || '0', 10),
    },
  });

  // sendBeacon is fire-and-forget and works during page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', new Blob([payload], { type: 'application/json' }));
  }
}

/** Track today as an active day (stored in localStorage, sent once per calendar day). */
function trackActiveDay() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('sc_last_active_day');
    if (lastActive === today) return;

    localStorage.setItem('sc_last_active_day', today);

    api.post('/analytics/track', {
      type: 'event',
      eventType: 'active_day',
      properties: { date: today },
    }).catch(() => {});
  } catch (_) { /* storage unavailable */ }
}

/** Install the beforeunload session-flush listener (call once in App.jsx). */
export function initSessionTracking() {
  getOrStartSession(); // ensure session is started
  trackActiveDay();
  window.addEventListener('beforeunload', flushSessionDuration);
  window.addEventListener('pagehide', flushSessionDuration);
}

// ─── Existing exports ─────────────────────────────────────────────────────

export const trackEvent = async (eventName, properties = {}) => {
  if (!isProd) {
    console.log(`[Analytics Event]: ${eventName}`, properties);
  }

  if (window.gtag) {
    window.gtag('event', eventName, properties);
  }

  try {
    await api.post('/analytics/track', { type: 'event', eventType: eventName, properties });
  } catch {
    // Silently fail — analytics shouldn't break the app
  }
};

export const trackPageView = async (url) => {
  if (!isProd) {
    console.log(`[Analytics PageView]: ${url}`);
  }

  // Increment per-session page counter for session_end payload
  try {
    const count = parseInt(sessionStorage.getItem('sc_page_count') || '0', 10);
    sessionStorage.setItem('sc_page_count', (count + 1).toString());
  } catch (_) { /* storage unavailable */ }

  if (window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA_ID, {
      page_path: url,
    });
  }

  try {
    await api.post('/analytics/track', { type: 'page_view', path: url });
  } catch {
    // Silently fail
  }
};
