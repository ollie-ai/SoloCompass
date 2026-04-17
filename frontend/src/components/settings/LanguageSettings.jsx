import { useState } from 'react';
import PropTypes from 'prop-types';
import { Globe, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const LOCALES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
];

export default function LanguageSettings({ currentLocale = 'en', onUpdate }) {
  const [locale, setLocale] = useState(currentLocale);
  const [saving, setSaving] = useState(false);

  const handleChange = async (code) => {
    if (code === locale || saving) return;
    setSaving(true);
    try {
      await api.put('/v1/settings/units', { locale: code });
      setLocale(code);
      onUpdate?.(code);
      toast.success('Language updated');
    } catch {
      toast.error('Failed to update language');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-brand-vibrant" />
        <h3 className="text-lg font-semibold">Language</h3>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {LOCALES.map((l) => {
          const active = l.code === locale;
          return (
            <motion.button
              key={l.code}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleChange(l.code)}
              disabled={saving}
              className={`relative flex items-center gap-2 rounded-xl px-3 py-3 text-left transition-colors border ${
                active
                  ? 'border-brand-vibrant bg-brand-vibrant/10 ring-1 ring-brand-vibrant/30'
                  : 'border-base-300/50 bg-base-200/60 hover:bg-base-200'
              }`}
            >
              <span className="text-xl leading-none">{l.flag}</span>
              <span className="text-sm font-medium truncate">{l.name}</span>
              {active && (
                <Check className="w-4 h-4 text-brand-vibrant ml-auto flex-shrink-0" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

LanguageSettings.propTypes = {
  currentLocale: PropTypes.string,
  onUpdate: PropTypes.func,
};
