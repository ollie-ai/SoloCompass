import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import PropTypes from 'prop-types';

export function UpgradeButton({ plan = 'guardian', children, className = '', size = 'md', variant = 'primary' }) {
  const navigate = useNavigate();

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base',
  };

  const variants = {
    primary: 'bg-brand-vibrant text-white hover:bg-emerald-600 shadow-md shadow-brand-vibrant/25',
    outline: 'border border-brand-vibrant text-brand-vibrant hover:bg-brand-vibrant/10',
    ghost: 'text-brand-vibrant hover:bg-brand-vibrant/10',
  };

  return (
    <button
      onClick={() => navigate(`/checkout?plan=${plan}`)}
      className={`inline-flex items-center gap-2 rounded-xl font-bold transition-all ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
    >
      <Crown size={size === 'sm' ? 12 : 16} />
      {children || `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
    </button>
  );
}

UpgradeButton.propTypes = {
  plan: PropTypes.oneOf(['guardian', 'navigator']),
  children: PropTypes.node,
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['primary', 'outline', 'ghost']),
};

export default UpgradeButton;
