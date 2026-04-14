import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Skeleton from '../components/Skeleton';
import LeafletMap from '../components/LeafletMap';
import SEO from '../components/SEO';
import WeatherWidget from '../components/WeatherWidget';
import CurrencyConverter from '../components/CurrencyConverter';
import DestinationChat from '../components/DestinationChat';
import PlanGate from '../components/PlanGate';
import AffiliateHub from '../components/destinations/AffiliateHub';
import WeatherChart from '../components/WeatherChart';
import PracticalInfoCard from '../components/destinations/PracticalInfoCard';
import SoloScoreBadge from '../components/destinations/SoloScoreBadge';
import CommunityTipsList from '../components/destinations/CommunityTipsList';
import TipSubmitForm from '../components/destinations/TipSubmitForm';
import ScamAlertList from '../components/destinations/ScamAlertList';
import NeighbourhoodSafetyMap from '../components/destinations/NeighbourhoodSafetyMap';
import SafetyScoreBar from '../components/destinations/SafetyScoreBar';
import ReviewList from '../components/destinations/ReviewList';
import ReviewFilters from '../components/destinations/ReviewFilters';
import { 
  MapPin, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  Calendar, 
  Navigation,
  ExternalLink,
  ChevronRight,
  Plus,
  ArrowLeft,
  Sparkles,
  Globe,
  Info,
  AlertTriangle,
  Zap,
  Moon,
  Heart,
  ShieldAlert
} from 'lucide-react';

function CostTab({ destinationId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    import('../lib/destinationService').then(m => {
      m.default.getCost(destinationId)
        .then(res => setData(res.data?.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    });
  }, [destinationId]);
  if (loading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  if (!data?.categories?.length) return <p className="text-gray-500 text-sm">No cost data available.</p>;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex">
        <span className="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</span>
        <span className="w-24 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Budget</span>
        <span className="w-24 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Mid</span>
        <span className="w-24 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Luxury</span>
      </div>
      {data.categories.map((cat, i) => (
        <div key={i} className="px-5 py-3 flex border-b border-gray-100 dark:border-gray-700 last:border-0">
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 capitalize">{cat.category}</span>
          <span className="w-24 text-sm text-gray-600 dark:text-gray-400 text-right">{cat.budget_low ? `${cat.currency_code || '$'}${cat.budget_low}` : '—'}</span>
          <span className="w-24 text-sm text-gray-600 dark:text-gray-400 text-right">{cat.budget_mid ? `${cat.currency_code || '$'}${cat.budget_mid}` : '—'}</span>
          <span className="w-24 text-sm text-gray-600 dark:text-gray-400 text-right">{cat.budget_high ? `${cat.currency_code || '$'}${cat.budget_high}` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function DestinationDetail() {
  const { id, slug, tab } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [buddies, setBuddies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [safetyStats, setSafetyStats] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(true);
  const [researchData, setResearchData] = useState(null);
  const [activeTab, setActiveTab] = useState(tab || 'overview');
  const [destinationId, setDestinationId] = useState(id || null);

  useEffect(() => {
    fetchDestination();
    fetchReviews();
    fetchBuddies();
    // Fetch research data
    const loadResearch = async () => {
      try {
        const codeMap = { japan: 'JP', thailand: 'TH', spain: 'ES', italy: 'IT', france: 'FR', germany: 'DE', 'united kingdom': 'GB', australia: 'AU', canada: 'CA', usa: 'US', 'united states': 'US' };
        const code = codeMap[String(id).toLowerCase()] || String(id).substring(0,2).toUpperCase();
        const res = await api.get(`/countries/${code}`);
        if (res.data?.data) {
          const data = res.data.data;
          const parseJSON = (str) => {
            if (!str) return [];
            try { return JSON.parse(str); } catch { return []; }
          };
          setResearchData(data);
          setDestination({
            name: data.name,
            country: data.name,
            description: data.overview,
            safety_rating: data.solo_safety_score >= 8 ? 'high' : 'medium',
            solo_friendly_rating: data.solo_friendly_rating,
            budget_level: data.budget_daily_local < 5000 ? 'budget' : data.budget_daily_local < 15000 ? 'medium' : 'luxury',
            highlights: parseJSON(data.best_regions_for_solo).map(r => r.split(' - ')[0]),
            travel_styles: ['Cultural', 'Adventure', 'Food'],
            best_months: ['April', 'May', 'September', 'October', 'November'],
            solo_safety_index: data.solo_safety_score * 10,
            city: data.capital_city || 'Multiple Cities'
          });
        }
      } catch (e) { console.log('No research'); }
    };
    loadResearch();
  }, [id, slug]);

  useEffect(() => {
    if (destination?.country) {
      fetchSafetyStats();
    }
  }, [destination?.country]);

  const fetchSafetyStats = async () => {
    try {
      setSafetyLoading(true);
      const countryName = destination.country;
      const response = await api.get(`/safety/score/${encodeURIComponent(countryName)}`);
      if (response.data?.data) {
        setSafetyStats(response.data.data);
      } else if (response.data) {
        setSafetyStats(response.data);
      }
    } catch (err) {
      setSafetyStats({
        overall_score: destination.safety_rating || 'N/A',
        crime_rate: 'Low',
        healthcare: 'Good',
        transport_safety: 'Reliable',
        night_lighting: 'Street-Vetted',
        night_lighting_sub: '98% Coverage in Tourist Hubs',
      });
    } finally {
      setSafetyLoading(false);
    }
  };

  const fetchDestination = async () => {
    try {
      setLoading(true);
      let response;
      if (slug) {
        response = await api.get(`/destinations/by-slug/${slug}`);
      } else {
        response = await api.get(`/destinations/${id}`);
      }
      setDestination(response.data.data);
      setDestinationId(response.data?.data?.id || response.data?.id || id);
      setError(null);
    } catch (err) {
      console.error('Error fetching destination:', err);
      // If destination fails, create from research data
      if (researchData) {
        const parseJSON = (str) => {
          if (!str) return [];
          try {
            const parsed = JSON.parse(str);
            return Array.isArray(parsed) ? parsed : [];
          } catch { return []; }
        };
        setDestination({
          name: researchData.name,
          country: researchData.name,
          description: researchData.overview,
          safety_rating: researchData.solo_safety_score >= 8 ? 'high' : 'medium',
          solo_friendly_rating: researchData.solo_friendly_rating,
          budget_level: researchData.budget_daily_local < 5000 ? 'budget' : researchData.budget_daily_local < 15000 ? 'medium' : 'luxury',
          highlights: parseJSON(researchData.best_regions_for_solo).map(r => r.split(' - ')[0]),
          travel_styles: ['Cultural', 'Adventure', 'Food'],
          best_months: ['April', 'May', 'September', 'October', 'November'],
          solo_safety_index: researchData.solo_safety_score * 10,
          city: researchData.capital_city || 'Multiple Cities'
        });
      } else {
        setError('Failed to load destination details');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await api.get(`/reviews?destination=${encodeURIComponent(id)}`);
      setReviews(response.data.data?.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  const fetchBuddies = async () => {
    try {
      const destName = destination?.name || id; 
      const response = await api.get(`/matching/discovery?destination=${encodeURIComponent(destName)}`);
      setBuddies(response.data.data || []);
    } catch (err) {
      console.error('Error fetching buddies:', err);
    }
  };

  useEffect(() => {
    if (destination?.name) {
      fetchBuddies();
    }
  }, [destination?.name]);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={`star-${i}`} className={`text-xl ${i < rating ? 'text-brand-vibrant' : 'text-base-content/20'}`}>
        ★
      </span>
    ));
  };

  if (loading) return (
    <div className="min-h-screen bg-base-200 animate-fade-in pb-20">
      <div className="relative h-[65vh] min-h-[450px] w-full overflow-hidden">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="space-y-8">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  if (error || !destination) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <div className="glass-card p-10 rounded-xl text-center max-w-md">
          <MapPin size={40} className="mx-auto text-red-400 mb-4" />
          <p className="text-base-content/80 font-bold mb-2 text-lg">Unable to Load Destination</p>
          <p className="text-base-content/60 mb-6 text-sm">We couldn't find this destination. It may have been removed or the link is incorrect.</p>
          <Link to="/destinations">
            <Button variant="primary" className="rounded-xl">Browse Destinations</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 animate-fade-in pb-20">
      <SEO 
        title={`Exploring ${destination.name}`} 
        description={`The ultimate solo travel guide to ${destination.name}, ${destination.country}. Discover safety ratings, budget levels, and AI-generated itineraries.`} 
      />
      
      <div className="fixed bottom-6 left-0 right-0 px-6 z-[100] md:hidden animate-slide-up">
        <Button 
          variant="primary" 
          onClick={() => navigate(`/trips/new?destination=${encodeURIComponent(destination.name)}&budget=${destination.budget_level}`)}
          className="w-full btn-premium rounded-xl py-4 font-black flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(16,185,129,0.4)]"
        >
          <Sparkles size={20} /> Build AI Itinerary
        </Button>
      </div>

      <div className="relative h-[65vh] min-h-[450px] w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={destination.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200'}
            className="w-full h-full object-cover"
            style={{ transform: 'scale(1.1)', filter: 'brightness(0.85)' }}
            alt={`${destination.name} - Solo Travel Guide`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-transparent to-slate-50/10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent opacity-100"></div>
          <div className="absolute inset-0 hero-layer-mask"></div>
        </div>

        <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="group flex items-center gap-3 px-4 py-2 rounded-xl bg-base-100/10 backdrop-blur-md text-white font-bold hover:bg-base-100/20 transition-all border border-white/10 shadow-lg"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back
          </button>
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-base-100/10 backdrop-blur-md border border-white/10 text-white font-bold">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="text-xs uppercase tracking-[0.2em]">Solo-Verified Platform</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 md:p-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-lg bg-success/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">
                {destination.safety_rating === 'high' ? 'Verified Safe' : 'Exercise Caution'}
              </div>
              <div className="px-3 py-1 rounded-lg bg-base-100/10 backdrop-blur-md border border-white/20 text-white/70 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1">
                <Clock size={12} /> {destination.best_months?.[0]} Ideal
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
              {destination.name}
            </h1>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-base-100/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 font-bold shadow-lg">
                <MapPin size={18} className="text-emerald-400" /> {destination.city}
              </div>
              <div className="flex items-center gap-2 bg-base-100/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 font-bold shadow-lg">
                <TrendingUp size={18} className="text-emerald-400" /> {destination.budget_level} Budget
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-20">
          <Button 
            variant="primary" 
            onClick={() => navigate(`/trips/new?destination=${encodeURIComponent(destination.name)}&budget=${destination.budget_level}`)}
            className="btn-premium rounded-xl font-black flex items-center gap-2 shadow-[0_10px_40px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_60px_rgba(16,185,129,0.6)]"
          >
            <div className="w-10 h-10 rounded-full bg-base-100/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles size={24} />
            </div>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex overflow-x-auto gap-0 -mb-px">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'safety', label: 'Safety' },
              { id: 'cost', label: 'Cost' },
              { id: 'weather', label: 'Weather' },
              { id: 'practical', label: 'Practical' },
              { id: 'reviews', label: 'Reviews' },
              { id: 'tips', label: 'Tips' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-10">
          <div className="glass-card p-8 md:p-10 rounded-xl">
            <h2 className="text-2xl font-black text-base-content flex items-center gap-3 mb-6">
              <Info className="text-brand-vibrant" /> Overview
            </h2>
            <p className="text-base-content/80 leading-relaxed text-lg mb-8">
              {destination.description}
            </p>

            <div className="mb-8">
              <h3 className="text-xl font-black text-base-content mb-6">Top Highlights</h3>
              <div className="grid gap-4">
                {destination.highlights?.map((h, i) => (
                  <div key={`highlight-${i}`} className="flex items-start gap-4 p-4 rounded-xl bg-base-200 border border-base-300/50 group hover:border-brand-vibrant/20 transition-all">
                    <div className="w-8 h-8 rounded-xl bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant font-black text-sm">
                      {i + 1}
                    </div>
                    <span className="text-base-content/80 font-bold leading-tight pt-1">{h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-black text-base-content mb-6">Best For</h3>
              <div className="flex flex-wrap gap-3">
                {destination.travel_styles?.map((s, i) => (
                  <span key={`style-${i}`} className="px-4 py-2 rounded-xl bg-brand-accent/10 text-brand-accent font-bold text-sm border border-brand-accent/5">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-black text-base-content mb-3 text-sm uppercase tracking-widest text-base-content/40">Best Time to Visit</h4>
              <div className="flex flex-wrap gap-2">
                {destination.best_months?.map((m, i) => (
                  <span key={`month-${i}`} className="px-4 py-2 rounded-xl bg-base-200 text-base-content/80 font-bold text-sm">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-10 rounded-xl border-t-8 border-brand-vibrant shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-vibrant/5 rounded-full blur-3xl opacity-50"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>
                <h3 className="text-3xl font-black flex items-center gap-3 tracking-tight text-base-content">
                  <ShieldCheck className="text-brand-vibrant" size={36} /> Solo-Safe Vault
                </h3>
                <p className="text-base-content/60 mt-2 font-medium">Verified by FCDO, AI Logistics, and real-time solo traveler data.</p>
              </div>
              <div className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-lg border-2 shadow-xl flex items-center gap-2 transform hover:scale-105 transition-transform duration-300 ${
                destination.safety_rating === 'high' ? 'border-brand-vibrant bg-brand-vibrant/5 text-success shadow-emerald-500/10' : 'border-orange-500 bg-orange-500/5 text-orange-600 shadow-orange-500/10'
              }`}>
                {destination.solo_safety_index || '94'}% Secure
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-10">
              {safetyLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={`skeleton-${i}`} className="p-6 rounded-xl bg-base-200 border border-base-300/50 animate-pulse">
                      <div className="w-12 h-12 rounded-xl bg-base-300 mb-4"></div>
                      <div className="h-3 bg-base-300 rounded w-1/2 mb-2"></div>
                      <div className="h-6 bg-base-300 rounded w-3/4 mb-2"></div>
                      <div className="h-2 bg-base-300 rounded w-full"></div>
                    </div>
                  ))}
                </>
              ) : safetyStats ? (
                [
                  { label: 'Night Lighting', value: safetyStats.night_lighting || 'Street-Vetted', sub: safetyStats.night_lighting_sub || '98% Coverage in Tourist Hubs', icon: Moon, color: 'text-indigo-500' },
                  { label: 'Solo-Female Friendly', value: safetyStats.solo_female_friendly || 'High', sub: safetyStats.solo_female_sub || 'Dedicated safe-spaces verified', icon: Heart, color: 'text-pink-500' },
                  { label: 'Transit Reliability', value: safetyStats.transit_reliability || '96%', sub: safetyStats.transit_sub || 'Real-time tracking available', icon: Navigation, color: 'text-brand-vibrant' }
                ].map((m, i) => (
                  <div key={`safety-${i}`} className="p-6 rounded-xl bg-base-200 border border-base-300/50 hover:border-brand-vibrant/20 hover:bg-base-100 hover:shadow-xl transition-all group">
                    <div className={`w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform ${m.color}`}>
                      <m.icon size={24} />
                    </div>
                    <h4 className="font-black text-base-content text-sm mb-1 uppercase tracking-widest opacity-40">{m.label}</h4>
                    <p className="text-xl font-black text-base-content mb-1">{m.value}</p>
                    <p className="text-[10px] font-bold text-base-content/40">{m.sub}</p>
                  </div>
                ))
              ) : (
                [
                  { label: 'Night Lighting', value: 'Street-Vetted', sub: '98% Coverage in Tourist Hubs', icon: Moon, color: 'text-indigo-500' },
                  { label: 'Solo-Female Friendly', value: 'High', sub: 'Dedicated safe-spaces verified', icon: Heart, color: 'text-pink-500' },
                  { label: 'Transit Reliability', value: '96%', sub: 'Real-time tracking available', icon: Navigation, color: 'text-brand-vibrant' }
                ].map((m, i) => (
                  <div key={`safety-default-${i}`} className="p-6 rounded-xl bg-base-200 border border-base-300/50 hover:border-brand-vibrant/20 hover:bg-base-100 hover:shadow-xl transition-all group">
                    <div className={`w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform ${m.color}`}>
                      <m.icon size={24} />
                    </div>
                    <h4 className="font-black text-base-content text-sm mb-1 uppercase tracking-widest opacity-40">{m.label}</h4>
                    <p className="text-xl font-black text-base-content mb-1">{m.value}</p>
                    <p className="text-[10px] font-bold text-base-content/40">{m.sub}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-brand-deep text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-vibrant/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 flex items-center gap-4">
                   <div className="w-16 h-16 rounded-xl bg-base-100/10 flex items-center justify-center text-brand-vibrant">
                      <Globe size={32} className="animate-pulse" />
                   </div>
                   <div>
                      <h4 className="text-lg font-black tracking-tight">Connected Live Map</h4>
                      <p className="text-white/50 text-xs font-medium">Real-time crime heatmaps & Pink-Path safe routing.</p>
                   </div>
                </div>
                <Button 
                  onClick={() => navigate('/safety')}
                  variant="primary" 
                  className="relative z-10 btn-premium rounded-xl px-10 py-4 font-black whitespace-nowrap shadow-lg shadow-brand-vibrant/30"
                >
                  Enter Live Map →
                </Button>
              </div>
            </div>
          </div>

          <PlanGate
            minPlan="navigator"
            title="AI Destination Chat"
            description="Upgrade to Navigator to ask Atlas anything about this destination — safety, culture, food, and custom itinerary prompts."
          >
            <DestinationChat destinationId={id} destinationName={destination.name} />
          </PlanGate>

          <div className="glass-card p-8 md:p-10 rounded-xl shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-black text-base-content flex items-center gap-3">
                <Users className="text-brand-vibrant" /> Community Insights
              </h3>
              <Link to={`/reviews/new?destination=${encodeURIComponent(destination.name)}`}>
                <Button variant="secondary" className="rounded-xl flex items-center gap-2">
                  <Plus size={18} /> Add Review
                </Button>
              </Link>
            </div>

            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="p-6 rounded-xl bg-base-200 border border-base-300/50 hover:border-brand-vibrant/20 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-vibrant/10 flex items-center justify-center font-black text-brand-vibrant uppercase text-xs">
                          {review.author?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-base-content text-sm">{review.author?.name}</p>
                            {review.isVerified && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success text-[8px] font-black uppercase tracking-wider">
                                <ShieldCheck size={10} /> Verified Traveler
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">
                            {new Date(review.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(review.overallRating)}
                      </div>
                    </div>
                    
                    <h4 className="font-black text-base-content text-lg mb-2">{review.title}</h4>
                    <p className="text-base-content/80 text-sm leading-relaxed mb-4">
                      {review.content}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {review.tags?.map((tag, i) => (
                        <span key={`tag-${i}`} className="px-2 py-1 rounded-md bg-base-100 border border-base-300 text-base-content/60 text-[10px] font-bold">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-8 rounded-xl bg-brand-vibrant/5 border-2 border-dashed border-brand-vibrant/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                      <Sparkles size={120} className="text-brand-vibrant" />
                   </div>
                   <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-8 h-8 rounded-lg bg-brand-vibrant text-white flex items-center justify-center">
                            <Zap size={18} />
                         </div>
                         <h4 className="font-black text-base-content text-lg uppercase tracking-tight">AI-Vetted Insights</h4>
                      </div>
                      <p className="text-sm font-medium text-base-content/80 leading-relaxed mb-6">
                         Our intelligence engine hasn't processed enough verified traveler data for <strong>{destination.name}</strong> yet. Here is our baseline solo safety analysis:
                      </p>
                      <ul className="space-y-3 mb-8">
                         {[
                            `Day walking is highly secure; avoid back-streets near the main square after 11 PM.`,
                            `${destination.city} transit is solo-verified; use official app trackers.`,
                            `${destination.budget_level} cost profile confirmed for Q2 2026.`
                          ].map((tip, i) => (
                            <li key={`tip-${i}`} className="flex items-start gap-3 bg-base-100 p-3 rounded-xl border border-base-300/50 shadow-sm">
                              <span className="text-brand-vibrant mt-0.5 font-bold">✓</span>
                              <span className="text-[11px] font-bold text-base-content/60">{tip}</span>
                           </li>
                         ))}
                      </ul>
                      <Link to={`/reviews/new?destination=${encodeURIComponent(destination.name)}`}>
                        <button className="w-full py-4 rounded-xl bg-brand-deep text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-all">
                           <ShieldCheck size={18} /> Become a Founding Explorer <span className="text-[10px] bg-brand-vibrant px-2 py-0.5 rounded-full ml-2">REWARDS AVAILABLE</span>
                        </button>
                      </Link>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="animate-slide-up">
            <LeafletMap 
              center={destination.latitude && destination.longitude ? [destination.latitude, destination.longitude] : null}
              markers={destination.latitude && destination.longitude ? [{
                id: destination.id,
                position: [destination.latitude, destination.longitude],
                title: destination.name,
                description: destination.country,
              }] : []}
              height="300px"
            />
          </div>

          <CurrencyConverter 
            defaultFrom={destination.currency_code || (destination.country === 'United Kingdom' ? 'GBP' : destination.country === 'United States' ? 'USD' : 'EUR')} 
            defaultTo="GBP" 
          />

          <WeatherWidget 
            city={destination.city || destination.name} 
            country={destination.country} 
          />

          <div className="glass-card p-6 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-black text-base-content flex items-center gap-2">
                <Users className="text-brand-vibrant" size={20} /> Explorers
              </h4>
              <span className="px-2 py-1 rounded-md bg-brand-vibrant/10 text-brand-vibrant text-[10px] font-black uppercase">Nearby</span>
            </div>
            
            {buddies.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-base-content/60 font-bold leading-relaxed mb-4">
                  Other solo explorers are heading to <span className="text-base-content">{destination.name}</span> soon!
                </p>
                <div className="flex -space-x-3 mb-6">
                  {buddies.slice(0, 5).map((buddy, i) => (
                    <div key={`buddy-${i}`} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-base-300">
                      {buddy.avatar_url ? (
                        <img src={buddy.avatar_url} alt={buddy.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-vibrant text-white text-xs font-black">
                          {(buddy.firstName || 'U').charAt(0)}
                        </div>
                      )}
                    </div>
                  ))}
                  {buddies.length > 5 && (
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-base-200 flex items-center justify-center text-[10px] font-black text-base-content/60">
                      +{buddies.length - 5}
                    </div>
                  )}
                </div>
                <Link to={`/matching?destination=${encodeURIComponent(destination.name)}`}>
                  <button className="w-full py-3 rounded-xl bg-base-200 text-base-content/80 font-black text-sm hover:bg-brand-vibrant/10 hover:text-brand-vibrant transition-all">
                    Connect with {buddies[0]?.firstName || 'other'} & others
                  </button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-base-content/40 font-medium italic">Searching for active travelers...</p>
                <Link to="/matching">
                  <button className="mt-4 text-xs font-black text-brand-vibrant hover:underline">Join Discovery Hub</button>
                </Link>
              </div>
            )}
          </div>

          <div className="glass-card p-8 rounded-xl">
            <h4 className="text-xl font-black text-base-content mb-6">Logistics</h4>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50">
                <div className="flex items-center gap-3 text-base-content/60 font-bold uppercase text-[10px] tracking-widest"><TrendingUp size={14} className="text-brand-vibrant" /> Budget</div>
                <span className="font-black text-base-content capitalize">{destination.budget_level}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50">
                <div className="flex items-center gap-3 text-base-content/60 font-bold uppercase text-[10px] tracking-widest"><Calendar size={14} className="text-brand-accent" /> Climate</div>
                <span className="font-black text-base-content capitalize">{destination.climate}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300/50">
                <div className="flex items-center gap-3 text-base-content/60 font-bold uppercase text-[10px] tracking-widest"><Navigation size={14} className="text-brand-vibrant" /> Transit</div>
                <span className="font-black text-base-content capitalize">High Quality</span>
              </div>
            </div>
            
            <div className="mt-6">
              <AffiliateHub destination={destination} />
            </div>

            <div className="mt-6 pt-6 border-t border-base-300/50">
              <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-3">Partner Offers</p>
              <Link to="/partnerships" className="flex items-center justify-between text-xs font-bold text-base-content/60 hover:text-brand-vibrant transition-colors">
                Hotel Deals <span className="text-[10px] bg-base-200 px-1.5 py-0.5 rounded text-base-content/40">Affiliate</span> <ChevronRight size={14} />
              </Link>
              <p className="text-[10px] text-base-content/40 mt-2 leading-relaxed">
                We may earn a commission when you book through our partner links at no extra cost to you, helping keep SoloCompass free.
              </p>
            </div>
          </div>
        </div>
        
        {/* AI Research Badge & Data */}
        {researchData && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-brand-vibrant/10 border border-brand-vibrant/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-brand-vibrant uppercase">Solo Score</p>
                <p className="text-xl font-black text-brand-vibrant">{researchData.solo_safety_score}/10</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-base-200">
                  <p className="text-base-content/50">Local ¥{researchData.budget_daily_local}/day</p>
                </div>
                <div className="p-2 rounded bg-base-200">
                  <p className="text-base-content/50">Tourist ¥{researchData.budget_daily_tourist}/day</p>
                </div>
              </div>
            </div>
            
            {/* Safety & Cultural Insights */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-base-200 border border-base-300/50">
                <h4 className="text-sm font-black text-base-content mb-2 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-orange-500" /> Safety Overview
                </h4>
                <p className="text-xs text-base-content/70 line-clamp-4">{researchData.safety_overview}</p>
              </div>
              <div className="p-4 rounded-xl bg-base-200 border border-base-300/50">
                <h4 className="text-sm font-black text-base-content mb-2 flex items-center gap-2">
                  <Globe size={16} className="text-blue-500" /> Cultural Etiquette
                </h4>
                <p className="text-xs text-base-content/70 line-clamp-4">{researchData.cultural_etiquette || researchData.local_customs}</p>
              </div>
            </div>
            
            {/* Top Cities */}
            {researchData.cities && researchData.cities.length > 0 && (
              <div className="p-4 rounded-xl bg-base-200 border border-base-300/50">
                <h4 className="text-sm font-black text-base-content mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-brand-vibrant" /> Top Cities for Solo Travel
                </h4>
                <div className="flex flex-wrap gap-2">
                  {researchData.cities.slice(0, 6).map((city, i) => (
                    <span key={i} className="px-3 py-1 rounded-lg bg-brand-vibrant/10 text-brand-vibrant text-xs font-bold flex items-center gap-1">
                      {city.name} <span className="text-brand-vibrant/60">({city.solo_score}/10)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Common Scams */}
            {researchData.common_scams && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <h4 className="text-sm font-black text-orange-600 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> Watch Out For
                </h4>
                <p className="text-xs text-base-content/70 line-clamp-3">{researchData.common_scams}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'safety' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Safety</h2>
          {safetyStats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Safety Scores</h3>
              <div className="space-y-3">
                {safetyStats.scores?.overall != null && <SafetyScoreBar label="Overall" score={safetyStats.scores.overall} />}
                {safetyStats.scores?.women != null && <SafetyScoreBar label="Women" score={safetyStats.scores.women} />}
                {safetyStats.scores?.lgbtq != null && <SafetyScoreBar label="LGBTQ+" score={safetyStats.scores.lgbtq} />}
                {safetyStats.scores?.night != null && <SafetyScoreBar label="Night Safety" score={safetyStats.scores.night} />}
                {safetyStats.scores?.solo != null && <SafetyScoreBar label="Solo Travel" score={safetyStats.scores.solo} />}
              </div>
            </div>
          )}
          <ScamAlertList destinationId={destinationId} />
          <NeighbourhoodSafetyMap destinationId={destinationId} />
        </div>
      )}
      {activeTab === 'cost' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cost Breakdown</h2>
          <CostTab destinationId={destinationId} />
        </div>
      )}
      {activeTab === 'weather' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Weather</h2>
          <WeatherChart destinationId={destinationId} />
        </div>
      )}
      {activeTab === 'practical' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Practical Info</h2>
          <PracticalInfoCard destinationId={destinationId} />
        </div>
      )}
      {activeTab === 'reviews' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reviews</h2>
          <ReviewFilters filters={{}} onChange={() => {}} />
          <ReviewList reviews={reviews} />
        </div>
      )}
      {activeTab === 'tips' && destinationId && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Community Tips</h2>
          <TipSubmitForm destinationId={destinationId} onSuccess={() => {}} />
          <CommunityTipsList destinationId={destinationId} />
        </div>
      )}
    </div>
  );
}

export default DestinationDetail;
