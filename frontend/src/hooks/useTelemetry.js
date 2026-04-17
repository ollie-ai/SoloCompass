import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { hasConsentFor } from '../components/CookieConsent';

export function useTelemetry() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const trackPageView = useCallback(async (path, referrer = null) => {
    if (!hasConsentFor('analytics')) return;
    try {
      await api.post('/analytics/track', {
        type: 'page_view',
        path,
        referrer: referrer || document.referrer
      });
    } catch (error) {
      console.log('Telemetry: page_view tracked locally');
    }
  }, []);

  const trackEvent = useCallback(async (eventType, properties = {}) => {
    if (!hasConsentFor('analytics')) return;
    try {
      await api.post('/analytics/track', {
        type: 'event',
        eventType,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      });
    } catch (error) {
      console.log('Telemetry: event tracked locally', eventType, properties);
    }
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageView(path, document.referrer);
  }, [location, trackPageView]);

  return { trackPageView, trackEvent };
}

export default useTelemetry;
