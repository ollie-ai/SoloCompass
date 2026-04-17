import { Smile } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * AtlasTypingIndicator — animated three-dot "Atlas is typing" bubble.
 */
export default function AtlasTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-start"
    >
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-base-300 border border-base-300 flex items-center justify-center">
          <Smile size={14} className="text-base-content/80" />
        </div>
        <div className="bg-base-100 border border-base-300 p-3 rounded-2xl rounded-bl-md shadow-sm flex gap-1">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        </div>
      </div>
    </motion.div>
  );
}
