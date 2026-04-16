import { useState } from 'react';
import { Shield, Sun, Moon, MapPin, Flag, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const SAFETY_COLORS = {
  safe: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', dot: 'bg-success' },
  moderate: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', dot: 'bg-warning' },
  caution: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-600', dot: 'bg-orange-500' },
  avoid: { bg: 'bg-error/10', border: 'border-error/30', text: 'text-error', dot: 'bg-error' }
};

const SAFETY_LABELS = {
  safe: 'Safe',
  moderate: 'Generally Safe',
  caution: 'Use Caution',
  avoid: 'Avoid'
};

export default function AreaSafetyDetail({ area, isNight, onClose }) {
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [voted, setVoted] = useState(null); // 'up' | 'down' | null
  const [voting, setVoting] = useState(false);

  if (!area) return null;

  const level = (isNight ? area.night_safety : area.day_safety) || area.safety_level || 'moderate';
  const colors = SAFETY_COLORS[level] || SAFETY_COLORS.moderate;

  const handleVote = async (vote) => {
    if (voted === vote) return;
    setVoting(true);
    try {
      await api.post(`/safety-areas/reports/${area.id}/validate`, { vote });
      setVotes(prev => ({
        up: prev.up + (vote === 'up' ? 1 : voted === 'up' ? -1 : 0),
        down: prev.down + (vote === 'down' ? 1 : voted === 'down' ? -1 : 0)
      }));
      setVoted(vote);
      toast.success(vote === 'up' ? 'Thanks for validating this area' : 'Feedback noted');
    } catch {
      toast.error('Could not submit feedback');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className={`rounded-2xl border ${colors.bg} ${colors.border} p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full shrink-0 ${colors.dot}`} />
          <h4 className="font-black text-base-content text-sm">{area.name}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${colors.text} border ${colors.border}`}>
            {SAFETY_LABELS[level] || level}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-base-content/40 hover:text-base-content/70">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Day/night comparison */}
      <div className="flex gap-3 mb-3">
        {area.day_safety && (
          <div className="flex items-center gap-1.5 text-xs">
            <Sun size={12} className="text-warning" />
            <span className={`${SAFETY_COLORS[area.day_safety]?.text || 'text-base-content/70'} font-bold`}>
              {SAFETY_LABELS[area.day_safety] || area.day_safety}
            </span>
            <span className="text-base-content/40">day</span>
          </div>
        )}
        {area.night_safety && (
          <div className="flex items-center gap-1.5 text-xs">
            <Moon size={12} className="text-info" />
            <span className={`${SAFETY_COLORS[area.night_safety]?.text || 'text-base-content/70'} font-bold`}>
              {SAFETY_LABELS[area.night_safety] || area.night_safety}
            </span>
            <span className="text-base-content/40">night</span>
          </div>
        )}
      </div>

      {area.description && (
        <p className="text-xs text-base-content/75 mb-2 leading-relaxed">{area.description}</p>
      )}

      {area.notes && (
        <p className="text-[11px] text-base-content/55 italic mb-3 border-l-2 border-base-300/60 pl-2">{area.notes}</p>
      )}

      {area.source && (
        <p className="text-[10px] text-base-content/40 mb-3 flex items-center gap-1">
          <Flag size={9} /> Source: {area.source}
        </p>
      )}

      {/* Community validation */}
      <div className="border-t border-base-300/40 pt-3">
        <p className="text-[10px] text-base-content/50 mb-2 font-bold uppercase tracking-wide">Is this information accurate?</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleVote('up')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              voted === 'up'
                ? 'bg-success text-white border-success'
                : 'border-base-300 text-base-content/70 hover:border-success hover:text-success'
            } disabled:opacity-50`}
          >
            <ThumbsUp size={12} />
            Yes {(area.validated_count || 0) + votes.up > 0 && `(${(area.validated_count || 0) + votes.up})`}
          </button>
          <button
            onClick={() => handleVote('down')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              voted === 'down'
                ? 'bg-error text-white border-error'
                : 'border-base-300 text-base-content/70 hover:border-error hover:text-error'
            } disabled:opacity-50`}
          >
            <ThumbsDown size={12} />
            No
          </button>
        </div>
      </div>
    </div>
  );
}
