import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Loader2, MapPin, Plus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import DashboardShell from '../components/dashboard/DashboardShell';
import PageHeader from '../components/PageHeader';
import MeetupCard from '../components/MeetupCard';
import MeetupCreationForm from '../components/MeetupCreationForm';

const Meetups = () => {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [filterDestination, setFilterDestination] = useState('');

  const fetchMeetups = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDestination ? `?destination=${encodeURIComponent(filterDestination)}` : '';
      const res = await api.get(`/meetups${params}`);
      setMeetups(res.data.data || []);
    } catch {
      toast.error('Failed to load meetups');
    } finally {
      setLoading(false);
    }
  }, [filterDestination]);

  useEffect(() => {
    fetchMeetups();
  }, [fetchMeetups]);

  const handleCreate = async (formData) => {
    setCreating(true);
    try {
      const res = await api.post('/meetups', formData);
      const { data, safetyWarning } = res.data;
      if (safetyWarning) {
        toast(safetyWarning, { icon: '⚠️', duration: 7000 });
      }
      toast.success('Meetup created!');
      setShowForm(false);
      setMeetups((prev) => [data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meetup');
    } finally {
      setCreating(false);
    }
  };

  const handleRSVP = async (meetupId, status) => {
    setRsvpLoading(true);
    try {
      const res = await api.put(`/meetups/${meetupId}/rsvp`, { status });
      const { attendeeCount, meetupStatus } = res.data.data;
      setMeetups((prev) =>
        prev.map((m) =>
          m.id === meetupId
            ? { ...m, attendee_count: attendeeCount, status: meetupStatus, my_rsvp: status }
            : m
        )
      );
      const labels = { going: "You're going!", maybe: "Marked as maybe", not_going: "RSVP updated" };
      toast.success(labels[status] || 'RSVP updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'RSVP failed');
    } finally {
      setRsvpLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title={<>Group <span className="text-gradient">Meetups</span></>}
          subtitle="Meet up with 3 or more solo travelers at the same destination."
          badge="Safety Network"
          icon={Users}
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/20 hover:bg-emerald-600 transition-colors"
            >
              <Plus size={16} /> Create Meetup
            </button>
          }
        />

        {/* Filter bar */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" size={14} />
            <input
              type="text"
              placeholder="Filter by destination..."
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMeetups()}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-base-300 bg-base-100 text-sm"
            />
          </div>
          <button
            onClick={fetchMeetups}
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white"
          >
            Search
          </button>
        </div>

        {/* Creation form modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-lg bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              >
                <MeetupCreationForm
                  onSubmit={handleCreate}
                  onCancel={() => setShowForm(false)}
                  loading={creating}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meetup list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-base-content/30">
            <div className="w-10 h-10 border-3 border-base-300/50 border-t-brand-vibrant rounded-full animate-spin mb-3" />
            <p className="font-bold text-sm text-base-content/40">Loading meetups…</p>
          </div>
        ) : meetups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-base-100 rounded-xl border border-base-300/60 p-10 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-5 bg-base-200 rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-base-content/30" />
            </div>
            <h3 className="text-lg font-black text-base-content mb-2">No meetups yet</h3>
            <p className="text-base-content/60 font-medium text-sm mb-6 max-w-sm mx-auto">
              {filterDestination
                ? `No meetups found in ${filterDestination}.`
                : 'Be the first to organise a group meetup!'}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/20 hover:bg-emerald-600 transition-colors"
            >
              <Plus size={16} /> Create the first meetup
            </button>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetups.map((meetup, i) => (
              <motion.div
                key={meetup.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <MeetupCard
                  meetup={meetup}
                  onRSVP={handleRSVP}
                  rsvpLoading={rsvpLoading}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
};

export default Meetups;
