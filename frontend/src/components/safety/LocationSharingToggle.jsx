import { useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function LocationSharingToggle({ guardianId, enabled, onToggled }) {
  const [loading, setLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(!!enabled);

  const handleToggle = async () => {
    setLoading(true);
    const next = !isEnabled;
    try {
      const payload = { locationSharingEnabled: next };
      if (next && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          payload.latitude = pos.coords.latitude;
          payload.longitude = pos.coords.longitude;
        } catch {
          // location optional
        }
      }
      await api.put(`/guardian/${guardianId}/location`, payload);
      setIsEnabled(next);
      toast.success(next ? 'Location sharing enabled' : 'Location sharing disabled');
      onToggled?.(next);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update location sharing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={isEnabled ? 'Disable location sharing' : 'Enable location sharing'}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
        isEnabled
          ? 'bg-brand-vibrant/10 text-brand-vibrant border border-brand-vibrant/30 hover:bg-brand-vibrant/20'
          : 'bg-base-200 text-base-content/50 border border-base-300 hover:bg-base-300'
      }`}
    >
      {isEnabled ? <MapPin size={12} /> : <MapPinOff size={12} />}
      {isEnabled ? 'Sharing' : 'Location off'}
    </button>
  );
}
