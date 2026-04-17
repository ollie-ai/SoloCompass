import { ShieldCheck, ShieldAlert, ShieldOff, TrendingUp, Users, Moon, Star } from 'lucide-react';

const SCORE_LABELS = {
  overall: { label: 'Overall Safety', icon: ShieldCheck },
  women: { label: 'Women\'s Safety', icon: Users },
  lgbtq: { label: 'LGBTQ+ Safety', icon: Star },
  night: { label: 'Nighttime Safety', icon: Moon },
  solo: { label: 'Solo Traveller', icon: TrendingUp },
};

const ScoreBar = ({ label, score, icon: Icon }) => {
  const pct = Math.round(Math.min(100, Math.max(0, (score || 0) * 10)));
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-error';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-xs font-bold text-base-content/70">
          {Icon && <Icon size={12} />} {label}
        </span>
        <span className="text-xs font-black text-base-content/80">{score?.toFixed(1) ?? '—'}/10</span>
      </div>
      <div className="h-2 rounded-full bg-base-200">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const SafetyCard = ({ destination, scores = {}, advisoryLevel, advisoryText, className = '' }) => {
  const overall = scores.overall ?? scores.overall_score ?? null;
  const overallPct = overall != null ? Math.min(100, Math.max(0, overall * 10)) : null;
  
  const getBadge = () => {
    if (overallPct == null) return { label: 'No data', color: 'bg-base-200 text-base-content/40', Icon: ShieldOff };
    if (overallPct >= 70) return { label: 'Generally Safe', color: 'bg-success/10 text-success', Icon: ShieldCheck };
    if (overallPct >= 40) return { label: 'Exercise Caution', color: 'bg-warning/10 text-warning', Icon: ShieldAlert };
    return { label: 'High Risk', color: 'bg-error/10 text-error', Icon: ShieldOff };
  };

  const { label, color, Icon } = getBadge();

  return (
    <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-black text-base-content text-base">Safety Overview</h3>
          {destination && <p className="text-xs font-medium text-base-content/50 mt-0.5">{destination}</p>}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
          <Icon size={12} /> {label}
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(SCORE_LABELS).map(([key, { label: lbl, icon: IcoCmp }]) => {
          const value = scores[key] ?? scores[`${key}_score`] ?? null;
          if (value == null) return null;
          return <ScoreBar key={key} label={lbl} score={value} icon={IcoCmp} />;
        })}
      </div>

      {advisoryLevel && (
        <div className="mt-4 pt-4 border-t border-base-300/50">
          <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">Travel Advisory</p>
          <p className="text-xs font-bold text-base-content/70">Level {advisoryLevel}: {advisoryText || ''}</p>
        </div>
      )}
    </div>
  );
};

export default SafetyCard;
