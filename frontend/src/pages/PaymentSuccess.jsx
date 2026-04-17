import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Crown } from 'lucide-react';

const PLAN_NAMES = {
  guardian: 'Guardian',
  navigator: 'Navigator',
};

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const planId = searchParams.get('plan') || '';
  const planName = PLAN_NAMES[planId] || 'Premium';

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/dashboard', { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="glass-card p-10 rounded-3xl border border-base-300/50 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="relative mx-auto mb-8 w-20 h-20">
          <div className="absolute inset-0 bg-brand-vibrant/20 rounded-full animate-ping" />
          <div className="relative w-20 h-20 bg-brand-vibrant/10 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-brand-vibrant" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-base-content font-outfit mb-2">
          Payment Successful!
        </h1>
        <p className="text-base-content/60 font-medium mb-6">
          Welcome to <span className="font-black text-base-content">{planName}</span>. Your
          upgraded features are now active.
        </p>

        {/* Plan Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-vibrant/10 text-brand-vibrant px-4 py-2 rounded-full mb-8">
          <Crown size={16} />
          <span className="text-xs font-black uppercase tracking-widest">{planName} Member</span>
        </div>

        {/* Next Steps */}
        <div className="bg-base-200/50 rounded-2xl p-5 mb-8 text-left space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 mb-3">
            Next Steps
          </p>
          <div className="flex items-start gap-3 text-sm text-base-content/80 font-medium">
            <span className="w-5 h-5 bg-brand-vibrant/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-brand-vibrant">
              1
            </span>
            Explore your new AI-powered features
          </div>
          <div className="flex items-start gap-3 text-sm text-base-content/80 font-medium">
            <span className="w-5 h-5 bg-brand-vibrant/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-brand-vibrant">
              2
            </span>
            Set up scheduled check-ins for safety
          </div>
          <div className="flex items-start gap-3 text-sm text-base-content/80 font-medium">
            <span className="w-5 h-5 bg-brand-vibrant/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-brand-vibrant">
              3
            </span>
            Plan your next solo adventure
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="w-full py-4 rounded-2xl font-black text-sm bg-brand-deep text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-brand-deep/20 flex items-center justify-center gap-2"
        >
          Go to Dashboard
          <ArrowRight size={16} />
        </button>

        <p className="text-xs text-base-content/40 font-medium mt-4">
          Redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
}
