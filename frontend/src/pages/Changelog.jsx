import { useState, useEffect } from 'react';
import { Zap, Bug, Shield, Rocket, Wrench, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import SEO from '../components/SEO';
import Skeleton from '../components/Skeleton';

const TYPE_CONFIG = {
  feature:     { label: 'New Feature',   color: 'bg-emerald-100 text-emerald-700', Icon: Rocket },
  improvement: { label: 'Improvement',   color: 'bg-sky-100 text-sky-700',         Icon: Zap },
  fix:         { label: 'Bug Fix',       color: 'bg-amber-100 text-amber-700',     Icon: Bug },
  security:    { label: 'Security',      color: 'bg-red-100 text-red-700',         Icon: Shield },
  breaking:    { label: 'Breaking Change', color: 'bg-rose-100 text-rose-700',     Icon: AlertTriangle },
};

const DEFAULT_ENTRIES = [
  { id: 1, version: '2.0.0', title: 'Emergency support priority lane', description: 'SOS tickets are now automatically fast-tracked to urgent status with a 15-minute SLA target. Emergency keywords in ticket subjects and messages trigger automatic escalation.', type: 'feature', published_at: new Date().toISOString() },
  { id: 2, version: '1.9.0', title: 'GDPR consent management', description: 'Detailed consent tracking for data processing and cookie preferences. Consent history is stored per-user with full audit trail.', type: 'feature', published_at: new Date(Date.now() - 7 * 86400000).toISOString() },
  { id: 3, version: '1.8.0', title: 'Destination content blocks', description: 'AI-generated safety briefs, solo suitability scores, arrival checklists, and neighbourhood guidance for hundreds of destinations worldwide.', type: 'feature', published_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: 4, version: '1.7.0', title: 'Admin session security hardening', description: 'Added IP allowlist support and enforced 2FA flag for admin accounts. Rate limiting added to sensitive GDPR endpoints.', type: 'security', published_at: new Date(Date.now() - 45 * 86400000).toISOString() },
  { id: 5, version: '1.6.0', title: 'Plan-based feature gating', description: 'Backend enforcement of feature access by subscription tier. Data export and account deletion now correctly gate-checked against the user\'s plan.', type: 'improvement', published_at: new Date(Date.now() - 60 * 86400000).toISOString() },
];

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function Changelog() {
  const [entries, setEntries] = useState(DEFAULT_ENTRIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const res = await api.get('/help/changelog');
        const raw = res.data?.data?.entries;
        if (Array.isArray(raw) && raw.length > 0) {
          setEntries(raw);
        }
      } catch {
        // Fall back to defaults
      } finally {
        setLoading(false);
      }
    };
    fetchChangelog();
  }, []);

  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO
        title="Changelog — What's New in SoloCompass"
        description="Stay up to date with the latest features, improvements, and fixes in SoloCompass."
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-brand-vibrant/10 text-brand-vibrant text-sm font-bold rounded-full mb-5">
            Updates
          </span>
          <h1 className="text-4xl font-black text-base-content mb-3">Changelog</h1>
          <p className="text-base-content/60">
            New features, improvements, and fixes — shipped regularly.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-6" aria-busy="true">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : (
          <ol className="relative border-l border-base-300/50 space-y-8 pl-6" aria-label="Changelog">
            {entries.map((entry) => {
              const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.feature;
              const { Icon } = cfg;
              return (
                <li key={entry.id} className="relative">
                  {/* Timeline dot */}
                  <span
                    className="absolute -left-[1.625rem] w-5 h-5 rounded-full bg-base-100 border-2 border-base-300 flex items-center justify-center text-base-content/40"
                    aria-hidden="true"
                  >
                    <Icon size={10} />
                  </span>

                  <article className="bg-base-100 rounded-2xl border border-base-300/50 shadow-sm p-5">
                    <header className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black bg-base-200 px-2 py-0.5 rounded-full text-base-content/60">
                          v{entry.version}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <time
                        dateTime={entry.published_at}
                        className="text-xs text-base-content/40 shrink-0"
                      >
                        {formatDate(entry.published_at)}
                      </time>
                    </header>

                    <h2 className="text-base font-black text-base-content mb-1">{entry.title}</h2>
                    {entry.description && (
                      <p className="text-sm text-base-content/70 leading-relaxed">{entry.description}</p>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
