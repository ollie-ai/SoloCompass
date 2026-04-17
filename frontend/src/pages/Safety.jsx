import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { triggerHaptic } from '../hooks/useHaptics';
import toast from 'react-hot-toast';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import { useAuthStore } from '../stores/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Shield, Bell, Lock, ShieldCheck, AlertTriangle, Phone, MapPin, Eye, Info, Check, Clock, Users, Send, History, 
  PhoneCall, AlertOctagon, Calendar, X, Plus, Edit2, Trash2, XCircle, CheckCircle, Smartphone, Activity, Compass, Sparkles,
  Map, FileText, Building
} from 'lucide-react';
import Button from '../components/Button';
import APIErrorBoundary from '../components/APIErrorBoundary';
import PlanGate from '../components/PlanGate';
import SEO from '../components/SEO';

const Skeleton = ({ className }) => (
  <div className={`bg-base-content/5 rounded-lg animate-pulse ${className}`} />
);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3005/api';

const RELATIONSHIPS = [
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse/Partner' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' }
];

const INTERVAL_OPTIONS = [
  { value: '15min', label: 'Every 15 minutes' },
  { value: '30min', label: 'Every 30 minutes' },
  { value: '1hr', label: 'Every hour' },
  { value: '2hr', label: 'Every 2 hours' },
  { value: '4hr', label: 'Every 4 hours' },
  { value: '6hr', label: 'Every 6 hours' },
  { value: '12hr', label: 'Every 12 hours' },
  { value: '24hr', label: 'Every 24 hours' }
];

export default function Safety() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('checkin');
  const [contacts, setContacts] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [scheduledCheckIns, setScheduledCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: 'friend',
    isPrimary: false,
    notifyOnCheckin: true,
    notifyOnEmergency: true
  });

  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState(null);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkInType, setCheckInType] = useState('safe');
  const [isFakeCalling, setIsFakeCalling] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [fakeCallCountdown, setFakeCallCountdown] = useState(0);
  const [fakeCallDelay, setFakeCallDelay] = useState(3);
  const [sosSliderValue, setSosSliderValue] = useState(0);
  const [sosHoldActive, setSosHoldActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  const [sosEventActive, setSosEventActive] = useState(false);
  const [sosEventId, setSosEventId] = useState(null);
  const [sosEventLocation, setSosEventLocation] = useState(null);
  const sosHoldTimer = { interval: null, timeout: null };

  const [showScheduledForm, setShowScheduledForm] = useState(false);
  const [scheduleType, setScheduleType] = useState('one-time');
  const [scheduledForm, setScheduledForm] = useState({
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [recurringForm, setRecurringForm] = useState({
    interval: '1hr',
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [activeRecurringSchedule, setActiveRecurringSchedule] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

  // New state for wired safety components
  const [missedCheckIn, setMissedCheckIn] = useState(null);
  const [trips, setTrips] = useState([]);
  const [returnPlan, setReturnPlan] = useState(null);
  const [guardianRelationships, setGuardianRelationships] = useState([]);
  const [activeDestinationId, setActiveDestinationId] = useState(null);
  const [embassyCountryCode, setEmbassyCountryCode] = useState('');
  const [showGuardianInvite, setShowGuardianInvite] = useState(false);
  const [showGuardianDashboard, setShowGuardianDashboard] = useState(false);

  const { on: wsOn } = useWebSocket();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000);
    
    fetchData();
    fetchRecurringSchedule();
    requestLocation();
    
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to WebSocket checkin_missed events
  useEffect(() => {
    const unsubscribe = wsOn('checkin_missed', (data) => {
      if (data.scheduledCheckInId) {
        const sci = scheduledCheckIns.find((s) => s.id === data.scheduledCheckInId);
        setMissedCheckIn(sci || { id: data.scheduledCheckInId });
      }
    });
    return unsubscribe;
  }, [wsOn, scheduledCheckIns]);

  const fetchData = async () => {
    try {
      const [contactsRes, checkInsRes, scheduledRes, tripsRes, guardianRes] = await Promise.all([
        api.get('/emergency-contacts'),
        api.get('/checkin/history'),
        api.get('/checkin/scheduled?activeOnly=true'),
        api.get('/trips').catch(() => null),
        api.get('/guardian/list').catch(() => null)
      ]);

      if (contactsRes.data.success) {
        const contactsData = contactsRes.data.data;
        setContacts(Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || []));
      }
      if (checkInsRes.data.success) {
        const checkInsData = checkInsRes.data.data;
        setCheckIns(Array.isArray(checkInsData) ? checkInsData : (checkInsData?.checkIns || []));
      }
      if (scheduledRes.data.success) {
        const scheduledData = scheduledRes.data.data;
        setScheduledCheckIns(Array.isArray(scheduledData) ? scheduledData : (scheduledData?.scheduled || []));
      }
      if (tripsRes?.data?.success) {
        const tripsData = tripsRes.data.data;
        const tripList = Array.isArray(tripsData) ? tripsData : (tripsData?.trips || []);
        setTrips(tripList);
        const activeTrip = tripList.find((t) => t.status === 'active') || tripList[0];
        if (activeTrip) {
          setActiveDestinationId(activeTrip.destination_id || activeTrip.id);
        }
      }
      if (guardianRes?.data?.success) {
        const rel = guardianRes.data.data?.relationships || guardianRes.data.data || [];
        setGuardianRelationships(Array.isArray(rel) ? rel : []);
      }
      // Load return plan (no trip filter – get most recent)
      api.get('/return-plan').then((res) => {
        if (res.data?.success) {
          const plans = res.data.data;
          const plan = Array.isArray(plans) ? plans[0] || null : plans;
          setReturnPlan(plan);
          if (plan) offlineStorage.setReturnPlan(plan);
        }
      }).catch(() => null);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation not supported on this browser');
      return;
    }
    setLocationStatus('loading');
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('success');
        setLocationError(null);
      },
      (err) => {
        setLocationStatus('error');
        if (err.code === 1) {
          setLocationError('Permission denied - check browser settings');
        } else if (err.code === 2) {
          setLocationError('GPS unavailable - check location services');
        } else {
          setLocationError('Location request timed out');
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    );
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = editingContact
        ? `/emergency-contacts/${editingContact.id}`
        : '/emergency-contacts';
      
      const response = editingContact
        ? await api.put(endpoint, contactForm)
        : await api.post(endpoint, contactForm);
      
      if (response.data.success) {
        setSuccess(editingContact ? 'Contact updated' : 'Contact added');
        setShowContactForm(false);
        setEditingContact(null);
        resetContactForm();
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.data.error?.message || response.data.error || 'Failed to save contact');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = (id) => {
    setConfirmDialog({ open: true, action: 'delete_contact', id });
  };

  const executeDeleteContact = async () => {
    const id = confirmDialog.id;
    setConfirmDialog({ open: false, action: null });
    try {
      const response = await api.delete(`/emergency-contacts/${id}`);
      if (response.data.success) {
        setSuccess('Contact deleted');
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to delete contact');
    }
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      relationship: contact.relationship,
      isPrimary: contact.isPrimary,
      notifyOnCheckin: contact.notifyOnCheckin,
      notifyOnEmergency: contact.notifyOnEmergency
    });
    setShowContactForm(true);
  };

  const resetContactForm = () => {
    setContactForm({
      name: '',
      email: '',
      phone: '',
      relationship: 'friend',
      isPrimary: false,
      notifyOnCheckin: true,
      notifyOnEmergency: true
    });
  };

  const handleCheckIn = async (type) => {
    triggerHaptic(type === 'emergency' ? [120, 80, 120] : [35]);
    setCheckInType(type);
    setShowConfirmModal(true);
  };

  const sosHoldTimers = { interval: null, timeout: null };

  const handleSosHoldStart = () => {
    if (contacts.length === 0) return;
    setSosHoldActive(true);
    setSosCountdown(3);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    let count = 3;
    sosHoldTimers.interval = setInterval(() => {
      count -= 1;
      setSosCountdown(count);
    }, 1000);

    sosHoldTimers.timeout = setTimeout(async () => {
      clearInterval(sosHoldTimers.interval);
      setSosHoldActive(false);
      setSosCountdown(3);
      try {
        const payload = {
          triggerType: 'manual',
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: location?.address || null
        };
        const res = await api.post('/sos/trigger', payload);
        if (res.data?.success) {
          setSosEventActive(true);
          setSosEventId(res.data.data?.sosEventId);
          setSosEventLocation(location);
          if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
          toast.error('🚨 SOS ACTIVE — Emergency contacts notified', { duration: 8000 });
        }
      } catch (err) {
        toast.error('Failed to trigger SOS. Try again.');
      }
    }, 3000);
  };

  const handleSosHoldEnd = () => {
    if (!sosHoldActive) return;
    clearInterval(sosHoldTimers.interval);
    clearTimeout(sosHoldTimers.timeout);
    setSosHoldActive(false);
    setSosCountdown(3);
  };

  const handleSosCancel = async () => {
    try {
      await api.post('/sos/cancel', { sosEventId });
      setSosEventActive(false);
      setSosEventId(null);
      setSosEventLocation(null);
      toast.success('SOS cancelled');
    } catch (err) {
      toast.error('Failed to cancel SOS');
    }
  };

  const confirmCheckIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = checkInType === 'emergency'
        ? '/checkin/emergency'
        : '/checkin';
      
      const response = await api.post(endpoint, {
        type: checkInType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        message
      });
      
      if (response.data.success) {
        triggerHaptic(checkInType === 'emergency' ? [200, 120, 200] : [45]);
        setSuccess(
          checkInType === 'emergency'
            ? 'Emergency alert sent — contacts notified'
            : 'Safe check-in sent'
        );
        setMessage('');
        setShowConfirmModal(false);
        fetchData();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(response.data.error?.message || response.data.error || 'Failed to send check-in');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to send check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduledSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post('/checkin/scheduled', {
        scheduledTime: scheduledForm.scheduledTime,
        timezone: scheduledForm.timezone
      });
      
      if (response.data.success) {
        setSuccess('Scheduled check-in created');
        setShowScheduledForm(false);
        setScheduledForm({
          scheduledTime: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.data.error?.message || response.data.error || 'Failed to schedule check-in');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to schedule check-in');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelScheduled = async (id) => {
    try {
      const response = await api.delete(`/checkin/scheduled/${id}`);
      if (response.data.success) {
        setSuccess('Scheduled check-in cancelled');
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to cancel');
    }
  };

  const fetchRecurringSchedule = async () => {
    try {
      const res = await api.get('/checkin/schedule');
      if (res.data.success && res.data.data) {
        setActiveRecurringSchedule(res.data.data);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Error fetching recurring schedule:', err);
      }
    }
  };

  const handleCreateRecurringSchedule = async (e) => {
    e.preventDefault();
    setRecurringLoading(true);
    setError(null);
    try {
      const res = await api.post('/checkin/schedule', {
        interval: recurringForm.interval,
        startTime: recurringForm.startTime || undefined,
        endTime: recurringForm.endTime || undefined,
        timezone: recurringForm.timezone
      });
      if (res.data.success) {
        setSuccess('Recurring schedule created');
        setActiveRecurringSchedule(res.data.data);
        setRecurringForm({
          interval: '1hr',
          startTime: '',
          endTime: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.data.error?.message || res.data.error || 'Failed to create schedule');
      }
    } catch (err) {
      setError('Failed to create recurring schedule');
    } finally {
      setRecurringLoading(false);
    }
  };

  const handlePauseRecurringSchedule = async () => {
    if (!activeRecurringSchedule) return;
    try {
      const res = await api.put(`/checkin/schedule/${activeRecurringSchedule.id}`, {
        isActive: false
      });
      if (res.data.success) {
        setSuccess('Schedule paused');
        setActiveRecurringSchedule(res.data.data);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Failed to pause schedule');
    }
  };

  const handleResumeRecurringSchedule = async () => {
    if (!activeRecurringSchedule) return;
    try {
      const res = await api.put(`/checkin/schedule/${activeRecurringSchedule.id}`, {
        isActive: true
      });
      if (res.data.success) {
        setSuccess('Schedule resumed');
        setActiveRecurringSchedule(res.data.data);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Failed to resume schedule');
    }
  };

  const handleCancelRecurringSchedule = () => {
    if (!activeRecurringSchedule) return;
    setConfirmDialog({ open: true, action: 'cancel_schedule' });
  };

  const executeCancelSchedule = async () => {
    setConfirmDialog({ open: false, action: null });
    try {
      const res = await api.delete(`/checkin/schedule/${activeRecurringSchedule.id}`);
      if (res.data.success) {
        setSuccess('Recurring schedule cancelled');
        setActiveRecurringSchedule(null);
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Failed to cancel schedule');
    }
  };

  const handleGetAIAdvice = async () => {
    setAiAdviceLoading(true);
    setAiAdvice(null);
    try {
      const res = await api.post('/ai/safety-advice', {
        destination: user?.currentTripLocation || 'my current location'
      });
      if (res.data.success) {
        setAiAdvice(res.data.data?.content || res.data.data?.text);
      }
    } catch (err) {
      console.error('AI advice failed:', err);
      setError('Could not get AI safety advice');
    } finally {
      setAiAdviceLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeUntil = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    if (diff < 0) return 'Overdue';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  const getCheckInTypeLabel = (type) => {
    const labels = { safe: 'Safe', emergency: 'Emergency', scheduled: 'Scheduled', arrived: 'Arrived' };
    return labels[type] || type;
  };

  const triggerFakeCall = () => {
    if (fakeCallDelay === 0) {
      startFakeCall();
      return;
    }
    setFakeCallCountdown(fakeCallDelay);
    const countdown = setInterval(() => {
      setFakeCallCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          startFakeCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startFakeCall = () => {
    setIsFakeCalling(true);
    setIsCallActive(false);
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); // Reliable ringing sound
    audio.loop = true;
    audio.play().catch(e => {
      console.log('Audio play failed', e);
      // Fallback to visual only alert if audio is blocked
      toast.error('Incoming Safe-Return Verification Call (Audio Blocked)');
    });
    setTimeout(() => {
      if (!isCallActive) {
        setIsFakeCalling(false);
        setIsCallActive(false);
      }
    }, 45000);
  };

  const answerFakeCall = () => {
    setIsCallActive(true);
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance();
      msg.text = "Hello, I am your SoloCompass AI Agent. I am monitoring your location. If you need to leave the situation, please stay on the line and walk towards the nearest Safe Haven as indicated on your map. I will stay on the line with you.";
      msg.rate = 0.9;
      msg.pitch = 1.1;
      window.speechSynthesis.speak(msg);
    }
  };

  const endFakeCall = () => {
    setIsFakeCalling(false);
    setIsCallActive(false);
    window.speechSynthesis.cancel();
  };

  const setupState = contacts.length === 0
    ? 'not_setup'
    : scheduledCheckIns.length === 0 && !activeRecurringSchedule
      ? 'partial'
      : 'fully_active';

  const lastCheckIn = checkIns.length > 0 ? checkIns[0] : null;
  const nextScheduled = scheduledCheckIns.length > 0
    ? scheduledCheckIns.reduce((next, s) => {
        const sTime = new Date(s.scheduledTime);
        return !next || sTime < new Date(next.scheduledTime) ? s : next;
      }, null)
    : null;
  const primaryContacts = contacts.filter(c => c.isPrimary);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-12">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-16 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {['skeleton-1', 'skeleton-2', 'skeleton-3', 'skeleton-4'].map(key => (
              <div key={key} className="glass-card h-24 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="mt-12 glass-card h-96 rounded-3xl animate-pulse" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <SEO
        title="Safety Center"
        description="Manage your emergency contacts, scheduled check-ins, and SOS settings on SoloCompass."
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={confirmDialog.action === 'delete_contact' ? executeDeleteContact : executeCancelSchedule}
        onCancel={() => setConfirmDialog({ open: false, action: null })}
        title={confirmDialog.action === 'delete_contact' ? 'Delete Emergency Contact?' : 'Cancel Recurring Schedule?'}
        description={confirmDialog.action === 'delete_contact'
          ? 'This emergency contact will be permanently removed.'
          : 'Your recurring check-in schedule will be cancelled.'}
        confirmLabel={confirmDialog.action === 'delete_contact' ? 'Delete Contact' : 'Cancel Schedule'}
        variant="danger"
      />
      <APIErrorBoundary>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PageHeader 
          title={<>Your <span className="text-gradient">Safety Center</span></>}
          subtitle="Manage mission-critical check-ins, emergency contacts, and stay connected while travelling."
          badge="Security Operations"
          icon={Shield}
        />

      {/* Setup State Banner */}
      {setupState === 'not_setup' && (
        <motion.div variants={itemVariants} className="mb-10 p-8 glass-card border-warning/20 bg-warning/5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-warning" size={32} />
          </div>
          <div className="flex-1">
            <h3 className="font-outfit font-black text-warning text-xl uppercase tracking-premium">Set up emergency contacts</h3>
            <p className="text-warning/70 text-sm font-bold mt-1 uppercase tracking-wide">
              ADD AT LEAST ONE EMERGENCY CONTACT TO ENABLE SAFETY CHECK-INS. MISSION STATUS: UNPROTECTED.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('contacts')}
            className="px-6 py-3 bg-warning text-white rounded-xl font-black text-xs hover:bg-warning/90 transition-all shrink-0 uppercase tracking-wide shadow-md shadow-warning/20"
          >
            Add Contact
          </button>
        </motion.div>
      )}

      {setupState === 'partial' && (
        <motion.div variants={itemVariants} className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Bell className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-blue-800 text-lg">Schedule a safety check-in</h3>
            <p className="text-blue-700 text-sm font-medium mt-1">
              You have emergency contacts set up. Create a scheduled check-in so we can monitor your safety automatically.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('checkin')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shrink-0"
          >
            Schedule Check-In
          </button>
        </motion.div>
      )}

      {setupState === 'fully_active' && (
        <motion.div variants={itemVariants} className="mb-8 p-5 bg-success/10 border border-success/30 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="text-success" size={20} />
          </div>
          <div>
            <h3 className="font-black text-emerald-800">Your safety tools are set up and ready</h3>
            <p className="text-success text-sm font-medium mt-0.5">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''} • {scheduledCheckIns.length + (activeRecurringSchedule ? 1 : 0)} scheduled check-in{scheduledCheckIns.length + (activeRecurringSchedule ? 1 : 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </motion.div>
      )}

      {/* Trust Signals Bar */}
      {setupState !== 'not_setup' && (
        <motion.div variants={itemVariants} className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { label: 'Last Check-In', value: lastCheckIn ? formatDateTime(lastCheckIn.createdAt) : 'None yet', icon: Activity },
            { label: 'Next Event', value: nextScheduled ? getTimeUntil(nextScheduled.scheduledTime) : activeRecurringSchedule ? 'Recurring active' : 'Not set', icon: Clock },
            { label: 'Guardians', value: primaryContacts.length > 0 ? primaryContacts.map(c => c.name).join(', ') : contacts.length > 0 ? `${contacts.length} Contact${contacts.length !== 1 ? 's' : ''}` : 'None', icon: Users },
            { label: 'Escalation', value: setupState === 'fully_active' ? 'LEVEL: OPTIMAL' : 'LEVEL: PARTIAL', icon: ShieldCheck }
          ].map((stat) => (
            <div key={`stat-${stat.label}`} className="glass-card p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 transform group-hover:scale-125 transition-transform duration-500">
                <stat.icon size={48} strokeWidth={2.5} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-premium text-base-content/40 mb-2">{stat.label}</p>
              <p className="text-sm font-black text-base-content truncate uppercase">{stat.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Missed Check-In Alert banner */}
      {missedCheckIn && (
        <MissedCheckInAlert
          scheduledCheckIn={missedCheckIn}
          onConfirm={() => setMissedCheckIn(null)}
          onSnooze={() => setMissedCheckIn(null)}
        />
      )}

      {/* Navigation tabs */}
      <motion.div variants={itemVariants} className="mb-6">
         <div className="flex bg-base-200 border border-base-300/50 p-1 gap-1 rounded-xl">
          {[
            { id: 'checkin', label: 'Check-In & SOS', icon: Send },
            { id: 'tools', label: 'Tools', icon: Compass },
            { id: 'contacts', label: 'Guardians', icon: Phone },
            { id: 'returnplan', label: 'Return Plan', icon: FileText },
            { id: 'safetymap', label: 'Safety Map', icon: Map },
            { id: 'history', label: 'History', icon: History }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-black text-xs uppercase tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'bg-base-100 text-base-content shadow-sm border border-base-300/50'
                  : 'text-base-content/50 hover:text-base-content hover:bg-base-100/50'
              }`}
            >
              <tab.icon size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Error/Success Messages */}
      {error && (
        <motion.div variants={itemVariants} className="mb-6 p-4 glass-card border-error/20 bg-error/5 rounded-xl flex items-center gap-3">
          <XCircle className="text-error shrink-0" size={20} />
          <p className="text-error text-sm font-medium">{error}</p>
        </motion.div>
      )}
      {success && (
        <motion.div variants={itemVariants} className="mb-6 p-4 glass-card border-success/20 bg-success/5 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-emerald-500 shrink-0" size={20} />
          <p className="text-success text-sm font-medium">{success}</p>
        </motion.div>
      )}

      {/* Check-In Tab */}
      {activeTab === 'checkin' && (
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Quick Actions */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="font-black text-base-content text-lg mb-4">Quick actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleCheckIn('safe')}
                disabled={contacts.length === 0}
                className="w-full flex items-center justify-between p-5 bg-success/10 hover:bg-success/20 border-2 border-success/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-200/50 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                    <Check size={24} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-black text-success text-base">I'm Safe</h4>
                    <p className="text-xs font-medium text-success/80">Notify your emergency contacts</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full border border-emerald-300 flex items-center justify-center text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Send size={14} />
                </div>
              </button>

              {contacts.length > 0 && !contacts.some(c => c.isAccepted) && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={18} className="text-warning shrink-0" />
                  <p className="text-xs font-medium text-warning">
                    Your contacts haven't accepted their roles yet. Emergency alerts may not be delivered until they opt-in.
                  </p>
                </div>
              )}

              {/* Hold to SOS */}
              <div className={`relative ${contacts.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                {sosHoldActive && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-error/90 rounded-xl">
                    <span className="text-white font-black text-4xl tabular-nums">{sosCountdown}</span>
                  </div>
                )}
                <button
                  onMouseDown={handleSosHoldStart}
                  onMouseUp={handleSosHoldEnd}
                  onMouseLeave={handleSosHoldEnd}
                  onTouchStart={handleSosHoldStart}
                  onTouchEnd={handleSosHoldEnd}
                  disabled={contacts.length === 0}
                  aria-label="Hold 3 seconds to activate SOS emergency alert"
                  className="w-full h-16 bg-error/10 border-2 border-error/30 rounded-xl flex items-center justify-center gap-3 select-none cursor-pointer active:bg-error/20 transition-colors"
                >
                  <Shield size={20} className="text-error" />
                  <p className="font-black text-error uppercase tracking-[0.2em] text-xs">
                    <AlertTriangle size={14} className="inline mr-1" />Hold for SOS
                  </p>
                </button>
              </div>

              {/* SOS Active Overlay */}
              {sosEventActive && (
                <div className="fixed inset-0 z-50 bg-error flex flex-col items-center justify-center p-6 text-white">
                  <div className="animate-pulse mb-4">
                    <Shield size={64} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-widest mb-2">SOS ACTIVE</h2>
                  <p className="text-lg font-bold mb-1">Help is on the way</p>
                  <p className="text-sm opacity-80 mb-6">Your emergency contacts have been notified.</p>
                  {sosEventLocation && (
                    <div className="flex items-center gap-2 text-sm opacity-90 mb-6">
                      <MapPin size={16} />
                      <span>{sosEventLocation.address || `${sosEventLocation.latitude?.toFixed(4)}, ${sosEventLocation.longitude?.toFixed(4)}`}</span>
                    </div>
                  )}
                  {/* Offline fallback: direct call to local emergency services */}
                  <div className="mb-6 text-center">
                    <p className="text-xs opacity-70 mb-2 uppercase tracking-wide font-bold">No signal? Call directly:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[{ label: '112 (International)', number: '112' }, { label: '999 (UK)', number: '999' }, { label: '911 (US/CA)', number: '911' }, { label: '000 (AU)', number: '000' }].map(({ label, number }) => (
                        <a
                          key={number}
                          href={`tel:${number}`}
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/30 transition-colors"
                        >
                          <Phone size={12} />
                          {label}
                        </a>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleSosCancel}
                    className="bg-white text-error font-black px-8 py-3 rounded-xl uppercase tracking-wide text-sm hover:bg-red-50 transition-colors"
                  >
                    Cancel SOS
                  </button>
                </div>
              )}

              {/* Fake Call */}
              <PlanGate
                minPlan="guardian"
                title="Fake Call"
                description="Upgrade to Guardian to trigger a simulated voice call and exit uncomfortable situations safely."
              >
                <div className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={triggerFakeCall}
                  disabled={fakeCallCountdown > 0}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-bold text-base-content/80 text-sm">
                      {fakeCallCountdown > 0 ? `Calling in ${fakeCallCountdown}s...` : 'Trigger Fake Call'}
                    </span>
                    <span className="text-xs text-base-content/40">Simulated call to help you exit a situation</span>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center text-base-content/40 group-hover:scale-110 group-hover:bg-brand-vibrant group-hover:text-white group-hover:border-brand-vibrant transition-all ${fakeCallCountdown > 0 ? 'animate-pulse bg-brand-vibrant text-white border-brand-vibrant' : ''}`}>
                    <PhoneCall size={18} />
                  </div>
                </button>
                <div className="flex items-center gap-1 p-2 bg-base-100/50 border-t border-base-300/50">
                  <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider ml-1">Delay:</span>
                  {[0, 3, 5, 10].map((delay) => (
                    <button
                      key={delay}
                      onClick={() => setFakeCallDelay(delay)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        fakeCallDelay === delay
                          ? 'bg-brand-vibrant text-white shadow-sm'
                          : 'text-base-content/40 hover:bg-base-200'
                      }`}
                    >
                      {delay === 0 ? 'Instant' : `${delay}s`}
                    </button>
                  ))}
                </div>
              </div>
              </PlanGate>
            </div>
          </div>

          {/* Escalation Explanation */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Eye className="text-blue-500" size={20} />
              </div>
              <div>
                <h3 className="font-black text-base-content text-base mb-2">How check-in alerts work</h3>
                <p className="text-sm text-base-content/60 font-medium leading-relaxed">
                  Alerts are only sent if you <strong className="text-base-content">fail to respond</strong> to a scheduled check-in prompt. As long as you confirm you're safe, your contacts receive no notifications. If you miss a check-in, your primary contacts are notified with your last known location.
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="font-black text-base-content text-base mb-3">Your location</h3>
            {locationStatus === 'loading' && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <MapPin className="animate-pulse" size={16} />
                <span>Getting your location...</span>
              </div>
            )}
            {location && locationStatus === 'success' && (
              <div className="flex items-center gap-2 text-success text-sm">
                <MapPin size={16} />
                <span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
              </div>
            )}
            {locationStatus === 'error' && (
              <div className="flex items-center gap-2 text-warning text-sm">
                <MapPin size={16} />
                <span>{locationError}</span>
                {locationError?.includes('denied') ? (
                  <span className="text-xs text-base-content/40 ml-1">(reset in browser settings)</span>
                ) : (
                  <button onClick={requestLocation} className="text-brand-vibrant underline text-xs ml-1">Retry</button>
                )}
              </div>
            )}
          </div>

          {/* AI Safety Advice */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-base-content text-base">AI Safety Advice</h3>
              <button
                onClick={handleGetAIAdvice}
                disabled={aiAdviceLoading}
                className="px-3 py-1.5 bg-brand-vibrant text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-600 transition-colors"
              >
                <Sparkles size={14} />
                {aiAdviceLoading ? 'Getting...' : 'Get Advice'}
              </button>
            </div>
            {aiAdvice ? (
              <div className="p-4 bg-brand-vibrant/5 border border-brand-vibrant/20 rounded-xl">
                <p className="text-sm text-base-content/80 whitespace-pre-wrap">{aiAdvice}</p>
              </div>
            ) : (
              <p className="text-xs text-base-content/40">Get personalized safety tips for your current location.</p>
            )}
          </div>

          {/* Scheduled Check-Ins — CheckInReminder + CheckInStatus + CheckInScheduler */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base-content text-base">Scheduled check-ins</h3>
            </div>

            {/* Reminder banner for overdue check-in */}
            {missedCheckIn && (
              <div className="mb-4">
                <CheckInReminder
                  scheduledCheckIn={missedCheckIn}
                  onDismiss={() => { setMissedCheckIn(null); fetchData(); }}
                />
              </div>
            )}

            {/* Live status of all scheduled check-ins */}
            <div className="mb-4">
              <CheckInStatus
                tripId={trips.find((t) => t.status === 'active')?.id || trips[0]?.id}
                onMissed={(ci) => setMissedCheckIn(ci)}
              />
            </div>

            {/* Scheduler form — Guardian+ only */}
            <PlanGate
              minPlan="guardian"
              title="Scheduled Check-Ins"
              description="Upgrade to Guardian to set up automatic scheduled check-ins."
            >
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-bold text-brand-vibrant hover:underline list-none flex items-center gap-1">
                  <Plus size={12} /> Add new check-in schedule
                </summary>
                <div className="mt-3 border border-base-300/60 rounded-xl p-4">
                  <CheckInScheduler
                    trips={trips}
                    onScheduled={() => fetchData()}
                  />
                </div>
              </details>
            </PlanGate>
          </div>
        </motion.div>
      )}

      {/* Survival Tools Tab */}
      {activeTab === 'tools' && (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="glass-card p-6 rounded-3xl">
            <div className="mb-6">
              <h3 className="font-black text-base-content text-lg">Survival Tools</h3>
              <p className="text-sm text-base-content/60">Essential safety tools for solo travellers</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="/safety/translator" className="flex items-center gap-4 p-4 bg-base-200/50 hover:bg-base-200 rounded-xl transition-colors">
                <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center">
                  <Smartphone size={24} className="text-brand-accent" />
                </div>
                <div>
                  <h4 className="font-black text-base-content">Quick Translator</h4>
                  <p className="text-xs text-base-content/60">Translate essential phrases</p>
                </div>
              </a>
              <a href="/safety/pink-path" className="flex items-center gap-4 p-4 bg-base-200/50 hover:bg-base-200 rounded-xl transition-colors">
                <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center">
                  <MapPin size={24} className="text-rose-500" />
                </div>
                <div>
                  <h4 className="font-black text-base-content">Pink Path</h4>
                  <p className="text-xs text-base-content/60">Plan safe walking routes</p>
                </div>
              </a>
              <a href="/safety/emergency-phrases" className="flex items-center gap-4 p-4 bg-base-200/50 hover:bg-base-200 rounded-xl transition-colors">
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={24} className="text-warning" />
                </div>
                <div>
                  <h4 className="font-black text-base-content">Emergency Phrases</h4>
                  <p className="text-xs text-base-content/60">Key phrases in local language</p>
                </div>
              </a>
              <a href="/safety/crime-map" className="flex items-center gap-4 p-4 bg-base-200/50 hover:bg-base-200 rounded-xl transition-colors">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Shield size={24} className="text-blue-500" />
                </div>
                <div>
                  <h4 className="font-black text-base-content">Crime Map</h4>
                  <p className="text-xs text-base-content/60">View local safety data</p>
                </div>
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-base-content text-lg">Emergency contacts</h3>
                <p className="text-base-content/40 text-sm font-medium mt-1">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => {
                  setEditingContact(null);
                  resetContactForm();
                  setShowContactForm(true);
                }}
                className="px-4 py-2 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors flex items-center gap-1.5 shadow-md shadow-brand-vibrant/25"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
                <p className="text-base-content/60 font-medium mb-1">No emergency contacts set up</p>
                <p className="text-base-content/40 text-sm mb-4 max-w-xs mx-auto">Emergency contacts are who we notify if you miss a check-in. Add at least one to activate your safety net.</p>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-emerald-600 transition-colors"
                >
                  <Plus size={14} /> Add your first contact
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-4 border border-base-300/50 rounded-xl bg-base-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-brand-vibrant/10 rounded-xl flex items-center justify-center relative">
                        <span className="text-brand-vibrant font-black text-lg">{contact.name.charAt(0).toUpperCase()}</span>
                        {contact.isAccepted ? (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-success/100 rounded-full border-2 border-white flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        ) : (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning/100 rounded-full border-2 border-white flex items-center justify-center">
                            <Clock size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-base-content">{contact.name}</p>
                          {contact.isPrimary && (
                            <span className="text-[10px] bg-brand-vibrant text-white px-2 py-0.5 rounded-full font-black uppercase">Primary</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-base-content/60 font-medium">{contact.relationship} • {contact.phone}</p>
                          {!contact.isAccepted && (
                            <span className="text-[9px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">Pending opt-in</span>
                          )}
                          {contact.isAccepted && (
                            <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full">Guardian Active</span>
                          )}
                          {contact.verified && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                          )}
                          {!contact.verified && (
                            <span className="text-[9px] font-bold text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded-full">Unverified</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!contact.isAccepted && (
                        <button
                          onClick={() => toast && toast.success(`Verification link resent to ${contact.name}`)}
                          className="px-2 py-1 text-brand-vibrant hover:bg-brand-vibrant/10 rounded-lg transition-colors text-[10px] font-bold uppercase"
                        >
                          Resend
                        </button>
                      )}
                      <button onClick={() => handleEditContact(contact)} className="p-2 text-base-content/40 hover:text-brand-vibrant hover:bg-base-200 rounded-lg transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteContact(contact.id)} className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guardian Invite Form */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-base-content text-lg">Guardian Network</h3>
                <p className="text-base-content/40 text-sm font-medium mt-1">Invite someone to watch over you while you travel</p>
              </div>
              <button
                onClick={() => setShowGuardianInvite(!showGuardianInvite)}
                className="px-3 py-2 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                {showGuardianInvite ? 'Cancel' : 'Invite'}
              </button>
            </div>

            {showGuardianInvite && (
              <div className="mb-4 border border-base-300/50 rounded-xl p-4">
                <GuardianInviteForm
                  trips={trips}
                  onSuccess={() => {
                    setShowGuardianInvite(false);
                    fetchData();
                  }}
                />
              </div>
            )}

            <GuardianList onInvite={() => setShowGuardianInvite(true)} />
          </div>

          {/* Guardian Dashboard (for users who are guardians themselves) */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base-content text-lg">People I'm Guarding</h3>
              <button
                onClick={() => setShowGuardianDashboard(!showGuardianDashboard)}
                className="text-xs font-bold text-brand-vibrant hover:underline"
              >
                {showGuardianDashboard ? 'Hide' : 'Show'}
              </button>
            </div>
            {showGuardianDashboard && <GuardianDashboard />}
          </div>

          {/* Embassy Finder */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Building size={18} className="text-brand-vibrant" />
              <h3 className="font-black text-base-content text-lg">Embassy Finder</h3>
            </div>
            <p className="text-sm text-base-content/60 mb-4">Find your country's embassy at your destination.</p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                maxLength={3}
                value={embassyCountryCode}
                onChange={(e) => setEmbassyCountryCode(e.target.value.toUpperCase())}
                placeholder="e.g. TH, JP, FR"
                className="flex-1 px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm font-mono uppercase focus:outline-none focus:border-brand-vibrant"
              />
            </div>
            {embassyCountryCode.length >= 2 && (
              <EmbassyFinder countryCode={embassyCountryCode} />
            )}
          </div>
        </motion.div>
      )}

      {/* Return Plan Tab */}
      {activeTab === 'returnplan' && (
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Quick view card — always visible, offline-capable */}
          {(returnPlan || offlineStorage.getReturnPlan()) && (
            <ReturnPlanCard
              plan={returnPlan}
              onEdit={() => {}}
              onActivate={(plan) => {
                // EmergencyReturnActivation handles the confirm flow inline
              }}
            />
          )}

          {/* Emergency Return Activation */}
          {returnPlan?.id && (
            <div className="glass-card p-6 rounded-3xl">
              <PlanGate minPlan="guardian" title="Emergency Activation" description="Requires Guardian plan.">
                <EmergencyReturnActivation
                  plan={returnPlan}
                  onActivated={() => {
                    api.get('/return-plan').then((res) => {
                      if (res.data?.success) {
                        const plans = res.data.data;
                        const plan = Array.isArray(plans) ? plans[0] || null : plans;
                        setReturnPlan(plan);
                        if (plan) offlineStorage.setReturnPlan(plan);
                      }
                    }).catch(() => null);
                  }}
                />
              </PlanGate>
            </div>
          )}

          {/* Nearest Safe Locations */}
          <div className="glass-card p-6 rounded-3xl">
            <NearestSafeLocations />
          </div>

          {/* Edit / Create plan form */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="mb-6">
              <h3 className="font-black text-base-content text-lg">
                {returnPlan ? 'Edit Return Plan' : 'Create Return Plan'}
              </h3>
              <p className="text-sm text-base-content/60 mt-1">Document your embassy, hospital, flight, and accommodation details so your guardians can get you home safely.</p>
            </div>
            <PlanGate
              minPlan="guardian"
              title="Safe Return Planning"
              description="Upgrade to Guardian to create a safe return plan that your guardians can use in an emergency."
            >
              <ReturnPlanSetup
                tripId={trips.find((t) => t.status === 'active')?.id || trips[0]?.id}
                existingPlan={returnPlan}
                onSaved={() => {
                  api.get('/return-plan').then((res) => {
                    if (res.data?.success) {
                      const plans = res.data.data;
                      const plan = Array.isArray(plans) ? plans[0] || null : plans;
                      setReturnPlan(plan);
                      if (plan) offlineStorage.setReturnPlan(plan);
                    }
                  }).catch(() => null);
                }}
              />
            </PlanGate>
          </div>
        </motion.div>
      )}

      {/* Safety Map Tab */}
      {activeTab === 'safetymap' && (
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Emergency Services Card */}
          {embassyCountryCode.length >= 2 && (
            <div className="glass-card p-6 rounded-3xl">
              <EmergencyServicesCard countryCode={embassyCountryCode} />
            </div>
          )}

          <div className="glass-card p-6 rounded-3xl">
            <div className="mb-4">
              <h3 className="font-black text-base-content text-lg">Nearby Hospitals</h3>
            </div>
            <NearbyHospitals />
          </div>

          <div className="glass-card p-6 rounded-3xl">
            <div className="mb-6">
              <h3 className="font-black text-base-content text-lg">Area Safety</h3>
              <p className="text-sm text-base-content/60 mt-1">Community-sourced safety ratings for areas in your destination.</p>
            </div>
            {activeDestinationId ? (
              <SafetyMapOverlay destinationId={activeDestinationId} />
            ) : (
              <div className="text-center py-8 text-base-content/50">
                <Map size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active trip destination found.</p>
                <p className="text-xs mt-1">Add a trip to see safety area data.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <motion.div variants={itemVariants} className="glass-card p-6 rounded-3xl">
          <h3 className="font-black text-base-content text-lg mb-6">Check-in history</h3>
          <CheckInHistory
            tripId={trips.find((t) => t.status === 'active')?.id || trips[0]?.id}
          />
        </motion.div>
      )}

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-base-content">
                {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
              </h3>
              <button onClick={() => setShowContactForm(false)} className="text-base-content/40 hover:text-base-content/80" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-base-content/80 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-base-content/80 mb-1">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-base-content/80 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-base-content/80 mb-1">Relationship</label>
                <select
                  value={contactForm.relationship}
                  onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                  className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel.value} value={rel.value}>{rel.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="text-sm text-base-content/80 font-medium">Primary contact</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactForm.notifyOnCheckin}
                    onChange={(e) => setContactForm({ ...contactForm, notifyOnCheckin: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="text-sm text-base-content/80 font-medium">Notify on safe check-in</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactForm.notifyOnEmergency}
                    onChange={(e) => setContactForm({ ...contactForm, notifyOnEmergency: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="text-sm text-base-content/80 font-medium">Notify on emergency</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="flex-1 py-2.5 bg-base-200 text-base-content/80 rounded-xl font-bold text-sm hover:bg-base-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-brand-vibrant/25 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scheduled Check-In Modal */}
      {showScheduledForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-base-content">Schedule Check-In</h3>
              <button onClick={() => setShowScheduledForm(false)} className="text-base-content/40 hover:text-base-content/80" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="flex bg-base-200 rounded-lg p-1 mb-4">
              <button
                onClick={() => setScheduleType('one-time')}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors ${scheduleType === 'one-time' ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60'}`}
              >
                One-time
              </button>
              <button
                onClick={() => setScheduleType('recurring')}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors ${scheduleType === 'recurring' ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60'}`}
              >
                Recurring
              </button>
            </div>
            {scheduleType === 'one-time' ? (
              <form onSubmit={handleScheduledSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-base-content/80 mb-1">When to check in?</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledForm.scheduledTime}
                    onChange={(e) => setScheduledForm({ ...scheduledForm, scheduledTime: e.target.value })}
                    className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-base-content/80 mb-1">Timezone</label>
                  <select
                    value={scheduledForm.timezone}
                    onChange={(e) => setScheduledForm({ ...scheduledForm, timezone: e.target.value })}
                    className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Australia/Sydney">Sydney</option>
                  </select>
                </div>
                <p className="text-xs text-base-content/40">You'll receive a notification at this time. If you don't check in, your contacts will be notified.</p>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowScheduledForm(false)} className="flex-1 py-2.5 bg-base-200 text-base-content/80 rounded-xl font-bold text-sm hover:bg-base-300 transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-brand-vibrant/25 disabled:opacity-50">
                    {submitting ? 'Scheduling...' : 'Schedule'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateRecurringSchedule} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-base-content/80 mb-1">Check-in interval</label>
                  <select
                    value={recurringForm.interval}
                    onChange={(e) => setRecurringForm({ ...recurringForm, interval: e.target.value })}
                    className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-base-content/80 mb-1">Start time</label>
                    <input
                      type="time"
                      value={recurringForm.startTime}
                      onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
                      className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-base-content/80 mb-1">End time</label>
                    <input
                      type="time"
                      value={recurringForm.endTime}
                      onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
                      className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-base-content/80 mb-1">Timezone</label>
                  <select
                    value={recurringForm.timezone}
                    onChange={(e) => setRecurringForm({ ...recurringForm, timezone: e.target.value })}
                    className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Australia/Sydney">Sydney</option>
                  </select>
                </div>
                <p className="text-xs text-base-content/40">You'll receive check-in notifications at each interval. Missed check-ins will notify your contacts.</p>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowScheduledForm(false)} className="flex-1 py-2.5 bg-base-200 text-base-content/80 rounded-xl font-bold text-sm hover:bg-base-300 transition-colors">Cancel</button>
                  <button type="submit" disabled={recurringLoading} className="flex-1 py-2.5 bg-brand-vibrant text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-brand-vibrant/25 disabled:opacity-50">
                    {recurringLoading ? 'Creating...' : 'Create Schedule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Check-In Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              {checkInType === 'emergency' ? (
                <>
                  <AlertTriangle className="w-16 h-16 text-error mx-auto mb-4" />
                  <h3 className="text-xl font-black text-error">Emergency Alert</h3>
                  <p className="text-base-content/60 mt-2 text-sm">This will immediately notify all your emergency contacts with your current location.</p>
                </>
              ) : (
                <>
                  <Check className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-success">Safe Check-In</h3>
                  <p className="text-base-content/60 mt-2 text-sm">Notify your emergency contacts that you're safe.</p>
                </>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-base-content/80 mb-1">Quick message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={checkInType === 'emergency' ? "Describe your situation..." : "Add a message..."}
                  className="w-full px-3 py-2.5 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant focus:border-transparent text-sm"
                  rows={3}
                />
              </div>
              {location && (
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <MapPin size={16} />
                  <span>Your location will be shared</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 bg-base-200 text-base-content/80 rounded-xl font-bold text-sm hover:bg-base-300 transition-colors">Cancel</button>
              <button
                onClick={confirmCheckIn}
                disabled={submitting}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm transition-colors shadow-md disabled:opacity-50 ${
                  checkInType === 'emergency'
                    ? 'bg-error/100 hover:bg-red-600 shadow-red-500/25'
                    : 'bg-brand-vibrant hover:bg-emerald-600 shadow-brand-vibrant/25'
                }`}
              >
                {submitting ? 'Sending...' : checkInType === 'emergency' ? 'Send Alert' : "I'm Safe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fake Call UI */}
      {fakeCallCountdown > 0 && (
        <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-center">
          <div className="text-center">
            <PhoneCall size={48} className="mx-auto mb-6 text-brand-vibrant animate-pulse" />
            <p className="text-2xl font-bold mb-2">Incoming call in</p>
            <p className="text-6xl font-black text-brand-vibrant">{fakeCallCountdown}</p>
          </div>
        </div>
      )}

      {isFakeCalling && fakeCallCountdown === 0 && (
        <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-between py-20 px-8">
          <div className="flex flex-col items-center w-full">
            <div className="text-center mb-8">
              <h4 className="text-3xl font-normal mb-2">
                {isCallActive ? 'SoloCompass AI Agent' : 'Incoming Call'}
              </h4>
              <p className="text-base-content/40 text-xs font-bold uppercase tracking-widest">
                {isCallActive ? 'Encrypted Channel' : 'Mobile Call'}
              </p>
            </div>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 border-2 border-white/10 shadow-2xl overflow-hidden relative ${isCallActive ? 'bg-brand-vibrant' : 'bg-slate-800'}`}>
              <div className="absolute inset-0 bg-base-100/5 animate-pulse"></div>
              <Users className="text-white" size={60} />
            </div>
            {isCallActive && (
              <div className="text-emerald-400 font-mono text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success/100 animate-pulse"></div>
                Active
              </div>
            )}
          </div>
          <div className="w-full max-w-xs space-y-16">
            {!isCallActive ? (
              <div className="flex justify-between w-full mt-10">
                <div className="flex flex-col items-center gap-2">
                  <button onClick={endFakeCall} className="w-20 h-20 bg-error/100 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/20">
                    <Phone size={32} className="rotate-[135deg]" />
                  </button>
                  <span className="text-xs font-bold text-base-content/40">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button onClick={answerFakeCall} className="w-20 h-20 bg-success/100 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20">
                    <Phone size={32} />
                  </button>
                  <span className="text-xs font-bold text-base-content/40">Answer</span>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <button
                  onClick={endFakeCall}
                  className="w-full py-5 bg-error/100 rounded-full flex items-center justify-center font-bold text-lg gap-3 shadow-xl shadow-red-500/30"
                >
                  <Phone size={24} className="rotate-[135deg]" /> End Call
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </APIErrorBoundary>
    </DashboardShell>
  );
}
