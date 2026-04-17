import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Loader2, Globe, MessageCircle, Clock, UserPlus, Shield, Crown, CheckCircle, Search, X, MapPin, 
  Calendar, Zap, AlertCircle, PlusCircle, UserCheck, ChevronDown, Sparkles, Link as LinkIcon, Plus, Info, Activity 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import { useAuthStore } from '../stores/authStore';
import PlanGate from '../components/PlanGate';
import BuddyRequestCard from '../components/BuddyRequestCard';
import SoloIDCard from '../components/SoloIDCard';
import MatchingProfile from '../components/MatchingProfile';
import MatchingProfileEdit from '../components/MatchingProfileEdit';
import VerificationModal from '../components/VerificationModal';
import ConfirmDialog from '../components/ConfirmDialog';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
};

const destinationSuggestions = [
  'Tokyo', 'Bangkok', 'Paris', 'London', 'New York', 'Bali', 'Rome', 'Barcelona', 'Lisbon', 'Sydney',
  'Amsterdam', 'Berlin', 'Dubai', 'Singapore', 'Seoul', 'Istanbul', 'Cape Town', 'Mumbai', 'Ho Chi Minh City', 'Chiang Mai'
];

const Buddies = () => {
  const { user } = useAuthStore();
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [soloId, setSoloId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterDestination, setFilterDestination] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [activeTab, setActiveTab] = useState('discover');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [confirmBlockId, setConfirmBlockId] = useState(null);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [filterDestination]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setHighlightedSuggestion(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = destinationSuggestions.filter(
    (d) => d.toLowerCase().includes(filterDestination.toLowerCase()) && filterDestination.length > 0
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [potentialRes, requestsRes, connectionsRes, profileRes, soloIdRes] = await Promise.all([
        api.get(`/matching/potential${filterDestination ? `?destination=${encodeURIComponent(filterDestination)}` : ''}`),
        api.get('/matching/requests'),
        api.get('/matching/connections'),
        api.get('/matching/profile').catch(err => { console.error('[Buddies] Failed to fetch profile:', err); return { data: { data: null } }; }),
        api.get('/matching/solo-id').catch(err => { console.error('[Buddies] Failed to fetch solo-id:', err); return { data: { data: null } }; })
      ]);
      setPotentialMatches(potentialRes.data.data || []);
      setIncomingRequests(requestsRes.data.data?.incoming || []);
      setOutgoingRequests(requestsRes.data.data?.outgoing || []);
      setConnections(connectionsRes.data.data || []);
      setMyProfile(profileRes.data.data);
      setSoloId(soloIdRes.data.data);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (userId) => {
    setActionLoading(true);
    try {
      await api.post('/matching/request', { recipientId: userId });
      toast.success('Connection request sent!');
      setPotentialMatches(prev => (prev || []).filter(m => m.userId !== userId));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = (userId) => {
    setPotentialMatches(prev => (prev || []).filter(m => m.userId !== userId));
  };

  const handleAcceptRequest = async (requestId) => {
    setActionLoading(true);
    try {
      await api.post(`/matching/request/${requestId}/accept`);
      toast.success('Connection accepted!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    setActionLoading(true);
    try {
      await api.post(`/matching/request/${requestId}/decline`);
      toast.success('Request declined');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to decline request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = (userId) => {
    setConfirmBlockId(userId);
  };

  const executeBlockUser = async () => {
    const userId = confirmBlockId;
    setConfirmBlockId(null);
    try {
      await api.post(`/matching/block/${userId}`);
      toast.success('User blocked');
      setPotentialMatches(prev => (prev || []).filter(m => m.userId !== userId));
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleProfileSave = (updatedProfile) => {
    setMyProfile(updatedProfile);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    if (diffMonths === 1) return '1 month ago';
    return `${diffMonths} months ago`;
  };

  const getRequestMatchReasons = (request) => {
    const reasons = [];
    const user = request.requester || request.recipient;
    if (!myProfile) return reasons;
    if (request.trip?.destination && myProfile.destinations) {
      const myDests = Array.isArray(myProfile.destinations) ? myProfile.destinations : [myProfile.destinations];
      const matchDest = request.trip.destination;
      if (myDests.some(d => d.toLowerCase().includes(matchDest.toLowerCase()) || matchDest.toLowerCase().includes(d.toLowerCase()))) {
        reasons.push({ icon: MapPin, label: 'Same destination', color: 'text-brand-vibrant bg-brand-vibrant/5 border-brand-vibrant/20' });
      }
    }
    if (request.trip?.startDate && request.trip?.endDate && myProfile.startDate && myProfile.endDate) {
      const aStart = new Date(request.trip.startDate);
      const aEnd = new Date(request.trip.endDate);
      const bStart = new Date(myProfile.startDate);
      const bEnd = new Date(myProfile.endDate);
      if (aStart <= bEnd && aEnd >= bStart) {
        reasons.push({ icon: Calendar, label: 'Overlapping dates', color: 'text-warning bg-warning/10 border-warning/30/60' });
      }
    }
    if (user?.interests && myProfile.interests) {
      const sharedInterests = user.interests.filter(i => myProfile.interests.includes(i));
      if (sharedInterests.length > 0) {
        reasons.push({ icon: Sparkles, label: 'Shared interests', color: 'text-rose-600 bg-rose-50 border-rose-200/60' });
      }
    }
    return reasons;
  };

  const getConnectionStatus = (conn) => {
    if (conn.trip?.endDate && new Date(conn.trip.endDate) < new Date()) {
      return { label: 'Trip ended', color: 'bg-base-200 text-base-content/60' };
    }
    return { label: 'Active', color: 'bg-brand-vibrant/10 text-brand-vibrant' };
  };

  const getConnectionSharedInfo = (conn) => {
    const shared = [];
    if (!myProfile) return shared;
    if (conn.trip?.destination && myProfile.destinations) {
      const myDests = Array.isArray(myProfile.destinations) ? myProfile.destinations : [myProfile.destinations];
      const connDest = conn.trip.destination;
      if (myDests.some(d => d.toLowerCase().includes(connDest.toLowerCase()) || connDest.toLowerCase().includes(d.toLowerCase()))) {
        shared.push({ icon: MapPin, label: connDest });
      }
    }
    if (conn.user?.interests && myProfile.interests) {
      const sharedInterests = conn.user.interests.filter(i => myProfile.interests.includes(i));
      if (sharedInterests.length > 0) {
        shared.push({ icon: Sparkles, label: sharedInterests.slice(0, 2).join(', ') });
      }
    }
    return shared;
  };

  const getMatchReasons = (match) => {
    const reasons = [];
    if (match.destination && filterDestination && match.destination.toLowerCase().includes(filterDestination.toLowerCase())) {
      reasons.push({ icon: MapPin, label: 'Same destination', color: 'text-brand-vibrant bg-brand-vibrant/5 border-brand-vibrant/20' });
    }
    if (match.travelStyle && myProfile?.travelStyle && match.travelStyle === myProfile.travelStyle) {
      reasons.push({ icon: Zap, label: 'Similar vibe', color: 'text-purple-600 bg-purple-50 border-purple-200/60' });
    }
    if (match.startDate && match.endDate && myProfile?.startDate && myProfile?.endDate) {
      const aStart = new Date(match.startDate);
      const aEnd = new Date(match.endDate);
      const bStart = new Date(myProfile.startDate);
      const bEnd = new Date(myProfile.endDate);
      if (aStart <= bEnd && aEnd >= bStart) {
        reasons.push({ icon: Calendar, label: 'Overlapping dates', color: 'text-warning bg-warning/10 border-warning/30/60' });
      }
    }
    if (match.interests && myProfile?.interests) {
      const sharedInterests = match.interests.filter(i => myProfile.interests.includes(i));
      if (sharedInterests.length > 0) {
        reasons.push({ icon: Sparkles, label: 'Shared interests', color: 'text-rose-600 bg-rose-50 border-rose-200/60' });
      }
    }
    if (reasons.length === 0) {
      reasons.push({ icon: Users, label: 'Solo traveler', color: 'text-base-content/60 bg-base-200 border-base-300/60' });
    }
    return reasons;
  };

  const getProfileCompleteness = (profile) => {
    if (!profile) return { percent: 0, label: 'Incomplete' };
    const fields = ['bio', 'travelStyle', 'destinations', 'startDate', 'endDate', 'age'];
    const filled = fields.filter(f => profile[f]).length;
    const percent = Math.round((filled / fields.length) * 100);
    if (percent >= 80) return { percent, label: 'Complete' };
    if (percent >= 50) return { percent, label: 'Mostly complete' };
    return { percent, label: 'Incomplete' };
  };

  const handleSuggestionKeyDown = (e) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSuggestion(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestion(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter' && highlightedSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(filteredSuggestions[highlightedSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedSuggestion(-1);
    }
  };

  const selectSuggestion = (suggestion) => {
    setFilterDestination(suggestion);
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
    fetchData();
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={`highlight-${part}-${i}`} className="text-brand-vibrant font-bold">{part}</span>
      ) : (
        part
      )
    );
  };

  const tabs = [
    { id: 'discover', label: 'Discover', icon: Users, count: potentialMatches.length },
    { id: 'requests', label: 'Requests', icon: UserPlus, count: incomingRequests.filter(r => r.status === 'pending').length },
    { id: 'connections', label: 'Connections', icon: MessageCircle, count: connections.length },
    { id: 'profile', label: 'Profile', icon: UserCheck, count: null },
  ];

  const emptyStateForDiscover = () => {
    const reasons = [];
    if (!filterDestination) {
      reasons.push('Search for a destination to find travelers heading there');
    } else {
      reasons.push(`No travellers found heading to ${filterDestination} yet`);
    }
    if (!myProfile) {
      reasons.push('Your travel profile is not set up');
    } else {
      const completeness = getProfileCompleteness(myProfile);
      if (completeness.percent < 80) {
        reasons.push('Complete your travel profile for better matches');
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-10 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-5 bg-base-200 rounded-2xl flex items-center justify-center">
          <Users className="w-8 h-8 text-base-content/30" />
        </div>
        <h3 className="text-lg font-black text-base-content mb-2">No matches yet</h3>
        <p className="text-base-content/60 font-medium text-sm mb-6 max-w-sm mx-auto">
          {reasons[0]}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setActiveTab('profile')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
          >
            <UserCheck size={16} /> Complete Travel Profile
          </button>
          <Link
            to="/trips/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-base-100 border border-base-300 text-base-content/80 hover:border-brand-vibrant hover:text-brand-vibrant transition-colors"
          >
            <PlusCircle size={16} /> Create a Trip
          </Link>
        </div>
        {reasons.length > 1 && (
          <div className="mt-6 pt-6 border-t border-base-300/50">
            <p className="text-xs text-base-content/40 font-medium mb-2">Why no matches?</p>
            <ul className="text-xs text-base-content/40 space-y-1 max-w-xs mx-auto text-left">
              {reasons.slice(1).map((r, i) => (
                <li key={`reason-${r.slice(0, 20)}-${i}`} className="flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-base-content/30 mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <DashboardShell>
      <ConfirmDialog
        open={confirmBlockId !== null}
        onConfirm={executeBlockUser}
        onCancel={() => setConfirmBlockId(null)}
        title="Block This User?"
        description="This user will be blocked and will no longer appear in your matches or be able to contact you."
        confirmLabel="Block User"
        variant="danger"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader 
          title={<>Solo <span className="text-gradient">Collective</span></>}
          subtitle="Connect with high-compatibility solo travelers heading to your destinations."
          badge="Mission Network"
          icon={Users}
        />

      <motion.div
        className="glass-card p-6 mb-10 overflow-visible relative z-30"
        ref={searchRef}
      >
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Filter by mission destination..."
              value={filterDestination}
              onChange={(e) => {
                setFilterDestination(e.target.value);
                setShowSuggestions(true);
                setHighlightedSuggestion(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                  setHighlightedSuggestion(-1);
                  fetchData();
                }
                handleSuggestionKeyDown(e);
              }}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-white/5 text-sm font-bold text-base-content outline-none focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant bg-white/5 placeholder:text-base-content/20 uppercase tracking-wide"
            />
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-3 glass-card rounded-2xl shadow-2xl overflow-hidden z-50 p-2"
                >
                  {filteredSuggestions.map((s, index) => (
                    <button
                      key={s}
                      onClick={() => selectSuggestion(s)}
                      onMouseEnter={() => setHighlightedSuggestion(index)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 ${
                        index === highlightedSuggestion
                          ? 'bg-brand-vibrant/5 text-brand-vibrant'
                          : 'text-base-content/80 hover:bg-brand-vibrant/5 hover:text-brand-vibrant'
                      }`}
                    >
                      <Globe size={14} className="text-base-content/30" />
                      {highlightMatch(s, filterDestination)}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => {
              setShowSuggestions(false);
              setHighlightedSuggestion(-1);
              fetchData();
            }}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
          >
            Search
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex glass-card-dark p-1.5 gap-1.5 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-premium transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-vibrant text-white shadow-lg shadow-brand-vibrant/20'
                  : 'text-base-content/40 hover:text-base-content/60 hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-brand-vibrant/10 text-brand-vibrant'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-base-content/30">
          <div className="w-10 h-10 border-3 border-base-300/50 border-t-brand-vibrant rounded-full animate-spin mb-3" />
          <p className="font-bold text-sm text-base-content/40">Finding matches...</p>
        </div>
      ) : (
        <>
          {activeTab === 'discover' && (
            <PlanGate
              minPlan="navigator"
              title="Buddy Discovery"
              description="Upgrade to Navigator to discover and connect with compatible solo travelers heading to your destinations."
            >
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mb-6"
              >
                <div className="bg-gradient-to-r from-brand-vibrant/5 to-emerald-500/5 border border-brand-vibrant/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-vibrant" />
                    <p className="text-sm font-medium text-base-content/80">
                      Matches based on your <span className="font-bold text-base-content">Travel DNA</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-vibrant hover:text-success transition-colors shrink-0"
                  >
                    <LinkIcon size={12} /> Update Profile
                  </button>
                </div>
              </motion.div>

              {potentialMatches.length === 0 ? (
                emptyStateForDiscover()
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {potentialMatches.map((match, index) => (
                    <motion.div
                      key={match.userId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                    >
                      <div className="glass-card rounded-2xl hover:bg-white/[0.02] transition-colors overflow-hidden group border-white/5">
                        <div className="p-6">
                          <div className="flex items-start gap-4 mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-brand-vibrant/10 flex items-center justify-center shrink-0 border border-brand-vibrant/20 group-hover:scale-105 transition-transform duration-500">
                              <span className="text-xl font-black text-brand-vibrant font-outfit uppercase">
                                {getInitials(match.name || match.userName)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-outfit font-black text-lg text-base-content tracking-tight uppercase">{match.name || match.userName || 'Traveler'}</h4>
                                {match.emailVerified && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black text-brand-vibrant bg-brand-vibrant/10 border border-brand-vibrant/20 uppercase tracking-widest">
                                    <CheckCircle size={10} /> Verified
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-black text-base-content/30 uppercase tracking-premium">
                                <MapPin size={12} className="text-brand-vibrant/40" />
                                {match.location || 'Location hidden'}
                              </div>
                            </div>
                          </div>

                          {match.destination && (
                            <div className="flex items-center gap-2 text-xs text-base-content/70 font-bold mb-4 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                              <Globe size={14} className="text-brand-vibrant" />
                              <span className="uppercase tracking-wide">{match.destination}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mb-6">
                            {getMatchReasons(match).map((reason, i) => (
                              <span key={`reason-${reason.label}-${i}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-premium border ${reason.color}`}>
                                <reason.icon size={12} strokeWidth={2.5} /> {reason.label}
                              </span>
                            ))}
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleConnect(match.userId)}
                              disabled={actionLoading}
                              className="flex-1 btn-premium text-[11px] py-3 disabled:opacity-50"
                            >
                              <UserPlus size={14} strokeWidth={2.5} /> Connect
                            </button>
                            <button
                              onClick={() => handleSkip(match.userId)}
                              className="px-4 py-3 rounded-xl font-black text-[11px] bg-white/5 text-base-content/40 border border-white/5 hover:bg-white/10 hover:text-base-content/60 transition-all uppercase tracking-premium"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
            </PlanGate>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6">
              {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="font-black text-base-content text-lg">
                        Requests <span className="bg-gradient-to-r from-brand-vibrant to-emerald-500 bg-clip-text text-transparent">({incomingRequests.filter(r => r.status === 'pending').length + outgoingRequests.filter(r => r.status === 'pending').length})</span>
                      </h3>
                      <p className="text-base-content/60 font-medium text-sm mt-0.5">
                        People who want to connect with you, and requests you've sent.
                      </p>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-vibrant/20 border-l-2 border-brand-vibrant"></div>
                        <span className="text-base-content/60 font-medium">{incomingRequests.filter(r => r.status === 'pending').length} incoming</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500/20 border-l-2 border-blue-500"></div>
                        <span className="text-base-content/60 font-medium">{outgoingRequests.filter(r => r.status === 'pending').length} outgoing</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {incomingRequests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Incoming Requests</h3>
                  <div className="space-y-3">
                    {incomingRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                        className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5 border-l-4 border-l-emerald-400"
                      >
                        <BuddyRequestCard
                          request={request}
                          type="incoming"
                          onAccept={handleAcceptRequest}
                          onDecline={handleDeclineRequest}
                          loading={actionLoading}
                          matchReasons={getRequestMatchReasons(request)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {outgoingRequests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                >
                  <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Sent Requests</h3>
                  <div className="space-y-3">
                    {outgoingRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                        className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5 border-l-4 border-l-blue-400"
                      >
                        <BuddyRequestCard
                          request={request}
                          type="outgoing"
                          loading={actionLoading}
                          matchReasons={getRequestMatchReasons(request)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-10 text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-5 bg-base-200 rounded-2xl flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-base-content/30" />
                  </div>
                  <h3 className="text-lg font-black text-base-content mb-2">No pending requests</h3>
                  <p className="text-base-content/60 font-medium text-sm mb-6 max-w-sm mx-auto">
                    When someone wants to connect, their request will appear here.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setActiveTab('discover')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
                    >
                      <Users size={16} /> Discover travellers
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-base-100 border border-base-300 text-base-content/80 hover:border-brand-vibrant hover:text-brand-vibrant transition-colors"
                    >
                      <UserCheck size={16} /> Complete Travel Profile
                    </button>
                    <Link
                      to="/trips/new"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-base-100 border border-base-300 text-base-content/80 hover:border-brand-vibrant hover:text-brand-vibrant transition-colors"
                    >
                      <Plus size={16} /> Create a trip
                    </Link>
                  </div>
                  <div className="mt-6 pt-6 border-t border-base-300/50">
                    <p className="text-xs text-base-content/40 font-medium mb-2">Improve your discoverability</p>
                    <ul className="text-xs text-base-content/40 space-y-1 max-w-xs mx-auto text-left">
                      <li className="flex items-start gap-1.5">
                        <AlertCircle size={12} className="text-base-content/30 mt-0.5 shrink-0" />
                        Complete your travel profile with destinations and interests
                      </li>
                      <li className="flex items-start gap-1.5">
                        <AlertCircle size={12} className="text-base-content/30 mt-0.5 shrink-0" />
                        Create trips to show where you're heading
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {activeTab === 'connections' && (
            <>
              {connections.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5 mb-6"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="font-black text-base-content text-lg">
                        Connections <span className="bg-gradient-to-r from-brand-vibrant to-emerald-500 bg-clip-text text-transparent">({connections.length})</span>
                      </h3>
                      <p className="text-base-content/60 font-medium text-sm mt-0.5">
                        Travellers you've connected with. Plan together, share tips, and stay in touch.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {connections.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-10 text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-5 bg-base-200 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-base-content/30" />
                  </div>
                  <h3 className="text-lg font-black text-base-content mb-2">No connections yet</h3>
                  <p className="text-base-content/60 font-medium text-sm mb-6 max-w-sm mx-auto">
                    Start discovering travellers to build your solo travel network.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setActiveTab('discover')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
                    >
                      <Users size={16} /> Discover travellers
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-base-100 border border-base-300 text-base-content/80 hover:border-brand-vibrant hover:text-brand-vibrant transition-colors"
                    >
                      <UserCheck size={16} /> Update Travel Profile
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {connections.map((conn, index) => {
                    const status = getConnectionStatus(conn);
                    const sharedInfo = getConnectionSharedInfo(conn);
                    return (
                      <motion.div
                        key={conn.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                        className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-5 hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.10)] transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-vibrant/10 to-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="text-base font-black text-brand-vibrant">
                              {getInitials(conn.user?.name)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-base-content text-sm truncate">{conn.user?.name || 'Unknown'}</h4>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-xs text-base-content/40 font-medium mt-0.5">{conn.user?.location || 'Location unknown'}</p>
                          </div>
                        </div>

                        {sharedInfo.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {sharedInfo.map((info, i) => (
                              <span key={`shared-${info.label}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-brand-vibrant/10 text-brand-vibrant">
                                <info.icon size={10} /> {info.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {conn.trip && (
                          <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-medium mb-3">
                            <MapPin size={12} className="text-base-content/30" />
                            {conn.trip.destination}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-medium pt-3 border-t border-base-300/50">
                          <Calendar size={12} />
                          Connected {conn.connectedAt ? getRelativeTime(conn.connectedAt) : 'Recently'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl space-y-6"
            >
              {/* Profile Anchor: The Solo ID Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-xs font-black text-base-content/40 uppercase tracking-widest flex items-center gap-2">
                     <Shield size={12} className="text-brand-vibrant" /> Your Solo ID
                   </h3>
                   <span className="text-[10px] font-black text-brand-vibrant uppercase tracking-tight bg-brand-vibrant/10 px-2 py-0.5 rounded-md">
                     Public Identity
                   </span>
                </div>
                <SoloIDCard data={soloId} />
              </div>

              {/* Verification Center CTA */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/10 overflow-hidden relative group cursor-pointer border border-slate-800">
                 <div className="absolute top-0 right-0 p-8 bg-brand-vibrant/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-vibrant/20 transition-colors" />
                 <div className="relative flex items-center justify-between gap-4">
                    <div className="space-y-1">
                       <h4 className="text-base font-black flex items-center gap-2 italic tracking-tight">
                         <Crown size={18} className="text-brand-vibrant" /> Verification Center
                       </h4>
                       <p className="text-xs font-medium text-white/60">
                         Boost your Trust Score to get 3x more connection requests.
                       </p>
                    </div>
                    <button 
                      onClick={() => setShowVerificationModal(true)}
                      className="px-4 py-2 bg-brand-vibrant text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-vibrant/20 hover:scale-105 active:scale-95 transition-all"
                    >
                       View Tiers
                    </button>
                 </div>
              </div>

              {/* Detailed Travel DNA & Interests */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-xs font-black text-base-content/40 uppercase tracking-widest flex items-center gap-2">
                     <Globe size={12} className="text-indigo-500" /> Detailed Personality
                   </h3>
                </div>
                <MatchingProfile 
                  profile={myProfile} 
                  user={user}
                  showEdit={true}
                  onEdit={() => setShowProfileEdit(true)}
                />
              </div>

              {!myProfile && (
                <div className="mt-4 p-5 bg-warning/10 border border-warning/30/60 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-warning shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-warning font-bold text-sm mb-1">Profile not set up</p>
                      <p className="text-warning/80 text-xs font-medium mb-3">
                        Complete your travel profile to get better matches with fellow solo travelers.
                      </p>
                      <button 
                        onClick={() => setShowProfileEdit(true)}
                        className="w-full py-2 bg-warning/100 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
                      >
                        Set Up Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {showProfileEdit && (
        <MatchingProfileEdit
          profile={myProfile}
          onClose={() => setShowProfileEdit(false)}
          onSave={handleProfileSave}
        />
      )}

      <VerificationModal 
        isOpen={showVerificationModal} 
        onClose={() => setShowVerificationModal(false)} 
      />
      </div>
    </DashboardShell>
  );
};

export default Buddies;
