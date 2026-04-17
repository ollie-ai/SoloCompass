import { useState, useEffect } from 'react';
import { Save, Loader, Globe, Users, Lock } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'bio',          label: 'Bio',           desc: 'Your personal description' },
  { key: 'home_city',    label: 'Home City',      desc: 'Where you're based' },
  { key: 'phone',        label: 'Phone Number',   desc: 'Safety contact number' },
  { key: 'interests',    label: 'Interests',      desc: 'Your travel interests and hobbies' },
  { key: 'travel_style', label: 'Travel Style',   desc: 'How you like to travel' },
  { key: 'pronouns',     label: 'Pronouns',       desc: 'Your preferred pronouns' },
];

const LEVELS = [
  { value: 'public',  label: 'Public',  icon: Globe,  desc: 'Visible to everyone', color: 'text-green-600' },
  { value: 'buddies', label: 'Buddies', icon: Users,  desc: 'Visible to your matched buddies only', color: 'text-blue-600' },
  { value: 'private', label: 'Private', icon: Lock,   desc: 'Only visible to you', color: 'text-red-500' },
];

/**
 * PrivacySettingsForm — per-field profile visibility controls.
 * GET/PUT /api/users/me/privacy
 */
export default function PrivacySettingsForm({ onSave }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users/me/privacy')
      .then(res => setSettings(res.data.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/users/me/privacy', settings);
      setSettings(res.data.data);
      toast.success('Privacy settings saved');
      onSave?.(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save privacy settings');
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
    <div className="space-y-4">
      <p className="text-sm text-base-content/60">
        Control who can see each field on your public profile. <strong>Public</strong> fields are visible to all users,
        <strong> Buddies</strong> only to your matched travel buddies, and <strong>Private</strong> is visible only to you.
      </p>

      <div className="divide-y divide-base-200">
        {FIELDS.map(field => {
          const current = settings[field.key] || 'public';
          return (
            <div key={field.key} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-base-content">{field.label}</p>
                <p className="text-xs text-base-content/50">{field.desc}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {LEVELS.map(level => {
                  const Icon = level.icon;
                  const active = current === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      title={`${level.label}: ${level.desc}`}
                      onClick={() => setSettings(s => ({ ...s, [field.key]: level.value }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? `${level.color} border-current bg-current/10`
                          : 'text-base-content/40 border-base-200 hover:border-base-content/20'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="btn btn-primary gap-2"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Privacy Settings
        </button>
      </div>
    </div>
  );
}
