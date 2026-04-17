/**
 * MSW Node Server
 * Used in Jest / Vitest / Node-based tests to intercept requests server-side.
 *
 * Usage in test setup file:
 *   import { server } from './mocks/node';
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

export const server = setupServer(...handlers);
