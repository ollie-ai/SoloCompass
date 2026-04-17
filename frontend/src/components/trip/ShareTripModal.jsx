import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Share2, Copy, Check, X, Loader2, Link as LinkIcon, Globe, Lock } from 'lucide-react';
import api from '../../lib/api';
import { getErrorMessage } from '../../lib/utils';

export default function ShareTripModal({ tripId, tripName, onClose }) {
  const [shareUrl, setShareUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/trips/${tripId}/share`);
      const code = res.data?.data?.shareUrl;
      const fullUrl = `${window.location.origin}${code}`;
      setShareUrl(fullUrl);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 size={20} className="text-brand-vibrant" />
              <h2 className="text-lg font-black">Share Trip</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-200 transition-colors">
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-base-content/60 mb-4">
            Share <span className="font-bold text-base-content">{tripName}</span> with a public link.
            Anyone with the link can view the itinerary.
          </p>

          {!shareUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-base-200 rounded-xl">
                <Globe size={18} className="text-brand-vibrant shrink-0" />
                <div className="text-sm">
                  <p className="font-bold text-base-content">Public view only</p>
                  <p className="text-base-content/50 text-xs">Recipients can view your itinerary but cannot edit</p>
                </div>
              </div>

              <button
                onClick={generateLink}
                disabled={generating}
                className="btn btn-primary w-full gap-2"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                Generate Share Link
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-base-200 rounded-xl">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm font-mono text-base-content/70 outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`btn btn-sm gap-1.5 shrink-0 ${copied ? 'btn-success' : 'btn-ghost'}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-xs text-base-content/40 text-center">
                Link expires in 7 days
              </p>

              <button
                onClick={generateLink}
                disabled={generating}
                className="btn btn-ghost btn-sm w-full text-xs"
              >
                Generate New Link
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
