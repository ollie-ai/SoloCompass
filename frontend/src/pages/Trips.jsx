import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { createCancelToken, isCancel, duplicateTrip } from '../lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/utils';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import APIErrorBoundary from '../components/APIErrorBoundary';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../lib/telemetry';
import { isExplorerTier } from '../lib/subscriptionAccess';
import { 
  MapPin, Calendar, Sparkles, Plus, 
  ChevronRight, Clock, Map as MapIcon, Globe, MoreVertical, Trash2, Eye, Shield, Check, Navigation, Wallet, Search, Copy, ArrowUpDown
} from 'lucide-react';

const EXPLORER_ACTIVE_TRIP_LIMIT = 2;

function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingItinerary, setGeneratingItinerary] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [filterTab, setFilterTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const navigate = useNavigate();
  const cancelSourceRef = useRef(null);
  const menuRef = useRef(null);
  const { user } = useAuthStore();

  const pastTripsCache = useRef({ data: null, timestamp: null });

  const isExplorerUser = () => {
    return isExplorerTier(user);
  };

  const countActiveTrips = (allTrips) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allTrips.filter(trip => {
      if (trip.status === 'archived') return false;
      if (!trip.end_date) return true;
      const endDate = new Date(trip.end_date);
      return endDate >= today;
    }).length;
  };

  const canCreateTrip = () => {
    if (!isExplorerUser()) return true;
    return countActiveTrips(trips) < EXPLORER_ACTIVE_TRIP_LIMIT;
  };

  const handleNewTrip = () => {
    if (!canCreateTrip()) {
      toast.error('Explorer plan allows up to 2 active trips. Complete or archive one to start another.');
      return;
    }
    navigate('/trips/new');
  };

  const isPastTripsCacheValid = () => {
    if (!pastTripsCache.current.timestamp) return false;
    return Date.now() - pastTripsCache.current.timestamp < 300000;
  };

  const getPastTrips = (allTrips) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allTrips.filter(trip => {
      if (!trip.end_date) return false;
      const endDate = new Date(trip.end_date);
      return endDate < today;
    });
  };

  const fetchTrips = useCallback(async () => {
    const source = createCancelToken();
    cancelSourceRef.current = source;
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/trips', { cancelToken: source.token });
      const allTrips = response.data.data?.trips || [];
      
      const pastTrips = getPastTrips(allTrips);
      if (pastTrips.length > 0 && isPastTripsCacheValid()) {
        const cachedPast = pastTripsCache.current.data;
        const activeTrips = allTrips.filter(t => !getPastTrips([t]).length);
        const mergedTrips = [...activeTrips, ...cachedPast];
        setTrips(mergedTrips);
      } else {
        setTrips(allTrips);
        if (pastTrips.length > 0) {
          pastTripsCache.current = { data: pastTrips, timestamp: Date.now() };
        }
      }
    } catch (err) {
      if (isCancel(err)) return;
      console.error('[Trips] Fetch error:', err.response?.status, err.response?.data || err.message);
      setError('Unable to load trips. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    trackEvent('view_trips_list', {});
    return () => {
      if (cancelSourceRef.current) {
        cancelSourceRef.current.cancel('Component unmounted');
      }
    };
  }, [fetchTrips]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateItinerary = async (tripId) => {
    setGeneratingItinerary(tripId);
    try {
      await api.post(`/trips/${tripId}/generate`, {
        days: 7,
        interests: [],
        pace: 'moderate'
      });
      toast.success('AI Itinerary generated successfully!');
      fetchTrips(); 
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate itinerary'));
    } finally {
      setGeneratingItinerary(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/trips/${deleteTarget}`);
      toast.success('Trip deleted');
      setDeleteTarget(null);
      setOpenMenuId(null);
      fetchTrips();
    } catch (error) {
      toast.error('Failed to delete trip');
    }
  };

  const formatDateRange = (start, end) => {
    if (!start) return 'Dates TBD';
    const s = new Date(start);
    const opts = { month: 'short', day: 'numeric' };
    const yearOpts = { year: 'numeric' };
    let str = s.toLocaleDateString('en-US', opts);
    if (end) {
      const e = new Date(end);
      str += ' – ' + e.toLocaleDateString('en-US', { ...opts, ...yearOpts });
    } else {
      str += ', ' + s.toLocaleDateString('en-US', yearOpts);
    }
    return str;
  };

  const getDuration = (start, end) => {
    if (!start || !end) return null;
    const diff = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
    return diff <= 1 ? '1 day' : `${diff} days`;
  };

  const getTripPriority = (trip) => {
    const now = new Date();
    const start = trip.start_date ? new Date(trip.start_date) : null;
    const end = trip.end_date ? new Date(trip.end_date) : null;

    // Live/active trips first
    if (trip.status === 'confirmed') {
      if (start && start <= now && (!end || end >= now)) return 0; // currently travelling
      if (!start || start > now) return 1; // upcoming confirmed
    }
    if (trip.status === 'planning') return 2; // planning — treat as active
    if (trip.status === 'draft') return 3; // draft
    if (trip.status === 'completed') return 10;
    if (trip.status === 'cancelled') return 11;
    if (trip.status === 'archived') return 12;
    return 5;
  };

  const getCardAction = (trip) => {
    const now = new Date();
    const start = trip.start_date ? new Date(trip.start_date) : null;

    if (trip.status === 'planning') return { label: 'Continue planning', icon: Sparkles };
    if (trip.status === 'confirmed' && start && start <= now) return { label: 'Open trip', icon: Eye };
    if (trip.status === 'confirmed' && (!start || start > now)) return { label: 'Open trip', icon: Eye };
    if (trip.status === 'completed') return { label: 'View summary', icon: Eye };
    if (trip.status === 'cancelled') return { label: 'View trip record', icon: Eye };
    return { label: 'View trip', icon: Eye };
  };

  // Search filter
  const filteredTrips = trips.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (t.name?.toLowerCase().includes(q) || t.destination?.toLowerCase().includes(q));
  });

  // Sort logic
  const applySorting = (list) => {
    if (sortBy === 'name') return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'date') return [...list].sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
    if (sortBy === 'destination') return [...list].sort((a, b) => (a.destination || '').localeCompare(b.destination || ''));
    return [...list].sort((a, b) => getTripPriority(a) - getTripPriority(b));
  };

  const sortedTrips = applySorting(filteredTrips);
  const activeTrips = sortedTrips.filter(t => getTripPriority(t) <= 2);
  const draftTrips = sortedTrips.filter(t => t.status === 'draft' || getTripPriority(t) === 3);
  const pastTrips = sortedTrips.filter(t => getTripPriority(t) >= 10);
  const featuredTrip = activeTrips.length > 0 ? activeTrips[0] : null;
  const remainingActive = featuredTrip ? activeTrips.slice(1) : activeTrips;

  // Duplicate handler
  const handleDuplicate = async (tripId) => {
    try {
      const response = await duplicateTrip(tripId);
      if (response.data?.id) {
        toast.success('Trip duplicated!');
        fetchTrips();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to duplicate trip'));
    }
  };

  // Countdown helper
  const getTripCountdown = (trip) => {
    if (!trip.start_date) return null;
    const start = new Date(trip.start_date);
    const now = new Date();
    const end = trip.end_date ? new Date(trip.end_date) : null;
    if (end && now > end) return null;
    if (now >= start && end && now <= end) return 'Now';
    const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return 'Today';
    return `${diff}d`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return { bg: 'bg-base-200', border: 'border-base-300', text: 'text-base-content/50', label: 'Draft' };
      case 'planning':
        return { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', label: 'Planning' };
      case 'confirmed':
        return { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', label: 'Active' };
      case 'completed':
        return { bg: 'bg-base-200', border: 'border-base-300', text: 'text-base-content/80', label: 'Completed' };
      case 'cancelled':
        return { bg: 'bg-error/10', border: 'border-error/30', text: 'text-error', label: 'Cancelled' };
      case 'archived':
        return { bg: 'bg-base-200', border: 'border-base-300', text: 'text-base-content/40', label: 'Archived' };
      default:
        return { bg: 'bg-base-200', border: 'border-base-300', text: 'text-base-content/60', label: status };
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  };

  if (loading) return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-16 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={`skeleton-trip-${i}`} className="glass-card overflow-hidden rounded-3xl">
              <Skeleton className="h-40" />
              <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-3 pt-4">
                  <Skeleton className="h-12 flex-1 rounded-2xl" />
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );

  if (error) return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex justify-center">
        <EmptyState
          icon={MapIcon}
          title="Unable to Load Trips"
          description={error}
          actionLabel="Try Again"
          onAction={fetchTrips}
          variant="glass"
        />
      </div>
    </DashboardShell>
  );

  return (
    <DashboardShell>
      <APIErrorBoundary>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader 
          title={<>Your <span className="text-gradient">Adventures</span></>}
          subtitle="Plan, track, and relive every solo journey with mission-critical precision."
          badge="Trip Management"
          icon={Navigation}
          actions={
            trips.length > 0 && (
              <button onClick={handleNewTrip} className="btn btn-premium gap-2">
                <Plus size={18} strokeWidth={2.5} />
                New Adventure
              </button>
            )
          }
        />

        {/* Search & Sort Bar */}
        {trips.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trips by name or destination..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none font-bold text-sm text-base-content placeholder:text-base-content/30"
              />
            </div>
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="pl-9 pr-8 py-3 rounded-xl border border-base-content/10 bg-base-100 font-bold text-sm text-base-content appearance-none cursor-pointer focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none"
              >
                <option value="priority">Priority</option>
                <option value="name">Name</option>
                <option value="date">Date</option>
                <option value="destination">Destination</option>
              </select>
            </div>
          </div>
        )}

        {trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="py-10"
          >
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-brand-vibrant/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Globe size={48} strokeWidth={1.5} className="text-brand-vibrant" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-outfit font-black text-base-content mb-4 uppercase tracking-tight">
                Where to next?
              </h2>
              <p className="text-base-content/50 text-lg max-w-md mx-auto mb-8">
                Your next solo adventure awaits. Let Atlas help you discover the perfect destination and create a personalized itinerary.
              </p>
              <button onClick={handleNewTrip} className="btn btn-premium gap-2 px-10">
                <Plus size={18} strokeWidth={2.5} />
                Start Planning
              </button>
            </div>

            <div className="max-w-3xl mx-auto">
              <p className="text-xs font-black text-base-content/30 uppercase tracking-widest mb-6 text-center">Or choose a template</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { name: 'Weekend Escape', duration: '2-3 days', icon: '🌆' },
                  { name: 'Week Adventure', duration: '5-7 days', icon: '🗺️' },
                  { name: 'Extended Journey', duration: '2+ weeks', icon: '✈️' }
                ].map((template, idx) => (
                  <button
                    key={idx}
                    onClick={handleNewTrip}
                    className="glass-card p-6 text-left hover:shadow-brand-vibrant/10 hover:-translate-y-1 transition-all duration-300 rounded-2xl group"
                  >
                    <span className="text-3xl mb-3 block">{template.icon}</span>
                    <h3 className="font-black text-base-content uppercase text-sm mb-1 group-hover:text-brand-vibrant transition-colors">{template.name}</h3>
                    <p className="text-xs text-base-content/40 font-bold uppercase tracking-wide">{template.duration}</p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" key={trips.length}>
            {featuredTrip && (
              <motion.div variants={itemVariants} className="mb-12">
                <div className="glass-card overflow-hidden shadow-2xl shadow-brand-vibrant/5 group hover:shadow-brand-vibrant/10 transition-all duration-500 rounded-[2.5rem]">
                  <div className="p-8 sm:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-vibrant/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-brand-vibrant/10 transition-colors duration-500"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-premium bg-brand-vibrant text-white uppercase shadow-lg shadow-brand-vibrant/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            Incoming Mission
                          </span>
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-outfit font-black text-base-content tracking-tight mb-2 uppercase">{featuredTrip.name}</h2>
                        <div className="flex items-center gap-2 text-base-content/50 font-bold text-lg">
                          <MapPin size={18} strokeWidth={2.5} className="text-brand-vibrant" />
                          {featuredTrip.destination.toUpperCase()}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black tracking-premium border shadow-sm uppercase ${getStatusBadge(featuredTrip.status).bg} ${getStatusBadge(featuredTrip.status).border} ${getStatusBadge(featuredTrip.status).text} self-start`}>
                        {getStatusBadge(featuredTrip.status).label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-6 mb-10 text-sm text-base-content/40 font-black relative z-10 uppercase tracking-premium mt-8">
                      <span className="inline-flex items-center gap-2">
                        <Calendar size={16} strokeWidth={2.5} className="text-brand-vibrant" />
                        {formatDateRange(featuredTrip.start_date, featuredTrip.end_date)}
                      </span>
                      {getDuration(featuredTrip.start_date, featuredTrip.end_date) && (
                        <span className="inline-flex items-center gap-2">
                          <Clock size={16} strokeWidth={2.5} className="text-brand-vibrant" />
                          {getDuration(featuredTrip.start_date, featuredTrip.end_date).toUpperCase()}
                        </span>
                      )}
                      {featuredTrip.budget && (
                        <span className="inline-flex items-center gap-2">
                          <Wallet size={16} strokeWidth={2.5} className="text-brand-vibrant" />
                          TOTAL BUDGET: £{featuredTrip.budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 relative z-10">
                      {(() => {
                        const action = getCardAction(featuredTrip);
                        return (
                          <>
                            <Link to={`/trips/${featuredTrip.id}`} className="flex-1 sm:flex-none">
                              <button className="w-full sm:w-auto btn btn-premium gap-3 px-8">
                                {action.icon && <action.icon size={20} strokeWidth={2.5} />}
                                {action.label.toUpperCase()}
                                <ChevronRight size={18} strokeWidth={2.5} />
                              </button>
                            </Link>
                            {!featuredTrip.itinerary && (
                              <button
                                onClick={() => generateItinerary(featuredTrip.id)}
                                disabled={generatingItinerary === featuredTrip.id}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm border-2 border-brand-vibrant/20 text-brand-vibrant hover:bg-brand-vibrant/5 transition-all disabled:opacity-50 uppercase tracking-premium"
                              >
                                <Sparkles size={18} strokeWidth={2.5} />
                                {generatingItinerary === featuredTrip.id ? 'Analyzing...' : 'Generate Itinerary'}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {(remainingActive.length > 0 || pastTrips.length > 0) && (
              <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-outfit font-black text-base-content uppercase tracking-premium">
                    {filterTab === 'past' ? 'Archived Journeys' : filterTab === 'all' ? 'All Mission Files' : remainingActive.length > 0 ? 'All Active Mission Files' : 'No Active Trips'}
                  </h3>
                  <div className="flex items-center gap-1 p-1 bg-base-200/50 rounded-xl">
                    {[
                      { key: 'active', label: 'Active' },
                      { key: 'draft', label: 'Drafts' },
                      { key: 'past', label: 'Past' },
                      { key: 'all', label: 'All' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFilterTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-black uppercase tracking-premium transition-all ${
                          filterTab === tab.key
                            ? 'bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25'
                            : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
                        }`}
                        aria-pressed={filterTab === tab.key}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                  {(filterTab === 'active' ? remainingActive
                    : filterTab === 'draft' ? draftTrips
                      : filterTab === 'past' ? pastTrips
                        : [...remainingActive, ...draftTrips, ...pastTrips]).map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      getStatusBadge={getStatusBadge}
                      formatDateRange={formatDateRange}
                      getDuration={getDuration}
                      getCardAction={getCardAction}
                      generateItinerary={generateItinerary}
                      generatingItinerary={generatingItinerary}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      setDeleteTarget={setDeleteTarget}
                      menuRef={menuRef}
                      onDuplicate={handleDuplicate}
                      countdown={getTripCountdown(trip)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {trips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="mt-20"
          >
            <h3 className="text-xl font-outfit font-black text-base-content mb-8 uppercase tracking-premium">Quick Discovery</h3>
            <div className="grid sm:grid-cols-2 gap-8">
              <Link to="/destinations" className="group block">
                <div className="glass-card p-10 hover:shadow-brand-vibrant/10 transition-all duration-500 rounded-[2rem]">
                  <div className="w-16 h-16 bg-brand-vibrant/10 rounded-2xl flex items-center justify-center text-brand-vibrant mb-6 group-hover:bg-brand-vibrant group-hover:text-white transition-all duration-500 transform group-hover:rotate-6">
                    <Globe size={32} strokeWidth={2.5} />
                  </div>
                  <h4 className="text-2xl font-outfit font-black text-base-content mb-2 uppercase">Explore Hubs</h4>
                  <p className="text-base-content/40 font-bold text-sm tracking-wide">FIND THE PERFECT SOLO-FRIENDLY MISSION BASE.</p>
                </div>
              </Link>
              <Link to="/quiz" className="group block">
                <div className="glass-card p-10 hover:shadow-brand-vibrant/10 transition-all duration-500 rounded-[2rem]">
                  <div className="w-16 h-16 bg-brand-vibrant/10 rounded-2xl flex items-center justify-center text-brand-vibrant mb-6 group-hover:bg-brand-vibrant group-hover:text-white transition-all duration-500 transform group-hover:-rotate-6">
                    <Sparkles size={32} strokeWidth={2.5} />
                  </div>
                  <h4 className="text-2xl font-outfit font-black text-base-content mb-2 uppercase">Travel DNA</h4>
                  <p className="text-base-content/40 font-bold text-sm tracking-wide">REFINE YOUR AI ITINERARY GENERATOR CALIBRATION.</p>
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
      </APIErrorBoundary>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-base-100 rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-error" />
              </div>
              <h3 className="text-xl font-black text-base-content text-center mb-2">Delete this trip?</h3>
              <p className="text-base-content/60 font-medium text-center text-sm mb-6">This will permanently remove the trip and any AI-generated plans. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl font-bold border border-base-300 text-base-content/80 hover:bg-base-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl font-bold bg-error/100 text-white hover:bg-red-600 transition-all shadow-md shadow-red-500/25"
                >
                  Delete trip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

function TripCard({ trip, getStatusBadge, formatDateRange, getDuration, getCardAction, generateItinerary, generatingItinerary, openMenuId, setOpenMenuId, setDeleteTarget, menuRef, onDuplicate, countdown }) {
  const badge = getStatusBadge(trip.status);
  const action = getCardAction(trip);
  const isOpen = openMenuId === trip.id;

  return (
    <div className="glass-card group overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-brand-vibrant/10 hover:-translate-y-1 rounded-3xl">
      <div className="h-40 bg-brand-vibrant/5 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe size={120} strokeWidth={1} className="text-brand-vibrant/10 group-hover:text-brand-vibrant/20 transition-all duration-700 group-hover:rotate-12 transform" />
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {countdown && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-premium border uppercase shadow-sm ${
              countdown === 'Now' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :
              countdown === 'Today' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' :
              'bg-blue-500/10 border-blue-500/30 text-blue-600'
            }`}>
              <Clock size={10} strokeWidth={3} /> {countdown}
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-premium border uppercase shadow-sm ${badge.bg} ${badge.border} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
        <div className="absolute bottom-4 left-5 z-10">
          <h3 className="text-xl font-outfit font-black text-base-content truncate max-w-[200px] uppercase leading-tight mb-1">{trip.name}</h3>
          <div className="flex items-center gap-1.5 text-base-content/40 text-[10px] font-black tracking-premium">
            <MapPin size={12} strokeWidth={2.5} className="text-brand-vibrant" />
            <span className="truncate max-w-[160px] uppercase">{trip.destination}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col gap-2 mb-6 text-[11px] text-base-content/50 font-bold uppercase tracking-premium">
          <span className="inline-flex items-center gap-2">
            <Calendar size={14} strokeWidth={2.5} className="text-brand-vibrant/60" />
            {formatDateRange(trip.start_date, trip.end_date)}
          </span>
          {getDuration(trip.start_date, trip.end_date) && (
            <span className="inline-flex items-center gap-2">
              <Clock size={14} strokeWidth={2.5} className="text-brand-vibrant/60" />
              {getDuration(trip.start_date, trip.end_date)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {trip.itinerary ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-premium bg-brand-vibrant/10 text-brand-vibrant border border-brand-vibrant/20 uppercase">
              <Check size={10} strokeWidth={3} /> READY
            </span>
          ) : trip.status !== 'completed' && trip.status !== 'cancelled' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-premium bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
              <Clock size={10} strokeWidth={3} /> NO ITINERARY
            </span>
          ) : null}
          {trip.safety_setup ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-premium bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase">
              <Shield size={10} strokeWidth={3} /> SAFETY ON
            </span>
          ) : trip.status !== 'completed' && trip.status !== 'cancelled' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-premium bg-base-content/5 text-base-content/30 border border-base-content/10 uppercase">
              NO SAFETY
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/trips/${trip.id}`} className="flex-1">
            <button className="w-full py-3.5 rounded-2xl font-black text-[11px] bg-brand-vibrant text-white shadow-lg shadow-brand-vibrant/20 hover:shadow-brand-vibrant/30 transition-all flex items-center justify-center gap-2 uppercase tracking-premium">
              <action.icon size={14} strokeWidth={2.5} />
              {action.label}
            </button>
          </Link>
          {!trip.itinerary && trip.status !== 'completed' && trip.status !== 'cancelled' && (
            <button
              onClick={() => generateItinerary(trip.id)}
              disabled={generatingItinerary === trip.id}
              className="p-3.5 rounded-2xl border-2 border-brand-vibrant/20 text-brand-vibrant hover:bg-brand-vibrant/5 transition-all disabled:opacity-50"
              title="Generate AI Itinerary"
            >
              <Sparkles size={16} strokeWidth={2.5} />
            </button>
          )}
          <div className="relative" ref={isOpen ? menuRef : null}>
            <button
              onClick={() => setOpenMenuId(isOpen ? null : trip.id)}
              className="p-2.5 rounded-xl border border-base-300 text-base-content/40 hover:bg-base-200 hover:text-base-content/80 transition-all"
              title="More options"
            >
              <MoreVertical size={16} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-base-100 rounded-xl border border-base-300/60 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12)] z-20 overflow-hidden"
                >
                  <button
                    onClick={() => { onDuplicate(trip.id); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-base-content/70 hover:bg-base-200 transition-colors"
                  >
                    <Copy size={14} />
                    Duplicate trip
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(trip.id); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete trip
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Trips;
