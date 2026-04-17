import { useState } from 'react';
import { Tag, Check, Loader } from 'lucide-react';
import api from '../../lib/api';
import PropTypes from 'prop-types';

export function PromoCodeInput({ onApplied }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/billing/promo', { code: code.trim() });
      setResult(res.data.data);
      onApplied?.(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid or expired promo code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); setResult(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="PROMO CODE"
            disabled={loading || !!result}
            className="w-full pl-8 pr-3 py-2 text-sm bg-base-200 border border-base-300 rounded-xl font-mono font-bold placeholder:font-normal placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-brand-vibrant/30 disabled:opacity-60"
          />
        </div>
        <button
          onClick={handleApply}
          disabled={!code.trim() || loading || !!result}
          className="px-4 py-2 bg-base-200 border border-base-300 rounded-xl text-sm font-bold hover:bg-base-300 disabled:opacity-50 transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          {loading && <Loader size={13} className="animate-spin" />}
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </div>
      {result && (
        <div className="flex items-center gap-2 text-sm text-brand-vibrant font-bold bg-brand-vibrant/10 px-3 py-2 rounded-xl">
          <Check size={14} />
          {result.discount} applied!
        </div>
      )}
      {error && <p className="text-xs text-error font-medium">{error}</p>}
    </div>
  );
}

PromoCodeInput.propTypes = {
  onApplied: PropTypes.func,
};

export default PromoCodeInput;
