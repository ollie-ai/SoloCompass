import { useEffect, useState } from 'react';
import { Globe, Languages } from 'lucide-react';
import api from '../lib/api';
import SEO from '../components/SEO';
import PhraseList from '../components/PhraseList';

const PHRASE_KEYS = [
  { key: 'hello', label: 'Hello' },
  { key: 'please', label: 'Please' },
  { key: 'thank_you', label: 'Thank you' },
  { key: 'help', label: 'Help' },
  { key: 'where_is', label: 'Where is...' },
  { key: 'how_much', label: 'How much?' },
  { key: 'emergency', label: 'Emergency' },
];

export default function Phrasebook() {
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [phrases, setPhrases] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    api.get('/emergency/phrases').then((res) => {
      if (res.data?.success) setLanguages(res.data.data.languages || []);
    }).catch(() => {});
  }, []);

  const loadPhrases = async (languageCode) => {
    try {
      const res = await api.get(`/emergency/phrases?language=${languageCode}`);
      if (res.data?.success) {
        const rawPhrases = res.data.data.phrases || {};
        const normalized = Object.entries(rawPhrases).reduce((acc, [key, value]) => {
          acc[String(key).trim().toLowerCase().replace(/\s+/g, '_')] = value;
          return acc;
        }, {});
        setPhrases(normalized);
      }
    } catch {
      setPhrases({});
    }
  };

  const handleSelectLanguage = (lang) => {
    setSelectedLanguage(lang);
    loadPhrases(lang.code);
  };

  const handleCopy = async (key, text) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSpeak = (text) => {
    if (text && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const rows = PHRASE_KEYS.map(({ key, label }) => ({ key, label, text: phrases?.[key] || '...' }));

  return (
    <div className="min-h-screen bg-base-100 pt-20 pb-12">
      <SEO title="Phrasebook - SoloCompass" description="General phrasebook tool with quick multilingual travel phrases and optional pronunciation." />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-vibrant/10 rounded-xl flex items-center justify-center"><Languages className="text-brand-vibrant" size={20} /></div>
            <h1 className="text-2xl font-black text-base-content">Phrasebook</h1>
          </div>
          <p className="text-base-content/60 text-sm">Quick everyday phrases for your trip.</p>
        </div>

        {!selectedLanguage ? (
          <div>
            <h2 className="text-sm font-bold text-base-content/80 mb-3 uppercase tracking-wide">Choose Language</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {languages.map((lang) => (
                <button key={lang.code} onClick={() => handleSelectLanguage(lang)} className="p-4 bg-base-200 hover:bg-base-300 rounded-xl transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-brand-vibrant" />
                    <span className="font-bold text-base-content text-sm">{lang.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setSelectedLanguage(null)} className="text-sm font-medium text-brand-vibrant hover:underline">Change language ({selectedLanguage.name})</button>
            <PhraseList phrases={rows} copiedKey={copiedKey} onCopy={handleCopy} onSpeak={handleSpeak} />
          </div>
        )}
      </div>
    </div>
  );
}
