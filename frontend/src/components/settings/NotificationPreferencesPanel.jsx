import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  Shield,
  Users,
  CreditCard,
  MapPin,
  Volume2,
  Vibrate,
  Loader2,
  Moon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const CHANNELS = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'push', label: 'Push', icon: Bell },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];

const NOTIFICATION_CATEGORIES = [
  {
    id: 'safety',
    name: 'Safety & Check-ins',
    icon: Shield,
    settings: [
      { key: 'checkinReminders', label: 'Check-in Reminders', description: 'Get reminded before scheduled check-ins' },
      { key: 'checkinMissed', label: 'Missed Check-in Alerts', description: 'Alert when a check-in is missed' },
      { key: 'checkinEmergency', label: 'Emergency Alerts', description: 'SOS and emergency notifications', locked: true },
    ],
  },
  {
    id: 'trips',
    name: 'Trips & Travel',
    icon: MapPin,
    settings: [
      { key: 'tripReminders', label: 'Trip Reminders', description: 'Upcoming trip and itinerary notifications' },
      { key: 'budgetAlerts', label: 'Budget Alerts', description: 'When spending approaches your budget' },
    ],
  },
  {
    id: 'social',
    name: 'Social & Buddies',
    icon: Users,
    settings: [
      { key: 'buddyRequests', label: 'Buddy Requests', description: 'New buddy match requests and responses' },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    icon: CreditCard,
    settings: [
      { key: 'paymentNotifications', label: 'Payment Updates', description: 'Payment confirmations and failures' },
    ],
  },
];

const DIGEST_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const DEFAULT_PREFS = {
  channels: { email: true, push: true, sms: false },
  categories: {},
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  sound: true,
  vibration: true,
  digestFrequency: 'never',
};

export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef(null);

  useEffect(() => {
    fetchPrefs();
    return () => clearTimeout(debounceTimer.current);
  }, []);

  const fetchPrefs = async () => {
    try {
      const res = await api.get('/api/notifications/preferences');
      if (res.data?.success) {
        setPrefs((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = useCallback(
    (updated) => {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          await api.put('/api/notifications/preferences', updated);
        } catch {
          toast.error('Failed to save preferences');
        }
      }, 600);
    },
    [],
  );

  const updatePref = (path, value) => {
    setPrefs((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      savePrefs(next);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Channels */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Notification Channels</h3>
        <div className="flex flex-wrap gap-3">
          {CHANNELS.map(({ key, label, icon: Icon }) => {
            const enabled = prefs.channels?.[key] ?? false;
            return (
              <button
                key={key}
                onClick={() => updatePref(`channels.${key}`, !enabled)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border transition-colors ${
                  enabled
                    ? 'border-brand-vibrant bg-brand-vibrant/10 text-brand-vibrant'
                    : 'border-base-300/50 bg-base-200/60 text-base-content/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Categories */}
      {NOTIFICATION_CATEGORIES.map((cat) => {
        const CatIcon = cat.icon;
        return (
          <motion.section
            key={cat.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-base-200/60 backdrop-blur-sm border border-base-300/50 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <CatIcon className="w-5 h-5 text-brand-vibrant" />
              <h4 className="font-semibold">{cat.name}</h4>
            </div>
            <div className="space-y-3">
              {cat.settings.map((setting) => {
                const enabled = prefs.categories?.[setting.key] ?? true;
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{setting.label}</p>
                      <p className="text-xs text-base-content/50">{setting.description}</p>
                    </div>
                    {setting.locked ? (
                      <span className="badge badge-sm badge-warning gap-1">Always on</span>
                    ) : (
                      <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-primary"
                        checked={enabled}
                        onChange={() => updatePref(`categories.${setting.key}`, !enabled)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        );
      })}

      {/* Quiet Hours */}
      <section className="rounded-xl bg-base-200/60 backdrop-blur-sm border border-base-300/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-brand-vibrant" />
            <h4 className="font-semibold">Quiet Hours</h4>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={prefs.quietHoursEnabled}
            onChange={() => updatePref('quietHoursEnabled', !prefs.quietHoursEnabled)}
          />
        </div>
        {prefs.quietHoursEnabled && (
          <div className="flex items-center gap-3 mt-2">
            <input
              type="time"
              className="input input-sm input-bordered w-28"
              value={prefs.quietHoursStart}
              onChange={(e) => updatePref('quietHoursStart', e.target.value)}
            />
            <span className="text-sm text-base-content/50">to</span>
            <input
              type="time"
              className="input input-sm input-bordered w-28"
              value={prefs.quietHoursEnd}
              onChange={(e) => updatePref('quietHoursEnd', e.target.value)}
            />
          </div>
        )}
      </section>

      {/* Sound & Vibration */}
      <section className="rounded-xl bg-base-200/60 backdrop-blur-sm border border-base-300/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-brand-vibrant" />
            <span className="text-sm font-medium">Sound</span>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={prefs.sound}
            onChange={() => updatePref('sound', !prefs.sound)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vibrate className="w-5 h-5 text-brand-vibrant" />
            <span className="text-sm font-medium">Vibration</span>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={prefs.vibration}
            onChange={() => updatePref('vibration', !prefs.vibration)}
          />
        </div>
      </section>

      {/* Digest Frequency */}
      <section className="rounded-xl bg-base-200/60 backdrop-blur-sm border border-base-300/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-brand-vibrant" />
          <h4 className="font-semibold">Email Digest</h4>
        </div>
        <div className="flex gap-2">
          {DIGEST_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updatePref('digestFrequency', opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                prefs.digestFrequency === opt.value
                  ? 'border-brand-vibrant bg-brand-vibrant/10 text-brand-vibrant'
                  : 'border-base-300/50 bg-base-200/60 text-base-content/60 hover:bg-base-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
