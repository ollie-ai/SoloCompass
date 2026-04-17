import { useState } from 'react';
import { ArrowRight, Copy, Check, Volume2, RefreshCw, Globe, Send } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'hi', name: 'Hindi' }
];

const QUICK_PHRASES = [
  'Where is the bathroom?',
  'How much does this cost?',
  'Can you help me?',
  'I need a doctor',
  'I am lost',
  'Thank you',
  'Excuse me',
  'No thank you'
];

export default function TranslationTool() {
  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);

  const handleTranslate = async (inputText = text) => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const res = await api.post('/translate', { text: inputText, from: sourceLang, to: targetLang });
      const result = res.data.data?.translations?.[0]?.text;
      if (result) {
        setTranslatedText(result);
        setHistory((prev) => [{ original: inputText, translated: result, source: sourceLang, target: targetLang }, ...prev.slice(0, 9)]);
      }
    } catch {
      toast.error('Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (translatedText) {
      setText(translatedText);
      setTranslatedText('');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleSpeak = (textToSpeak) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
            <Globe className="text-brand-accent" size={20} />
          </div>
          <h1 className="text-2xl font-black text-base-content">Translation Tool</h1>
        </div>
        <p className="text-base-content/60 text-sm">Translate essential phrases for your travels.</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-bold text-base-content/60 mb-1 uppercase">From</label>
          <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full p-3 bg-base-200 border border-base-300 rounded-xl text-sm font-medium">
            {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
          </select>
        </div>

        <button onClick={handleSwap} className="mt-6 p-2 bg-base-200 hover:bg-base-300 rounded-lg transition-colors" title="Swap languages">
          <ArrowRight size={18} className="rotate-180" />
        </button>

        <div className="flex-1">
          <label className="block text-xs font-bold text-base-content/60 mb-1 uppercase">To</label>
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full p-3 bg-base-200 border border-base-300 rounded-xl text-sm font-medium">
            {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-bold text-base-content/60 mb-1 uppercase">Your Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to translate..." className="w-full p-4 bg-base-200 border border-base-300 rounded-xl text-base-content placeholder:text-base-content/40 resize-none" rows={3} />
      </div>

      <button onClick={() => handleTranslate()} disabled={loading || !text.trim()} className="w-full py-3 bg-brand-vibrant text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />} Translate
      </button>

      {translatedText && (
        <div className="mt-6">
          <label className="block text-xs font-bold text-base-content/60 mb-1 uppercase">Translation</label>
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl">
            <p className="text-base-content text-lg font-medium">{translatedText}</p>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleSpeak(translatedText)} className="p-2 hover:bg-base-200 rounded-lg transition-colors" title="Speak">
                <Volume2 size={16} className="text-base-content/60" />
              </button>
              <button onClick={handleCopy} className="p-2 hover:bg-base-200 rounded-lg transition-colors" title="Copy">
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} className="text-base-content/60" />}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <label className="block text-xs font-bold text-base-content/60 mb-3 uppercase">Quick Phrases</label>
        <div className="flex flex-wrap gap-2">
          {QUICK_PHRASES.map((phrase) => (
            <button key={phrase} onClick={() => { setText(phrase); setTimeout(() => handleTranslate(phrase), 0); }} className="px-3 py-2 bg-base-200 hover:bg-base-300 rounded-lg text-sm font-medium text-base-content/80 transition-colors">
              {phrase}
            </button>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <label className="block text-xs font-bold text-base-content/60 mb-3 uppercase">Recent</label>
          <div className="space-y-2">
            {history.map((item, i) => (
              <button
                type="button"
                key={`${item.original}-${i}`}
                onClick={() => { setText(item.original); setTranslatedText(item.translated); setSourceLang(item.source); setTargetLang(item.target); }}
                className="w-full p-3 bg-base-200 hover:bg-base-300 rounded-lg cursor-pointer transition-colors text-left"
              >
                <p className="text-xs text-base-content/60">{item.original}</p>
                <p className="text-sm font-medium text-base-content">{item.translated}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
