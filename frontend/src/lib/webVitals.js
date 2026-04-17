/**
 * Core Web Vitals tracking using web-vitals library (if available) or PerformanceObserver fallback
 */
import { trackEvent } from './telemetry';

export function trackWebVitals() {
  // Try web-vitals package first
  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
    const report = ({ name, value, rating }) => {
      trackEvent('web_vital', { metric: name, value: Math.round(value), rating });
    };
    onCLS(report);
    onFID?.(report);
    onFCP(report);
    onLCP(report);
    onTTFB(report);
    onINP?.(report);
  }).catch(() => {
    // Fallback: use PerformanceObserver
    try {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              trackEvent('web_vital', {
                metric: 'LCP',
                value: Math.round(entry.startTime),
                rating: entry.startTime < 2500 ? 'good' : entry.startTime < 4000 ? 'needs-improvement' : 'poor',
              });
            }
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              trackEvent('web_vital', {
                metric: 'CLS',
                value: entry.value,
                rating: entry.value < 0.1 ? 'good' : entry.value < 0.25 ? 'needs-improvement' : 'poor',
              });
            }
          }
        });
        try { observer.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
        try { observer.observe({ type: 'layout-shift', buffered: true }); } catch {}
      }
    } catch {}
  });
}
