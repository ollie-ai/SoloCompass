import { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';

const STORAGE_KEY = 'solocompass_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

function getDetectedLanguage() {
  const nav = navigator.language || navigator.languages?.[0] || 'en';
  const lang = nav.split('-')[0];
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.code || 'en';
}

function getStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Small hook to manage the active language preference.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState(
    () => getStoredLanguage() || getDetectedLanguage(),
  );

  const setLanguage = useCallback((code) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Private browsing
    }
    setLanguageState(code);
    // Set <html lang="…"> attribute so screen readers reflect the change
    document.documentElement.setAttribute('lang', code);
  }, []);

  // Keep <html lang> in sync on mount
  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const currentLanguage = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return { language, setLanguage, currentLanguage };
}

/**
 * LanguageSelector component — a compact dropdown for choosing the UI language.
 *
 * Currently stores the preference and sets document `lang`. Full translation
 * strings require an i18n framework (i18next) wired up separately; this
 * component provides the picker/plumbing layer.
 *
 * Props:
 *   className   — extra Tailwind classes applied to the container button
 *   compact     — show flag + code only (no full name)
 */
const LanguageSelector = ({ className = '', compact = false }) => {
  const { language, setLanguage, currentLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-base-300 bg-base-100 text-sm font-medium text-base-content hover:bg-base-200 transition-colors"
        aria-label="Select language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={14} className="text-base-content/50 shrink-0" />
        <span>{currentLanguage.flag}</span>
        {!compact && <span className="hidden sm:inline">{currentLanguage.nativeName}</span>}
        <span className="text-xs text-base-content/40">{currentLanguage.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div
            className="fixed inset-0 z-[80]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <ul
            role="listbox"
            aria-label="Language options"
            className="absolute right-0 mt-1.5 w-48 bg-base-100 border border-base-300 rounded-xl shadow-xl z-[81] overflow-auto max-h-72 py-1"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <li key={lang.code} role="option" aria-selected={lang.code === language}>
                <button
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    lang.code === language
                      ? 'bg-primary/10 text-primary'
                      : 'text-base-content/70 hover:bg-base-200'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.nativeName}</span>
                  {lang.code === language && (
                    <span className="text-xs font-black text-primary">✓</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
