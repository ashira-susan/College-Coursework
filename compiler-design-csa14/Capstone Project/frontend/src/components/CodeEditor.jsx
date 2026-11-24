import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { highlight } from '../highlight.js';

const LINE_HEIGHT = 22;

/**
 * A lightweight code editor: a transparent <textarea> sits on top of a
 * highlighted copy of the text. Line numbers, error lines and wavy underlines
 * under the offending token all come from the backend diagnostics.
 */
const CodeEditor = forwardRef(function CodeEditor({ value, onChange, diagnostics, onRun }, ref) {
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const gutterRef = useRef(null);

  const lines = useMemo(() => highlight(value, diagnostics), [value, diagnostics]);

  useImperativeHandle(ref, () => ({
    jumpTo(line, col) {
      const ta = textareaRef.current;
      if (!ta) return;
      const rows = value.split('\n');
      let index = 0;
      for (let i = 0; i < Math.min(line - 1, rows.length); i++) index += rows[i].length + 1;
      index += Math.max(0, Math.min(col - 1, (rows[line - 1] || '').length));
      ta.focus();
      ta.setSelectionRange(index, index);
      ta.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT);
    },
  }));

  function syncScroll(event) {
    const { scrollTop, scrollLeft } = event.target;
    if (overlayRef.current) overlayRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-scrollTop}px)`;
  }

  // execCommand keeps the browser's undo history intact; fall back to a plain state update.
  function insertText(textarea, text) {
    textarea.focus();
    if (document.execCommand && document.execCommand('insertText', false, text)) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
  }

  function onKeyDown(event) {
    const ta = event.target;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onRun();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      insertText(ta, '    ');
    } else if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const start = ta.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const before = value.slice(lineStart, start);
      const indent = before.match(/^[ \t]*/)[0] + (/\{\s*$/.test(before) ? '    ' : '');
      insertText(ta, '\n' + indent);
    }
  }

  return (
    <div className="editor">
      <div className="gutter" aria-hidden="true">
        <div className="gutter-inner" ref={gutterRef}>
          {lines.map((line, i) => (
            <div key={i} className={`ln ${line.severity ? `ln-${line.severity}` : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="code-area">
        <div className="overlay" aria-hidden="true">
          <div className="overlay-inner" ref={overlayRef}>
            {lines.map((line, i) => (
              <div key={i} className={`row ${line.severity ? `row-${line.severity}` : ''}`}>
                {line.parts.map((part, j) => (
                  <span
                    key={j}
                    className={`${part.cls} ${part.severity ? `squiggle-${part.severity}` : ''}`}
                  >
                    {part.text}
                  </span>
                ))}
                {'\u200b'}
              </div>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-label="Source code editor"
        />
      </div>
    </div>
  );
});

export default CodeEditor;
