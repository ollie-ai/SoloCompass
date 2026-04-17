import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import Button from './Button';

/**
 * ConfirmDialog — modal that asks the user to confirm a destructive or important action.
 *
 * Props:
 *   open        – boolean, whether the dialog is visible
 *   onConfirm   – () => void, called when the user confirms
 *   onCancel    – () => void, called when the user cancels
 *   title       – string, dialog heading
 *   description – string | ReactNode, explanatory text
 *   confirmLabel  – string (default "Confirm")
 *   cancelLabel   – string (default "Cancel")
 *   variant     – "danger" | "warning" | "info" (default "danger")
 *   loading     – boolean, disables buttons during async confirmation
 */
const ConfirmDialog = ({
  open = false,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) => {
  const cancelRef = useRef(null);

  // Focus cancel button when dialog opens
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && open) onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  const variantConfig = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-error/10',
      iconColor: 'text-error',
      confirmClass: 'bg-error hover:bg-red-700 text-white border-transparent shadow-lg shadow-error/20',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      confirmClass: 'bg-warning hover:bg-amber-600 text-white border-transparent shadow-lg shadow-warning/20',
    },
    info: {
      icon: AlertTriangle,
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
      confirmClass: 'bg-info hover:bg-sky-600 text-white border-transparent shadow-lg shadow-info/20',
    },
  };

  const cfg = variantConfig[variant] || variantConfig.danger;
  const IconComponent = cfg.icon;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={!loading ? onCancel : undefined}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="confirm-panel"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onCancel}
              disabled={loading}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                  <IconComponent size={22} className={cfg.iconColor} />
                </div>
                <div className="pt-1 min-w-0 pr-6">
                  <h2 id="confirm-dialog-title" className="text-lg font-black text-base-content leading-tight">
                    {title}
                  </h2>
                  {description && (
                    <p id="confirm-dialog-description" className="mt-2 text-sm text-base-content/70 leading-relaxed font-medium">
                      {description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button
                  ref={cancelRef}
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 sm:flex-none sm:min-w-[120px] rounded-xl py-3 font-bold border-base-300 text-base-content/80"
                >
                  {cancelLabel}
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={loading}
                  loading={loading}
                  className={`flex-1 sm:flex-none sm:min-w-[140px] rounded-xl py-3 font-bold ${cfg.confirmClass}`}
                >
                  {!loading && confirmLabel}
                  {loading && 'Processing…'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
