import { useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Calendar, Loader2, MapPin, Users, X } from 'lucide-react';

const SAFETY_DEFAULTS = [
  'Always meet in a public place with other people around.',
  'Tell a trusted friend or family member where you are going.',
  'Keep your phone charged and share your live location if possible.',
];

function MeetupCreationForm({ onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    destination: '',
    locationName: '',
    meetupDate: '',
    maxAttendees: 10,
    isPublic: true,
    safetyNotes: '',
  });

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ ...form, maxAttendees: parseInt(form.maxAttendees, 10) });
  };

  const minDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-base-content">Create a Meetup</h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-base-200">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Safety guidelines banner */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
          <AlertTriangle size={12} /> Safety guidelines
        </div>
        <ul className="space-y-0.5">
          {SAFETY_DEFAULTS.map((tip) => (
            <li key={tip} className="text-[11px] text-warning/70 flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">•</span> {tip}
            </li>
          ))}
        </ul>
      </div>

      <label className="form-control">
        <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 block">Title *</span>
        <input
          required
          value={form.title}
          onChange={set('title')}
          placeholder="e.g. Coffee morning in Shibuya"
          maxLength={120}
          className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="form-control">
          <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
            <MapPin size={11} /> Destination *
          </span>
          <input
            required
            value={form.destination}
            onChange={set('destination')}
            placeholder="City / country"
            maxLength={120}
            className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="form-control">
          <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 block">Location name</span>
          <input
            value={form.locationName}
            onChange={set('locationName')}
            placeholder="Café / park name"
            maxLength={200}
            className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="form-control">
        <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
          <Calendar size={11} /> Date &amp; Time *
        </span>
        <input
          required
          type="datetime-local"
          min={minDate}
          value={form.meetupDate}
          onChange={set('meetupDate')}
          className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="form-control">
        <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
          <Users size={11} /> Max attendees (3–50)
        </span>
        <input
          type="number"
          min={3}
          max={50}
          value={form.maxAttendees}
          onChange={set('maxAttendees')}
          className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="form-control">
        <span className="label-text text-xs font-bold uppercase tracking-wide mb-1 block">Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={set('description')}
          placeholder="What's the vibe? What will you do?"
          maxLength={1000}
          className="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-sm resize-none"
        />
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isPublic}
          onChange={set('isPublic')}
          className="checkbox checkbox-sm checkbox-success"
        />
        <span className="text-sm font-medium text-base-content/80">Visible to all compatible travelers</span>
      </label>

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-base-300 text-sm font-bold">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-vibrant text-white text-sm font-bold shadow-md shadow-brand-vibrant/20 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Create Meetup
        </button>
      </div>
    </form>
  );
}

MeetupCreationForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  loading: PropTypes.bool,
};

export default MeetupCreationForm;
