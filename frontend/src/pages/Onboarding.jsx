import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ChevronRight, Check, Globe, User, Star, Settings, Shield, Bell, Map, Compass } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, title: 'Welcome to SoloCompass', icon: Compass, description: 'Your adventure starts here' },
  { id: 2, title: 'Travel DNA Quiz', icon: Globe, description: 'Discover your travel persona' },
  { id: 3, title: 'Your Profile', icon: User, description: 'Tell us about yourself' },
  { id: 4, title: 'Solo Travel Experience', icon: Star, description: 'How seasoned are you?' },
  { id: 5, title: 'Travel Preferences', icon: Settings, description: 'How do you like to travel?' },
  { id: 6, title: 'Safety Setup', icon: Shield, description: 'Stay safe on the road' },
  { id: 7, title: 'Notifications', icon: Bell, description: 'Stay in the loop' },
  { id: 8, title: 'Start Exploring', icon: Map, description: 'Your first adventure awaits' },
];

export default function Onboarding() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profileData, setProfileData] = useState({ name: '', pronouns: '', display_name: '' });
  const [experienceLevel, setExperienceLevel] = useState('');
  const [preferences, setPreferences] = useState({ travel_style: '', budget_level: '', pace: '' });
  const [notifPrefs, setNotifPrefs] = useState({ email_updates: true, safety_alerts: true });

  useEffect(() => {
    api.get('/onboarding/state').then(res => {
      const { currentStep: saved, completed } = res.data.data;
      if (completed) { navigate('/dashboard'); return; }
      setCurrentStep(saved || 1);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [navigate]);

  const completeStep = async (stepData = {}) => {
    setSaving(true);
    try {
      await api.post(`/onboarding/step/${currentStep}/complete`, stepData);
      if (currentStep >= 8) {
        await api.post('/onboarding/complete');
        navigate('/dashboard');
      } else {
        setCurrentStep(s => s + 1);
      }
    } catch (err) {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const skipStep = async () => {
    setSaving(true);
    try {
      await api.post(`/onboarding/step/${currentStep}/skip`);
      if (currentStep >= 8) { navigate('/dashboard'); }
      else { setCurrentStep(s => s + 1); }
    } catch (err) {
      toast.error('Failed to skip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg" /></div>;

  const step = STEPS[currentStep - 1];
  const StepIcon = step.icon;
  const progress = ((currentStep - 1) / 8) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">🧭</div>
            <h2 className="text-3xl font-bold">Welcome, {user?.name?.split(' ')[0] || 'Explorer'}!</h2>
            <p className="text-base-content/70 max-w-md mx-auto">We'll help you set up your SoloCompass profile in just a few steps. Let's make your solo travel experience extraordinary.</p>
            <button onClick={() => completeStep()} disabled={saving} className="btn btn-primary btn-lg gap-2 mt-4">
              {saving ? <span className="loading loading-spinner loading-sm" /> : null}
              Let's Get Started <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        );

      case 2:
        return (
          <div className="text-center space-y-4">
            <p className="text-base-content/70">Take our Travel DNA quiz to discover your travel persona and get personalised recommendations.</p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={async () => { await completeStep(); navigate('/quiz'); }}
                disabled={saving}
                className="btn btn-primary gap-2"
              >
                Take the Quiz <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={skipStep} className="btn btn-ghost">Skip for now</button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="form-control">
              <label className="label"><span className="label-text">Your Name</span></label>
              <input className="input input-bordered" value={profileData.name} onChange={e => setProfileData(d => ({...d, name: e.target.value}))} placeholder="How should we call you?" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Display Name (optional)</span></label>
              <input className="input input-bordered" value={profileData.display_name} onChange={e => setProfileData(d => ({...d, display_name: e.target.value}))} placeholder="Public display name" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pronouns (optional)</span></label>
              <select className="select select-bordered" value={profileData.pronouns} onChange={e => setProfileData(d => ({...d, pronouns: e.target.value}))}>
                <option value="">Select pronouns</option>
                {['He/Him','She/Her','They/Them','He/They','She/They','Prefer not to say'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => completeStep(profileData)} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue'}
              </button>
              <button onClick={skipStep} className="btn btn-ghost">Skip</button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-base-content/70 text-center">How experienced are you with solo travel?</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: 'First-time', label: '🌱 First-time', desc: 'This will be my first solo adventure' },
                { value: 'Beginner', label: '🚶 Beginner', desc: 'I\'ve done it a few times' },
                { value: 'Intermediate', label: '🏃 Intermediate', desc: 'Comfortable with solo travel' },
                { value: 'Experienced', label: '✈️ Experienced', desc: 'Many solo trips under my belt' },
                { value: 'Expert', label: '🌍 Expert', desc: 'Solo travel is my lifestyle' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExperienceLevel(opt.value)}
                  className={`btn btn-outline justify-start gap-3 h-auto py-3 ${experienceLevel === opt.value ? 'btn-primary' : ''}`}
                >
                  <div className="text-left">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => completeStep({ solo_travel_experience: experienceLevel })} disabled={saving || !experienceLevel} className="btn btn-primary flex-1">
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Continue'}
              </button>
              <button onClick={skipStep} className="btn btn-ghost">Skip</button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="form-control">
              <label className="label"><span className="label-text">Travel Style</span></label>
              <select className="select select-bordered" value={preferences.travel_style} onChange={e => setPreferences(p => ({...p, travel_style: e.target.value}))}>
                <option value="">Select style</option>
                {['Budget','Mid-range','Luxury','Backpacker','Adventure','Cultural'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Budget Level</span></label>
              <select className="select select-bordered" value={preferences.budget_level} onChange={e => setPreferences(p => ({...p, budget_level: e.target.value}))}>
                <option value="">Select budget</option>
                {['Budget (<$50/day)','Mid-range ($50-150/day)','Comfortable ($150-300/day)','Luxury ($300+/day)'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Travel Pace</span></label>
              <select className="select select-bordered" value={preferences.pace} onChange={e => setPreferences(p => ({...p, pace: e.target.value}))}>
                <option value="">Select pace</option>
                {['Slow (1+ week per city)','Medium (3-7 days per city)','Fast (1-2 days per city)','Frenetic (move daily)'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => completeStep(preferences)} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue'}
              </button>
              <button onClick={skipStep} className="btn btn-ghost">Skip</button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-4">
            <div className="text-4xl">🛡️</div>
            <p className="text-base-content/70">Set up emergency contacts to let people know you're safe while travelling. You can do this in your Safety settings.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={async () => { await completeStep(); navigate('/safety'); }} disabled={saving} className="btn btn-primary gap-2">
                Set Up Safety <Shield className="w-4 h-4" />
              </button>
              <button onClick={skipStep} className="btn btn-ghost">Skip for now</button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-base-content/70 text-center">Choose which notifications you'd like to receive:</p>
            <div className="space-y-3">
              {[
                { key: 'email_updates', label: 'Email Updates', desc: 'Tips, features, and travel inspiration' },
                { key: 'safety_alerts', label: 'Safety Alerts', desc: 'Advisories for your destinations' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-base-content/60">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={notifPrefs[item.key]}
                    onChange={e => setNotifPrefs(p => ({...p, [item.key]: e.target.checked}))}
                  />
                </div>
              ))}
            </div>
            <button onClick={() => completeStep(notifPrefs)} disabled={saving} className="btn btn-primary w-full">
              {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue'}
            </button>
          </div>
        );

      case 8:
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-2xl font-bold">You're all set!</h2>
            <p className="text-base-content/70 max-w-md mx-auto">Your SoloCompass is ready. Start exploring destinations, planning trips, and connecting with fellow solo travellers.</p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => completeStep()} disabled={saving} className="btn btn-primary btn-lg gap-2">
                {saving ? <span className="loading loading-spinner loading-sm" /> : null}
                Explore Now <Map className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="card bg-base-100 shadow-lg max-w-lg w-full">
        <div className="card-body">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-base-content/50 mb-1">
              <span>Step {currentStep} of 8</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="w-full bg-base-200 rounded-full h-2">
              <div className="bg-brand-vibrant h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Step header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-brand-vibrant/10 flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-brand-vibrant" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{step.title}</h2>
              <p className="text-sm text-base-content/60">{step.description}</p>
            </div>
          </div>

          {/* Step content */}
          {renderStepContent()}

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5 mt-6">
            {STEPS.map(s => (
              <div key={s.id} className={`w-2 h-2 rounded-full transition-all ${s.id === currentStep ? 'bg-brand-vibrant w-4' : s.id < currentStep ? 'bg-brand-vibrant/50' : 'bg-base-300'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
