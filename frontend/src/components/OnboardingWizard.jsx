import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const STEPS = [
  { key: 'profile_setup', label: 'Complete profile' },
  { key: 'first_trip', label: 'Create first trip' },
  { key: 'safety_setup', label: 'Configure safety settings' },
  { key: 'preferences', label: 'Set travel preferences' },
  { key: 'notifications', label: 'Enable notifications' }
];

export default function OnboardingWizard() {
  const [status, setStatus] = useState({ steps: [], progressPercent: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/onboarding/status');
      setStatus(res.data?.data || { steps: [], progressPercent: 0 });
    } catch {
      toast.error('Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (step) => {
    try {
      await api.post('/v1/onboarding/complete', { step });
      await load();
    } catch {
      toast.error('Failed to update onboarding step');
    }
  };

  const isDone = (key) => status.steps?.find(s => s.step_key === key)?.completed;

  return (
    <section className="rounded-2xl border border-base-300 p-6 bg-base-100">
      <h2 className="text-xl font-black mb-1">Welcome to SoloCompass</h2>
      <p className="text-sm text-base-content/60 mb-4">Complete a few quick steps to unlock your personalised dashboard.</p>
      <div className="w-full h-2 rounded-full bg-base-200 mb-4">
        <div className="h-full rounded-full bg-brand-vibrant" style={{ width: `${status.progressPercent || 0}%` }} />
      </div>
      {loading ? (
        <p className="text-sm text-base-content/50">Loading...</p>
      ) : (
        <ul className="space-y-2">
          {STEPS.map(step => (
            <li key={step.key} className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
              <span className={isDone(step.key) ? 'text-success font-bold' : 'text-base-content/70'}>{step.label}</span>
              {!isDone(step.key) ? (
                <button onClick={() => complete(step.key)} className="text-xs px-3 py-1 rounded-lg bg-brand-vibrant text-white">Mark done</button>
              ) : (
                <span className="text-xs text-success font-bold">Done</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
