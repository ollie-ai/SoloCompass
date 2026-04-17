import { http, HttpResponse } from 'msw';

const API_BASE = '/api';

export const handlers = [
  // ── Trips ──────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/trips`, () =>
    HttpResponse.json({ success: true, data: { trips: [] } })
  ),

  // ── Destinations ───────────────────────────────────────────────────────
  http.get(`${API_BASE}/destinations`, () =>
    HttpResponse.json({ success: true, data: { destinations: [] } })
  ),

  // ── Weather (OpenWeatherMap) ────────────────────────────────────────────
  http.get(`${API_BASE}/weather`, () =>
    HttpResponse.json({
      success: true,
      data: {
        current: { temp: 20, description: 'Sunny', humidity: 50 },
        forecast: [],
      },
    })
  ),

  // ── Stripe (billing) ───────────────────────────────────────────────────
  http.post(`${API_BASE}/billing/create-subscription`, () =>
    HttpResponse.json({ success: true, data: { clientSecret: 'pi_test_secret' } })
  ),

  http.get(`${API_BASE}/billing/subscription`, () =>
    HttpResponse.json({
      success: true,
      data: { subscription: null, tier: 'free' },
    })
  ),

  // ── AI / Atlas ─────────────────────────────────────────────────────────
  http.post(`${API_BASE}/ai/chat`, () =>
    HttpResponse.json({
      success: true,
      data: { message: 'This is a mocked Atlas response.' },
    })
  ),

  // ── Auth ───────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/auth/me`, () =>
    HttpResponse.json({
      success: true,
      data: {
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          is_verified: true,
        },
      },
    })
  ),

  // ── Notifications ──────────────────────────────────────────────────────
  http.get(`${API_BASE}/notifications`, () =>
    HttpResponse.json({ success: true, data: { notifications: [] } })
  ),
];
