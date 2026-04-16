/**
 * SoloCompass — Analytics
 * 
 * Tracks page views and events to the backend analytics endpoint.
 * Falls back to console logging in development.
 */

import api from './api';

const isProd = import.meta.env.PROD;

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
