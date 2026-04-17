import { useState, useEffect } from 'react';
import { Building, Phone, Mail, Plane, Hotel, DollarSign, FileText, Check, Sparkles, Loader } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const FIELD_SECTIONS = [
  {
    title: 'Embassy',
    icon: Building,
    fields: [
      { key: 'embassyName', label: 'Embassy Name', placeholder: 'e.g. British Embassy Bangkok' },
      { key: 'embassyAddress', label: 'Address', placeholder: 'Street address' },
      { key: 'embassyPhone', label: 'Phone', placeholder: '+66 2 305 8333', type: 'tel' },
      { key: 'embassyEmail', label: 'Email', placeholder: 'consul@embassy.gov', type: 'email' }
    ]
  },
  {
    title: 'Nearest Hospital',
    icon: Phone,
    fields: [
      { key: 'hospitalName', label: 'Hospital Name', placeholder: 'e.g. Bangkok International Hospital' },
      { key: 'hospitalAddress', label: 'Address', placeholder: 'Street address' },
      { key: 'hospitalPhone', label: 'Phone', placeholder: '+66 2 310 3000', type: 'tel' }
    ]
  },
  {
    title: 'Emergency Flight Home',
    icon: Plane,
    fields: [
      { key: 'nearestAirport', label: 'Nearest Airport', placeholder: 'Suvarnabhumi Airport' },
      { key: 'airportCode', label: 'Airport Code', placeholder: 'BKK' },
      { key: 'flightBack', label: 'Flight Back', placeholder: 'e.g. BA168 or return route' },
      { key: 'flightBackDate', label: 'Planned Date', type: 'datetime-local' }
    ]
  },
  {
    title: 'Accommodation',
    icon: Hotel,
    fields: [
      { key: 'accommodationName', label: 'Accommodation', placeholder: 'Hotel name' },
      { key: 'accommodationAddress', label: 'Address', placeholder: 'Street address' },
      { key: 'accommodationPhone', label: 'Phone', placeholder: '+66 2 xxx xxxx', type: 'tel' }
    ]
  },
  {
    title: 'Emergency Fund',
    icon: DollarSign,
    fields: [
      { key: 'emergencyFundAmount', label: 'Amount', placeholder: '500', type: 'number' },
      { key: 'emergencyFundCurrency', label: 'Currency', placeholder: 'USD' }
    ]
  }
];

export default function ReturnPlanSetup({ tripId, existingPlan, onSaved }) {
  const [form, setForm] = useState({
    embassyName: existingPlan?.embassy_name || '',
    embassyAddress: existingPlan?.embassy_address || '',
    embassyPhone: existingPlan?.embassy_phone || '',
    embassyEmail: existingPlan?.embassy_email || '',
    hospitalName: existingPlan?.hospital_name || '',
    hospitalAddress: existingPlan?.hospital_address || '',
    hospitalPhone: existingPlan?.hospital_phone || '',
    nearestAirport: existingPlan?.nearest_airport || '',
    airportCode: existingPlan?.airport_code || '',
    flightBack: existingPlan?.flight_back || '',
    flightBackDate: existingPlan?.flight_back_date || '',
    accommodationName: existingPlan?.accommodation_name || '',
    accommodationAddress: existingPlan?.accommodation_address || '',
    accommodationPhone: existingPlan?.accommodation_phone || '',
    emergencyFundAmount: existingPlan?.emergency_fund_amount || '',
    emergencyFundCurrency: existingPlan?.emergency_fund_currency || 'USD',
    notes: existingPlan?.notes || ''
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);

  // Auto-populate nearby embassy + hospital when creating a new plan
  useEffect(() => {
    if (existingPlan?.id) return; // don't overwrite an existing plan
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setAutoPopulating(true);
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const [safeHavenRes, embassyRes] = await Promise.allSettled([
          api.get(`/safety/safe-haven?lat=${lat}&lng=${lng}`),
          api.get('/safety-areas/emergency-services/nearby?lat=' + lat + '&lng=' + lng + '&radius=5')
        ]);

        const updates = {};

        // Nearest hospital from safe-haven
        const safeHavens = safeHavenRes.status === 'fulfilled' ? safeHavenRes.value.data?.data || [] : [];
        const nearestHospital = safeHavens.find(s => s.type === 'hospital');
        if (nearestHospital && !form.hospitalName) {
          updates.hospitalName = nearestHospital.name || '';
          updates.hospitalAddress = nearestHospital.address || '';
          updates.hospitalPhone = nearestHospital.phone || '';
        }

        // Nearest police station fills address if we don't have hospital
        const hospitals = embassyRes.status === 'fulfilled'
          ? embassyRes.value.data?.data?.hospitals || []
          : [];
        if (hospitals.length > 0 && !updates.hospitalName) {
          const h = hospitals[0];
          updates.hospitalName = h.name || '';
          updates.hospitalAddress = h.address || '';
          updates.hospitalPhone = h.phone || '';
        }

        if (Object.keys(updates).length > 0) {
          setForm(prev => ({ ...prev, ...updates }));
          toast.success('Nearby hospital auto-populated', { icon: '✨' });
        }
      } catch {
        // silently fail — auto-populate is best-effort
      } finally {
        setAutoPopulating(false);
      }
    }, () => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, tripId: tripId || undefined };
      if (existingPlan?.id) {
        await api.put(`/return-plan/${existingPlan.id}`, payload);
      } else {
        await api.post('/return-plan', payload);
      }
      setSaved(true);
      toast.success('Return plan saved');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save return plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {autoPopulating && (
        <div className="flex items-center gap-2 p-3 bg-brand-vibrant/10 border border-brand-vibrant/30 rounded-xl text-brand-vibrant text-sm font-bold">
          <Loader size={14} className="animate-spin" />
          Auto-populating nearby hospital...
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm font-bold">
          <Check size={16} />
          Return plan saved successfully
        </div>
      )}

      {FIELD_SECTIONS.map(({ title, icon: Icon, fields }) => (
        <div key={title}>
          <div className="flex items-center gap-2 mb-3">
            <Icon size={16} className="text-brand-vibrant" />
            <h4 className="font-black text-sm text-base-content">{title}</h4>
          </div>
          <div className="grid grid-cols-1 gap-3 pl-6">
            {fields.map(({ key, label, placeholder, type = 'text' }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-base-content/60 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-brand-vibrant" />
          <h4 className="font-black text-sm text-base-content">Notes</h4>
        </div>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Any additional information for your guardians..."
          rows={3}
          className="w-full px-3 py-2 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-vibrant text-white font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Saving...' : existingPlan?.id ? 'Update Return Plan' : 'Save Return Plan'}
      </button>
    </form>
  );
}
