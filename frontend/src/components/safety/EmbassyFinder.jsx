import { useState, useEffect } from 'react';
import { Building, Phone, Mail, Globe, ExternalLink, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

export default function EmbassyFinder({ countryCode }) {
  const [embassies, setEmbassies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);

  useEffect(() => {
    if (!countryCode) return;
    fetchEmbassies();
  }, [countryCode]);

  const fetchEmbassies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/safety/embassies/${countryCode}`);
      setEmbassies(res.data?.data || []);
      setFallbackUrl(res.data?.fallbackSearchUrl || null);
    } catch (err) {
      setError('Failed to load embassy information');
      setFallbackUrl(`https://www.google.com/search?q=embassy+in+${encodeURIComponent(countryCode)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!countryCode) {
    return (
      <div className="p-4 text-center text-base-content/60 text-sm">
        No country code provided
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-base-content/60">
        <div className="animate-spin w-6 h-6 border-2 border-brand-vibrant border-t-transparent rounded-full mx-auto mb-2" />
        Looking up embassy...
      </div>
    );
  }

  if (error || embassies.length === 0) {
    return (
      <div className="p-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-error mb-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {embassies.length === 0 && !error && (
          <p className="text-sm text-base-content/60 mb-3">
            No embassy data found for <strong>{countryCode}</strong>.
          </p>
        )}
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-brand-vibrant text-sm font-bold hover:underline"
          >
            <ExternalLink size={14} />
            Search for embassy information
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {embassies.map((e) => (
        <div key={e.id} className="border border-base-300/50 rounded-xl bg-base-100 p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-brand-vibrant/10 rounded-xl flex items-center justify-center shrink-0">
              <Building size={18} className="text-brand-vibrant" />
            </div>
            <div>
              <h4 className="font-black text-base-content text-sm">{e.embassy_name}</h4>
              {e.city && <p className="text-xs text-base-content/60">{e.city}</p>}
            </div>
          </div>

          <div className="space-y-2 pl-13">
            {e.address && (
              <p className="text-xs text-base-content/70">{e.address}</p>
            )}
            {e.emergency_phone && (
              <a href={`tel:${e.emergency_phone}`} className="flex items-center gap-2 text-sm text-error font-bold hover:underline">
                <Phone size={14} />
                Emergency: {e.emergency_phone}
              </a>
            )}
            {e.phone && (
              <a href={`tel:${e.phone}`} className="flex items-center gap-2 text-sm text-brand-vibrant hover:underline">
                <Phone size={14} />
                {e.phone}
              </a>
            )}
            {e.email && (
              <a href={`mailto:${e.email}`} className="flex items-center gap-2 text-sm text-base-content/60 hover:text-brand-vibrant hover:underline">
                <Mail size={14} />
                {e.email}
              </a>
            )}
            {e.website && (
              <a href={e.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-base-content/60 hover:text-brand-vibrant hover:underline">
                <Globe size={14} />
                Website
              </a>
            )}
          </div>
        </div>
      ))}
      {fallbackUrl && (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-brand-vibrant text-xs font-bold hover:underline mt-2"
        >
          <ExternalLink size={12} />
          Search for more embassy information
        </a>
      )}
    </div>
  );
}
