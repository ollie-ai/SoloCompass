import { useState, useEffect } from 'react';
import { Shield, Phone, ExternalLink, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import offlineStorage from '../../lib/offlineStorage';

const TYPE_ICONS = {
  police: '🚔',
  ambulance: '🚑',
  fire: '🚒',
  general: '🆘'
};

export default function EmergencyServicesCard({ countryCode, compact = false }) {
  const [numbers, setNumbers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!countryCode) { setLoading(false); return; }
    loadNumbers();
  }, [countryCode]);

  const loadNumbers = async () => {
    // Try offline cache first
    const cached = offlineStorage.getEmergencyNumbers();
    if (cached?.countryCode === countryCode && cached?.numbers) {
      setNumbers(cached);
      setLoading(false);
      setOffline(true);
      return;
    }

    try {
      const res = await api.get(`/emergency-numbers/${countryCode}`);
      const data = res.data?.data || res.data;
      if (data) {
        setNumbers(data);
        offlineStorage.setEmergencyNumbers(data);
      }
    } catch {
      // Fall back to offline cache even if it's for a different country
      const fallback = offlineStorage.getEmergencyNumbers();
      if (fallback?.numbers) {
        setNumbers(fallback);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!countryCode) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/60 py-2">
        <div className="animate-spin w-4 h-4 border-2 border-brand-vibrant border-t-transparent rounded-full" />
        Loading emergency numbers...
      </div>
    );
  }

  if (!numbers) {
    return (
      <div className="p-3 rounded-xl bg-base-200/50 border border-base-300/40 text-center">
        <AlertCircle size={18} className="mx-auto mb-1 text-base-content/40" />
        <p className="text-xs text-base-content/60">
          No emergency numbers for <strong>{countryCode}</strong>
        </p>
        <a
          href={`https://www.google.com/search?q=emergency+numbers+${countryCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-vibrant font-bold mt-1 flex items-center justify-center gap-1 hover:underline"
        >
          <ExternalLink size={11} /> Search online
        </a>
      </div>
    );
  }

  if (compact) {
    // Show only general + ambulance side by side
    const general = numbers.numbers?.find(n => n.type === 'general');
    const ambulance = numbers.numbers?.find(n => n.type === 'ambulance');
    return (
      <div className="flex gap-2">
        {general && (
          <a href={`tel:${general.number}`} className="flex-1 flex items-center justify-center gap-1.5 bg-error text-white rounded-xl py-2 text-xs font-black hover:bg-red-600 transition-colors">
            🆘 {general.number}
          </a>
        )}
        {ambulance && ambulance.number !== general?.number && (
          <a href={`tel:${ambulance.number}`} className="flex-1 flex items-center justify-center gap-1.5 bg-warning text-white rounded-xl py-2 text-xs font-black hover:bg-amber-500 transition-colors">
            🚑 {ambulance.number}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-error/5 border-b border-base-300/40">
        <Shield size={15} className="text-error" />
        <p className="font-black text-sm text-base-content">Emergency Numbers</p>
        <span className="ml-auto text-[10px] font-black text-base-content/50 uppercase tracking-wide">
          {numbers.countryCode}
        </span>
        {offline && (
          <span className="text-[9px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">Offline</span>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-2">
        {numbers.numbers?.map(({ type, number }) => (
          <a
            key={type}
            href={`tel:${number}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-base-200/50 border border-base-300/40 hover:bg-base-200 transition-colors"
          >
            <span className="text-base">{TYPE_ICONS[type] || '📞'}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-base-content/60 capitalize">{type}</p>
              <p className="text-sm font-black text-base-content">{number}</p>
            </div>
            <Phone size={13} className="ml-auto text-brand-vibrant shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
