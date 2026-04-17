import { useState, useEffect } from 'react';
import { 
  Shield,
  Phone,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  Check,
  X,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Bell,
  Eye,
  EyeOff,
  Send,
  History,
  Users,
  AlertOctagon,
  PhoneCall,
  MessageSquare,
  Mail,
  Smartphone,
  Calendar,
  User,
  Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button.jsx';
import api from '../lib/api';
import { triggerHaptic } from '../hooks/useHaptics';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3005/api';

const RELATIONSHIPS = [
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse/Partner' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' }
];

export default function SafetyCheckIn({ tripId, onClose }) {
  const [activeTab, setActiveTab] = useState('checkin');
  const [contacts, setContacts] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [scheduledCheckIns, setScheduledCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Contact form state
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

  // Check-in state
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle, loading, success, error
  const [locationError, setLocationError] = useState(null);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkInType, setCheckInType] = useState('safe');
  const [isFakeCalling, setIsFakeCalling] = useState(false);
  const [sosSliderValue, setSosSliderValue] = useState(0);

  // Scheduled check-in form
  const [showScheduledForm, setShowScheduledForm] = useState(false);
  const [scheduleType, setScheduleType] = useState('one-time');
  const [scheduledForm, setScheduledForm] = useState({
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // Recurring schedule form
  const [recurringForm, setRecurringForm] = useState({
    interval: '1hr',
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // Active recurring schedule
  const [activeRecurringSchedule, setActiveRecurringSchedule] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

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

  useEffect(() => {
    fetchData();
    fetchRecurringSchedule();
    requestLocation();
  }, []);

  const fetchData = async () => {
    try {
      const [contactsRes, checkInsRes, scheduledRes] = await Promise.all([
        api.get('/emergency-contacts'),
        tripId 
          ? api.get(`/checkin/history/${tripId}`)
          : api.get('/checkin/history'),
        api.get(`/checkin/scheduled?tripId=${tripId || ''}&activeOnly=true`)
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
    
    const options = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30000
    };
    
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
        console.warn('[Location] Error:', err.code, err.message);
        setLocationStatus('error');
        if (err.code === 1) {
          setLocationError('Permission denied - check browser settings');
        } else if (err.code === 2) {
          setLocationError('GPS unavailable - check location services');
        } else if (err.code === 3) {
          setLocationError('Location request timed out');
        } else {
          setLocationError('Could not get location');
        }
      },
      options
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
        setSuccess(editingContact ? 'Contact updated!' : 'Contact added!');
        setShowContactForm(false);
        setEditingContact(null);
        resetContactForm();
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorMsg = response.data.error?.message || response.data.error || 'Failed to save contact';
        setError(errorMsg);
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

  const confirmCheckIn = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const endpoint = checkInType === 'emergency' 
        ? '/checkin/emergency'
        : '/checkin';

      const response = await api.post(endpoint, {
        tripId,
        type: checkInType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        message
      });

      if (response.data.success) {
        triggerHaptic(checkInType === 'emergency' ? [200, 120, 200] : [45]);
        setSuccess(
          checkInType === 'emergency'
            ? 'Emergency alert sent! Contacts notified.'
            : 'Safe check-in sent!'
        );
        setMessage('');
        setShowConfirmModal(false);
        fetchData();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorMsg = response.data.error?.message || response.data.error || 'Failed to send check-in';
        setError(errorMsg);
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
        tripId,
        scheduledTime: scheduledForm.scheduledTime,
        timezone: scheduledForm.timezone
      });

      if (response.data.success) {
        setSuccess('Scheduled check-in created!');
        setShowScheduledForm(false);
        setScheduledForm({
          scheduledTime: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorMsg = response.data.error?.message || response.data.error || 'Failed to schedule check-in';
        setError(errorMsg);
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
    if (!tripId) return;
    try {
      const res = await api.get(`/checkin/schedule/${tripId}`);
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
        tripId,
        interval: recurringForm.interval,
        startTime: recurringForm.startTime || undefined,
        endTime: recurringForm.endTime || undefined,
        timezone: recurringForm.timezone
      });

      if (res.data.success) {
        setSuccess('Recurring schedule created!');
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
        const errorMsg = res.data.error?.message || res.data.error || 'Failed to schedule check-in';
        setError(errorMsg);
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
        status: 'paused'
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
        status: 'active'
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
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const [isCallActive, setIsCallActive] = useState(false);
  const [fakeCallCountdown, setFakeCallCountdown] = useState(0);

  const triggerFakeCall = () => {
    setFakeCallCountdown(3);
    const countdownInterval = setInterval(() => {
      setFakeCallCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsFakeCalling(true);
          setIsCallActive(false);
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
          audio.play().catch(e => console.log('Audio play failed', e));
          setTimeout(() => {
            if (!isCallActive) {
              setIsFakeCalling(false);
              setIsCallActive(false);
            }
          }, 45000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

  const getCheckInTypeLabel = (type) => {
    const labels = {
      safe: '✓ Safe',
      emergency: '⚠️ Emergency',
      scheduled: '⏰ Scheduled',
      arrived: '🏁 Arrived'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-vibrant"></div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-xl shadow-lg overflow-hidden">
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
      <div className="bg-gradient-to-r from-brand-vibrant to-green-500 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Safety Check-In</h2>
              <p className="text-green-100 text-sm">Your safety is our priority</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b">
        {[
          { id: 'checkin', label: 'Check-In', icon: Send },
          { id: 'contacts', label: 'Contacts', icon: Phone },
          { id: 'history', label: 'History', icon: History }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-brand-vibrant border-b-2 border-brand-vibrant'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-error/10 border border-error/30 rounded-lg flex items-center space-x-2">
          <XCircle className="w-5 h-5 text-error" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <button
              onClick={() => handleCheckIn('safe')}
              disabled={contacts.length === 0}
              className="w-full flex items-center justify-between p-6 bg-success/10 hover:bg-success/20 border-2 border-success/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-200/50 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                  <Check size={24} />
                </div>
                <div className="text-left">
                   <h3 className="font-black text-success text-lg leading-tight">I'm Safe</h3>
                   <p className="text-xs font-bold text-success/80">Notify your emergency contacts</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full border border-emerald-300 flex items-center justify-center text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity">
                 <Send size={14} />
              </div>
            </button>

            {contacts.length > 0 && !contacts.some(c => c.isAccepted) && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3">
                 <AlertTriangle size={18} className="text-warning shrink-0" />
                 <p className="text-[10px] font-bold text-warning leading-tight">
                    Your contacts haven't accepted their roles yet. Emergency alerts may not be delivered until they opt-in via the SMS link.
                 </p>
              </div>
            )}

            <div className={`relative h-20 bg-error/10 border-2 border-error/30 rounded-xl overflow-hidden shadow-inner flex items-center px-2 ${contacts.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
               <div className="absolute inset-0 bg-red-100 origin-left transition-transform duration-75" style={{ transform: `scaleX(${sosSliderValue / 100})` }}></div>
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <p className="font-black text-error uppercase tracking-[0.2em] text-sm flex items-center gap-2">
                   <AlertTriangle size={16} /> Slide to SOS
                 </p>
               </div>
               <input 
                 type="range" 
                 min="0" 
                 max="100" 
                 value={sosSliderValue}
                 onChange={(e) => {
                     setSosSliderValue(e.target.value);
                     if (e.target.value === '100') {
                         handleCheckIn('emergency');
                         setTimeout(() => setSosSliderValue(0), 1000);
                     }
                 }}
                 onMouseUp={() => setSosSliderValue(0)}
                 onTouchEnd={() => setSosSliderValue(0)}
                 className="relative z-10 w-full h-full opacity-0 cursor-pointer"
                 disabled={contacts.length === 0}
               />
               <div className="absolute left-2 top-1/2 -translate-y-1/2 w-16 h-16 bg-error/100 rounded-xl flex items-center justify-center text-white p-2 shadow-lg pointer-events-none transition-transform duration-75" style={{ transform: `translateX(calc(${sosSliderValue}% * 4.5))` }}>
                  <Shield size={24} />
               </div>
            </div>

            <button
               onClick={triggerFakeCall}
               className="w-full flex items-center justify-between p-4 bg-base-200 hover:bg-base-200 border border-base-300 rounded-xl transition-colors group"
            >
                <div className="flex flex-col items-start gap-1">
                   <span className="font-black text-base-content/80 text-sm">Trigger Fake Call</span>
                   <span className="text-[10px] font-bold text-base-content/40">Receive a simulated phone call immediately.</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center text-base-content/40 group-hover:scale-110 group-hover:bg-brand-vibrant group-hover:text-white group-hover:border-brand-vibrant transition-all">
                   <Phone size={18} />
                </div>
            </button>
          </div>

          {contacts.length === 0 && (
            <div className="text-center p-4 bg-warning/10 rounded-lg">
              <p className="text-warning text-sm">
                Add emergency contacts to use check-in features
              </p>
              <button
                onClick={() => setActiveTab('contacts')}
                className="text-brand-vibrant text-sm underline mt-2"
              >
                Add contacts
              </button>
            </div>
          )}

          {locationStatus === 'loading' && (
            <div className="flex items-center space-x-2 text-blue-600 text-sm">
              <MapPin className="w-4 h-4 animate-pulse" />
              <span>Getting your location...</span>
            </div>
          )}
          {location && locationStatus === 'success' && (
            <div className="flex items-center space-x-2 text-success text-sm">
              <MapPin className="w-4 h-4" />
              <span>Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
            </div>
          )}
          {locationStatus === 'error' && (
            <div className="flex items-center space-x-2 text-warning text-sm">
              <MapPin className="w-4 h-4" />
              <span>{locationError || 'Could not get location'}</span>
              {locationError?.includes('denied') ? (
                <span className="text-xs text-base-content/60 ml-1">
                  (reset in browser settings)
                </span>
              ) : (
                <button 
                  onClick={requestLocation} 
                  className="text-brand-vibrant underline text-xs ml-1"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base-content flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Scheduled Check-Ins</span>
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowScheduledForm(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Schedule
              </Button>
            </div>

            {scheduledCheckIns.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-base-content/60 text-sm font-medium mb-1">No scheduled check-ins</p>
                <p className="text-base-content/40 text-xs">Set up recurring or one-time check-ins to stay connected with your emergency contacts automatically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scheduledCheckIns.map((scheduled) => (
                  <div
                    key={scheduled.id}
                    className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-brand-vibrant" />
                      <div>
                        <p className="font-medium text-base-content">
                          {formatDateTime(scheduled.scheduledTime)}
                        </p>
<p className="text-xs text-base-content/60">
                          {getTimeUntil(scheduled.scheduledTime)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelScheduled(scheduled.id)}
                      className="p-2 text-base-content/40 hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base-content">Emergency Contacts</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingContact(null);
                resetContactForm();
                setShowContactForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-base-content/30 mx-auto mb-3" />
              <p className="text-base-content/60 font-medium mb-1">No contacts added</p>
              <p className="text-base-content/40 text-sm">Add trusted people to notify in case of an emergency.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className="group relative bg-base-200 hover:bg-base-100 border-2 border-base-300/50 hover:border-brand-vibrant p-5 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center text-brand-vibrant relative">
                      <User size={30} />
                      {contact.isAccepted ? (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-vibrant rounded-full border-2 border-white flex items-center justify-center">
                           <Check size={12} className="text-white" />
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning/100 rounded-full border-2 border-white flex items-center justify-center animate-pulse">
                           <Clock size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-base-content">{contact.name}</p>
                        {contact.isPrimary && (
                          <span className="text-[10px] bg-brand-vibrant text-white px-2 py-0.5 rounded-md font-black uppercase tracking-widest">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-base-content/60 font-medium">
                          {contact.relationship} • {contact.phone}
                        </p>
                        {!contact.isAccepted && (
                          <span className="text-[9px] font-black text-warning uppercase tracking-widest">Pending Opt-In</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!contact.isAccepted && (
                      <button 
                        onClick={() => toast.success(`Verification link resent to ${contact.name}`)}
                        className="p-2 text-brand-vibrant hover:bg-brand-vibrant/10 rounded-lg transition-colors text-[10px] font-black uppercase"
                      >
                         Resend
                      </button>
                    )}
                    <button
                      onClick={() => handleEditContact(contact)}
                      className="p-2 text-base-content/40 hover:text-brand-vibrant hover:bg-base-200 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="p-6">
          <h3 className="font-semibold text-base-content mb-4">Check-In History</h3>
          {checkIns.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-base-content/30 mx-auto mb-3" />
              <p className="text-base-content/60 font-medium mb-1">No check-in history</p>
              <p className="text-base-content/40 text-sm">Send your first safety check-in to start building your record.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkIns.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className={`p-4 rounded-lg border ${
                    checkIn.type === 'emergency'
                      ? 'bg-error/10 border-error/30'
                      : checkIn.type === 'scheduled'
                      ? 'bg-warning/10 border-warning/30'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-medium ${
                        checkIn.type === 'emergency' ? 'text-error' : 'text-green-700'
                      }`}>
                        {getCheckInTypeLabel(checkIn.type)}
                      </span>
                      {checkIn.address && (
                        <p className="text-sm text-base-content/80 flex items-center mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
                          {checkIn.address}
                        </p>
                      )}
                      {checkIn.message && (
                        <p className="text-sm text-base-content/80 mt-1">{checkIn.message}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {formatDateTime(checkIn.createdAt)}
                      </p>
                      {checkIn.sentTo?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {checkIn.sentTo.length} notified
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
              </h3>
              <button onClick={() => setShowContactForm(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Relationship</label>
                <select
                  value={contactForm.relationship}
                  onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel.value} value={rel.value}>{rel.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="ml-2 text-sm text-base-content/80">Primary contact</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contactForm.notifyOnCheckin}
                    onChange={(e) => setContactForm({ ...contactForm, notifyOnCheckin: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="ml-2 text-sm text-base-content/80">Notify on safe check-in</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contactForm.notifyOnEmergency}
                    onChange={(e) => setContactForm({ ...contactForm, notifyOnEmergency: e.target.checked })}
                    className="rounded text-brand-vibrant focus:ring-brand-vibrant"
                  />
                  <span className="ml-2 text-sm text-base-content/80">Notify on emergency</span>
                </label>
              </div>
              <div className="flex space-x-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowContactForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={submitting}>{editingContact ? 'Update' : 'Add Contact'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScheduledForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Schedule Check-In</h3>
              <button onClick={() => setShowScheduledForm(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleScheduledSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">When to check in?</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledForm.scheduledTime}
                  onChange={(e) => setScheduledForm({ ...scheduledForm, scheduledTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Timezone</label>
                <select
                  value={scheduledForm.timezone}
                  onChange={(e) => setScheduledForm({ ...scheduledForm, timezone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
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
              <p className="text-sm text-gray-500">You'll receive a notification at this time. If you don't check in, your contacts will be notified.</p>
              <div className="flex space-x-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowScheduledForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={submitting}>Schedule</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              {checkInType === 'emergency' ? (
                <>
                  <AlertTriangle className="w-16 h-16 text-error mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-error">Emergency Alert</h3>
                  <p className="text-base-content/80 mt-2">This will immediately notify ALL your emergency contacts with your current location.</p>
                </>
              ) : (
                <>
                  <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-600">Safe Check-In</h3>
                  <p className="text-base-content/80 mt-2">Notify your emergency contacts that you're safe.</p>
                </>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Quick message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={checkInType === 'emergency' ? "Describe your situation..." : "Add a message..."}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-vibrant focus:border-transparent"
                  rows={3}
                />
              </div>
              {location && (
                <div className="flex items-center space-x-2 text-sm text-base-content/80">
                  <MapPin className="w-4 h-4" />
                  <span>Your location will be shared</span>
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
              <Button variant={checkInType === 'emergency' ? 'danger' : 'primary'} className="flex-1" onClick={confirmCheckIn} loading={submitting}>
                {checkInType === 'emergency' ? 'Send Alert' : "I'm Safe"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isFakeCalling && (
        <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-between py-20 px-8 transition-all animate-fade-in duration-500">
           <div className="flex flex-col items-center w-full">
              <div className="text-center mb-8">
                  <h4 className="text-3xl font-normal mb-2">{isCallActive ? 'SoloCompass Safety Agent' : 'Incoming Safety Call'}</h4>
                 <p className="text-base-content/40 text-lg uppercase tracking-widest text-xs font-black">{isCallActive ? 'Encrypted Channel' : 'Mobile Call'}</p>
              </div>
              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 border-2 border-white/10 shadow-2xl overflow-hidden relative ${isCallActive ? 'bg-brand-vibrant shadow-brand-vibrant/20' : 'bg-slate-800'}`}>
                <div className="absolute inset-0 bg-base-100/5 animate-pulse"></div>
                <User className="text-white" size={60} />
              </div>
              {isCallActive && (
                 <div className="text-emerald-400 font-mono text-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success/100 animate-pulse"></div>
                     Active Safety Check-In
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
                   <div className="grid grid-cols-3 gap-8 text-center text-[10px] font-black uppercase tracking-widest text-base-content/40">
                      <div><div className="w-14 h-14 bg-base-100/10 rounded-full mb-2 mx-auto flex items-center justify-center"><Mic size={18} /></div>Mute</div>
                      <div><div className="w-14 h-14 bg-base-100/10 rounded-full mb-2 mx-auto flex items-center justify-center"><Plus size={18} /></div>Add</div>
                      <div><div className="w-14 h-14 bg-base-100/10 rounded-full mb-2 mx-auto flex items-center justify-center"><History size={18} /></div>Log</div>
                   </div>
                   <button onClick={endFakeCall} className="w-full py-5 bg-error/100 rounded-full flex items-center justify-center font-black text-lg gap-3 shadow-xl shadow-red-500/30">
                      <Phone size={24} className="rotate-[135deg]" /> End Safety Call
                   </button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
