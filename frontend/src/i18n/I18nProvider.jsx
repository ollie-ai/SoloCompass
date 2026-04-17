import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const SUPPORTED = ['en', 'es'];
const STORAGE_KEY = 'solocompass-locale';

function detectLocale() {
  // 1. Persisted preference takes priority
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch (_) {}

  // 2. Browser language
  const rawLocale = (navigator.language || 'en').toLowerCase();
  const browserLocale = rawLocale.length >= 2 ? rawLocale.slice(0, 2) : 'en';
  return SUPPORTED.includes(browserLocale) ? browserLocale : 'en';
}

const I18nContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  supportedLocales: SUPPORTED,
});

function getFromPath(obj, key) {
  return key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

/**
 * Resolve a translation with optional interpolation variables.
 *
 * Supports:
 *  - Simple:      t('help.title')
 *  - Interpolation: t('dashboard.greeting', { name: 'Alex' })   → "Hello, Alex!"
 *  - Pluralisation: t('trips.count', { count: 3 })               → "3 trips"
 *    (pair keys: 'trips.count_one' / 'trips.count_other')
 */
function resolveMessage(messages, key, vars) {
  let template = getFromPath(messages, key);

  // Pluralisation: look for _one / _other variants when `count` is supplied
  if (template === undefined && vars !== undefined && 'count' in vars) {
    const pluralKey = vars.count === 1 ? `${key}_one` : `${key}_other`;
    template = getFromPath(messages, pluralKey);
  }

  if (template === undefined) return undefined;

  // Interpolation: replace {{variable}} placeholders
  if (vars) {
    return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) =>
      name in vars ? String(vars[name]) : `{{${name}}}`
    );
  }

  return String(template);
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale());

  const setLocale = useCallback((newLocale) => {
    if (!SUPPORTED.includes(newLocale)) return;
    try { localStorage.setItem(STORAGE_KEY, newLocale); } catch (_) {}
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key, vars) => {
    const localeMessages = translations[locale] || translations.en;
    let result = resolveMessage(localeMessages, key, vars);

    // Fallback to English
    if (result === undefined && locale !== 'en') {
      result = resolveMessage(translations.en, key, vars);
    }

    // Dev-mode missing-key logging
    if (result === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key: "${key}" (locale: ${locale})`);
      }
      return key;
    }

    return result;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, supportedLocales: SUPPORTED }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
