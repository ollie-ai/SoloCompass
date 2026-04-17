import { Download } from 'lucide-react';

export default function DataExport({ exporting, onExport }) {
  return (
    <button
      onClick={onExport}
      disabled={exporting}
      className="inline-flex items-center gap-2 bg-brand-vibrant text-white shadow-md shadow-brand-vibrant/25 hover:bg-green-600 disabled:opacity-50 rounded-xl font-bold px-5 py-2.5 text-sm transition-all"
    >
      <Download size={14} />
      {exporting ? 'Generating archive...' : 'Download my data archive'}
    </button>
  );
}
