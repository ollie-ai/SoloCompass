import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function UpgradePrompt({ title = 'Upgrade required', description = 'This feature is available on paid plans.' }) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-amber-400/20 flex items-center justify-center">
          <Lock size={16} className="text-amber-500" />
        </div>
        <h3 className="font-black text-base-content">{title}</h3>
      </div>
      <p className="text-sm text-base-content/70 mb-4">{description}</p>
      <Link to="/pricing" className="inline-flex px-4 py-2 rounded-lg bg-brand-vibrant text-white font-bold text-sm">
        View plans
      </Link>
    </div>
  );
}
