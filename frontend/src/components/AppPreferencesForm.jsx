import { useState, useEffect } from 'react';
import { Save, Loader } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'ko', label: '한국어' },
];

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
  'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'BRL', 'INR', 'ZAR', 'THB',
];

const COMMON_TZ = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
  'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
];

/**
 * AppPreferencesForm — language, currency, units, timezone settings.
 * GET/PUT /api/preferences/app
 */
export default function AppPreferencesForm({ onSave }) {
  const [prefs, setPrefs] = useState({
    language: 'en',
    currency: 'USD',
    units: 'metric',
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/preferences/app')
      .then(res => {
        if (res.data.data) setPrefs(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/preferences/app', prefs);
      setPrefs(res.data.data || prefs);
      toast.success('App preferences saved!');
      onSave?.(prefs);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader className="w-5 h-5 animate-spin text-brand-vibrant" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Language</span></label>
          <select
            className="select select-bordered w-full"
            value={prefs.language}
            onChange={e => setPrefs(p => ({ ...p, language: e.target.value }))}
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Currency</span></label>
          <select
            className="select select-bordered w-full"
            value={prefs.currency}
            onChange={e => setPrefs(p => ({ ...p, currency: e.target.value }))}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Units of Measurement</span></label>
          <select
            className="select select-bordered w-full"
            value={prefs.units}
            onChange={e => setPrefs(p => ({ ...p, units: e.target.value }))}
          >
            <option value="metric">Metric (km, °C, kg)</option>
            <option value="imperial">Imperial (mi, °F, lb)</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Timezone</span></label>
          <select
            className="select select-bordered w-full"
            value={prefs.timezone}
            onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
          >
            {COMMON_TZ.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Date Format</span></label>
          <select
            className="select select-bordered w-full"
            value={prefs.date_format}
            onChange={e => setPrefs(p => ({ ...p, date_format: e.target.value }))}
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="btn btn-primary gap-2">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save App Preferences
        </button>
      </div>
    </form>
  );
}
