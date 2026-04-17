import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * AtlasChatBubble — fixed floating trigger button that opens the Atlas chat panel.
 *
 * Props:
 *  bottomOffset  — Tailwind class string for bottom positioning
 *  horizontalPos — Tailwind class string for horizontal positioning
 *  onClick       — () => void
 */
export default function AtlasChatBubble({ bottomOffset = 'bottom-6', horizontalPos = 'right-6', onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`fixed ${bottomOffset} ${horizontalPos} z-[90] w-12 h-12 lg:w-14 lg:h-14 bg-brand-vibrant text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-brand-vibrant/40 transition-all group`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Open Atlas chat"
    >
      <Sparkles size={20} className="group-hover:rotate-12 transition-transform" aria-hidden="true" />
    </motion.button>
  );
}
