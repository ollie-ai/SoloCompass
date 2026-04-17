import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { trackEvent } from '../lib/telemetry';
import { useEffect, useState } from 'react';
import { 
  Shield, Compass, Sparkles, MapPin, Users, Calendar, 
  Bell, Globe, Zap, ArrowRight, CheckCircle2,
  Heart, Lock, AlertTriangle, Smartphone, MessageSquare, Plane, FileText
} from 'lucide-react';
import api from '../lib/api';

const features = [
  {
    icon: Sparkles,
    title: 'AI Itinerary Planning',
    description: 'Generate personalised day-by-day plans based on your Travel DNA — pace, budget, and interests all factored in.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: Shield,
    title: 'Safety Check-ins',
    description: 'Schedule regular check-ins. If you miss one, your chosen contacts are notified — you stay in control of who gets alerted.',
    color: 'bg-success/20 text-success',
  },
  {
    icon: MapPin,
    title: 'Destination Explorer',
    description: 'Discover solo-friendly destinations with safety ratings, budget guidance, and AI-curated recommendations.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Bell,
    title: 'Travel Advisories',
    description: 'Real-time FCDO advisories matched to your trip destinations, with severity ratings you can scan at a glance.',
    color: 'bg-orange-100 text-orange-600',
  },
  {
    icon: Heart,
    title: 'Emergency Tools',
    description: 'One-tap SOS, fake call for uncomfortable situations, safe haven locator, and emergency contact management.',
    color: 'bg-red-100 text-error',
  },
  {
    icon: Calendar,
    title: 'Trip Management',
    description: 'Organise all your trips in one place — itineraries, packing lists, budgets, and safety settings.',
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    icon: Users,
    title: 'Travel Buddies',
    description: 'Find solo travellers heading to the same places. Match based on destination overlap, dates, and Travel DNA compatibility.',
    color: 'bg-pink-100 text-pink-600',
  },
  {
    icon: MessageSquare,
    title: 'AI Travel Assistant',
    description: 'Ask Atlas anything about your destination — safety tips, local customs, transport options, and hidden gems.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: Plane,
    title: 'Flight Tracking',
    description: 'Track your flights in real-time with status updates and gate information.',
    color: 'bg-sky-100 text-info',
  },
];

const productPrinciples = [
  {
    icon: Shield,
    title: 'Safety built into every workflow',
    description: 'Safety isn\'t an afterthought — it\'s part of planning your trip from the start.',
  },
  {
    icon: Lock,
    title: 'You control your data',
    description: 'Export or delete your data at any time. We don\'t sell your information.',
  },
  {
    icon: Sparkles,
    title: 'Practical AI, not gimmicks',
    description: 'Our AI helps you plan itineraries and answer destination questions — it doesn\'t replace your judgement.',
  },
  {
    icon: Compass,
    title: 'Designed for solo travellers',
    description: 'Every feature is built with solo travel in mind — no group travel assumptions.',
  },
];

const Features = () => {
  const [planFeatures, setPlanFeatures] = useState([]);
  useEffect(() => {
    trackEvent('page_view', { page: 'features' });
    api.get('/v1/features').then((response) => {
      setPlanFeatures(response.data?.data?.plans || []);
    }).catch(() => {});
  }, []);

  const handleCTAClick = (cta) => {
    trackEvent('cta_click', { location: cta, page: 'features' });
  };

  return (
    <>
      <SEO 
        title="Features - SoloCompass" 
        description="Discover how SoloCompass helps solo travelers plan safer, smarter trips with AI-powered itineraries, real-time safety alerts, and travel buddy matching."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden bg-mesh pt-16">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 bg-brand-vibrant/10 text-brand-vibrant text-xs font-black uppercase tracking-[0.2em] rounded-full mb-6 border border-brand-vibrant/20">
                Product capabilities
              </span>
              <h1 className="text-4xl lg:text-7xl font-black text-base-content mb-6 leading-[1.1] tracking-tight font-outfit">
                Travel smarter.
                <span className="text-gradient block mt-2">Travel safer.</span>
              </h1>
              <p className="text-xl text-base-content/60 mb-10 leading-relaxed font-medium">
                SoloCompass combines AI-powered trip planning with a mission-critical safety layer — so you can explore with absolute confidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/register" 
                  onClick={() => handleCTAClick('hero_signup')}
                  className="btn-brand btn-lg rounded-xl font-bold px-8 gap-2"
                >
                  Get Started Free <ArrowRight size={20} />
                </Link>
                <Link 
                  to="/safety-info" 
                  onClick={() => handleCTAClick('hero_safety')}
                  className="btn-brand-outline btn-lg rounded-xl font-bold px-8 gap-2"
                >
                  <Shield size={20} /> See how safety works
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-base-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-black text-base-content mb-4">
                What SoloCompass can do
              </h2>
              <p className="text-lg text-base-content/80 max-w-2xl mx-auto">
                Tools designed specifically for solo travellers — from planning to staying safe on the road.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={index}
                    className="group p-6 rounded-2xl border border-base-300 hover:border-brand-vibrant/30 hover:shadow-xl hover:shadow-brand-vibrant/5 transition-all duration-300 bg-base-100"
                  >
                    <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-black text-base-content mb-2">{feature.title}</h3>
                    <p className="text-base-content/80 leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Product Principles — replaces "Why choose" / testimonials */}
        <section className="py-20 bg-base-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-black text-base-content mb-4">
                Why we built SoloCompass
              </h2>
              <p className="text-lg text-base-content/80 max-w-2xl mx-auto">
                Four principles that guide every feature we build.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {productPrinciples.map((principle, index) => {
                const Icon = principle.icon;
                return (
                  <div key={index} className="flex gap-4 p-6 bg-base-100 rounded-2xl border border-base-300">
                    <div className="w-12 h-12 rounded-xl bg-brand-vibrant/10 flex items-center justify-center shrink-0">
                      <Icon size={24} className="text-brand-vibrant" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-base-content mb-1">{principle.title}</h3>
                      <p className="text-base-content/80 text-sm leading-relaxed">{principle.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works — connects to real product workflow */}
        <section className="py-20 bg-base-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-black text-base-content mb-4">
                How it works
              </h2>
              <p className="text-lg text-base-content/80 max-w-2xl mx-auto">
                Three steps from sign-up to your first trip.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: 1, icon: Sparkles, title: 'Take the Travel DNA quiz', desc: 'A 60-second quiz calibrates the AI to your travel style, budget, and interests.' },
                { step: 2, icon: MapPin, title: 'Create a trip', desc: 'Add your destination, dates, and budget — then generate a personalised itinerary.' },
                { step: 3, icon: Shield, title: 'Set up safety', desc: 'Add emergency contacts, schedule check-ins, and surface advisories for your destination.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-brand-vibrant/10 flex items-center justify-center mx-auto mb-4">
                      <Icon size={28} className="text-brand-vibrant" />
                    </div>
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-vibrant text-white text-sm font-black mb-3">
                      {item.step}
                    </div>
                    <h3 className="text-lg font-black text-base-content mb-2">{item.title}</h3>
                    <p className="text-base-content/80 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-12">
              <Link 
                to="/register" 
                onClick={() => handleCTAClick('how_it_works_signup')}
                className="btn-brand btn-lg rounded-xl font-bold px-8 gap-2"
              >
                Get Started Free <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        {planFeatures.length > 0 && (
          <section className="py-20 bg-base-100">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-black text-base-content mb-6 text-center">Feature availability by plan</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {planFeatures.map((plan) => (
                  <div key={plan.plan} className="border border-base-300 rounded-2xl p-5">
                    <p className="font-black uppercase mb-3">{plan.plan}</p>
                    <ul className="space-y-1 text-sm text-base-content/80">
                      {plan.features.map((feature) => <li key={feature}>• {feature}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 bg-base-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-black text-base-content mb-6">
              Ready to plan your next solo trip?
            </h2>
            <p className="text-lg text-base-content/80 mb-10">
              Start free — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/register" 
                onClick={() => handleCTAClick('footer_signup')}
                className="btn-brand btn-lg rounded-xl font-bold px-8 gap-2"
              >
                Get Started Free <ArrowRight size={20} />
              </Link>
              <Link 
                to="/login" 
                onClick={() => handleCTAClick('footer_signin')}
                className="btn btn-outline btn-lg rounded-xl font-bold px-8"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Features;
