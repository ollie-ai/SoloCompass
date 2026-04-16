import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import Skeleton from '../components/Skeleton';
import api, { getTripAccommodation, getTripBookings, getTripDocuments, getTripPlaces, getTripBudget } from '../lib/api';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveDashboardState, computeStats } from '../lib/dashboardStateResolver';
import { useDashboardState } from '../hooks/useWidgetState';
import DashboardShell from '../components/dashboard/DashboardShell';
import NoTripsDashboard from '../components/dashboard/states/NoTripsDashboard';
import PlanningDashboard from '../components/dashboard/states/PlanningDashboard';
import UpcomingDashboard from '../components/dashboard/states/UpcomingDashboard';
import LiveTripDashboard from '../components/dashboard/states/LiveTripDashboard';
import CompletedDashboard from '../components/dashboard/states/CompletedDashboard';
import SubscriptionBanner from '../components/dashboard/SubscriptionBanner';
import APIErrorBoundary from '../components/APIErrorBoundary';
import SEO from '../components/SEO';

// Stable selector for user - prevents unnecessary re-renders
const selectUser = (state) => state.user;
const selectRefreshUser = (state) => state.refreshUser;

const Dashboard = () => {
  // Use stable selectors to prevent unnecessary re-renders
  const user = useAuthStore(selectUser);
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const refreshUser = useAuthStore(selectRefreshUser);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);
  const [dashboardState, setDashboardState] = useState(null);
  const [stats, setStats] = useState({});
  const [accommodation, setAccommodation] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [places, setPlaces] = useState(null);
  const [budget, setBudget] = useState(null);
  const [safetyData, setSafetyData] = useState({
    contacts: [],
    checkInSchedule: null,
    checkInScheduled: false,
  });
  const [timeWeather, setTimeWeather] = useState(null);
  const [devMode, setDevMode] = useState(null);
  const [savedDashboardState, setSavedDashboardState] = useDashboardState();
  
  // Ref to store interval ID for cleanup
  const paymentIntervalRef = useRef(null);

  // Payment verification handler with proper cleanup
  const handlePaymentVerification = useCallback(async () => {
    setVerifyingPayment(true);
    let attempts = 0;
    
    // Clear any existing interval before starting a new one
    if (paymentIntervalRef.current) {
      clearInterval(paymentIntervalRef.current);
    }
    
    paymentIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        await refreshUser();
        const updatedUser = useAuthStore.getState().user;
        if (updatedUser?.is_premium) {
          clearInterval(paymentIntervalRef.current);
          paymentIntervalRef.current = null;
          setVerifyingPayment(false);
          toast.success('Welcome to SoloCompass Premium!');
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#34d399', '#6ee7b7'] });
        } else if (attempts >= 5) {
          clearInterval(paymentIntervalRef.current);
          paymentIntervalRef.current = null;
          setVerifyingPayment(false);
          toast.error('Payment verification timed out. Please contact support.');
        }
      } catch (err) {
        console.error('Payment verification error:', err);
      }
    }, 2000);
  }, [refreshUser]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [tripsRes, alertsRes, contactsRes, checkInRes] = await Promise.all([
          api.get('/trips'),
          api.get('/advisories'),
          api.get('/emergency-contacts'),
          api.get('/checkin/schedule'),
        ]);
        const tripsData = tripsRes.data.data?.trips || tripsRes.data.trips || [];
        const alertsData = alertsRes.data.advisories || alertsRes.data || [];
        const contactsData = contactsRes.data?.data?.contacts || contactsRes.data?.contacts || (Array.isArray(contactsRes.data?.data) ? contactsRes.data.data : (Array.isArray(contactsRes.data) ? contactsRes.data : []));
        const checkInData = checkInRes.data?.data || checkInRes.data;
        
        setTrips(tripsData);
        setAlerts(alertsData);
        setSafetyData({
          contacts: Array.isArray(contactsData) ? contactsData : [],
          checkInSchedule: checkInData?.schedule || checkInData,
          checkInScheduled: !!(checkInData?.schedule?.is_active || checkInData?.is_active),
        });
        const computed = computeStats(tripsData, alertsData);
        setStats(computed);
        const resolved = resolveDashboardState(tripsData);
        setDashboardState(resolved);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success' && user && !user.is_premium) {
      handlePaymentVerification();
    }
    fetchDashboardData();
  }, [user, handlePaymentVerification]);

  useEffect(() => {
    if (!loading) {
      const resolved = resolveDashboardState(trips);
      setDashboardState(resolved);
      const computed = computeStats(trips, alerts);
      setStats(computed);
      
      if (!devMode && resolved.state && resolved.state !== 'no_trips') {
        setSavedDashboardState({ type: resolved.state });
      }
    }
  }, [trips, alerts, loading, devMode, setSavedDashboardState]);

  useEffect(() => {
    const tripId = dashboardState?.trip?.id;
    if (!tripId) return;

    const fetchTripData = async () => {
      try {
        const [accommodationRes, bookingsRes, documentsRes, placesRes, budgetRes, timeWeatherRes] = await Promise.all([
          getTripAccommodation(tripId).catch(err => { console.error('[Dashboard] Failed to fetch accommodation:', err); toast.error('Failed to load accommodation details'); return null; }),
          getTripBookings(tripId).catch(err => { console.error('[Dashboard] Failed to fetch bookings:', err); toast.error('Failed to load booking details'); return null; }),
          getTripDocuments(tripId).catch(err => { console.error('[Dashboard] Failed to fetch documents:', err); toast.error('Failed to load travel documents'); return null; }),
          getTripPlaces(tripId).catch(err => { console.error('[Dashboard] Failed to fetch places:', err); toast.error('Failed to load saved places'); return null; }),
          getTripBudget(tripId).catch(err => { console.error('[Dashboard] Failed to fetch budget:', err); toast.error('Failed to load budget'); return null; }),
          api.get(`/trips/${tripId}/time-weather`).catch(err => { console.error('[Dashboard] Failed to fetch time-weather:', err); toast.error('Failed to load weather data'); return null; }),
        ]);
        
        setAccommodation(accommodationRes?.data || accommodationRes?.accommodation || (accommodationRes && !accommodationRes.success ? null : accommodationRes) || null);
        setBookings(bookingsRes?.data || (Array.isArray(bookingsRes?.bookings) ? bookingsRes.bookings : (Array.isArray(bookingsRes) ? bookingsRes : [])));
        setDocuments(documentsRes?.data || (Array.isArray(documentsRes?.documents) ? documentsRes.documents : (Array.isArray(documentsRes) ? documentsRes : [])));
        setPlaces(placesRes?.data || (Array.isArray(placesRes?.places) ? placesRes.places : (Array.isArray(placesRes) ? placesRes : [])));
        setBudget(budgetRes?.data || budgetRes || null);
        
        const twData = timeWeatherRes?.data?.data || timeWeatherRes?.data || null;
        setTimeWeather(twData);
      } catch (err) {
        console.error('Error fetching trip data:', err);
      }
    };

    fetchTripData();
  }, [dashboardState?.trip?.id]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (paymentIntervalRef.current) {
        clearInterval(paymentIntervalRef.current);
        paymentIntervalRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <div className="mb-8">
          <Skeleton className="h-10 w-72 mb-3" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="bg-base-100 rounded-2xl border border-base-content/10 shadow-sm p-8 mb-6">
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map(i => (
            <div key={`skeleton-${i}`} className="bg-base-100 rounded-xl border border-base-content/10 shadow-sm p-5">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const state = dashboardState?.state || 'no_trips'
  
  const handleDevModeChange = (e) => {
    const newState = e.target.value;
    if (newState === 'auto') {
      setDevMode(null);
      setSavedDashboardState(null);
    } else {
      setDevMode(newState);
      setSavedDashboardState({ type: newState });
    }
  };
  
  const displayState = devMode || (savedDashboardState?.type && state === 'no_trips' ? savedDashboardState.type : state);

  const trip = dashboardState?.trip ? {
    ...dashboardState.trip,
    accommodation,
    bookings,
    documents,
    places,
    budget,
  } : null

  const renderState = () => {
    switch (displayState) {
      case 'no_trips':
        return <NoTripsDashboard />;
      case 'planning':
        return <PlanningDashboard trip={trip} alerts={alerts} stats={stats} />;
      case 'upcoming':
        return <UpcomingDashboard trip={trip} alerts={alerts} stats={stats} safetyData={safetyData} timeWeather={timeWeather} />;
      case 'live_trip':
        return <LiveTripDashboard trip={trip} alerts={alerts} stats={stats} safetyData={safetyData} timeWeather={timeWeather} />;
      case 'completed':
        return <CompletedDashboard trip={trip} alerts={alerts} stats={stats} />;
      default:
        return <NoTripsDashboard />;
    }
  };

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <APIErrorBoundary>
      <SEO
        title="Dashboard"
        description="Your SoloCompass mission control — view your active trips, safety status, and travel insights."
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={displayState}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <DashboardShell>
            {isDev && (
              <div className="mb-4 p-2 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">Developer Mode</span>
                </div>
                <select 
                  value={devMode || 'auto'} 
                  onChange={handleDevModeChange}
                  className="text-[11px] font-bold bg-white/50 dark:bg-black/20 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-700 outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  <option value="auto">Auto-Resolve ({state})</option>
                  <option value="no_trips">Force: No Trips</option>
                  <option value="planning">Force: Planning</option>
                  <option value="upcoming">Force: Upcoming</option>
                  <option value="live_trip">Force: Live Trip</option>
                  <option value="completed">Force: Completed</option>
                </select>
              </div>
            )}
            <SubscriptionBanner />
            {renderState()}
          </DashboardShell>
        </motion.div>
      </AnimatePresence>
    </APIErrorBoundary>
  );
};

export default Dashboard;
