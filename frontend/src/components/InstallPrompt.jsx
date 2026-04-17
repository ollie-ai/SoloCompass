import { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISS_KEY = 'sc_install_dismissed_until';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400_000));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-80"
        >
          <div className="card bg-base-100 border border-base-200 shadow-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-vibrant/10 flex items-center justify-center shrink-0">
                <Smartphone size={18} className="text-brand-vibrant" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content">Add SoloCompass</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Install for faster access and offline features.
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleInstall} className="btn btn-xs btn-primary">
                    Install
                  </button>
                  <button onClick={handleDismiss} className="btn btn-xs btn-ghost">
                    Not now
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="btn btn-ghost btn-xs btn-square shrink-0"
                aria-label="Dismiss install prompt"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
