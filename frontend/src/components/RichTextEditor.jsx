/**
 * RichTextEditor — Lightweight contenteditable rich text editor.
 * No external dependencies. Provides bold, italic, underline, lists, headings.
 *
 * Props:
 *  - value {string}         HTML content (controlled)
 *  - onChange {fn}          Called with new HTML string
 *  - placeholder {string}
 *  - className {string}
 *  - minHeight {string}     Min height of editor area (default "180px")
 */
import { useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, List, Heading2, AlignLeft } from 'lucide-react';
import DOMPurify from 'dompurify';

const TOOLBAR = [
  { cmd: 'bold',        label: 'Bold',      icon: Bold },
  { cmd: 'italic',      label: 'Italic',    icon: Italic },
  { cmd: 'underline',   label: 'Underline', icon: Underline },
  { cmd: 'insertUnorderedList', label: 'Bullet list', icon: List },
  { cmd: 'formatBlock', arg: 'h3',  label: 'Heading', icon: Heading2 },
  { cmd: 'formatBlock', arg: 'p',   label: 'Paragraph', icon: AlignLeft },
];

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Write your journal entry…',
  className = '',
  minHeight = '180px',
}) => {
  const editorRef = useRef(null);
  // Track whether the current innerHTML came from a programmatic update
  const internalUpdateRef = useRef(false);

  // Sync controlled value into DOM without resetting cursor when user types
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const clean = DOMPurify.sanitize(value || '');
    if (el.innerHTML !== clean) {
      internalUpdateRef.current = true;
      el.innerHTML = clean;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const clean = DOMPurify.sanitize(el.innerHTML);
    onChange?.(clean);
  }, [onChange]);

  const exec = useCallback((cmd, arg) => {
    document.execCommand(cmd, false, arg || null);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  return (
    <div className={`rounded-xl border border-base-300 overflow-hidden focus-within:border-brand-vibrant focus-within:ring-2 focus-within:ring-brand-vibrant/20 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-base-300 bg-base-200/40">
        {TOOLBAR.map(({ cmd, arg, label, icon: Icon }) => (
          <button
            key={`${cmd}-${arg || ''}`}
            type="button"
            title={label}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd, arg); }}
            className="p-1.5 rounded hover:bg-base-300 text-base-content/60 hover:text-base-content transition-colors"
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        className="w-full px-4 py-3 text-sm text-base-content outline-none overflow-y-auto prose prose-sm max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-base-content/30"
        style={{ minHeight }}
        spellCheck
      />
    </div>
  );
};

export default RichTextEditor;
