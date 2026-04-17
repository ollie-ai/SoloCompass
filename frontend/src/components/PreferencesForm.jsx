import { useState, useEffect } from 'react';
import { Save, Loader } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const TRAVEL_STYLES = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid-range', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'backpacker', label: 'Backpacker' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'relaxation', label: 'Relaxation' },
];

const BUDGET_LEVELS = [
  { value: 'budget', label: 'Budget (< $50/day)' },
  { value: 'mid', label: 'Mid-range ($50–150/day)' },
  { value: 'comfortable', label: 'Comfortable ($150–300/day)' },
  { value: 'luxury', label: 'Luxury ($300+/day)' },
];

const PACES = [
  { value: 'slow', label: 'Slow (1+ week per city)' },
  { value: 'medium', label: 'Medium (3–7 days per city)' },
  { value: 'fast', label: 'Fast (1–2 days per city)' },
  { value: 'frenetic', label: 'Frenetic (move daily)' },
];

const CLIMATES = [
  { value: 'tropical', label: 'Tropical' },
  { value: 'temperate', label: 'Temperate' },
  { value: 'desert', label: 'Desert / Arid' },
  { value: 'cold', label: 'Cold / Arctic' },
  { value: 'any', label: 'Any climate' },
];

const ACCOMMODATION_TYPES = [
  { value: 'hostel', label: 'Hostels' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'airbnb', label: 'Airbnb / Apartments' },
  { value: 'boutique', label: 'Boutique hotels' },
  { value: 'camping', label: 'Camping' },
  { value: 'any', label: 'No preference' },
];

/**
 * PreferencesForm — standalone travel preferences form component.
 * Fetches from and saves to GET/PUT /api/preferences.
 *
 * Props:
 *   onSave — optional callback called after successful save
 */
export default function PreferencesForm({ onSave }) {
  const [prefs, setPrefs] = useState({
    travel_style: '',
    budget_level: '',
    pace: '',
    accommodation_type: '',
    preferred_climate: '',
    trip_duration: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/preferences')
      .then(res => {
        const data = res.data || {};
        setPrefs({
          travel_style: data.travel_style || '',
          budget_level: data.budget_level || '',
          pace: data.pace || '',
          accommodation_type: data.accommodation_type || '',
          preferred_climate: data.preferred_climate || '',
          trip_duration: data.trip_duration || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/preferences', prefs);
      toast.success('Preferences saved!');
      onSave?.(prefs);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, options) => (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={prefs[key]}
        onChange={e => setPrefs(p => ({ ...p, [key]: e.target.value }))}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-brand-vibrant" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {field('Travel Style', 'travel_style', TRAVEL_STYLES)}
        {field('Budget Level', 'budget_level', BUDGET_LEVELS)}
        {field('Travel Pace', 'pace', PACES)}
        {field('Accommodation Type', 'accommodation_type', ACCOMMODATION_TYPES)}
        {field('Preferred Climate', 'preferred_climate', CLIMATES)}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Typical Trip Duration (days)</span>
          </label>
          <input
            type="number"
            min="1"
            max="365"
            className="input input-bordered w-full"
            placeholder="e.g. 14"
            value={prefs.trip_duration}
            onChange={e => setPrefs(p => ({ ...p, trip_duration: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="btn btn-primary gap-2">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Preferences
        </button>
      </div>
    </form>
  );
}
