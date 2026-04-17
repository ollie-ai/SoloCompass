/**
 * useCurrency — locale-aware currency formatting hook.
 *
 * Priority order for resolving the preferred currency:
 *   1. User preference stored in localStorage (`solocompass_currency`)
 *   2. Currency inferred from `navigator.language` (e.g. en-US → USD)
 *   3. Fallback to USD
 */

import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'solocompass_currency';

/** Map of BCP 47 region tags to ISO 4217 currency codes */
const LOCALE_CURRENCY_MAP = {
  'en-US': 'USD', 'en-CA': 'CAD', 'en-AU': 'AUD', 'en-NZ': 'NZD',
  'en-GB': 'GBP', 'en-IE': 'EUR', 'en-IN': 'INR', 'en-SG': 'SGD',
  'en-ZA': 'ZAR', 'en-NG': 'NGN', 'en-KE': 'KES', 'en-PH': 'PHP',
  'de-DE': 'EUR', 'de-AT': 'EUR', 'de-CH': 'CHF',
  'fr-FR': 'EUR', 'fr-BE': 'EUR', 'fr-CA': 'CAD', 'fr-CH': 'CHF',
  'es-ES': 'EUR', 'es-MX': 'MXN', 'es-AR': 'ARS', 'es-CO': 'COP',
  'es-CL': 'CLP', 'es-PE': 'PEN',
  'pt-BR': 'BRL', 'pt-PT': 'EUR',
  'it-IT': 'EUR',
  'nl-NL': 'EUR', 'nl-BE': 'EUR',
  'pl-PL': 'PLN',
  'cs-CZ': 'CZK',
  'sv-SE': 'SEK',
  'da-DK': 'DKK',
  'nb-NO': 'NOK', 'nn-NO': 'NOK',
  'fi-FI': 'EUR',
  'ru-RU': 'RUB',
  'uk-UA': 'UAH',
  'tr-TR': 'TRY',
  'ar-AE': 'AED', 'ar-SA': 'SAR',
  'he-IL': 'ILS',
  'ja-JP': 'JPY',
  'zh-CN': 'CNY', 'zh-TW': 'TWD', 'zh-HK': 'HKD',
  'ko-KR': 'KRW',
  'th-TH': 'THB',
  'vi-VN': 'VND',
  'id-ID': 'IDR',
  'ms-MY': 'MYR',
  'hi-IN': 'INR',
};

function detectLocaleCurrency() {
  const locale = navigator.language || navigator.languages?.[0] || '';
  if (LOCALE_CURRENCY_MAP[locale]) return LOCALE_CURRENCY_MAP[locale];

  // Try region-only match (e.g. "en" → try "en-US")
  const lang = locale.split('-')[0];
  const match = Object.keys(LOCALE_CURRENCY_MAP).find((k) => k.startsWith(lang + '-'));
  return match ? LOCALE_CURRENCY_MAP[match] : 'USD';
}

function getStoredCurrency() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeCurrency(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private browsing may block writes
  }
}

/**
 * Format `amount` as a localised currency string.
 * Uses the browser's built-in `Intl.NumberFormat` — no network requests.
 */
export function formatCurrency(amount, currencyCode, locale = undefined) {
  const code = currencyCode || 'USD';
  try {
    return new Intl.NumberFormat(locale || navigator.language || 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Hook providing the preferred currency code and a format helper.
 *
 * @returns {{
 *   currency: string,
 *   setCurrency: (code: string) => void,
 *   format: (amount: number, overrideCurrency?: string) => string,
 * }}
 */
export default function useCurrency() {
  const [currency, setCurrencyState] = useState(
    () => getStoredCurrency() || detectLocaleCurrency(),
  );

  const setCurrency = useCallback((code) => {
    storeCurrency(code);
    setCurrencyState(code);
  }, []);

  const format = useCallback(
    (amount, overrideCurrency) => formatCurrency(amount, overrideCurrency || currency),
    [currency],
  );

  return useMemo(
    () => ({ currency, setCurrency, format }),
    [currency, setCurrency, format],
  );
}
