/**
 * dateUtils.js
 *
 * Timezone-aware date/time helpers.  All functions accept an optional
 * `timezone` (IANA string, e.g. "Europe/London") and `locale` string
 * so callers can forward the user's stored preferences.
 */

/** Fallback to the browser's local timezone when none is provided. */
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Format a date value according to the user's timezone and locale.
 *
 * @param {Date|string|number} date
 * @param {object} [opts]
 * @param {string}  [opts.timezone]   IANA timezone (e.g. "America/New_York")
 * @param {string}  [opts.locale]     BCP-47 locale (e.g. "en-GB")
 * @param {'short'|'medium'|'long'|'full'} [opts.dateStyle]
 * @param {'short'|'medium'|'long'|'full'} [opts.timeStyle]
 * @returns {string}
 */
export function formatDate(date, { timezone, locale, dateStyle = 'medium', timeStyle } = {}) {
  const tz = timezone || browserTz();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return 'Invalid date';

  const fmtOptions = { timeZone: tz };
  if (dateStyle) fmtOptions.dateStyle = dateStyle;
  if (timeStyle) fmtOptions.timeStyle = timeStyle;

  return new Intl.DateTimeFormat(locale || 'en-GB', fmtOptions).format(d);
}

/**
 * Format a date-only value (no time portion).
 */
export function formatDateOnly(date, { timezone, locale, dateStyle = 'medium' } = {}) {
  return formatDate(date, { timezone, locale, dateStyle });
}

/**
 * Format a time-only value.
 */
export function formatTimeOnly(date, { timezone, locale, timeStyle = 'short' } = {}) {
  const tz = timezone || browserTz();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return 'Invalid date';
  return new Intl.DateTimeFormat(locale || 'en-GB', { timeZone: tz, timeStyle }).format(d);
}

/**
 * Format a date-time value for display (date + time).
 */
export function formatDateTime(date, { timezone, locale, dateStyle = 'medium', timeStyle = 'short' } = {}) {
  return formatDate(date, { timezone, locale, dateStyle, timeStyle });
}

/**
 * Return a relative time string ("2 hours ago", "in 3 days").
 */
export function formatRelative(date, { locale } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return 'Invalid date';
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale || 'en', { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffSec) < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (Math.abs(diffSec) < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (Math.abs(diffSec) < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (Math.abs(diffSec) < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
}

/**
 * Convert a UTC ISO string to a local date-time string in the given timezone.
 *
 * @param {string} isoString  UTC ISO 8601 string
 * @param {string} timezone   IANA timezone
 * @returns {string}          Local representation
 */
export function utcToLocal(isoString, timezone) {
  return formatDateTime(isoString, { timezone, dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Given a user preferences object `{ timezone, locale }` (as stored in the
 * profile/settings store), return a pre-bound formatter set.
 *
 * @param {object} [prefs]
 * @param {string} [prefs.timezone]
 * @param {string} [prefs.locale]
 * @returns {{ date, time, dateTime, relative }}
 */
export function buildFormatters(prefs = {}) {
  const { timezone, locale } = prefs;
  return {
    date: (d, opts = {}) => formatDateOnly(d, { timezone, locale, ...opts }),
    time: (d, opts = {}) => formatTimeOnly(d, { timezone, locale, ...opts }),
    dateTime: (d, opts = {}) => formatDateTime(d, { timezone, locale, ...opts }),
    relative: (d) => formatRelative(d, { locale }),
  };
}
