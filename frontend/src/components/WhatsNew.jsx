import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle } from 'lucide-react';
import api from '../lib/api';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const STORAGE_KEY = 'solocompass_last_seen_version';

/**
 * Compares two semver strings.
 * Returns true if `a` is strictly greater than `b`.
 */
function isNewer(a, b) {
  const parse = (v) => String(v).split('.').slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] > bv[i]) return true;
    if (av[i] < bv[i]) return false;
  }
  return false;
}

const WhatsNew = () => {
  const [show, setShow] = useState(false);
  const [changelog, setChangelog] = useState([]);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    // Only show if we have a new version the user hasn't seen yet
    if (!lastSeen || isNewer(APP_VERSION, lastSeen)) {
      fetchChangelog();
    }
  }, []);

  const fetchChangelog = async () => {
    try {
      const res = await api.get(`/v1/app/version?v=${encodeURIComponent(APP_VERSION)}`);
      if (res.data?.success) {
        const { changelog: log, updateRequired: required } = res.data.data;
        setChangelog(log || []);
        setUpdateRequired(required);
        // Show the modal if there's genuinely new content
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        const latest = log?.[0]?.version;
        if (!lastSeen || (latest && isNewer(latest, lastSeen))) {
          setShow(true);
        }
      }
    } catch {
      // Non-critical — silently skip if API unavailable
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    setShow(false);
  };

  if (!show) return null;

  const latestEntry = changelog[0];

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            key="whats-new-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={!updateRequired ? handleDismiss : undefined}
          />

          {/* Modal */}
          <motion.div
            key="whats-new-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 flex items-center justify-center z-[201] px-4 pointer-events-none"
          >
            <div className="w-full max-w-md pointer-events-auto">
              <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-base-300/50">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-primary/10 to-secondary/10 px-6 pt-8 pb-6 text-center">
                  {!updateRequired && (
                    <button
                      onClick={handleDismiss}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-content/10 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X size={18} />
                    </button>
                  )}
                  <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={28} className="text-primary" />
                  </div>
                  <h2 className="text-2xl font-black text-base-content tracking-tight mb-1">
                    {updateRequired ? 'Update Required' : "What's New"}
                  </h2>
                  {latestEntry && (
                    <p className="text-sm font-medium text-base-content/50">
                      Version {latestEntry.version}
                      {latestEntry.releasedAt && ` — ${new Date(latestEntry.releasedAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                  {updateRequired && (
                    <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-xl text-sm font-medium text-warning">
                      A new version of SoloCompass is available. Please refresh the page to continue.
                    </div>
                  )}

                  {latestEntry?.title && (
                    <p className="font-bold text-base-content mb-3">{latestEntry.title}</p>
                  )}

                  {latestEntry?.notes?.length > 0 && (
                    <ul className="space-y-2.5">
                      {latestEntry.notes.map((note, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-base-content/70">
                          <CheckCircle size={16} className="text-primary shrink-0 mt-0.5" />
                          <span className="font-medium">{note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                  {updateRequired ? (
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-3 px-5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors text-sm"
                    >
                      Refresh Now
                    </button>
                  ) : (
                    <button
                      onClick={handleDismiss}
                      className="flex-1 py-3 px-5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors text-sm"
                    >
                      Got it!
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WhatsNew;
