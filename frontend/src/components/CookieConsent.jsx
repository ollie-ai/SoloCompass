import { useState, useEffect } from 'react';
import { ShieldCheck, X, Cookie, Settings, Check } from 'lucide-react';
import Button from './Button';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const CookieConsent = () => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    marketing: false
  });
  const { isAuthenticated } = useAuthStore();

  const persistConsent = async (status, prefs) => {
    if (!isAuthenticated) return;
    try {
      await api.post('/users/me/consent', {
        consentType: 'cookies',
        status,
        source: 'cookie_banner',
        preferences: prefs
      });
    } catch {
      // Silent by design to avoid blocking UX
    }
  };

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShow(true);
    } else if (consent === 'custom') {
      const stored = localStorage.getItem('cookie-preferences');
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    }
  }, []);

  const persistConsent = async (nextPreferences) => {
    try {
      await api.post('/v1/consents', { consentType: 'cookie_analytics', granted: !!nextPreferences.analytics, source: 'cookie_banner' });
      await api.post('/v1/consents', { consentType: 'cookie_marketing', granted: !!nextPreferences.marketing, source: 'cookie_banner' });
      await api.post('/v1/consents', { consentType: 'data_processing', granted: true, source: 'cookie_banner' });
    } catch {
      // no-op for guests / unauthenticated flows
    }
  };

  const acceptAll = () => {
    const fullConsent = {
      essential: true,
      analytics: true,
      marketing: true
    };
    localStorage.setItem('cookie-consent', 'all');
    localStorage.setItem('cookie-preferences', JSON.stringify(fullConsent));
    setPreferences(fullConsent);
    persistConsent(fullConsent);
    setShow(false);
    setShowPreferences(false);
    persistConsent('granted', fullConsent);
  };

  const acceptEssential = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false
    };
    localStorage.setItem('cookie-consent', 'essential');
    localStorage.setItem('cookie-preferences', JSON.stringify(essentialOnly));
    setPreferences(essentialOnly);
    persistConsent(essentialOnly);
    setShow(false);
    setShowPreferences(false);
    persistConsent('denied', essentialOnly);
  };

  const savePreferences = () => {
    localStorage.setItem('cookie-consent', 'custom');
    localStorage.setItem('cookie-preferences', JSON.stringify(preferences));
    persistConsent(preferences);
    setShow(false);
    setShowPreferences(false);
    const hasOptionalConsent = preferences.analytics || preferences.marketing;
    persistConsent(hasOptionalConsent ? 'granted' : 'denied', preferences);
  };

  const togglePreference = (key) => {
    if (key === 'essential') return;
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const openPreferences = () => {
    setShowPreferences(true);
  };

  if (!show && !showPreferences) return null;

  if (showPreferences) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-vibrant/20 rounded-xl flex items-center justify-center text-brand-vibrant border border-brand-vibrant/20">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">{t('cookie.title')}</h3>
                <p className="text-white/50 text-sm">Customise your privacy settings</p>
              </div>
            </div>
            <button onClick={() => setShowPreferences(false)} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div>
                <h4 className="font-black text-white uppercase text-xs tracking-widest mb-1">Essential Cookies</h4>
                <p className="text-sm text-white/50">Required for the Service to function. Cannot be disabled.</p>
              </div>
              <div className="w-6 h-6 bg-brand-vibrant/20 rounded-full flex items-center justify-center border border-brand-vibrant/40">
                <Check size={14} className="text-brand-vibrant" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div>
                <h4 className="font-black text-white uppercase text-xs tracking-widest mb-1">Analytics Cookies</h4>
                <p className="text-sm text-white/50">Help us understand how visitors use our Service.</p>
              </div>
              <button 
                onClick={() => togglePreference('analytics')}
                className={`w-12 h-6 rounded-full transition-colors relative ${preferences.analytics ? 'bg-brand-vibrant' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-base-100 rounded-full transition-transform ${preferences.analytics ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div>
                <h4 className="font-black text-white uppercase text-xs tracking-widest mb-1">Marketing Cookies</h4>
                <p className="text-sm text-base-content/40">Used to personalise content and ads based on your interests.</p>
              </div>
              <button 
                onClick={() => togglePreference('marketing')}
                className={`w-12 h-6 rounded-full transition-colors relative ${preferences.marketing ? 'bg-brand-vibrant' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-base-100 rounded-full transition-transform ${preferences.marketing ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="p-6 border-t border-white/10 flex flex-col sm:flex-row gap-3">
            <Button onClick={acceptEssential} variant="outline" className="px-6 rounded-xl font-[900] py-3 flex-1 border-2 border-slate-700 text-white/50 hover:border-slate-600 hover:bg-slate-800 uppercase tracking-wider text-xs">
               {t('cookie.essentialOnly')}
            </Button>
            <Button onClick={savePreferences} className="bg-brand-vibrant hover:bg-emerald-600 text-white px-8 rounded-xl font-[900] py-3 flex-1 uppercase tracking-wider text-xs shadow-lg shadow-brand-vibrant/20">
               {t('cookie.savePreferences')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 z-[60] animate-slide-up">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-white/10 p-8 rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center gap-8">
        <div className="w-14 h-14 bg-brand-vibrant/20 rounded-xl flex items-center justify-center text-brand-vibrant shrink-0 border border-brand-vibrant/20">
          <ShieldCheck size={28} />
        </div>
        
        <div className="flex-1 text-center md:text-left">
            <h4 className="text-lg font-[900] text-white underline decoration-brand-vibrant decoration-4 underline-offset-8 mb-4 uppercase tracking-widest">{t('cookie.title')}</h4>
            <p className="text-sm text-white/50 font-medium leading-relaxed">
               {t('cookie.description')} <Link to="/cookies" className="text-brand-vibrant hover:text-white transition-colors underline font-[900]">Cookie Policy</Link>.
            </p>
          </div>
          
        <div className="flex flex-col gap-3 w-full md:w-auto">
            <div className="flex gap-3">
              <Button onClick={openPreferences} variant="outline" className="px-4 rounded-xl font-[900] py-3 flex-1 border-2 border-slate-800 text-white/50 hover:border-slate-700 hover:bg-slate-900 uppercase tracking-wider text-xs flex items-center justify-center gap-2">
                <Cookie size={14} /> {t('cookie.customize')}
              </Button>
              <Button onClick={acceptEssential} variant="outline" className="px-4 rounded-xl font-[900] py-3 flex-1 border-2 border-slate-800 text-white/50 hover:border-slate-700 hover:bg-slate-900 uppercase tracking-wider text-xs">
                 {t('cookie.essentialOnly')}
              </Button>
            </div>
            <Button onClick={acceptAll} className="bg-brand-vibrant hover:bg-emerald-600 text-white px-8 rounded-xl font-[900] py-3 uppercase tracking-wider text-xs shadow-lg shadow-brand-vibrant/20 w-full">
               {t('cookie.acceptAll')}
            </Button>
          </div>
      </div>
    </div>
  );
};

export default CookieConsent;
