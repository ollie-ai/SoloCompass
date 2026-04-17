import { Copy, Check, Volume2 } from 'lucide-react';

export default function PhraseList({ phrases = [], copiedKey, onCopy, onSpeak }) {
  return (
    <div className="space-y-3">
      {phrases.map(({ key, label, text }) => (
        <div key={key} className="p-4 bg-base-200 rounded-xl border border-base-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-base-content font-medium text-lg">{text || '...'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onSpeak?.(text)} className="p-2 hover:bg-base-300 rounded-lg transition-colors" title="Speak">
                <Volume2 size={16} className="text-base-content/60" />
              </button>
              <button onClick={() => onCopy?.(key, text)} className="p-2 hover:bg-base-300 rounded-lg transition-colors" title="Copy">
                {copiedKey === key ? <Check size={16} className="text-success" /> : <Copy size={16} className="text-base-content/60" />}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
