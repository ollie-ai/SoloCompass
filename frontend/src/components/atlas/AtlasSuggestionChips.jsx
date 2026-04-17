import { motion } from 'framer-motion';

/**
 * AtlasSuggestionChips — scrollable row of quick-prompt suggestion chips.
 *
 * Props:
 *  prompts  — Array<{ label: string, icon: LucideIcon }>
 *  loading  — boolean  (shows skeleton placeholders while loading)
 *  onSelect — (label: string) => void
 */
export default function AtlasSuggestionChips({ prompts = [], loading = false, onSelect }) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={`skeleton-prompt-${i}`}
            className="px-3 py-2 rounded-xl bg-base-200 animate-pulse h-8 w-20 flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {prompts.slice(0, 4).map((p, i) => {
        const Icon = p.icon;
        return (
          <motion.button
            key={`chip-${i}`}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect?.(p.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-200 hover:bg-brand-vibrant/10 hover:text-brand-vibrant text-base-content/80 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border border-base-300/50 flex-shrink-0"
          >
            {Icon && <Icon size={12} aria-hidden="true" />}
            {p.label}
          </motion.button>
        );
      })}
    </div>
  );
}
