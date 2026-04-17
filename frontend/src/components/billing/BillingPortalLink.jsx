import { useState } from 'react';
import { ExternalLink, Loader } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

export function BillingPortalLink({ portalUrl, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();

    if (portalUrl) {
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Fetch portal URL on demand
    setLoading(true);
    try {
      const res = await api.post('/billing/portal');
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error('Could not open billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 text-sm font-bold border border-base-300 text-base-content/80 hover:bg-base-200 rounded-xl px-4 py-2 transition-all disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader size={14} className="animate-spin" /> : <ExternalLink size={14} />}
      {loading ? 'Opening...' : 'Manage subscription'}
    </button>
  );
}

BillingPortalLink.propTypes = {
  portalUrl: PropTypes.string,
  className: PropTypes.string,
};

export default BillingPortalLink;
