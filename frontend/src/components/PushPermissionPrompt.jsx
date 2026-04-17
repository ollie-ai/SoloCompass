import { useState, useEffect } from 'react';
import { Bell, X, Shield, Zap } from 'lucide-react';
import { requestPushPermission } from '../lib/pushNotifications';
import api from '../lib/api';

const PROMPT_DISMISSED_KEY = 'push_prompt_dismissed';
const PROMPT_DISMISSED_UNTIL_KEY = 'push_prompt_dismissed_until';

/**
 * Contextual push notification permission prompt.
 * Shows automatically when:
 * 1. Browser supports push notifications
 * 2. Permission hasn't been granted or denied
 * 3. User hasn't dismissed the prompt recently (7-day cooldown)
 * 4. A contextual trigger is met (e.g. first trip created, safety check-in set up)
 *
 * Props:
 * - trigger: string — optional contextual trigger reason ('trip_created', 'checkin_setup', 'buddy_match', 'default')
 * - onDismiss: function — called when user dismisses the prompt
 * - onGranted: function — called when permission is granted
 */
export default function PushPermissionPrompt({ trigger = 'default', onDismiss, onGranted }) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Check if push is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }

    // Already granted or permanently denied
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return;
    }

    // Check cooldown
    const dismissedUntil = localStorage.getItem(PROMPT_DISMISSED_UNTIL_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Show with a short delay for better UX
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [trigger]);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const subscription = await requestPushPermission();
      if (subscription) {
        // Register the subscription with the backend
        try {
          const token = typeof subscription === 'object' && subscription.endpoint
            ? subscription.endpoint
            : String(subscription);
          await api.post('/notifications/push/subscribe', { token });
        } catch {
          // Non-critical — subscription still works locally
        }
        onGranted?.();
        setVisible(false);
      } else {
        // Permission was denied
        setVisible(false);
      }
    } catch (err) {
      console.error('[PushPrompt] Failed to request permission:', err);
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    // Set 7-day cooldown
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(PROMPT_DISMISSED_UNTIL_KEY, String(Date.now() + sevenDays));
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setVisible(false);
    onDismiss?.();
  };

  const handleNotNow = () => {
    // Set 1-day cooldown for "Not now"
    const oneDay = 24 * 60 * 60 * 1000;
    localStorage.setItem(PROMPT_DISMISSED_UNTIL_KEY, String(Date.now() + oneDay));
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  const contextMessages = {
    trip_created: {
      title: 'Stay Updated on Your Trip',
      message: 'Get real-time alerts for flight changes, safety check-ins, and itinerary updates.',
      icon: <Zap size={24} className="text-brand-vibrant" />,
    },
    checkin_setup: {
      title: 'Never Miss a Check-In',
      message: 'Push notifications ensure you receive safety check-in reminders even when the app is closed.',
      icon: <Shield size={24} className="text-emerald-500" />,
    },
    buddy_match: {
      title: 'Know When Buddies Message',
      message: 'Get instant notifications when travel buddies send you messages or requests.',
      icon: <Bell size={24} className="text-blue-500" />,
    },
    default: {
      title: 'Enable Push Notifications',
      message: 'Get timely alerts for safety check-ins, trip changes, and travel buddy updates.',
      icon: <Bell size={24} className="text-brand-vibrant" />,
    },
  };

  const ctx = contextMessages[trigger] || contextMessages.default;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[380px] z-[100] animate-slide-up">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
              {ctx.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-base-content text-sm leading-tight">{ctx.title}</h3>
                <button
                  onClick={handleDismiss}
                  className="p-1 text-base-content/30 hover:text-base-content/60 transition-colors flex-shrink-0 -mt-1 -mr-1"
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-base-content/60 mt-1 leading-relaxed">{ctx.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleEnable}
              disabled={requesting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-brand-vibrant text-white font-black text-xs uppercase tracking-widest hover:bg-brand-vibrant/90 transition-all shadow-lg shadow-brand-vibrant/20 disabled:opacity-60"
            >
              {requesting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enabling...
                </span>
              ) : (
                'Enable Notifications'
              )}
            </button>
            <button
              onClick={handleNotNow}
              className="px-4 py-2.5 rounded-xl text-base-content/40 font-bold text-xs hover:text-base-content/60 hover:bg-base-200 transition-all"
            >
              Not now
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-base-200/50 border-t border-base-300/50">
          <p className="text-[10px] text-base-content/40 font-medium">
            🔒 You can disable notifications anytime in Settings → Notifications
          </p>
        </div>
      </div>
    </div>
  );
}
