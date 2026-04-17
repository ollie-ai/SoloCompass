import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';

const LOCAL_KEY = 'solocompass-feature-tour-seen';
const DELAY_MS = 3000; // 3 seconds after mount

export default function FeatureTour() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already dismissed locally — no need for further checks
    if (localStorage.getItem(LOCAL_KEY) === '1') return;
    // User has already seen it on another device (from DB)
    if (user?.tour_seen) {
      localStorage.setItem(LOCAL_KEY, '1');
      return;
    }

    // Show after a short delay so it doesn't interrupt the landing animation
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [user?.tour_seen]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(LOCAL_KEY, '1');
    setVisible(false);
    // Persist dismissal to DB so it doesn't reappear on other devices
    api.put('/users/tour-seen').catch(() => {});
  };

  return (
    <div className="fixed bottom-20 right-4 z-[1200] max-w-xs rounded-xl border border-brand-vibrant/30 bg-base-100 p-4 shadow-xl">
      <p className="text-sm font-black text-base-content mb-1">{t('tour.title')}</p>
      <p className="text-xs text-base-content/70 mb-3">{t('tour.body')}</p>
      <button onClick={dismiss} className="btn btn-sm btn-primary w-full">{t('tour.cta')}</button>
    </div>
  );
}
