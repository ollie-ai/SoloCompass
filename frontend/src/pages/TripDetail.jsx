import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api, { 
  getTripAccommodation, 
  createTripAccommodation, 
  deleteTripAccommodation,
  getTripBookings, 
  createTripBooking, 
  deleteTripBooking,
  getTripDocuments, 
  createTripDocument, 
  deleteTripDocument,
  getTripPlaces, 
  createTripPlace, 
  updateTripPlace, 
  deleteTripPlace,
  exportTripPDF,
  downloadTripDocument,
  shareTrip,
  duplicateTrip
} from '../lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../lib/telemetry';
import { 
  MapPin, 
  Trash2, 
  Sparkles, 
  Navigation,
  Utensils,
  Camera,
  Moon,
  Zap,
  Coffee,
  Download,
  ShieldCheck,
  Plus,
  Edit3,
  Loader2,
  X,
  Building,
  FileText,
  Bookmark,
  Ticket,
  Plane,
  Train,
  Bus,
  AlertCircle,
  Hotel,
  Home,
  Bed,
  File,
  Armchair,
  Users,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import PackingList from '../components/PackingList';
import BudgetTracker from '../components/BudgetTracker';
import FlightStatusWidget from '../components/FlightStatus';
import FeatureGate from '../components/FeatureGate';
import WeatherWidget from '../components/WeatherWidget';
import CurrencyConverter from '../components/CurrencyConverter';
import PlacesSearch from '../components/PlacesSearch';
import DirectionsPanel from '../components/DirectionsPanel';
import AffiliateLinks from '../components/AffiliateLinks';
import SafetyCheckIn from '../components/SafetyCheckIn';
import SoloSafetyHub from '../components/SoloSafetyHub';
import PlaceCard from '../components/PlaceCard';
import { FEATURES } from '../config/features';
// import TripItinerary from '../components/trip/TripItinerary';
// import TripSidebar from '../components/trip/TripSidebar';
// import { AccommodationForm, BookingForm, DocumentForm } from '../components/trip/TripForms';

function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [showPackingList, setShowPackingList] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [showAccommodation, setShowAccommodation] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showShareTrip, setShowShareTrip] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const [editTripForm, setEditTripForm] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    budget: 0,
    notes: ''
  });

  const [regenerateForm, setRegenerateForm] = useState({
    days: 7,
    interests: [],
    pace: 'moderate'
  });
  
  const [accommodationForm, setAccommodationForm] = useState({
    type: 'hotel',
    name: '',
    address: '',
    confirmation: '',
    checkIn: trip?.start_date?.split('T')[0] || '',
    checkOut: trip?.end_date?.split('T')[0] || ''
  });
  
  const [bookingForm, setBookingForm] = useState({
    type: 'flight',
    provider: '',
    confirmation: '',
    departureLocation: '',
    arrivalLocation: '',
    departureDate: trip?.start_date?.split('T')[0] || '',
    arrivalDate: trip?.end_date?.split('T')[0] || '',
    cost: '',
    notes: ''
  });
  
  const [documentForm, setDocumentForm] = useState({
    type: 'passport',
    name: '',
    expiryDate: ''
  });
  
  const [placeForm, setPlaceForm] = useState({
    name: '',
    address: '',
    category: 'restaurant',
    status: 'want_to_visit',
    notes: '',
  });
  
  const [accommodations, setAccommodations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { maximumAge: 600000, timeout: 5000 }
    );
  }, []);

  // ConfirmDialog state — action: 'delete_activity' | 'delete_accommodation' | 'delete_booking' | 'delete_document' | 'delete_place' | 'regenerate'
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, targetId: null });

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await exportTripPDF(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trip?.name || 'trip'}-itinerary.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export failed:', error);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const handleSafetyCheckIn = () => {
    setShowCheckIn(true);
  };

  const handleShareTrip = async () => {
    setSharing(true);
    try {
      const response = await shareTrip(id);
      if (response.data?.shareUrl) {
        const fullUrl = `${window.location.origin}${response.data.shareUrl}`;
        setShareLink(fullUrl);
        setShowShareTrip(true);
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Share link copied to clipboard!');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create share link'));
    } finally {
      setSharing(false);
    }
  };

  const handleDuplicateTrip = async () => {
    setDuplicating(true);
    try {
      const response = await duplicateTrip(id);
      if (response.data?.id) {
        toast.success('Trip duplicated! Redirecting...');
        navigate(`/trips/${response.data.id}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to duplicate trip'));
    } finally {
      setDuplicating(false);
    }
  };

  // Escape key to close all modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPackingList(false);
        setShowBudget(false);
        setShowCheckIn(false);
        setShowAccommodation(false);
        setShowBookings(false);
        setShowDocuments(false);
        setShowPlaces(false);
        setShowEditTrip(false);
        setShowRegenerate(false);
        setShowVersions(false);
        setShowJournal(false);
        setShowShareTrip(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchTrip();
  }, [id]);

  useEffect(() => {
    if (trip && location.state?.autoGenerate && !trip.itinerary?.length && !generating) {
      if (trip.generation_status === 'processing') {
         setGenerating(true);
         startPolling(id);
      } else {
         navigate(`/trips/${id}`, { replace: true, state: {} });
         generateItinerary(trip);
      }
    } else if (trip?.generation_status === 'processing') {
      setGenerating(true);
      startPolling(id);
    }
  }, [trip, location.state]);

  useEffect(() => {
    if (showVersions) {
      fetchVersions();
    }
  }, [showVersions]);

  const steps = [
    { title: "Analyzing Travel DNA", icon: <Sparkles className="text-brand-vibrant" /> },
    { title: "Syncing Safety Advisories", icon: <ShieldCheck size={24} className="text-blue-500" /> },
    { title: "Scouting Local Gems", icon: <MapPin size={24} className="text-brand-accent" /> },
    { title: "Forging Your Roadmap", icon: <Navigation size={24} className="text-base-content" /> }
  ];

  useEffect(() => {
    let interval;
    if (generating) {
      setGenStep(0);
      interval = setInterval(() => {
        setGenStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 3500);
    } else {
      setGenStep(0);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/trips/${id}`);
      if (response.data?.data) {
        setTrip(response.data.data);
        trackEvent('view_trip_detail', { trip_id: id });
        
        const isOwner = user && response.data.data && (user.id === response.data.data.user_id || user.id === response.data.data.owner_id);
        if (!isOwner) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        
        setEditTripForm({
          name: response.data.data.name,
          destination: response.data.data.destination,
          startDate: response.data.data.start_date?.split('T')[0] || '',
          endDate: response.data.data.end_date?.split('T')[0] || '',
          budget: response.data.data.budget || '',
          notes: response.data.data.notes || ''
        });
        setRegenerateForm(prev => ({
          ...prev,
          days: trip?.itinerary?.length || 7
        }));
      }
    } catch (error) {
      console.error('Failed to fetch trip:', error);
      toast.error(getErrorMessage(error, 'Failed to load trip'));
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const response = await api.get(`/trips/${id}/versions`);
      if (response.data?.data) {
        setVersions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    try {
      await api.post(`/trips/${id}/versions/${versionId}/restore`);
      toast.success('Itinerary version restored');
      setShowVersions(false);
      fetchTrip();
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error('Failed to restore version');
    }
  };

  const handleEditTripSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/trips/${id}`, editTripForm);
      toast.success('Trip updated successfully');
      setShowEditTrip(false);
      fetchTrip();
    } catch (error) {
      toast.error('Failed to update trip');
    }
  };

  const handleRegenerateSubmit = async (e) => {
    e.preventDefault();
    setConfirmDialog({ open: true, action: 'regenerate', targetId: null });
  };

  const executeRegenerate = async () => {
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      setIsRegenerating(true);
      await api.post(`/trips/${id}/generate`, regenerateForm);
      toast.success('Itinerary regeneration started!');
      setShowRegenerate(false);
      setGenerating(true);
      startPolling(id);
    } catch (error) {
      setIsRegenerating(false);
      toast.error('Failed to start regeneration');
    }
  };

  const fetchAccommodations = async () => {
    try {
      const response = await getTripAccommodation(id);
      if (response.data) setAccommodations(response.data);
    } catch (error) {
      console.error('Failed to fetch accommodations:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await getTripBookings(id);
      if (response.data) setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await getTripDocuments(id);
      if (response.data) setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await api.get('/emergency-contacts');
      if (response.data?.data?.contacts) setContacts(response.data.data.contacts);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const fetchPlaces = async () => {
    try {
      const response = await getTripPlaces(id);
      if (response.data) setSavedPlaces(response.data);
    } catch (error) {
      console.error('Failed to fetch saved places:', error);
    }
  };

  useEffect(() => {
    if (trip) {
      fetchAccommodations();
      fetchBookings();
      fetchDocuments();
      fetchPlaces();
      fetchContacts();
    }
  }, [trip]);

  const updateStatus = async (status) => {
    try {
      await api.put(`/trips/${id}`, { status });
      setTrip({ ...trip, status });
      toast.success('Status updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    }
  };

  const startPolling = (tripId) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        attempts++;
        const res = await api.get(`/trips/${tripId}/status`);
        const status = res.data.data.status;
        
        if (status === 'completed') {
          clearInterval(interval);
          setGenerating(false);
          toast.success('Itinerary ready!');
          fetchTrip();
        } else if (status === 'failed') {
          clearInterval(interval);
          setGenerating(false);
          toast.error('AI generation failed. Please try again.');
        }
        
        if (attempts > 40) {
          clearInterval(interval);
          setGenerating(false);
          toast.error('Generation taking longer than expected.');
        }
      } catch (err) {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 3000);
  };

  const generateItinerary = async (tripData = trip) => {
    setGenerating(true);
    try {
      let daysCount = 3; 
      if (tripData?.start_date && tripData?.end_date) {
        const diff = new Date(tripData.end_date) - new Date(tripData.start_date);
        daysCount = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
      }

      await api.post(`/trips/${id}/generate`, {
        days: daysCount,
        pace: 'balanced'
      });
      
      startPolling(id);
    } catch (error) {
      console.error('Failed to generate:', error);
      toast.error(getErrorMessage(error, 'Failed to initiate generation'));
      setGenerating(false);
    }
  };

  const deleteActivity = (activityId) => {
    setConfirmDialog({ open: true, action: 'delete_activity', targetId: activityId });
  };

  const executeDeleteActivity = async () => {
    const activityId = confirmDialog.targetId;
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      await api.delete(`/trips/activities/${activityId}`);
      toast.success('Activity removed');
      fetchTrip();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const [editingActivity, setEditingActivity] = useState(null);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [activityForm, setActivityForm] = useState({
    name: '',
    type: 'Sightseeing',
    location: '',
    time: '',
    durationHours: '',
    cost: '',
    notes: '',
    bookingInfo: ''
  });

  const openEditActivity = (activity) => {
    setEditingActivity(activity);
    setActivityForm({
      name: activity.name || '',
      type: activity.type || 'Sightseeing',
      location: activity.location || '',
      time: activity.time || '',
      durationHours: activity.duration_hours || '',
      cost: activity.cost || '',
      notes: activity.notes || '',
      bookingInfo: activity.booking_info || ''
    });
  };

  const openAddActivity = (dayId) => {
    setSelectedDayId(dayId);
    setActivityForm({
      name: '',
      type: 'Sightseeing',
      location: '',
      time: '',
      durationHours: '',
      cost: '',
      notes: '',
      bookingInfo: ''
    });
    setShowAddActivity(true);
  };

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...activityForm,
        durationHours: activityForm.durationHours ? Number(activityForm.durationHours) : null,
        cost: activityForm.cost ? Number(activityForm.cost) : 0,
      };

      if (editingActivity) {
        await api.put(`/trips/activities/${editingActivity.id}`, payload);
        toast.success('Activity updated');
      } else {
        await api.post(`/trips/${id}/activities`, {
          ...payload,
          dayId: selectedDayId
        });
        toast.success('Activity added');
      }
      
      setEditingActivity(null);
      setShowAddActivity(false);
      fetchTrip();
    } catch (error) {
      toast.error('Failed to save activity');
    }
  };

  const handleAccommodationSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createTripAccommodation(id, accommodationForm);
      if (response.data) {
        setAccommodations([...accommodations, response.data]);
        toast.success('Accommodation added');
      }
      setAccommodationForm({ type: 'hotel', name: '', address: '', confirmation: '', checkIn: '', checkOut: '' });
      setShowAccommodation(false);
    } catch (error) {
      toast.error('Failed to add accommodation');
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createTripBooking(id, bookingForm);
      if (response.data) {
        setBookings([...bookings, response.data]);
        toast.success('Booking added');
      }
      setBookingForm({ type: 'flight', provider: '', confirmation: '', departureLocation: '', arrivalLocation: '', departureDate: '', arrivalDate: '', cost: '', currency: 'GBP' });
      setShowBookings(false);
    } catch (error) {
      toast.error('Failed to add booking');
    }
  };

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createTripDocument(id, documentForm);
      if (response.data) {
        setDocuments([...documents, response.data]);
        toast.success('Document added');
      }
      setDocumentForm({ type: 'passport', name: '', expiryDate: '' });
      setShowDocuments(false);
    } catch (error) {
      toast.error('Failed to add document');
    }
  };

  const handlePlaceSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createTripPlace(id, placeForm);
      if (response.data) {
        setSavedPlaces([...savedPlaces, response.data]);
        toast.success('Place saved');
      }
      setPlaceForm({ name: '', address: '', category: 'restaurant', status: 'want_to_visit', notes: '' });
      setShowPlaces(false);
    } catch (error) {
      toast.error('Failed to save place');
    }
  };

  const deleteAccommodation = (id) => {
    setConfirmDialog({ open: true, action: 'delete_accommodation', targetId: id });
  };

  const executeDeleteAccommodation = async () => {
    const targetId = confirmDialog.targetId;
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      await deleteTripAccommodation(targetId);
      setAccommodations(accommodations.filter(a => a.id !== targetId));
      toast.success('Accommodation removed');
    } catch (error) {
      toast.error('Failed to delete accommodation');
    }
  };

  const deleteBooking = (id) => {
    setConfirmDialog({ open: true, action: 'delete_booking', targetId: id });
  };

  const executeDeleteBooking = async () => {
    const targetId = confirmDialog.targetId;
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      await deleteTripBooking(targetId);
      setBookings(bookings.filter(b => b.id !== targetId));
      toast.success('Booking removed');
    } catch (error) {
      toast.error('Failed to delete booking');
    }
  };

  const deleteDocument = (id) => {
    setConfirmDialog({ open: true, action: 'delete_document', targetId: id });
  };

  const executeDeleteDocument = async () => {
    const targetId = confirmDialog.targetId;
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      await deleteTripDocument(targetId);
      setDocuments(documents.filter(d => d.id !== targetId));
      toast.success('Document removed');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const downloadDocument = async (doc) => {
    if (!doc.url) {
      toast.error('No download available for this document');
      return;
    }
    try {
      const blob = await downloadTripDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      if (doc.url) {
        window.open(doc.url, '_blank');
      }
    }
  };

  const deletePlace = (id) => {
    setConfirmDialog({ open: true, action: 'delete_place', targetId: id });
  };

  const executeDeletePlace = async () => {
    const targetId = confirmDialog.targetId;
    setConfirmDialog({ open: false, action: null, targetId: null });
    try {
      await deleteTripPlace(targetId);
      setSavedPlaces(savedPlaces.filter(p => p.id !== targetId));
      toast.success('Place removed');
    } catch (error) {
      toast.error('Failed to delete place');
    }
  };

  const togglePlaceVisited = async (placeId) => {
    const place = savedPlaces.find(p => p.id === placeId);
    if (!place) return;
    const newStatus = place.status === 'visited' ? 'want_to_visit' : 'visited';
    try {
      await updateTripPlace(placeId, { status: newStatus });
      setSavedPlaces(savedPlaces.map(p => p.id === placeId ? { ...p, status: newStatus } : p));
    } catch (error) {
      toast.error('Failed to update place');
    }
  };

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const daysUntil = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil <= 30;
  };

  const getAccommodationIcon = (type) => {
    switch (type) {
      case 'hotel': return <Hotel size={18} />;
      case 'hostel': return <Bed size={18} />;
      case 'airbnb': return <Home size={18} />;
      case 'resort': return <Armchair size={18} />;
      default: return <Building size={18} />;
    }
  };

  const getBookingIcon = (type) => {
    switch (type) {
      case 'flight': return <Plane size={18} />;
      case 'train': return <Train size={18} />;
      case 'bus': return <Bus size={18} />;
      case 'tour': return <Users size={18} />;
      default: return <Ticket size={18} />;
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'passport': return <File size={18} />;
      case 'visa': return <FileText size={18} />;
      case 'insurance': return <ShieldCheck size={18} />;
      case 'ticket': return <Ticket size={18} />;
      default: return <FileText size={18} />;
    }
  };

  const getPlaceIcon = (category) => {
    switch (category) {
      case 'restaurant': return <Utensils size={18} />;
      case 'attraction': return <Camera size={18} />;
      case 'cafe': return <Coffee size={18} />;
      case 'bar': return <Moon size={18} />;
      case 'shop': return <MapPin size={18} />;
      default: return <Bookmark size={18} />;
    }
  };

  const totalActivities = trip?.itinerary?.reduce((sum, day) => sum + (day.activities?.length || 0), 0) || 0;
  const totalCost = trip?.itinerary?.reduce((sum, day) => 
    sum + (day.activities?.reduce((daySum, act) => daySum + Number(act.cost || 0), 0) || 0), 0
  ) || 0;

  // Trip countdown
  const getCountdown = () => {
    if (!trip?.start_date) return null;
    const start = new Date(trip.start_date);
    const now = new Date();
    const end = trip?.end_date ? new Date(trip.end_date) : null;
    if (end && now > end) return { label: 'Completed', days: 0, past: true };
    if (now >= start && end && now <= end) return { label: 'Travelling now!', days: 0, active: true };
    const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Completed', days: 0, past: true };
    if (diff === 0) return { label: 'Departs today!', days: 0, today: true };
    return { label: `${diff} day${diff !== 1 ? 's' : ''} to go`, days: diff };
  };

  // Planning completeness
  const getPlanningProgress = () => {
    if (!trip) return 0;
    let score = 0;
    let total = 6;
    if (trip.name) score++;
    if (trip.destination) score++;
    if (trip.start_date && trip.end_date) score++;
    if (trip.budget) score++;
    if (trip.itinerary?.length > 0) score++;
    if (trip.notes) score++;
    return Math.round((score / total) * 100);
  };

  const countdown = getCountdown();
  const planningProgress = getPlanningProgress();

  const handleAddFlightToTrip = async (flight) => {
    try {
      const activity = {
        name: `${flight.airline} ${flight.flight_number}`,
        type: 'Transport',
        location: `${flight.departure?.iata} → ${flight.arrival?.iata}`,
        time: flight.departure?.scheduled ? new Date(flight.departure.scheduled).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBD',
        description: `${flight.departure?.airport} to ${flight.arrival?.airport}. Status: ${flight.status}. Terminal: ${flight.departure?.terminal || 'TBD'}, Gate: ${flight.departure?.gate || 'TBD'}`,
        cost: 0
      };
      await api.post(`/trips/${id}/activities`, activity);
      toast.success('Flight added to trip itinerary');
      fetchTrip();
    } catch (error) {
      console.error('Failed to add flight:', error);
      toast.error('Failed to add flight to trip');
    }
  };

  if (!trip && !loading) return null;

  if (accessDenied) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
        <div className="glass-card p-12 rounded-xl shadow-xl text-center max-w-md mx-auto mt-20">
          <div className="w-20 h-20 bg-error/10 rounded-xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} className="text-error" />
          </div>
          <h2 className="text-2xl font-black text-base-content mb-4">Access Denied</h2>
          <p className="text-base-content/60 font-medium mb-8">
            You don't have permission to view this trip. Only the trip owner can access it.
          </p>
          <Link 
            to="/trips" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-vibrant text-white rounded-xl font-black hover:bg-brand-vibrant/90 transition-all"
          >
            <ArrowLeft size={18} /> Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  // Central dispatcher for confirmed destructive actions
  const handleConfirmAction = () => {
    switch (confirmDialog.action) {
      case 'regenerate': return executeRegenerate();
      case 'delete_activity': return executeDeleteActivity();
      case 'delete_accommodation': return executeDeleteAccommodation();
      case 'delete_booking': return executeDeleteBooking();
      case 'delete_document': return executeDeleteDocument();
      case 'delete_place': return executeDeletePlace();
      default: setConfirmDialog({ open: false, action: null, targetId: null });
    }
  };

  const CONFIRM_CONFIGS = {
    regenerate: {
      title: 'Regenerate Itinerary?',
      description: 'This will replace your current itinerary with a new AI-generated one. This cannot be undone.',
      confirmLabel: 'Yes, Regenerate',
      variant: 'warning',
    },
    delete_activity: {
      title: 'Remove Activity?',
      description: 'This activity will be permanently removed from your itinerary.',
      confirmLabel: 'Remove Activity',
      variant: 'danger',
    },
    delete_accommodation: {
      title: 'Remove Accommodation?',
      description: 'This accommodation entry will be permanently deleted.',
      confirmLabel: 'Remove',
      variant: 'danger',
    },
    delete_booking: {
      title: 'Remove Booking?',
      description: 'This booking entry will be permanently deleted.',
      confirmLabel: 'Remove',
      variant: 'danger',
    },
    delete_document: {
      title: 'Remove Document?',
      description: 'This document entry will be permanently deleted.',
      confirmLabel: 'Remove',
      variant: 'danger',
    },
    delete_place: {
      title: 'Remove Saved Place?',
      description: 'This place will be removed from your saved places.',
      confirmLabel: 'Remove',
      variant: 'danger',
    },
  };

  const activeConfirmConfig = confirmDialog.action ? CONFIRM_CONFIGS[confirmDialog.action] : null;

  return (
    <>
    <ConfirmDialog
      open={confirmDialog.open}
      onConfirm={handleConfirmAction}
      onCancel={() => setConfirmDialog({ open: false, action: null, targetId: null })}
      title={activeConfirmConfig?.title}
      description={activeConfirmConfig?.description}
      confirmLabel={activeConfirmConfig?.confirmLabel}
      variant={activeConfirmConfig?.variant || 'danger'}
    />
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in pb-32">
      <TripHeader
        trip={trip}
        exporting={exporting}
        onExportPDF={handleExportPDF}
        onSafetyCheckIn={handleSafetyCheckIn}
        onShowRegenerate={() => setShowRegenerate(true)}
        onShowVersions={() => setShowVersions(true)}
        onShowEditTrip={() => setShowEditTrip(true)}
      />

      <style>{`
        @page { size: A4 portrait; margin: 20mm; }
        @media print {
          .no-print, nav, header, footer, aside, .glass-card button, .btn-premium, [class*="BottomNav"], [class*="fixed"] { display: none !important; }
          .max-w-6xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          body { background: white !important; font-size: 11pt; padding: 0 !important; }
          .glass-card { border: 1px solid #ddd !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
          .grid { display: block !important; }
          .lg\\:col-span-2 { width: 100% !important; }
          h1, h2, h3, h4 { color: black !important; }
          .text-brand-vibrant { color: #10b981 !important; }
          .text-base-content { color: #0f172a !important; }
          .space-y-12 > * + * { page-break-before: auto; }
          a[href]:after { content: none !important; }
        }
      `}</style>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="no-print">
          <TripSidebar
            trip={trip}
            loading={loading}
            generating={generating}
            totalCost={totalCost}
            totalActivities={totalActivities}
            accommodations={accommodations}
            bookings={bookings}
            documents={documents}
            savedPlaces={savedPlaces}
            contacts={contacts}
            tripId={id}
            onGenerateItinerary={generateItinerary}
            onAddFlightToTrip={handleAddFlightToTrip}
            setShowPackingList={setShowPackingList}
            setShowBudget={setShowBudget}
            setShowAccommodation={setShowAccommodation}
            setShowBookings={setShowBookings}
            setShowDocuments={setShowDocuments}
            setShowPlaces={setShowPlaces}
            setShowCheckIn={setShowCheckIn}
          />
          {trip?.destination && <WeatherWidget city={trip.destination} />}
          <div className="glass-card p-8 rounded-xl shadow-xl">
             <h3 className="text-xl font-black text-base-content mb-6 flex items-center gap-2">
               <Calendar className="text-brand-vibrant" /> Trip Details
             </h3>
             {loading || !trip ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
             ) : (
               <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Duration</p>
                    <p className="font-bold text-base-content/70">
                      {trip.start_date ? new Date(trip.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'}) : 'TBD'} 
                      {' — '} 
                      {trip.end_date ? new Date(trip.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    </p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Budget Allocation</p>
                     <div className="flex items-end gap-2">
                        <p className="text-2xl font-black text-base-content">£{totalCost.toLocaleString()}</p>
                        <p className="text-sm font-bold text-base-content/40 mb-1">/ £{trip.budget?.toLocaleString() || '0'}</p>
                     </div>
                     <div className="w-full bg-base-200 rounded-full h-2 mt-2">
                        <div className="bg-brand-vibrant h-2 rounded-full" style={{ width: `${Math.min((totalCost / (trip.budget || 1)) * 100, 100)}%` }}></div>
                     </div>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Activities</p>
                     <p className="font-bold text-base-content/70">{totalActivities} Activities planned</p>
                  </div>
               </div>
             )}
             {trip?.notes && (
              <div className="mt-8 pt-8 border-t border-base-content/10">
                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">My Planning Notes</p>
                <p className="text-sm text-base-content/60 leading-relaxed italic">"{trip.notes}"</p>
              </div>
             )}
          </div>

          <div className="p-8 rounded-xl bg-brand-deep text-white shadow-xl relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-vibrant/20 rounded-full blur-2xl"></div>
             <Sparkles className="text-brand-vibrant mb-6" size={32} />
             <h4 className="text-xl font-black mb-2">AI Itinerary</h4>
             <p className="text-sm text-white/60 font-medium mb-8 leading-relaxed">
               {trip?.itinerary?.length > 0 
                ? "Your itinerary is ready. You can regenerate it if you've changed your travel dates or notes."
                : "Your itinerary hasn't been designed yet. Let our specialist AI build your solo adventure."}
             </p>
              <Button 
               onClick={generateItinerary}
               disabled={generating}
               variant="primary"
               className="w-full py-4 rounded-xl font-black btn-premium shadow-lg transition-all"
              >
                {generating ? 'Processing DNA...' : trip?.itinerary?.length > 0 ? 'Regenerate Itinerary' : 'Generate with AI'}
              </Button>
           </div>

            {/* Packing List Card */}
            <FeatureGate feature="PACKING">
              <button 
                onClick={() => setShowPackingList(true)}
                className="w-full p-8 rounded-xl bg-base-200 border-2 border-amber-500/20 shadow-lg hover:shadow-xl hover:border-amber-500/40 transition-all group text-left"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <Package size={28} className="text-warning" />
                  </div>
                  <ChevronRight size={20} className="text-amber-500/40 group-hover:translate-x-1 transition-transform" />
                </div>
                <h4 className="text-lg font-black text-base-content mb-1">Packing List</h4>
                <p className="text-sm text-base-content/60 font-medium">Never forget essentials again</p>
              </button>
            </FeatureGate>

            {/* Budget Tracker Card */}
            <FeatureGate feature="BUDGET">
              <button 
                onClick={() => setShowBudget(true)}
                className="w-full p-8 rounded-xl bg-base-200 border-2 border-emerald-500/20 shadow-lg hover:shadow-xl hover:border-emerald-500/40 transition-all group text-left"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Wallet size={28} className="text-emerald-500" />
                  </div>
                  <ChevronRight size={20} className="text-emerald-500/40 group-hover:translate-x-1 transition-transform" />
                </div>
                <h4 className="text-lg font-black text-base-content mb-1">Budget Tracker</h4>
                <p className="text-sm text-base-content/60 font-medium">Track your trip expenses</p>
              </button>
            </FeatureGate>

           {/* Accommodation Card */}
           <button 
             onClick={() => setShowAccommodation(true)}
             className="w-full p-8 rounded-xl bg-base-200 border-2 border-indigo-500/20 shadow-lg hover:shadow-xl hover:border-indigo-500/40 transition-all group text-left"
           >
             <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                 <Building size={28} className="text-indigo-500" />
               </div>
               <ChevronRight size={20} className="text-indigo-500/40 group-hover:translate-x-1 transition-transform" />
             </div>
             <h4 className="text-lg font-black text-base-content mb-1">Accommodation</h4>
             <p className="text-sm text-base-content/60 font-medium">{accommodations.length > 0 ? `${accommodations.length} booking(s)` : 'Add your stays'}</p>
           </button>

           {/* Bookings Card */}
           <button 
             onClick={() => setShowBookings(true)}
             className="w-full p-8 rounded-xl bg-base-200 border-2 border-cyan-500/20 shadow-lg hover:shadow-xl hover:border-cyan-500/40 transition-all group text-left"
           >
             <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                 <Ticket size={28} className="text-cyan-500" />
               </div>
               <ChevronRight size={20} className="text-cyan-500/40 group-hover:translate-x-1 transition-transform" />
             </div>
             <h4 className="text-lg font-black text-base-content mb-1">Bookings</h4>
             <p className="text-sm text-base-content/60 font-medium">{bookings.length > 0 ? `${bookings.length} booking(s)` : 'Transport & tours'}</p>
           </button>

           {/* Documents Card */}
           <button 
             onClick={() => setShowDocuments(true)}
             className="w-full p-8 rounded-xl bg-base-200 border-2 border-rose-500/20 shadow-lg hover:shadow-xl hover:border-rose-500/40 transition-all group text-left"
           >
             <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                 <FileText size={28} className="text-rose-500" />
               </div>
               <ChevronRight size={20} className="text-rose-500/40 group-hover:translate-x-1 transition-transform" />
             </div>
             <h4 className="text-lg font-black text-base-content mb-1">Documents</h4>
             <p className="text-sm text-base-content/60 font-medium">{documents.length > 0 ? `${documents.length} document(s)` : 'Passport, visa, insurance'}</p>
           </button>

           {/* Saved Places Card */}
           <button 
             onClick={() => setShowPlaces(true)}
           >
             <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                 <Bookmark size={28} className="text-violet-600" />
               </div>
               <ChevronRight size={20} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
             </div>
             <h4 className="text-lg font-black text-violet-900 mb-1">Saved Places</h4>
             <p className="text-sm text-violet-700 font-medium">{savedPlaces.length > 0 ? `${savedPlaces.length} place(s)` : 'Spots to explore'}</p>
           </button>

           {FEATURES.FLIGHTS && (
             <div className="mt-6">
               <FlightStatusWidget 
                 tripId={id}
                 onAddToTrip={handleAddFlightToTrip}
               />
             </div>
           )}

           {/* Currency Converter */}
           <div className="mt-6">
             <CurrencyConverter defaultFrom="GBP" defaultTo="EUR" initialAmount={100} />
           </div>

           {/* Places Search */}
           <div className="mt-6">
             <PlacesSearch destination={trip?.destination} />
           </div>

            {/* Transit Directions */}
            <div className="mt-6">
              <DirectionsPanel destination={trip?.destination} />
            </div>

           {/* Affiliate Links */}
           <div className="mt-6">
             <AffiliateLinks destination={trip?.destination} />
           </div>
         </div>

        <AnimatePresence>
          {generating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-brand-deep/80 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md w-full bg-base-100 p-10 rounded-xl shadow-2xl text-center relative overflow-hidden border border-base-content/10"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-base-300">
                  <motion.div
                    className="h-full bg-brand-vibrant"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 30, ease: "linear" }}
                  />
                </div>

                <div className="w-20 h-20 bg-brand-vibrant/10 rounded-xl flex items-center justify-center mx-auto mb-8 text-brand-vibrant">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={40} />
                  </motion.div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-base-content tracking-tight">
                    {steps[genStep]?.title || "Initializing..."}
                  </h3>
                  <div className="h-12 flex items-center justify-center">
                    <p className="text-base-content/60 font-medium leading-relaxed">
                      Our specialist AI is vetting local spots in <span className="text-brand-vibrant font-bold">{trip?.destination}</span>...
                    </p>
                  </div>
                </div>

                <div className="mt-10 flex flex-col gap-3">
                  {steps.map((step, i) => (
                    <div key={`step-${step.title}`} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${i <= genStep ? 'bg-brand-vibrant shadow-lg shadow-brand-vibrant/50' : 'bg-base-300'}`} />
                      <span className={`text-xs font-bold ${i <= genStep ? 'text-base-content' : 'text-base-content/20'}`}>{step.title}</span>
                      {i === genStep && <span className="ml-auto text-[10px] font-black text-brand-vibrant animate-pulse">Processing...</span>}
                    </div>
                  ))}
                </div>

                <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-base-content/40">Solo Mission Blueprinting v2.4</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <TripMainContent
          trip={trip}
          loading={loading}
          generating={generating}
          onEditActivity={openEditActivity}
          onDeleteActivity={deleteActivity}
          onAddActivity={openAddActivity}
          onGenerate={generateItinerary}
        />
      </div>

      {/* Add/Edit Activity Modal */}
      {(editingActivity || showAddActivity) && (
        <div className="fixed inset-0 z-[110] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-base-100 rounded-xl shadow-2xl overflow-hidden border border-base-content/10"
          >
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div>
                <h3 className="text-2xl font-black text-base-content">
                  {editingActivity ? 'Edit Activity' : 'Add Activity'}
                </h3>
                <p className="text-sm text-base-content/40 font-medium italic">Refine your solo mission blueprint</p>
              </div>
              <button
                onClick={() => { setEditingActivity(null); setShowAddActivity(false); }}
                className="w-10 h-10 rounded-xl bg-base-100 shadow-sm border border-base-content/10 flex items-center justify-center text-base-content/40 hover:text-base-content transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleActivitySubmit} className="p-8 space-y-6">
               <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Activity Name</label>
                    <input 
                      required
                      value={activityForm.name}
                      onChange={e => setActivityForm({...activityForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-200 focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant outline-none font-bold text-base-content"
                      placeholder="e.g. Sunset at the Acropolis"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Type</label>
                    <select 
                      value={activityForm.type}
                      onChange={e => setActivityForm({...activityForm, type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                    >
                      <option value="Sightseeing">Sightseeing</option>
                      <option value="Food & Dining">Food & Dining</option>
                      <option value="Transport">Transport</option>
                      <option value="Adventure">Adventure</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Relaxation">Relaxation</option>
                      <option value="Nightlife">Nightlife</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Time</label>
                    <input 
                      value={activityForm.time}
                      onChange={e => setActivityForm({...activityForm, time: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                      placeholder="e.g. 18:30"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Location</label>
                    <input 
                      value={activityForm.location}
                      onChange={e => setActivityForm({...activityForm, location: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                      placeholder="Full address or landmark"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Cost (£)</label>
                    <input 
                      type="number"
                      value={activityForm.cost}
                      onChange={e => setActivityForm({...activityForm, cost: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Duration (Hours)</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={activityForm.durationHours}
                      onChange={e => setActivityForm({...activityForm, durationHours: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                      placeholder="2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Notes / Description</label>
                    <textarea 
                      value={activityForm.notes}
                      onChange={e => setActivityForm({...activityForm, notes: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-300 focus:ring-2 focus:ring-brand-vibrant/50 outline-none font-bold text-base-content"
                      rows="3"
                      placeholder="Any specific solo-safety tips or highlights?"
                    />
                  </div>
               </div>

               <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setEditingActivity(null); setShowAddActivity(false); }}
                    className="px-6 py-3 rounded-xl font-black text-base-content/40 hover:text-base-content transition-all"
                  >
                    Cancel
                  </button>
                  <Button type="submit" className="px-10 py-3 rounded-xl font-black shadow-xl shadow-brand-vibrant/20">
                    {editingActivity ? 'Update Activity' : 'Create Activity'}
                  </Button>
               </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Packing List Modal */}
      {showPackingList && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-base-100 rounded-3xl shadow-2xl overflow-hidden relative">
            <PackingList tripId={id} tripName={trip?.name} onClose={() => setShowPackingList(false)} />
          </div>
        </div>
      )}

      {/* Budget Tracker Modal */}
      {showBudget && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <BudgetTracker tripId={id} tripName={trip?.name} onClose={() => setShowBudget(false)} />
        </div>
      )}

      {/* Accommodation Modal */}
      {showAccommodation && (
        <div className="fixed inset-0 z-[150] bg-brand-deep/60 backdrop-blur-md flex items-start justify-center p-4 pt-20 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden animate-slide-up border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Building size={24} className="text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Accommodation</h2>
                  <p className="text-sm text-base-content/40">Manage your stays</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAccommodation(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {accommodations.length > 0 ? (
                <div className="space-y-4">
                  {accommodations.map(acc => (
                    <div key={acc.id} className="glass-card p-6 rounded-xl border border-base-content/5 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            {getAccommodationIcon(acc.type)}
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-base-content">{acc.name}</h4>
                            <p className="text-sm text-base-content/40 font-medium flex items-center gap-1 mt-1">
                              <MapPin size={14} /> {acc.address || 'No address'}
                            </p>
                            {acc.confirmation && (
                              <p className="text-xs font-bold text-indigo-500 mt-1">Conf: {acc.confirmation}</p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteAccommodation(acc.id)}
                          className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {acc.checkIn && acc.checkOut && (
                        <div className="mt-4 pt-4 border-t border-base-content/5 flex items-center gap-4 text-sm">
                          <div>
                            <p className="text-[10px] font-black uppercase text-base-content/40">Check-in</p>
                            <p className="font-bold text-base-content/70">{new Date(acc.checkIn).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-base-content/40">Check-out</p>
                            <p className="font-bold text-base-content/70">{new Date(acc.checkOut).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building size={48} className="text-base-content/10 mx-auto mb-4" />
                  <p className="text-base-content/40 font-medium">No accommodations added yet</p>
                </div>
              )}
              
              <form onSubmit={handleAccommodationSubmit} className="mt-8 p-6 bg-base-200/50 rounded-xl border border-base-content/5">
                <h4 className="text-lg font-black text-base-content mb-4">Add Accommodation</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Type</label>
                    <select 
                      value={accommodationForm.type}
                      onChange={e => setAccommodationForm({...accommodationForm, type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                    >
                      <option value="hotel">Hotel</option>
                      <option value="hostel">Hostel</option>
                      <option value="airbnb">Airbnb</option>
                      <option value="resort">Resort</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Name</label>
                    <input 
                      value={accommodationForm.name}
                      onChange={e => setAccommodationForm({...accommodationForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                      placeholder="Hotel name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Address</label>
                    <input 
                      value={accommodationForm.address}
                      onChange={e => setAccommodationForm({...accommodationForm, address: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                      placeholder="Full address"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Confirmation Number</label>
                    <input 
                      value={accommodationForm.confirmation}
                      onChange={e => setAccommodationForm({...accommodationForm, confirmation: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                      placeholder="Booking confirmation"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Check-in</label>
                    <input 
                      type="date"
                      value={accommodationForm.checkIn}
                      onChange={e => setAccommodationForm({...accommodationForm, checkIn: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Check-out</label>
                    <input 
                      type="date"
                      value={accommodationForm.checkOut}
                      onChange={e => setAccommodationForm({...accommodationForm, checkOut: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base-content"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full py-3 rounded-xl font-black bg-brand-vibrant hover:bg-emerald-600 text-white">
                    <Plus size={18} className="inline mr-2" /> Add Accommodation
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Modal */}
      {showBookings && (
        <div className="fixed inset-0 z-[150] bg-brand-deep/60 backdrop-blur-md flex items-start justify-center p-4 pt-20 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden animate-slide-up border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Ticket size={24} className="text-cyan-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Bookings</h2>
                  <p className="text-sm text-base-content/40">Transport, tours & activities</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBookings(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {bookings.length > 0 ? (
                <div className="space-y-4">
                  {bookings.map(booking => (
                    <div key={booking.id} className="glass-card p-6 rounded-xl border border-base-content/5 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                            {getBookingIcon(booking.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-base-content">{booking.provider || 'Booking'}</h4>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-500">{booking.type}</span>
                            </div>
                            {booking.departureLocation && booking.arrivalLocation && (
                              <p className="text-sm text-base-content/40 font-medium mt-1 flex items-center gap-1">
                                <Navigation size={14} /> {booking.departureLocation} → {booking.arrivalLocation}
                              </p>
                            )}
                            {booking.confirmation && (
                              <p className="text-xs font-bold text-cyan-500 mt-1">Conf: {booking.confirmation}</p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteBooking(booking.id)}
                          className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {(booking.departureDate || booking.arrivalDate) && (
                        <div className="mt-4 pt-4 border-t border-base-content/5 flex items-center gap-4 text-sm">
                          {booking.departureDate && (
                            <div>
                              <p className="text-[10px] font-black uppercase text-base-content/40">Depart</p>
                              <p className="font-bold text-base-content/70">{new Date(booking.departureDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {booking.arrivalDate && (
                            <div>
                              <p className="text-[10px] font-black uppercase text-base-content/40">Arrive</p>
                              <p className="font-bold text-base-content/70">{new Date(booking.arrivalDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {booking.cost && (
                            <div className="ml-auto">
                              <p className="text-[10px] font-black uppercase text-base-content/40">Cost</p>
                              <p className="font-bold text-emerald-500">{booking.currency} {booking.cost}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Ticket size={48} className="text-base-content/20 mx-auto mb-4" />
                  <p className="text-base-content/40 font-medium">No bookings added yet</p>
                </div>
              )}
              
              <form onSubmit={handleBookingSubmit} className="mt-8 p-6 bg-base-200/50 rounded-xl border border-base-content/5">
                <h4 className="text-lg font-black text-base-content mb-4">Add Booking</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Type</label>
                    <select 
                      value={bookingForm.type}
                      onChange={e => setBookingForm({...bookingForm, type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                    >
                      <option value="flight">Flight</option>
                      <option value="train">Train</option>
                      <option value="bus">Bus</option>
                      <option value="tour">Tour</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Provider</label>
                    <input 
                      value={bookingForm.provider}
                      onChange={e => setBookingForm({...bookingForm, provider: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                      placeholder="Airline or company"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Confirmation</label>
                    <input 
                      value={bookingForm.confirmation}
                      onChange={e => setBookingForm({...bookingForm, confirmation: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                      placeholder="Booking reference"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">From</label>
                    <input 
                      value={bookingForm.departureLocation}
                      onChange={e => setBookingForm({...bookingForm, departureLocation: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                      placeholder="Departure location"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">To</label>
                    <input 
                      value={bookingForm.arrivalLocation}
                      onChange={e => setBookingForm({...bookingForm, arrivalLocation: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                      placeholder="Arrival location"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Departure Date</label>
                    <input 
                      type="date"
                      value={bookingForm.departureDate}
                      onChange={e => setBookingForm({...bookingForm, departureDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Arrival Date</label>
                    <input 
                      type="date"
                      value={bookingForm.arrivalDate}
                      onChange={e => setBookingForm({...bookingForm, arrivalDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Cost</label>
                    <input 
                      type="number"
                      value={bookingForm.cost}
                      onChange={e => setBookingForm({...bookingForm, cost: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Currency</label>
                    <select 
                      value={bookingForm.currency}
                      onChange={e => setBookingForm({...bookingForm, currency: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-base-content"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full py-3 rounded-xl font-black bg-brand-vibrant hover:bg-emerald-600 text-white">
                    <Plus size={18} className="inline mr-2" /> Add Booking
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocuments && (
        <div className="fixed inset-0 z-[150] bg-brand-deep/60 backdrop-blur-md flex items-start justify-center p-4 pt-20 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden animate-slide-up border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <FileText size={24} className="text-rose-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Documents</h2>
                  <p className="text-sm text-base-content/40">Passport, visa, insurance</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDocuments(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {documents.length > 0 ? (
                <div className="space-y-4">
                  {documents.map(doc => (
                    <div key={doc.id} className={`glass-card p-6 rounded-xl border hover:shadow-lg transition-all ${isExpiringSoon(doc.expiryDate) ? 'border-amber-500/50 bg-warning/5' : 'border-base-content/5'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExpiringSoon(doc.expiryDate) ? 'bg-warning/10 text-warning' : 'bg-rose-500/10 text-rose-500'}`}>
                            {getDocumentIcon(doc.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-base-content">{doc.name || doc.type}</h4>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500">{doc.type}</span>
                            </div>
                            {doc.expiryDate && (
                              <p className="text-sm font-medium mt-1 flex items-center gap-2">
                                <span className="text-base-content/40 font-bold uppercase text-[10px]">Expires:</span>
                                <span className={isExpiringSoon(doc.expiryDate) ? 'text-warning font-black' : 'text-base-content/60 font-bold'}>
                                  {new Date(doc.expiryDate).toLocaleDateString()}
                                </span>
                                {isExpiringSoon(doc.expiryDate) && (
                                  <span className="flex items-center gap-1 text-[10px] font-black uppercase text-warning bg-warning/20 px-2 py-0.5 rounded">
                                    <AlertCircle size={10} /> Expiring soon
                                  </span>
                                )}
                               </p>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center gap-1">
                           {(doc.url || doc.document_url) && (
                             <button 
                               onClick={() => downloadDocument(doc)}
                               className="p-2 text-base-content/40 hover:text-brand-vibrant hover:bg-brand-vibrant/10 rounded-lg transition-all"
                               title="Download"
                             >
                               <Download size={18} />
                             </button>
                           )}
                           <button 
                             onClick={() => deleteDocument(doc.id)}
                             className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                           >
                             <Trash2 size={18} />
                           </button>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
              ) : (
                <div className="text-center py-8">
                  <FileText size={48} className="text-base-content/10 mx-auto mb-4" />
                  <p className="text-base-content/40 font-medium">No documents added yet</p>
                </div>
              )}
              
              <form onSubmit={handleDocumentSubmit} className="mt-8 p-6 bg-base-200/50 rounded-xl border border-base-content/5">
                <h4 className="text-lg font-black text-base-content mb-4">Add Document</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Type</label>
                    <select 
                      value={documentForm.type}
                      onChange={e => setDocumentForm({...documentForm, type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-base-content"
                    >
                      <option value="passport">Passport</option>
                      <option value="visa">Visa</option>
                      <option value="insurance">Insurance</option>
                      <option value="ticket">Ticket</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Name</label>
                    <input 
                      value={documentForm.name}
                      onChange={e => setDocumentForm({...documentForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-base-content"
                      placeholder="Document name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Expiry Date</label>
                    <input 
                      type="date"
                      value={documentForm.expiryDate}
                      onChange={e => setDocumentForm({...documentForm, expiryDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-base-content"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full py-3 rounded-xl font-black bg-brand-vibrant hover:bg-emerald-600 text-white">
                    <Plus size={18} className="inline mr-2" /> Add Document
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Saved Places Modal */}
      {showPlaces && (
        <div className="fixed inset-0 z-[150] bg-brand-deep/60 backdrop-blur-md flex items-start justify-center p-4 pt-20 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden animate-slide-up border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Bookmark size={24} className="text-violet-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Saved Places</h2>
                  <p className="text-sm text-base-content/40">Places to explore</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPlaces(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {savedPlaces.length > 0 && (
                <div className="mb-6">
                  <PlaceMap places={savedPlaces} />
                </div>
              )}
              {savedPlaces.length > 0 ? (
                <div className="space-y-4">
                  {savedPlaces.map(place => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      userLocation={userLocation}
                      onToggleVisited={() => togglePlaceVisited(place.id)}
                      onDelete={() => deletePlace(place.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bookmark size={48} className="text-base-content/10 mx-auto mb-4" />
                  <p className="text-base-content/40 font-medium">No places saved yet</p>
                </div>
              )}
              
              <form onSubmit={handlePlaceSubmit} className="mt-8 p-6 bg-base-200/50 rounded-xl border border-base-content/5">
                <h4 className="text-lg font-black text-base-content mb-4">Save a Place</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Name</label>
                    <input 
                      value={placeForm.name}
                      onChange={e => setPlaceForm({...placeForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-violet-500 outline-none font-bold text-base-content"
                      placeholder="Place name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Address</label>
                    <input 
                      value={placeForm.address}
                      onChange={e => setPlaceForm({...placeForm, address: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-violet-500 outline-none font-bold text-base-content"
                      placeholder="Full address"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Category</label>
                    <select 
                      value={placeForm.category}
                      onChange={e => setPlaceForm({...placeForm, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-violet-500 outline-none font-bold text-base-content"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="attraction">Attraction</option>
                      <option value="cafe">Cafe</option>
                      <option value="bar">Bar</option>
                      <option value="shop">Shop</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Status</label>
                    <select
                      value={placeForm.status || 'want_to_visit'}
                      onChange={e => setPlaceForm({...placeForm, status: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-violet-500 outline-none font-bold text-base-content"
                    >
                      <option value="want_to_visit">Want to Visit</option>
                      <option value="planned">Planned</option>
                      <option value="visited">Visited</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Notes</label>
                    <textarea 
                      value={placeForm.notes}
                      onChange={e => setPlaceForm({...placeForm, notes: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-violet-500 outline-none font-bold text-base-content"
                      rows="2"
                      placeholder="Why save this place?"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full py-3 rounded-xl font-black bg-violet-600 hover:bg-violet-700 text-white">
                    <Plus size={18} className="inline mr-2" /> Save Place
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Edit Trip Modal */}
      {showEditTrip && (
        <div className="fixed inset-0 z-[200] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-base-100 rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Edit Trip</h2>
                  <p className="text-sm text-base-content/40">Update your trip basic details</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditTrip(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <form onSubmit={handleEditTripSubmit} className="p-8 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Trip Name</label>
                  <input 
                    value={editTripForm.name}
                    onChange={e => setEditTripForm({...editTripForm, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Destination</label>
                  <input 
                    value={editTripForm.destination}
                    onChange={e => setEditTripForm({...editTripForm, destination: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Start Date</label>
                  <input 
                    type="date"
                    value={editTripForm.startDate}
                    onChange={e => setEditTripForm({...editTripForm, startDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">End Date</label>
                  <input 
                    type="date"
                    value={editTripForm.endDate}
                    onChange={e => setEditTripForm({...editTripForm, endDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Total Budget (£)</label>
                  <input 
                    type="number"
                    value={editTripForm.budget || ''}
                    onChange={e => setEditTripForm({...editTripForm, budget: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                  />
                </div>
              </div>
              <div className="pt-4">
                <Button type="submit" className="w-full py-4 rounded-xl font-black bg-brand-deep hover:bg-brand-deep/90 text-white shadow-xl">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regenerate Itinerary Modal */}
      {showRegenerate && (
        <div className="fixed inset-0 z-[200] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-base-100 rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative border border-base-content/10">
            <div className="p-8 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant">
                  <Zap size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-base-content">Regenerate Itinerary</h2>
                  <p className="text-sm text-base-content/40">Let AI rebuild your schedule</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRegenerate(false)}
                className="w-10 h-10 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
                disabled={isRegenerating}
              >
                <X size={20} className="text-base-content/40" />
              </button>
            </div>
            <form onSubmit={handleRegenerateSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Duration (Days)</label>
                  <input 
                    type="number"
                    min="1"
                    max="14"
                    value={regenerateForm.days || ''}
                    onChange={e => setRegenerateForm({...regenerateForm, days: e.target.value === '' ? '' : parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Pace</label>
                  <div className="flex gap-2">
                    {['relaxed', 'moderate', 'fast'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRegenerateForm({...regenerateForm, pace: p})}
                        className={`flex-1 py-3 rounded-xl font-bold capitalize border-2 transition-all ${regenerateForm.pace === p ? 'bg-brand-vibrant/10 border-brand-vibrant text-brand-vibrant' : 'bg-base-200 border-transparent text-base-content/40 hover:bg-base-300'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Interests (Comma separated)</label>
                  <textarea 
                    value={regenerateForm.interests.join(', ')}
                    onChange={e => setRegenerateForm({...regenerateForm, interests: e.target.value.split(',').map(i => i.trim())})}
                    className="w-full px-4 py-3 rounded-xl border border-base-content/10 bg-base-100 focus:ring-2 focus:ring-brand-vibrant outline-none font-bold text-base-content"
                    placeholder="Museums, Nightlife, Culture, Solo Safety..."
                    rows="2"
                  />
                </div>
              </div>
              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isRegenerating}
                  className="w-full py-4 rounded-xl font-black bg-brand-vibrant hover:bg-brand-vibrant/90 text-white shadow-xl flex items-center justify-center gap-2"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Regenerating...
                    </>
                  ) : (
                    <>
                      <Zap size={20} /> Build New Itinerary
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Itinerary Versions Modal */}
      {showVersions && (
        <div className="fixed inset-0 z-[200] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-base-100 rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative border border-base-content/10">
            <div className="p-6 border-b border-base-content/5 flex items-center justify-between bg-base-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <Loader2 size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-base-content">Itinerary Versions</h2>
                  <p className="text-xs text-base-content/40">Restore a previous version</p>
                </div>
              </div>
              <button 
                onClick={() => setShowVersions(false)}
                className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-base-content/40" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {versions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-base-content/60">No previous versions saved.</p>
                  <p className="text-xs text-base-content/40 mt-1">When you regenerate, old versions are saved automatically.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div 
                      key={version.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-base-200 hover:bg-base-300 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-base-content">Version {version.version_number}</p>
                        <p className="text-xs text-base-content/40">
                          {new Date(version.created_at).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {version.notes && (
                          <p className="text-xs text-base-content/50 mt-1 line-clamp-1">{version.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRestoreVersion(version.id)}
                        className="px-3 py-1.5 rounded-lg bg-brand-vibrant/10 text-brand-vibrant text-sm font-bold hover:bg-brand-vibrant/20 transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-base-content/5">
              <button 
                onClick={() => setShowVersions(false)}
                className="w-full py-2.5 rounded-xl font-bold text-base-content/60 hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Check-in Modal */}
      {showCheckIn && (
        <div className="fixed inset-0 z-[200] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-base-100 rounded-3xl shadow-2xl overflow-hidden relative border border-base-content/10">
            <SafetyCheckIn tripId={id} onClose={() => setShowCheckIn(false)} />
          </div>
        </div>
      )}

      {/* Journal Modal */}
      {showJournal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-base-100 rounded-3xl shadow-2xl overflow-hidden relative">
            <TripJournal tripId={id} tripName={trip?.name} onClose={() => setShowJournal(false)} />
          </div>
        </div>
      )}

      {/* Share Trip Modal */}
      {showShareTrip && shareLink && (
        <div className="fixed inset-0 z-[200] bg-brand-deep/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShareTrip(false)}>
          <div className="w-full max-w-md bg-base-100 rounded-3xl shadow-2xl overflow-hidden relative border border-base-content/10 p-8 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-vibrant/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 className="text-brand-vibrant" size={32} />
              </div>
              <h2 className="text-2xl font-black text-base-content mb-2">Share Your Trip</h2>
              <p className="text-sm text-base-content/60 font-medium">Anyone with this link can view your itinerary (expires in 7 days)</p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-base-200 rounded-xl border border-base-content/10">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 bg-transparent text-sm font-bold text-base-content outline-none truncate"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(shareLink);
                  toast.success('Link copied!');
                }}
                className="p-2 text-brand-vibrant hover:bg-brand-vibrant/10 rounded-lg transition-colors flex-shrink-0"
              >
                <CopyIcon size={18} />
              </button>
            </div>
            <button
              onClick={() => setShowShareTrip(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-base-content/60 hover:bg-base-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default TripDetail;
