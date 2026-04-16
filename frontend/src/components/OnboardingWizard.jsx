import { useState, useEffect } from 'react';
import { Check, ChevronRight, Compass, Map, Shield, Users, Star, PartyPopper, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

const STEPS = [
  {
    id: 'profile',
    title: 'Set up your profile',
    description: 'Add your name, bio, and travel preferences so we can personalise your experience.',
    icon: Compass,
    actionLabel: 'Complete Profile',
    actionHref: '/settings?tab=profile',
  },
  {
    id: 'quiz',
    title: 'Take the Travel DNA quiz',
    description: 'A quick 60-second quiz that calibrates your itineraries and buddy matching.',
    icon: Star,
    actionLabel: 'Take Quiz',
    actionHref: '/quiz',
  },
  {
    id: 'first_trip',
    title: 'Create your first trip',
    description: 'Add a destination and let our AI generate a personalised itinerary.',
    icon: Map,
    actionLabel: 'New Trip',
    actionHref: '/trips/new',
  },
  {
    id: 'safety_setup',
    title: 'Configure safety check-ins',
    description: 'Set up scheduled check-ins so your guardians know you\'re safe.',
    icon: Shield,
    actionLabel: 'Safety Setup',
    actionHref: '/safety',
  },
  {
    id: 'emergency_contacts',
    title: 'Add emergency contacts',
    description: 'Add people who will be alerted if you miss a check-in or activate SOS.',
    icon: Users,
    actionLabel: 'Add Contacts',
    actionHref: '/settings?tab=safety',
  },
];

/**
 * OnboardingWizard — shown to new users as a guided setup checklist.
 *
 * Props:
 *   onDismiss  – callback when the user closes the wizard
 *   className  – extra classes on the outer container
 */
export default function OnboardingWizard({ onDismiss, className = '' }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ completedSteps: [], completionPercent: 0, isComplete: false });
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/onboarding/status');
      if (res.data?.data) {
        setStatus(res.data.data);
      }
    } catch {
      // Silently fail — widget is non-critical
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepId) => {
    if (status.completedSteps.includes(stepId)) return;
    try {
      const res = await api.post('/onboarding/complete', { step: stepId });
      if (res.data?.data) {
        setStatus((prev) => ({
          ...prev,
          completedSteps: res.data.data.completedSteps,
          completionPercent: res.data.data.completionPercent,
          isComplete: res.data.data.isComplete,
        }));
        if (res.data.data.isComplete) {
          toast.success('🎉 Onboarding complete! Welcome to SoloCompass!');
        }
      }
    } catch {
      // Non-critical, ignore
    }
  };

  const handleStepClick = (step) => {
    completeStep(step.id);
    navigate(step.actionHref);
  };

  const handleDismiss = () => {
    setDismissing(true);
    if (onDismiss) onDismiss();
  };

  if (dismissing || status.isComplete) return null;
  if (loading) return null;

  const completedCount = STEPS.filter((s) => status.completedSteps.includes(s.id)).length;

  return (
    <div
      className={`bg-base-100 rounded-2xl border border-base-300/50 shadow-sm overflow-hidden ${className}`}
      role="region"
      aria-label="Getting started checklist"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-base-content">Getting started</h2>
          <p className="text-xs text-base-content/60 mt-0.5">
            {completedCount} of {STEPS.length} steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-base-content/40 hover:text-base-content transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
          aria-label="Dismiss getting started checklist"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div
          className="w-full h-1.5 rounded-full bg-base-200"
          role="progressbar"
          aria-valuenow={status.completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
        >
          <div
            className="h-1.5 rounded-full bg-brand-vibrant transition-all duration-500"
            style={{ width: `${status.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="divide-y divide-base-200/60" role="list">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isComplete = status.completedSteps.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-base-200/60 focus:outline-none focus:bg-base-200/60 ${isComplete ? 'opacity-60' : ''}`}
                aria-label={`${isComplete ? 'Completed: ' : ''}${step.title}`}
              >
                {/* Status icon */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? 'bg-green-100 text-green-600' : 'bg-brand-vibrant/10 text-brand-vibrant'}`}
                  aria-hidden="true"
                >
                  {isComplete ? <Check size={16} /> : <Icon size={16} />}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold leading-tight ${isComplete ? 'line-through text-base-content/50' : 'text-base-content'}`}>
                    {step.title}
                  </p>
                  {!isComplete && (
                    <p className="text-xs text-base-content/50 leading-snug mt-0.5 truncate">{step.description}</p>
                  )}
                </div>

                {!isComplete && <ChevronRight size={14} className="text-base-content/30 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="px-5 py-3 bg-base-200/40 flex items-center gap-2">
        <PartyPopper size={14} className="text-brand-vibrant" aria-hidden="true" />
        <p className="text-xs text-base-content/60">Complete all steps to unlock your full SoloCompass experience.</p>
      </div>
    </div>
  );
}
