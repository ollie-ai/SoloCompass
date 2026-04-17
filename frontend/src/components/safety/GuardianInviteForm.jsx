import { useState } from 'react';
import { Mail, User, Shield, Eye, Bell, Map, Plus } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function GuardianInviteForm({ trips = [], onSuccess }) {
  const [form, setForm] = useState({
    guardianEmail: '',
    guardianName: '',
    tripId: '',
    permissionViewLocation: true,
    permissionReceiveAlerts: true,
    permissionViewItinerary: false
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/guardian/invite', {
        guardianEmail: form.guardianEmail,
        guardianName: form.guardianName || undefined,
        tripId: form.tripId || undefined,
        permissionViewLocation: form.permissionViewLocation,
        permissionReceiveAlerts: form.permissionReceiveAlerts,
        permissionViewItinerary: form.permissionViewItinerary
      });
      setSuccess(true);
      toast.success(`Invitation sent to ${form.guardianEmail}`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Shield size={24} className="text-success" />
        </div>
        <h3 className="font-black text-base-content mb-1">Invitation Sent!</h3>
        <p className="text-sm text-base-content/60 mb-4">{form.guardianEmail} will receive an email to accept.</p>
        <button
          onClick={() => { setSuccess(false); setForm({ guardianEmail: '', guardianName: '', tripId: '', permissionViewLocation: true, permissionReceiveAlerts: true, permissionViewItinerary: false }); }}
          className="text-brand-vibrant text-sm font-bold hover:underline"
        >
          Invite another guardian
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1">Guardian Email *</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="email"
            required
            value={form.guardianEmail}
            onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
            placeholder="guardian@example.com"
            className="w-full pl-9 pr-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-base-content/70 mb-1">Guardian Name (optional)</label>
        <div className="relative">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            value={form.guardianName}
            onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
            placeholder="e.g. Mum, Best Friend"
            className="w-full pl-9 pr-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
          />
        </div>
      </div>

      {trips.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-base-content/70 mb-1">Link to Trip (optional)</label>
          <select
            value={form.tripId}
            onChange={(e) => setForm({ ...form, tripId: e.target.value })}
            className="w-full px-3 py-2.5 border border-base-300 rounded-xl bg-base-100 text-sm focus:outline-none focus:border-brand-vibrant"
          >
            <option value="">All trips</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-base-content/70 mb-2">Permissions</p>
        <div className="space-y-2">
          {[
            { key: 'permissionViewLocation', label: 'View my location', icon: Map },
            { key: 'permissionReceiveAlerts', label: 'Receive safety alerts', icon: Bell },
            { key: 'permissionViewItinerary', label: 'View my itinerary', icon: Eye }
          ].map(({ key, label, icon: Icon }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                className="checkbox checkbox-sm checkbox-primary"
              />
              <Icon size={14} className="text-base-content/50" />
              <span className="text-sm text-base-content/80">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !form.guardianEmail}
        className="w-full flex items-center justify-center gap-2 bg-brand-vibrant text-white font-black py-3 rounded-xl text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Plus size={16} />
        {loading ? 'Sending...' : 'Send Invitation'}
      </button>
    </form>
  );
}
