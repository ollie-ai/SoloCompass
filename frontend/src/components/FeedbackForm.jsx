import { useState } from 'react';
import { Star, Paperclip, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function FeedbackForm({ className = '' }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    feedback: '',
    rating: 0,
    subject: 'Support Feedback',
  });
  const [hovered, setHovered] = useState(0);
  const [screenshot, setScreenshot] = useState(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.feedback.trim() || form.rating < 1) {
      toast.error('Please provide a star rating and feedback.');
      return;
    }

    setSending(true);
    try {
      await api.post('/help/contact', {
        name: form.name,
        email: form.email,
        subject: `${form.subject} (${form.rating}★)`,
        message: `${form.feedback}${screenshot ? `\n\nScreenshot attached: ${screenshot.name}` : ''}`,
      });
      toast.success('Thanks for your feedback!');
      setForm({ name: '', email: '', feedback: '', rating: 0, subject: 'Support Feedback' });
      setScreenshot(null);
    } catch {
      toast.error('Unable to submit feedback right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-bold text-base-content/80 mb-2">How would you rate your experience?</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => {
            const active = (hovered || form.rating) >= value;
            return (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                onMouseEnter={() => setHovered(value)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setForm((prev) => ({ ...prev, rating: value }))}
                className="p-1"
              >
                <Star size={22} className={active ? 'fill-warning text-warning' : 'text-base-content/30'} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl border-2 border-base-300/50 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-medium"
          placeholder="Your name (optional)"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl border-2 border-base-300/50 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-medium"
          placeholder="you@example.com (optional)"
        />
      </div>

      <textarea
        required
        rows={5}
        value={form.feedback}
        onChange={(e) => setForm((prev) => ({ ...prev, feedback: e.target.value }))}
        className="w-full px-4 py-3 rounded-xl border-2 border-base-300/50 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-medium resize-none"
        placeholder="Tell us what worked well and what we should improve."
      />

      <div className="rounded-xl border-2 border-dashed border-base-300 p-3 bg-base-200/50">
        <label className="flex items-center gap-2 text-sm font-bold text-base-content/70 cursor-pointer">
          <Paperclip size={16} />
          Attach screenshot (optional)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
          />
        </label>
        {screenshot && <p className="mt-2 text-xs text-base-content/60">Attached: {screenshot.name}</p>}
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full py-3 bg-brand-vibrant text-white rounded-xl font-bold hover:bg-brand-vibrant/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Send size={16} />
        {sending ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  );
}
