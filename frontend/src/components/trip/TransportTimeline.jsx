import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plane, Train, Bus, Ship, Car, Zap, Plus, Edit2, Trash2, X, Loader2,
  MapPin, Calendar, Clock, Hash, DollarSign, ArrowRight, Ticket, ChevronDown, ChevronUp
} from 'lucide-react';
import { getTransportSegments, createTransportSegment, updateTransportSegment, deleteTransportSegment } from '../../lib/api';
import { getErrorMessage } from '../../lib/utils';

const TRANSPORT_TYPES = [
  { value: 'flight', label: 'Flight', Icon: Plane },
  { value: 'train', label: 'Train', Icon: Train },
  { value: 'bus', label: 'Bus', Icon: Bus },
  { value: 'ferry', label: 'Ferry', Icon: Ship },
  { value: 'car', label: 'Car', Icon: Car },
  { value: 'taxi', label: 'Taxi', Icon: Zap },
  { value: 'other', label: 'Other', Icon: ArrowRight },
];

const STATUSES = ['confirmed', 'pending', 'cancelled', 'completed'];

function getTypeIcon(type, size = 16) {
  const found = TRANSPORT_TYPES.find(t => t.value === type);
  if (!found) return <ArrowRight size={size} />;
  const { Icon } = found;
  return <Icon size={size} />;
}

const statusColors = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-base-200 text-base-content/60',
};

const EMPTY_FORM = {
  type: 'flight',
  provider: '',
  referenceNumber: '',
  flightNumber: '',
  departureLocation: '',
  arrivalLocation: '',
  departureDatetime: '',
  arrivalDatetime: '',
  seat: '',
  platform: '',
  cost: '',
  currency: 'USD',
  status: 'confirmed',
  notes: '',
};

function TransportForm({ tripId, segment, onSave, onCancel }) {
  const [form, setForm] = useState(segment ? {
    type: segment.type,
    provider: segment.provider || '',
    referenceNumber: segment.referenceNumber || '',
    flightNumber: segment.flightNumber || '',
    departureLocation: segment.departureLocation || '',
    arrivalLocation: segment.arrivalLocation || '',
    departureDatetime: segment.departureDatetime ? segment.departureDatetime.slice(0, 16) : '',
    arrivalDatetime: segment.arrivalDatetime ? segment.arrivalDatetime.slice(0, 16) : '',
    seat: segment.seat || '',
    platform: segment.platform || '',
    cost: segment.cost || '',
    currency: segment.currency || 'USD',
    status: segment.status || 'confirmed',
    notes: segment.notes || '',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.departureLocation.trim()) { toast.error('Departure location is required'); return; }
    if (!form.arrivalLocation.trim()) { toast.error('Arrival location is required'); return; }

    setSaving(true);
    try {
      let result;
      if (segment) {
        result = await updateTransportSegment(tripId, segment.id, form);
      } else {
        result = await createTransportSegment(tripId, form);
      }
      toast.success(segment ? 'Transport updated' : 'Transport added');
      onSave(result.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isFlightOrTrain = ['flight', 'train'].includes(form.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-sm font-bold text-base-content/70 mb-2">Transport Type</label>
        <div className="grid grid-cols-4 gap-2">
          {TRANSPORT_TYPES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: value }))}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs font-bold transition-all ${
                form.type === value
                  ? 'border-brand-vibrant bg-brand-vibrant/10 text-brand-vibrant'
                  : 'border-base-content/10 text-base-content/50 hover:border-base-content/30'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Route */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">From *</label>
          <input
            type="text"
            value={form.departureLocation}
            onChange={e => setForm(f => ({ ...f, departureLocation: e.target.value }))}
            className="input input-bordered w-full"
            placeholder={form.type === 'flight' ? 'LHR – London Heathrow' : 'Departure station/stop'}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">To *</label>
          <input
            type="text"
            value={form.arrivalLocation}
            onChange={e => setForm(f => ({ ...f, arrivalLocation: e.target.value }))}
            className="input input-bordered w-full"
            placeholder={form.type === 'flight' ? 'NRT – Tokyo Narita' : 'Arrival station/stop'}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Departure</label>
          <input
            type="datetime-local"
            value={form.departureDatetime}
            onChange={e => setForm(f => ({ ...f, departureDatetime: e.target.value }))}
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Arrival</label>
          <input
            type="datetime-local"
            value={form.arrivalDatetime}
            onChange={e => setForm(f => ({ ...f, arrivalDatetime: e.target.value }))}
            className="input input-bordered w-full"
          />
        </div>
      </div>

      {/* Provider + Reference */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">
            {form.type === 'flight' ? 'Airline' : form.type === 'train' ? 'Train Company' : 'Provider'}
          </label>
          <input
            type="text"
            value={form.provider}
            onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            className="input input-bordered w-full"
            placeholder="e.g. British Airways"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">
            Booking Ref
          </label>
          <input
            type="text"
            value={form.referenceNumber}
            onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
            className="input input-bordered w-full"
            placeholder="ABC123"
          />
        </div>
      </div>

      {form.type === 'flight' && (
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Flight Number</label>
          <input
            type="text"
            value={form.flightNumber}
            onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))}
            className="input input-bordered w-full"
            placeholder="BA0123"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">
            {isFlightOrTrain ? 'Seat' : 'Notes'}
          </label>
          <input
            type="text"
            value={isFlightOrTrain ? form.seat : form.platform}
            onChange={e => setForm(f => ({ ...f, [isFlightOrTrain ? 'seat' : 'platform']: e.target.value }))}
            className="input input-bordered w-full"
            placeholder={isFlightOrTrain ? '14A' : 'Platform 9¾'}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-base-content/70 mb-1">Cost</label>
          <div className="flex gap-1">
            <input
              type="number"
              value={form.cost}
              onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
              className="input input-bordered flex-1"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <input
              type="text"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
              className="input input-bordered w-20"
              maxLength={3}
              placeholder="USD"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-base-content/70 mb-1">Status</label>
        <select
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="select select-bordered w-full"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex-1">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {segment ? 'Update' : 'Add Transport'}
        </button>
      </div>
    </form>
  );
}

function SegmentCard({ segment, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const durationMs = segment.departureDatetime && segment.arrivalDatetime
    ? new Date(segment.arrivalDatetime) - new Date(segment.departureDatetime)
    : null;
  const durationHours = durationMs ? Math.floor(durationMs / 3600000) : null;
  const durationMins = durationMs ? Math.floor((durationMs % 3600000) / 60000) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 rounded-xl border border-base-content/10 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant shrink-0">
            {getTypeIcon(segment.type, 18)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black text-base-content">{segment.departureLocation}</span>
              <ArrowRight size={14} className="text-base-content/40 shrink-0" />
              <span className="font-black text-base-content">{segment.arrivalLocation}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {segment.departureDatetime && (
                <span className="text-xs text-base-content/50">
                  {new Date(segment.departureDatetime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {durationHours !== null && (
                <span className="text-xs text-base-content/40">· {durationHours}h{durationMins > 0 ? ` ${durationMins}m` : ''}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColors[segment.status] || 'bg-base-200'}`}>
                {segment.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/40 transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={() => onEdit(segment)}
              className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(segment)}
              className="p-1.5 rounded-lg hover:bg-red-100 text-base-content/40 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-base-content/10 px-4 pb-4"
          >
            <div className="pt-3 grid grid-cols-2 gap-2 text-sm">
              {segment.provider && (
                <div>
                  <span className="text-xs text-base-content/40 font-bold">Provider</span>
                  <p className="font-bold text-base-content">{segment.provider}</p>
                </div>
              )}
              {segment.referenceNumber && (
                <div>
                  <span className="text-xs text-base-content/40 font-bold">Booking Ref</span>
                  <p className="font-bold font-mono text-brand-vibrant">{segment.referenceNumber}</p>
                </div>
              )}
              {segment.flightNumber && (
                <div>
                  <span className="text-xs text-base-content/40 font-bold">Flight</span>
                  <p className="font-bold text-base-content">{segment.flightNumber}</p>
                </div>
              )}
              {segment.seat && (
                <div>
                  <span className="text-xs text-base-content/40 font-bold">Seat</span>
                  <p className="font-bold text-base-content">{segment.seat}</p>
                </div>
              )}
              {segment.cost && (
                <div>
                  <span className="text-xs text-base-content/40 font-bold">Cost</span>
                  <p className="font-bold text-base-content">{segment.cost} {segment.currency}</p>
                </div>
              )}
              {segment.notes && (
                <div className="col-span-2">
                  <span className="text-xs text-base-content/40 font-bold">Notes</span>
                  <p className="text-base-content/70">{segment.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TransportTimeline({ tripId }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, [tripId]);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await getTransportSegments(tripId);
      setSegments(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (saved) => {
    setSegments(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = saved; return u; }
      const inserted = [...prev, saved].sort((a, b) => {
        if (!a.departureDatetime) return 1;
        if (!b.departureDatetime) return -1;
        return new Date(a.departureDatetime) - new Date(b.departureDatetime);
      });
      return inserted;
    });
    setShowForm(false);
    setEditingSegment(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransportSegment(tripId, deleteTarget.id);
      setSegments(prev => prev.filter(s => s.id !== deleteTarget.id));
      toast.success('Transport deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-base-content flex items-center gap-2">
          <Plane size={18} className="text-brand-vibrant" />
          Transport
        </h3>
        <button
          onClick={() => { setEditingSegment(null); setShowForm(true); }}
          className="btn btn-sm btn-primary gap-1"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-base-100 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">{editingSegment ? 'Edit Transport' : 'Add Transport'}</h2>
                <button onClick={() => { setShowForm(false); setEditingSegment(null); }} className="p-1.5 rounded-lg hover:bg-base-200">
                  <X size={18} />
                </button>
              </div>
              <TransportForm
                tripId={tripId}
                segment={editingSegment}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingSegment(null); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <h2 className="text-lg font-black mb-2">Delete Transport?</h2>
              <p className="text-sm text-base-content/60 mb-4">
                {deleteTarget.departureLocation} → {deleteTarget.arrivalLocation} will be removed.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="btn btn-ghost flex-1">Cancel</button>
                <button onClick={handleDeleteConfirm} disabled={deleting} className="btn btn-error flex-1">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segments */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />)}
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-8 text-base-content/40">
          <Plane size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-bold">No transport added yet</p>
          <p className="text-xs">Add flights, trains, buses and more</p>
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map(segment => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onEdit={(s) => { setEditingSegment(s); setShowForm(true); }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
