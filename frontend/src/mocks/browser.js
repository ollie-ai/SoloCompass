/**
 * MSW Browser Worker
 * Used in development to intercept fetch/XHR requests in the browser.
 *
 * Usage — add to main.jsx (dev only):
 *   if (import.meta.env.DEV) {
 *     const { worker } = await import('./mocks/browser');
 *     await worker.start({ onUnhandledRequest: 'bypass' });
 *   }
 *
 * The service worker file (mockServiceWorker.js) must be present in the
 * public directory. Generate it once with:
 *   npx msw init public/ --save
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';

export const worker = setupWorker(...handlers);
