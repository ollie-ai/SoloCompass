import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle, Loader2, MapPin, Calendar, Send, Shield, UserMinus, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SAFETY_TIPS = [
  'Always meet in public places first.',
  'Share your plans with a trusted friend or family member.',
  'Trust your instincts — it\'s okay to say no.',
  'Keep initial contact on the SoloCompass platform.',
  'Your personal contact info is never shared automatically.',
];

const SAFETY_ACKNOWLEDGED_KEY = 'solo_buddy_safety_ack';

const SafetyGuidelinesStep = ({ onAgree, onCancel }) => (
  <div className="space-y-4">
    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-brand-vibrant/5 to-emerald-500/5 rounded-xl border border-brand-vibrant/10">
      <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 flex items-center justify-center shrink-0">
        <Shield size={18} className="text-brand-vibrant" />
      </div>
      <div>
        <h4 className="font-black text-base-content text-sm mb-0.5">Safety-first guidelines</h4>
        <p className="text-xs text-base-content/60">Please review before connecting with fellow solo travelers.</p>
      </div>
    </div>

    <ul className="space-y-2.5">
      {SAFETY_TIPS.map((tip) => (
        <li key={tip} className="flex items-start gap-2.5 text-sm text-base-content/70">
          <CheckCircle size={14} className="text-brand-vibrant mt-0.5 shrink-0" />
          {tip}
        </li>
      ))}
    </ul>

    <div className="flex gap-2 pt-2">
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-2 border border-base-300 text-base-content/80 rounded-xl font-medium hover:bg-base-200 transition-colors text-sm"
      >
        Cancel
      </button>
      <button
        onClick={onAgree}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-vibrant text-white rounded-xl font-medium hover:bg-brand-vibrant/90 transition-colors text-sm"
      >
        <Check size={14} /> I understand, continue
      </button>
    </div>
  </div>
);

const BuddyRequest = ({ buddy, onSuccess, onCancel, isRequestList = false, request = null }) => {
  const alreadyAcknowledged = () => {
    try {
      return localStorage.getItem(SAFETY_ACKNOWLEDGED_KEY) === '1';
    } catch {
      return false;
    }
  };

  const [step, setStep] = useState(isRequestList ? 'form' : (alreadyAcknowledged() ? 'form' : 'safety'));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const handleSafetyAgree = () => {
    try { localStorage.setItem(SAFETY_ACKNOWLEDGED_KEY, '1'); } catch {}
    setStep('form');
  };

  const handleSend = async () => {
    if (isRequestList) {
      onCancel?.();
      return;
    }

    try {
      setSending(true);
      await api.post('/matching/buddies', {
        tripId: buddy.trip_id,
        message: message.trim() || undefined
      });
      toast.success('Connection request sent!');
      onSuccess?.();
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Failed to send request';
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  const fetchRequests = async (type) => {
    try {
      setLoadingRequests(true);
      const response = await api.get(`/matching/requests?type=${type}`);
      setRequests(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleResponse = async (requestId, action) => {
    try {
      await api.put(`/matching/requests/${requestId}`, { action });
      toast.success(action === 'accept' ? 'Request accepted!' : 'Request declined');
      setRequests((prev) => (prev || []).filter(r => r.id !== requestId));
    } catch (error) {
      toast.error('Failed to update request');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isRequestList) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-base-300 pb-2">
          <button
            onClick={() => fetchRequests('received')}
            className="px-4 py-2 text-sm font-medium text-brand-vibrant border-b-2 border-brand-vibrant"
          >
            Received
          </button>
          <button
            onClick={() => fetchRequests('sent')}
            className="px-4 py-2 text-sm font-medium text-base-content/60 hover:text-brand-vibrant"
          >
            Sent
          </button>
        </div>

        {loadingRequests ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-vibrant" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-base-content/60 font-medium mb-1">No connection requests</p>
            <p className="text-base-content/40 text-sm">When other solo travelers want to connect, their requests will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="p-4 bg-base-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-vibrant to-brand-deep flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(req.senderFirstName)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content">{req.senderFirstName}</p>
                    <p className="text-sm text-base-content/60 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {req.trip_destination}
                    </p>
                    {req.message && (
                      <p className="text-sm text-base-content/80 mt-2 italic">"{req.message}"</p>
                    )}
                  </div>
                </div>

                {request?.receiver_id === req.receiver_id && req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleResponse(req.id, 'accept')}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                    >
                      <Check className="w-4 h-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleResponse(req.id, 'decline')}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-base-300 text-base-content/80 rounded-lg text-sm font-medium hover:bg-base-300"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                )}

                {req.status === 'accepted' && (
                  <div className="mt-2 flex items-center gap-1 text-green-600 text-sm">
                    <Check className="w-4 h-4" />
                    Connected
                  </div>
                )}

                {req.status === 'declined' && (
                  <div className="mt-2 flex items-center gap-1 text-base-content/60 text-sm">
                    <X className="w-4 h-4" />
                    Declined
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step === 'safety' && (
        <SafetyGuidelinesStep onAgree={handleSafetyAgree} onCancel={onCancel} />
      )}
      {step === 'form' && (<>
      <div className="flex items-center gap-3 p-4 bg-base-200 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-vibrant to-brand-deep flex items-center justify-center text-white font-bold">
          {getInitials(buddy?.firstName)}
        </div>
        <div>
          <p className="font-medium text-base-content">{buddy?.firstName}</p>
          <p className="text-sm text-base-content/60 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {buddy?.destination}
          </p>
          {buddy?.start_date && buddy?.end_date && (
            <p className="text-sm text-base-content/60 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(buddy.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(buddy.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">
          Add a message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hi! I'm also planning a trip there. Would love to connect!"
          maxLength={500}
          rows={3}
          className="w-full px-4 py-3 border border-base-300 rounded-xl focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none resize-none"
        />
        <p className="text-xs text-base-content/40 mt-1 text-right">{message.length}/500</p>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
        <p className="text-sm text-warning">
          <strong>Privacy first:</strong> Your contact info won't be shared until both parties agree to connect.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-base-300 text-base-content/80 rounded-xl font-medium hover:bg-base-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-vibrant text-white rounded-xl font-medium hover:bg-brand-vibrant/90 transition-colors disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send Request
        </button>
      </div>
      </>)}
    </div>
  );
};

export default BuddyRequest;
