/**
 * useWebVitals — observes Core Web Vitals using the PerformanceObserver API.
 *
 * Metrics captured:
 *   LCP  — Largest Contentful Paint
 *   FID  — First Input Delay  (via event-timing)
 *   CLS  — Cumulative Layout Shift
 *   FCP  — First Contentful Paint
 *   TTFB — Time to First Byte  (navigation timing)
 *   INP  — Interaction to Next Paint (where supported)
 *
 * Each metric is reported via an optional `onMetric` callback and, if a
 * backend analytics endpoint is available, posted to `/api/analytics/vitals`.
 *
 * Usage:
 *   // In your root component or main.jsx:
 *   import { reportWebVitals } from '../hooks/useWebVitals';
 *   reportWebVitals(console.log);   // logs every metric
 *
 *   // Or use the React hook inside a component:
 *   import useWebVitals from '../hooks/useWebVitals';
 *   useWebVitals({ onMetric: (m) => console.log(m) });
 */

import { useEffect } from 'react';
import api from '../lib/api';

const RATING_THRESHOLDS = {
  LCP:  { good: 2500, needsImprovement: 4000 },
  FID:  { good: 100,  needsImprovement: 300 },
  CLS:  { good: 0.1,  needsImprovement: 0.25 },
  FCP:  { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800,  needsImprovement: 1800 },
  INP:  { good: 200,  needsImprovement: 500 },
};

function getRating(name, value) {
  const t = RATING_THRESHOLDS[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.needsImprovement) return 'needs-improvement';
  return 'poor';
}

function sendVital(metric) {
  // Best-effort — don't let analytics break the app
  api.post('/analytics/vitals', metric).catch(() => {});
}

/** Observe LCP, FCP, CLS via PerformanceObserver */
function observePaintMetrics(onMetric) {
  if (!('PerformanceObserver' in window)) return;

  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      const value = last.startTime;
      const metric = { name: 'LCP', value, rating: getRating('LCP', value), entries };
      onMetric(metric);
      sendVital(metric);
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  try {
    const fcpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const value = entry.startTime;
          const metric = { name: 'FCP', value, rating: getRating('FCP', value) };
          onMetric(metric);
          sendVital(metric);
        }
      }
    });
    fcpObs.observe({ type: 'paint', buffered: true });
  } catch {}

  try {
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      const metric = { name: 'CLS', value: clsValue, rating: getRating('CLS', clsValue) };
      onMetric(metric);
      sendVital(metric);
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch {}
}

/** Observe FID and INP via event-timing */
function observeInputMetrics(onMetric) {
  if (!('PerformanceObserver' in window)) return;

  try {
    let fidReported = false;
    const fidObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!fidReported) {
          const value = entry.processingStart - entry.startTime;
          const metric = { name: 'FID', value, rating: getRating('FID', value) };
          onMetric(metric);
          sendVital(metric);
          fidReported = true;
        }
        // INP: track max interaction
      }
    });
    fidObs.observe({ type: 'first-input', buffered: true });
  } catch {}

  // INP (Chrome 96+)
  try {
    let maxInp = 0;
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inp = entry.duration;
        if (inp > maxInp) {
          maxInp = inp;
          const metric = { name: 'INP', value: maxInp, rating: getRating('INP', maxInp) };
          onMetric(metric);
          sendVital(metric);
        }
      }
    });
    inpObs.observe({ type: 'event', durationThreshold: 40, buffered: true });
  } catch {}
}

/** Read TTFB from navigation timing */
function observeTTFB(onMetric) {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      const value = nav.responseStart - nav.requestStart;
      const metric = { name: 'TTFB', value, rating: getRating('TTFB', value) };
      onMetric(metric);
      sendVital(metric);
    } else {
      // Wait for navigation entry
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const value = entry.responseStart - entry.requestStart;
          const metric = { name: 'TTFB', value, rating: getRating('TTFB', value) };
          onMetric(metric);
          sendVital(metric);
        }
      }).observe({ type: 'navigation', buffered: true });
    }
  } catch {}
}

/**
 * Standalone reporter — call once, outside React (e.g. in main.jsx).
 */
export function reportWebVitals(onMetric = () => {}) {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return;
  observePaintMetrics(onMetric);
  observeInputMetrics(onMetric);
  observeTTFB(onMetric);
}

/**
 * React hook variant — observe Web Vitals inside a component tree.
 */
export default function useWebVitals({ onMetric } = {}) {
  useEffect(() => {
    const handler = typeof onMetric === 'function' ? onMetric : () => {};
    reportWebVitals(handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
