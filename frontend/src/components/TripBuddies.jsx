import { useState, useEffect } from 'react';
import { Users, MapPin, Calendar, Loader2, UserPlus, X, Shield } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Button from './Button';
import BuddyRequest from './BuddyRequest';
import ConfirmDialog from './ConfirmDialog';

const TripBuddies = ({ hubMode = false }) => {
  const [buddies, setBuddies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTarget, setRequestTarget] = useState(null);
  const [filterDestination, setFilterDestination] = useState('');
  const [confirmBlockId, setConfirmBlockId] = useState(null);

  useEffect(() => {
    fetchBuddies();
  }, []);

  const fetchBuddies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDestination) params.append('destination', filterDestination);
      
      const response = await api.get(`/matching/trips?${params}`);
      setBuddies(response.data.data || []);
    } catch (error) {
      console.error('Fetch buddies error:', error);
      toast.error('Failed to load travel buddies');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = (buddy) => {
    setRequestTarget(buddy);
    setShowRequestModal(true);
  };

  const handleBlockUser = (buddyId) => {
    setConfirmBlockId(buddyId);
  };

  const executeBlockUser = async () => {
    const buddyId = confirmBlockId;
    setConfirmBlockId(null);
    try {
      await api.post('/matching/blocks', { userId: buddyId, reason: 'Blocked by user' });
      toast.success('User blocked');
      setBuddies((prev) => (prev || []).filter(b => b.user_id !== buddyId));
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleRequestSent = () => {
    setShowRequestModal(false);
    setRequestTarget(null);
    fetchBuddies();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return 'Dates not set';
    const options = { month: 'short', day: 'numeric' };
    const startDate = start ? new Date(start).toLocaleDateString('en-US', options) : '?';
    const endDate = end ? new Date(end).toLocaleDateString('en-US', options) : '?';
    return `${startDate} - ${endDate}`;
  };

  const experienceLevel = (level) => {
    const levels = { beginner: 'Newbie', intermediate: 'Experienced', expert: 'Expert' };
    return levels[level] || 'Solo Traveler';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-vibrant" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmBlockId !== null}
        onConfirm={executeBlockUser}
        onCancel={() => setConfirmBlockId(null)}
        title="Block This User?"
        description="This user will be blocked and will no longer be able to see your trips or send you buddy requests."
        confirmLabel="Block User"
        variant="danger"
      />
      {!hubMode && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-base-content flex items-center gap-2">
                <Users className="w-6 h-6 text-brand-vibrant" />
                Travel Buddies
              </h2>
              <p className="text-base-content/60 mt-1 font-medium">Find solo travelers heading to the same destinations</p>
            </div>
          </div>

          <div className="flex gap-4 items-center glass-card p-2 rounded-xl border border-base-300/50 shadow-sm">
            <input
              type="text"
              placeholder="Find travelers in..."
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchBuddies()}
              className="flex-1 px-5 py-3 rounded-xl border border-transparent focus:ring-0 outline-none font-medium text-base-content bg-base-200/50"
            />
            <Button
              onClick={fetchBuddies}
              variant="primary"
              className="rounded-xl px-8 py-3 font-black shadow-lg shadow-brand-vibrant/20"
            >
              Search
            </Button>
          </div>
        </>
      )}

      {hubMode && buddies.length > 0 && (
        <div className="flex items-center justify-between mb-8 px-2">
           <p className="text-base-content/40 font-bold uppercase tracking-widest text-xs">
             Showing {buddies.length} Potential Matches
           </p>
        </div>
      )}

      {buddies.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-base-content/80">No travelers found</h3>
          <p className="text-base-content/60 mt-1">Try adjusting your filters or create a trip</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buddies.map((buddy) => (
            <div
              key={buddy.id}
              className="glass-card p-5 rounded-xl hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-vibrant to-brand-deep flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {buddy.avatar_url ? (
                    <img src={buddy.avatar_url} alt={`${buddy.firstName}'s profile photo`} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(buddy.firstName)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base-content truncate">{buddy.firstName}</h3>
                  {buddy.travel_style && (
                    <p className="text-sm text-base-content/60 capitalize">{experienceLevel(buddy.solo_travel_experience)}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-base-content/80">
                  <MapPin className="w-4 h-4 text-brand-vibrant flex-shrink-0" />
                  <span className="truncate">{buddy.destination}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-base-content/80">
                  <Calendar className="w-4 h-4 text-brand-vibrant flex-shrink-0" />
                  <span>{formatDateRange(buddy.start_date, buddy.end_date)}</span>
                </div>
              </div>

              {buddy.interests && buddy.interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {buddy.interests.slice(0, 3).map((interest, idx) => (
                    <span key={idx} className="px-2 py-1 bg-base-200 text-base-content/80 text-xs rounded-full">
                      {interest}
                    </span>
                  ))}
                  {buddy.interests.length > 3 && (
                    <span className="px-2 py-1 text-base-content/40 text-xs">+{buddy.interests.length - 3}</span>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-base-300/50 flex gap-2">
                <button
                  onClick={() => handleSendRequest(buddy)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand-vibrant text-white rounded-xl font-medium hover:bg-brand-vibrant/90 transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Connect
                </button>
                <button
                  onClick={() => handleBlockUser(buddy.user_id)}
                  className="p-2 text-base-content/40 hover:text-error transition-colors"
                  title="Block user"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRequestModal && requestTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-base-content">Connect with {requestTarget.firstName}</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-1 hover:bg-base-200 rounded-lg"
              >
                <X className="w-5 h-5 text-base-content/60" />
              </button>
            </div>
            <BuddyRequest
              buddy={requestTarget}
              onSuccess={handleRequestSent}
              onCancel={() => setShowRequestModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TripBuddies;
