import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api, { getTripTemplates } from '../lib/api';
import toast from 'react-hot-toast';
import { trackEvent } from '../lib/telemetry';
import { Sparkles, Calendar, MapPin, PoundSterling, StickyNote, ArrowLeft, CheckCircle2, AlertCircle, ChevronRight, User, ShieldCheck, LayoutTemplate, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getErrorMessage } from '../lib/utils';

function NewTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [travelProfile, setTravelProfile] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverTemplates, setServerTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const queryParams = new URLSearchParams(location.search);
  const initialDestination = queryParams.get('destination') || '';
  const initialBudgetRaw = queryParams.get('budget');
  
  const getBudgetAmount = (level) => {
    if (!level) return '';
    const l = level.toLowerCase();
    if (l.includes('low') || l.includes('budget')) return '1000';
    if (l.includes('med')) return '3000';
    if (l.includes('high') || l.includes('luxury')) return '8000';
    return '';
  };

  const [formData, setFormData] = useState({
    name: '',
    destination: initialDestination,
    startDate: '',
    endDate: '',
    budget: getBudgetAmount(initialBudgetRaw),
    notes: ''
  });

  useEffect(() => {
    trackEvent('initiate_trip_create', {});
    const checkQuizPreReq = async () => {
      try {
        const res = await api.get('/quiz/profile');
        if (res.data.hasQuiz) {
          setTravelProfile(res.data.profile || null);
        }
      } catch (err) {
        console.error('Failed to check quiz status', err);
      }
    };
    checkQuizPreReq();

    // Fetch trip templates
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTripTemplates();
        if (res.success && res.data) {
          setServerTemplates(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Failed to fetch trip templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Load draft from sessionStorage on mount
    const savedDraft = sessionStorage.getItem('draftTrip');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse draftTrip', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save to sessionStorage on form changes
    sessionStorage.setItem('draftTrip', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    // Allow URL param to override draft destination
    if (initialDestination && !formData.destination) {
      setFormData(prev => ({ ...prev, destination: initialDestination }));
    }
  }, [initialDestination, formData.destination]);

  const TEMPLATES = {
    SoloSafe: {
      notes: 'Focus on safety features and check-ins. Prioritize well-lit areas, accessible transport, and regular check-ins.'
    },
    Adventure: {
      notes: 'Adventure trip with moderate pace. Include outdoor activities, local experiences, and flexible scheduling.'
    }
  };

  const TEMPLATE_CARDS = [
    { id: 'SoloSafe', icon: '🛡️', label: 'Solo Safe', desc: 'Safety-first trip with check-ins', color: 'blue' },
    { id: 'Adventure', icon: '🏔️', label: 'Adventure', desc: 'Outdoor activities & local gems', color: 'amber' },
    { id: 'Cultural', icon: '🎭', label: 'Cultural', desc: 'Museums, history & local food', color: 'purple' },
    { id: 'Relaxation', icon: '🌴', label: 'Relaxation', desc: 'Spa, beach & slow travel', color: 'emerald' },
  ];

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    // Apply local template notes if available
    if (TEMPLATES[templateId]) {
      setFormData(prev => ({ ...prev, notes: TEMPLATES[templateId].notes }));
    }
    // Apply server template if found
    const serverTpl = serverTemplates.find(t => t.id === templateId || t.name === templateId);
    if (serverTpl) {
      setFormData(prev => ({
        ...prev,
        name: serverTpl.name ? `${serverTpl.name} Trip` : prev.name,
        destination: serverTpl.destination || prev.destination,
        notes: serverTpl.notes || serverTpl.description || prev.notes,
      }));
    }
    trackEvent('template_selected', { template: templateId });
  };

  useEffect(() => {
    const templateParam = queryParams.get('template');
    if (templateParam && TEMPLATES[templateParam]) {
      setFormData(prev => ({ ...prev, ...TEMPLATES[templateParam] }));
    }
  }, []);

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return !value.trim() ? 'Trip name is required' : null;
      case 'destination':
        return !value.trim() ? 'Destination is required' : null;
      case 'startDate':
        return !value ? 'Start date is required' : null;
      case 'endDate':
        if (value && formData.startDate && new Date(value) < new Date(formData.startDate)) {
          return 'End date must be on or after start date';
        }
        return null;
      case 'budget':
        if (value && (parseFloat(value) < 0 || parseFloat(value) > 100000)) {
          return 'Budget must be between £0 and £100,000';
        }
        return null;
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Trip name is required';
    }
    if (!formData.destination.trim()) {
      newErrors.destination = 'Destination is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (formData.endDate && formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = 'End date must be on or after start date';
    }
    if (formData.budget && (parseFloat(formData.budget) < 0 || parseFloat(formData.budget) > 100000)) {
      newErrors.budget = 'Budget must be between £0 and £100,000';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before continuing.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        destination: formData.destination.trim(),
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        notes: formData.notes || undefined
      };

      const response = await api.post('/trips', payload);
      sessionStorage.removeItem('draftTrip');
      trackEvent('itinerary_gen_start', { destination: formData.destination });
      toast.success('Trip created! Generating your AI itinerary...');
      navigate(`/trips/${response.data.data.id}`, { state: { autoGenerate: true } });
    } catch (error) {
      console.error('Failed to create trip:', error);
      toast.error(getErrorMessage(error, 'Unable to create trip. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="min-h-screen" style={{ backgroundImage: 'radial-gradient(rgba(16,185,129,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:pb-10 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <Link to="/trips" className="group inline-flex items-center gap-2 text-base-content/40 hover:text-base-content font-bold mb-4 transition-colors">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to My Trips
          </Link>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-success/30/60 mb-3">
            New Trip
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-base-content leading-tight">
            Plan Your Next <span className="bg-gradient-to-r from-brand-vibrant to-emerald-500 bg-clip-text text-transparent">Adventure</span>
          </h1>
          <p className="text-base-content/60 font-medium mt-2 text-lg max-w-2xl">
            Tell us where you are headed and we will build a personalised solo travel plan just for you.
          </p>
          <p className="text-base-content/40 font-medium text-sm mt-1">
            What happens next: after creating your trip, our AI generates a day-by-day itinerary, safety features activate, and you can refine every detail.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            className="lg:col-span-2"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Template Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-base-content/80 flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-brand-vibrant" />
                    Start from a template <span className="text-base-content/40 font-medium">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TEMPLATE_CARDS.map((tpl) => (
                      <button
                        type="button"
                        key={tpl.id}
                        onClick={() => handleTemplateSelect(tpl.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                          selectedTemplate === tpl.id
                            ? 'border-brand-vibrant bg-brand-vibrant/5 shadow-md shadow-brand-vibrant/10'
                            : 'border-base-300/60 hover:border-base-content/20'
                        }`}
                      >
                        <span className="text-2xl mb-2 block">{tpl.icon}</span>
                        <span className="text-sm font-black text-base-content block">{tpl.label}</span>
                        <span className="text-[11px] text-base-content/50 font-medium">{tpl.desc}</span>
                      </button>
                    ))}
                  </div>
                  {/* Server templates */}
                  {serverTemplates.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">Community Templates</p>
                      <div className="flex flex-wrap gap-2">
                        {serverTemplates.map((tpl) => (
                          <button
                            type="button"
                            key={tpl.id}
                            onClick={() => handleTemplateSelect(tpl.id)}
                            className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
                              selectedTemplate === tpl.id
                                ? 'border-brand-vibrant bg-brand-vibrant/5 text-brand-vibrant'
                                : 'border-base-300 text-base-content/60 hover:border-base-content/20'
                            }`}
                          >
                            {tpl.name || tpl.title || tpl.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {loadingTemplates && (
                    <div className="flex items-center gap-2 text-xs text-base-content/40">
                      <Loader2 size={12} className="animate-spin" /> Loading templates...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-base-content/80">
                    Trip name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                      <StickyNote size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., Hidden Gems of Japan"
                      className={`w-full pl-10 pr-4 py-3 bg-base-100 border rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium placeholder:text-base-content/40 ${errors.name ? 'border-red-300' : 'border-base-300'}`}
                    />
                    {errors.name && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                        <AlertCircle size={16} />
                      </div>
                    )}
                    {formData.name && !errors.name && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </div>
                  {errors.name && (
                    <p className="text-xs text-error font-medium">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-base-content/80">
                    Destination <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                      <MapPin size={18} />
                    </div>
                    <input
                      type="text"
                      name="destination"
                      value={formData.destination}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., Tokyo, Japan"
                      className={`w-full pl-10 pr-4 py-3 bg-base-100 border rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium placeholder:text-base-content/40 ${errors.destination ? 'border-red-300' : 'border-base-300'}`}
                    />
                    {errors.destination && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                        <AlertCircle size={16} />
                      </div>
                    )}
                    {formData.destination && !errors.destination && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </div>
                  {errors.destination && (
                    <p className="text-xs text-error font-medium">{errors.destination}</p>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-base-content/80">
                      Start date <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                        <Calendar size={18} />
                      </div>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`w-full pl-10 pr-4 py-3 bg-base-100 border rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium ${errors.startDate ? 'border-red-300' : 'border-base-300'}`}
                      />
                      {errors.startDate && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                          <AlertCircle size={16} />
                        </div>
                      )}
                    </div>
                    {errors.startDate && (
                      <p className="text-xs text-error font-medium">{errors.startDate}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-base-content/80">
                      End date <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                        <Calendar size={18} />
                      </div>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        min={formData.startDate}
                        className={`w-full pl-10 pr-4 py-3 bg-base-100 border rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium ${errors.endDate ? 'border-red-300' : 'border-base-300'}`}
                      />
                      {errors.endDate && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                          <AlertCircle size={16} />
                        </div>
                      )}
                    </div>
                    {errors.endDate && (
                      <p className="text-xs text-error font-medium">{errors.endDate}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-base-content/80">
                    Estimated budget <span className="text-base-content/40 font-medium">(optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                      <PoundSterling size={18} />
                    </div>
                    <input
                      type="number"
                      name="budget"
                      value={formData.budget}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., 3000"
                      min="0"
                      max="100000"
                      step="100"
                      className={`w-full pl-10 pr-4 py-3 bg-base-100 border rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium placeholder:text-base-content/40 ${errors.budget ? 'border-red-300' : 'border-base-300'}`}
                    />
                    {errors.budget && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                        <AlertCircle size={16} />
                      </div>
                    )}
                  </div>
                  {errors.budget && (
                    <p className="text-xs text-error font-medium">{errors.budget}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-base-content/80">
                    Personal notes <span className="text-base-content/40 font-medium">(optional)</span>
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell our AI if you have specific interests (e.g., 'focus on photography spots' or 'need high-speed wifi stays')..."
                    className="w-full px-4 py-3 bg-base-100 border border-base-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-vibrant/50 focus:border-brand-vibrant transition-all font-medium placeholder:text-base-content/40 resize-none"
                  />
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-brand-vibrant text-white rounded-xl font-bold text-lg shadow-md shadow-brand-vibrant/25 hover:shadow-lg hover:shadow-brand-vibrant/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Sparkles size={20} className="animate-spin" />
                        Creating adventure...
                      </>
                    ) : (
                      <>
                        Create adventure
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                  <p className="text-xs text-base-content/40 font-medium text-center">
                    Next: review your trip, generate an itinerary, and set up safety features.
                  </p>
                </div>
              </form>
            </div>
          </motion.div>

          <motion.div
            className="space-y-6 lg:order-last order-first"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            {travelProfile && (
              <div className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <User size={18} className="text-brand-vibrant" />
                  <h4 className="text-sm font-black text-base-content">Your Travel DNA</h4>
                </div>
                <p className="text-sm text-base-content/60 font-medium mb-4">
                  {travelProfile.travel_style ? `Travel style: ${travelProfile.travel_style}` : 'Complete the quiz to personalise your AI itinerary.'}
                </p>
                <Link to="/quiz">
                  <button className="w-full py-2.5 rounded-xl font-bold text-sm border border-base-300 text-base-content/80 hover:bg-base-200 transition-all flex items-center justify-center gap-1.5">
                    Update Travel DNA
                    <ChevronRight size={14} />
                  </button>
                </Link>
              </div>
            )}

            <div className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-6">
              <h4 className="text-sm font-black text-base-content mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-vibrant" />
                What SoloCompass builds next
              </h4>
              <p className="text-sm text-base-content/60 font-medium mb-4">
                Once your trip is created, Atlas prepares a tailored plan:
              </p>
              <ul className="space-y-3">
                <li className="flex gap-2.5 text-sm font-medium text-base-content/80">
                  <CheckCircle2 size={16} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
                  Day-by-day solo itinerary
                </li>
                <li className="flex gap-2.5 text-sm font-medium text-base-content/80">
                  <CheckCircle2 size={16} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
                  Per-activity safety notes
                </li>
                <li className="flex gap-2.5 text-sm font-medium text-base-content/80">
                  <CheckCircle2 size={16} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
                  Solo-dining and transport tips
                </li>
                <li className="flex gap-2.5 text-sm font-medium text-base-content/80">
                  <CheckCircle2 size={16} className="text-brand-vibrant flex-shrink-0 mt-0.5" />
                  Budget breakdown by day
                </li>
              </ul>
            </div>

            {/* Pre-trip readiness reminder */}
            <div className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-6">
              <h4 className="text-sm font-black text-base-content mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-vibrant" />
                Safety setup checklist
              </h4>
              <p className="text-xs text-base-content/50 mb-4">Set these up after creating your trip to activate your safety network.</p>
              <ul className="space-y-2.5">
                {[
                  'Add emergency contacts to your trip',
                  'Set up check-in schedule',
                  'Review destination FCDO advisory',
                  'Share trip with a trusted contact',
                ].map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-xs font-medium text-base-content/60">
                    <div className="w-4 h-4 rounded border border-base-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-brand-vibrant/15 bg-brand-vibrant/5 p-5">
              <h4 className="text-sm font-black text-base-content mb-2">
                Refine everything later
              </h4>
              <p className="text-xs text-base-content/60 font-medium leading-relaxed">
                Dates, budget, notes — all editable after creation. Start with what you know.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default NewTrip;
