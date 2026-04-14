import { useState } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Volume2, ChevronRight } from 'lucide-react';

/**
 * PhraseList — renders a categorised list of translated phrases.
 *
 * Each phrase row shows the translated text with copy-to-clipboard and
 * optional text-to-speech buttons.
 *
 * @example
 * <PhraseList phrases={phrases} language="Japanese" />
 */
const PhraseList = ({ phrases = {}, language = '', className = '' }) => {
  const [copied, setCopied]   = useState(null);
  const [playing, setPlaying] = useState(null);

  const handleCopy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* browser may deny clipboard access */ }
  };

  const handleSpeak = (key, text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (playing === key) {
      setPlaying(null);
      return;
    }
    const utt = new SpeechSynthesisUtterance(text);
    utt.onend   = () => setPlaying(null);
    utt.onerror = () => setPlaying(null);
    setPlaying(key);
    window.speechSynthesis.speak(utt);
  };

  const categories = Object.keys(phrases);
  if (!categories.length) {
    return (
      <p className="text-sm text-base-content/50 italic py-4 text-center">
        No phrases available for this language yet.
      </p>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {categories.map((category) => {
        const entries = Object.entries(phrases[category] || {});
        if (!entries.length) return null;
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight size={14} className="text-primary" aria-hidden="true" />
              <h3 className="text-xs uppercase tracking-widest font-black text-base-content/50">
                {category}
              </h3>
            </div>
            <ul className="space-y-2" aria-label={`${category} phrases`}>
              {entries.map(([key, phrase]) => (
                <li
                  key={key}
                  className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-base-100 border border-base-200 hover:border-primary/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-base-content truncate">{phrase}</p>
                    <p className="text-xs text-base-content/40 truncate">{key.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {'speechSynthesis' in window && (
                      <button
                        type="button"
                        onClick={() => handleSpeak(key, phrase)}
                        className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/50 hover:text-primary transition-colors"
                        aria-label={playing === key ? 'Stop speaking' : `Speak phrase in ${language}`}
                        title="Speak"
                      >
                        <Volume2
                          size={14}
                          className={playing === key ? 'text-primary' : ''}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(key, phrase)}
                      className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/50 hover:text-primary transition-colors"
                      aria-label={copied === key ? 'Copied!' : 'Copy phrase'}
                      title="Copy"
                    >
                      {copied === key ? (
                        <Check size={14} className="text-success" aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

PhraseList.propTypes = {
  /**
   * Nested object: { categoryName: { phraseKey: translatedText } }
   */
  phrases:   PropTypes.objectOf(PropTypes.objectOf(PropTypes.string)),
  language:  PropTypes.string,
  className: PropTypes.string,
};

export default PhraseList;
