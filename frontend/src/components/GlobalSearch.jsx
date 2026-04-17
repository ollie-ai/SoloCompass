import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Compass, Map, Shield, BookOpen, Users, HelpCircle, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

const SCOPES = [
  { key: 'destinations', label: 'Destinations', icon: Compass, path: '/destinations' },
  { key: 'trips', label: 'Trips', icon: Map, path: '/trips' },
  { key: 'safety', label: 'Safety', icon: Shield, path: '/safety' },
  { key: 'journal', label: 'Journal', icon: BookOpen, path: '/journal' },
  { key: 'buddies', label: 'Buddies', icon: Users, path: '/buddies' },
  { key: 'help', label: 'Help', icon: HelpCircle, path: '/help' },
];

const RECENT_KEY = 'solocompass_recent_searches';
const MAX_RECENT = 8;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(query) {
  try {
    const existing = getRecentSearches().filter(q => q !== query);
    const updated = [query, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

function removeRecentSearch(query) {
  try {
    const updated = getRecentSearches().filter(q => q !== query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export default function GlobalSearch({ isOpen: isOpenProp, onClose }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const open = isOpenProp || isOpen;

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    onClose?.();
  }, [onClose]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          handleClose();
        } else {
          setIsOpen(true);
        }
      }
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Load recent searches on open — try backend first, fall back to localStorage
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Try to load from API (persisted across devices)
      api.get('/search/recent')
        .then(res => {
          const rows = res.data?.data || [];
          if (rows.length) {
            setRecentSearches(rows.map(r => r.query));
          } else {
            setRecentSearches(getRecentSearches());
          }
        })
        .catch(() => setRecentSearches(getRecentSearches()));
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/search', { params: { q: query.trim(), scope: 'all' } });
        // API returns { results: { destinations: [...], trips: [...], ... } }
        const raw = res.data?.data?.results || res.data?.results || res.data || {};
        // Normalise: if it's already a flat array keep it, otherwise flatten object
        if (Array.isArray(raw)) {
          setResults(raw);
        } else {
          const flat = Object.values(raw).flat();
          setResults(flat);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setActiveIndex(-1);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Results are now a flat array — no extra flatMap needed
  const flatResults = results;

  const handleSelect = (item) => {
    addRecentSearch(query || item.title || item.name || '');
    setRecentSearches(getRecentSearches());
    navigate(item.url || item.path || '/');
    handleClose();
  };

  const handleRecentSelect = (q) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (e, q) => {
    e.stopPropagation();
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
      handleSelect(flatResults[activeIndex]);
    }
  };

  const getScopeIcon = (scopeKey) => {
    const scope = SCOPES.find(s => s.key === scopeKey);
    return scope?.icon || Search;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-2xl bg-base-100 rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300/50">
            <Search size={18} className="text-base-content/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent outline-none text-base-content placeholder:text-base-content/30 text-base font-medium"
              placeholder="Search destinations, trips, journal…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }} className="text-base-content/40 hover:text-base-content transition-colors">
                <X size={16} />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-base-200 text-base-content/40 text-xs font-mono">
              ESC
            </kbd>
          </div>

          {/* Scope pills */}
          <div className="flex gap-2 px-4 py-2.5 border-b border-base-300/50 overflow-x-auto scrollbar-none">
            {SCOPES.map(scope => {
              const Icon = scope.icon;
              return (
                <button
                  key={scope.key}
                  onClick={() => { navigate(scope.path); handleClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200 hover:bg-primary/10 hover:text-primary text-xs font-bold text-base-content/60 transition-colors shrink-0"
                >
                  <Icon size={12} />
                  {scope.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-10 gap-3 text-base-content/50">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm font-medium">Searching…</span>
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="py-10 text-center text-base-content/40">
                <Search size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {!loading && query && results.length > 0 && (
              <div className="py-2">
                {results.map((group) => {
                  const Icon = getScopeIcon(group.scope);
                  return (
                    <div key={group.scope}>
                      <div className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-base-content/30">
                        <Icon size={11} />
                        {group.scope}
                      </div>
                      {(group.items || []).map((item, idx) => {
                        const globalIdx = flatResults.findIndex(r => r === item || (r.id && r.id === item.id && r._scope === group.scope));
                        const isActive = globalIdx === activeIndex;
                        return (
                          <button
                            key={item.id || idx}
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'}`}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{item.title || item.name}</p>
                              {item.description && (
                                <p className="text-xs text-base-content/50 truncate mt-0.5">{item.description}</p>
                              )}
                            </div>
                            <ArrowRight size={14} className="shrink-0 opacity-40" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {!query && recentSearches.length > 0 && (
              <div className="py-2">
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-base-content/30">
                  <Clock size={11} />
                  Recent
                </div>
                {recentSearches.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleRecentSelect(q)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-base-200 transition-colors group"
                  >
                    <span className="text-sm text-base-content/70 font-medium truncate">{q}</span>
                    <button
                      onClick={e => handleRemoveRecent(e, q)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-base-content/30 hover:text-base-content"
                      aria-label={`Remove "${q}" from recent searches`}
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {!query && recentSearches.length === 0 && (
              <div className="py-8 text-center text-base-content/30">
                <Search size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Type to search</p>
                <p className="text-xs mt-1">Destinations, trips, journal entries and more</p>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-base-300/50 text-xs text-base-content/30">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-base-200 font-mono">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-base-200 font-mono">↵</kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-base-200 font-mono">ESC</kbd> close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
