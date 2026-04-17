/**
 * SoloCompass Error Taxonomy — SC-ERR-XXX codes
 *
 * Standard error codes used across the API.
 * Format: SC-ERR-{category}{number}
 *
 * Categories:
 *   000-099  Generic / HTTP standard
 *   100-199  Auth & Authorization
 *   200-299  User / Profile
 *   300-399  Trips & Itinerary
 *   400-499  AI / Atlas
 *   500-599  Safety / Check-in
 *   600-699  Billing / Paywall
 *   700-799  Maps / Places
 *   800-899  Content
 *   900-999  Platform / Internal
 */

export const ERROR_CODES = {
  // ── Generic ───────────────────────────────────────────────────────────────
  SC_ERR_400: { code: 'SC-ERR-400', httpStatus: 400, message: 'Bad request' },
  SC_ERR_401: { code: 'SC-ERR-401', httpStatus: 401, message: 'Authentication required' },
  SC_ERR_403: { code: 'SC-ERR-403', httpStatus: 403, message: 'Access denied' },
  SC_ERR_404: { code: 'SC-ERR-404', httpStatus: 404, message: 'Resource not found' },
  SC_ERR_409: { code: 'SC-ERR-409', httpStatus: 409, message: 'Conflict' },
  SC_ERR_429: { code: 'SC-ERR-429', httpStatus: 429, message: 'Rate limit exceeded' },
  SC_ERR_500: { code: 'SC-ERR-500', httpStatus: 500, message: 'Internal server error' },

  // ── Auth ──────────────────────────────────────────────────────────────────
  SC_ERR_101: { code: 'SC-ERR-101', httpStatus: 401, message: 'Invalid or expired token' },
  SC_ERR_102: { code: 'SC-ERR-102', httpStatus: 401, message: 'Token refresh required' },
  SC_ERR_103: { code: 'SC-ERR-103', httpStatus: 403, message: 'Insufficient permissions' },
  SC_ERR_104: { code: 'SC-ERR-104', httpStatus: 401, message: 'Invalid credentials' },
  SC_ERR_105: { code: 'SC-ERR-105', httpStatus: 403, message: 'Account locked' },
  SC_ERR_106: { code: 'SC-ERR-106', httpStatus: 403, message: 'Email not verified' },

  // ── User / Profile ────────────────────────────────────────────────────────
  SC_ERR_201: { code: 'SC-ERR-201', httpStatus: 409, message: 'Email already in use' },
  SC_ERR_202: { code: 'SC-ERR-202', httpStatus: 404, message: 'User not found' },
  SC_ERR_203: { code: 'SC-ERR-203', httpStatus: 400, message: 'Invalid profile data' },

  // ── Trips ─────────────────────────────────────────────────────────────────
  SC_ERR_301: { code: 'SC-ERR-301', httpStatus: 404, message: 'Trip not found' },
  SC_ERR_302: { code: 'SC-ERR-302', httpStatus: 403, message: 'Trip limit reached for your plan' },
  SC_ERR_303: { code: 'SC-ERR-303', httpStatus: 400, message: 'Invalid trip data' },
  SC_ERR_304: { code: 'SC-ERR-304', httpStatus: 409, message: 'Itinerary already generated' },

  // ── AI / Atlas ────────────────────────────────────────────────────────────
  SC_ERR_401_AI: { code: 'SC-ERR-401', httpStatus: 403, message: 'AI feature not included in your plan' },
  SC_ERR_402: { code: 'SC-ERR-402', httpStatus: 429, message: 'AI usage limit reached' },
  SC_ERR_403_AI: { code: 'SC-ERR-403', httpStatus: 503, message: 'AI service temporarily unavailable' },
  SC_ERR_404_CONV: { code: 'SC-ERR-404', httpStatus: 404, message: 'Conversation not found' },
  SC_ERR_405: { code: 'SC-ERR-405', httpStatus: 400, message: 'Unknown Atlas tool' },

  // ── Safety / Check-in ────────────────────────────────────────────────────
  SC_ERR_501: { code: 'SC-ERR-501', httpStatus: 404, message: 'Check-in schedule not found' },
  SC_ERR_502: { code: 'SC-ERR-502', httpStatus: 400, message: 'Invalid check-in window' },
  SC_ERR_503: { code: 'SC-ERR-503', httpStatus: 404, message: 'Guardian not found' },
  SC_ERR_504: { code: 'SC-ERR-504', httpStatus: 400, message: 'SOS already triggered' },

  // ── Billing / Paywall ────────────────────────────────────────────────────
  SC_ERR_601: { code: 'SC-ERR-601', httpStatus: 402, message: 'Feature requires a paid plan' },
  SC_ERR_602: { code: 'SC-ERR-602', httpStatus: 402, message: 'Subscription expired' },
  SC_ERR_603: { code: 'SC-ERR-603', httpStatus: 400, message: 'Invalid billing information' },

  // ── Maps / Places ────────────────────────────────────────────────────────
  SC_ERR_701: { code: 'SC-ERR-701', httpStatus: 503, message: 'Geocoding service unavailable' },
  SC_ERR_702: { code: 'SC-ERR-702', httpStatus: 400, message: 'Invalid coordinates' },
  SC_ERR_703: { code: 'SC-ERR-703', httpStatus: 404, message: 'Place not found' },

  // ── Content ───────────────────────────────────────────────────────────────
  SC_ERR_801: { code: 'SC-ERR-801', httpStatus: 404, message: 'Guide not found' },
  SC_ERR_802: { code: 'SC-ERR-802', httpStatus: 404, message: 'Tip not found' },

  // ── Platform / Internal ───────────────────────────────────────────────────
  SC_ERR_901: { code: 'SC-ERR-901', httpStatus: 503, message: 'Database connection unavailable' },
  SC_ERR_902: { code: 'SC-ERR-902', httpStatus: 503, message: 'External service unavailable' },
  SC_ERR_903: { code: 'SC-ERR-903', httpStatus: 500, message: 'Feature flag evaluation failed' },
};

/**
 * Build a standard error response object
 * @param {string} codeKey - Key from ERROR_CODES (e.g. 'SC_ERR_404')
 * @param {string} [overrideMessage] - Optional override message
 * @param {object} [details] - Optional additional details
 * @returns {{ code: string, message: string, details?: object }}
 */
export function buildError(codeKey, overrideMessage, details) {
  const def = ERROR_CODES[codeKey] || ERROR_CODES.SC_ERR_500;
  const error = { code: def.code, message: overrideMessage || def.message };
  if (details) error.details = details;
  return error;
}

/**
 * Send a standard error response
 */
export function sendError(res, codeKey, overrideMessage, details) {
  const def = ERROR_CODES[codeKey] || ERROR_CODES.SC_ERR_500;
  return res.status(def.httpStatus).json({
    success: false,
    error: buildError(codeKey, overrideMessage, details),
  });
}

export default ERROR_CODES;
