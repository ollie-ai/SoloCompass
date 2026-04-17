import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, MessageSquare, RotateCcw } from 'lucide-react';
import api from '../lib/api';

const FEEDBACK_OPTIONS = [
  'Too expensive',
  'Found an alternative',
  'Missing features I need',
  'Just browsing',
  'Technical issues',
  'Other',
];

export default function PaymentCancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [feedback, setFeedback] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fromSettings = searchParams.get('payment') === 'cancel';

  const handleSubmitFeedback = async () => {
    if (!feedback) return;
    setSubmitting(true);
    try {
      await api.post('/billing/cancellation-feedback', {
        reason: feedback,
        details: details.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      // Feedback is optional — don't block the user
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="glass-card p-10 rounded-3xl border border-base-300/50 max-w-md w-full text-center">
        {/* Warning Icon */}
        <div className="mx-auto mb-8 w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center">
          <AlertTriangle size={36} className="text-warning" />
        </div>

        <h1 className="text-2xl font-black text-base-content font-outfit mb-2">
          Payment Cancelled
        </h1>
        <p className="text-base-content/60 font-medium mb-8">
          {fromSettings
            ? 'Your subscription change has been cancelled. No changes were made.'
            : 'Your payment was not completed. No charges were made.'}
        </p>

        {/* Feedback Section */}
        {!submitted ? (
          <div className="bg-base-200/50 rounded-2xl p-5 mb-8 text-left">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={14} className="text-base-content/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">
                Quick Feedback (Optional)
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {FEEDBACK_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setFeedback(option)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    feedback === option
                      ? 'bg-brand-vibrant/10 text-brand-vibrant border border-brand-vibrant/30'
                      : 'bg-base-100 text-base-content/60 border border-base-300/50 hover:border-base-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {feedback && (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else you'd like us to know? (optional)"
                rows={3}
                className="w-full bg-base-100 border border-base-300/50 rounded-xl p-3 text-sm text-base-content placeholder:text-base-content/30 resize-none focus:outline-none focus:border-brand-vibrant/40 transition-colors"
              />
            )}

            {feedback && (
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting}
                className="mt-3 w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-base-100 text-base-content/60 hover:bg-base-300 border border-base-300/50 transition-all active:scale-95"
              >
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-brand-vibrant/5 border border-brand-vibrant/20 rounded-2xl p-4 mb-8">
            <p className="text-sm text-brand-vibrant font-bold">Thanks for your feedback!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/pricing')}
            className="w-full py-4 rounded-2xl font-black text-sm bg-brand-deep text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-brand-deep/20 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <button
            onClick={() => navigate(fromSettings ? '/settings?tab=billing' : '/dashboard')}
            className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-base-200 text-base-content/60 hover:bg-base-300 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} />
            {fromSettings ? 'Back to Settings' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
