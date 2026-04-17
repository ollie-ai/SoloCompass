import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const SUPPORTED = ['en', 'es'];

function detectLocale() {
  const rawLocale = (navigator.language || 'en').toLowerCase();
  const browserLocale = rawLocale.length >= 2 ? rawLocale.slice(0, 2) : 'en';
  return SUPPORTED.includes(browserLocale) ? browserLocale : 'en';
}

const I18nContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key
});

function getFromPath(obj, key) {
  return key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(detectLocale());

  const t = useCallback((key) => {
    const localeMessages = translations[locale] || translations.en;
    return getFromPath(localeMessages, key) || getFromPath(translations.en, key) || key;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
