// Client-side highlighter for the editor overlay. It mirrors the lexer rules in
// backend/compiler/lexer.l closely enough for colouring; the real analysis is
// always done by Flex/Bison on the server.

const KEYWORDS = new Set(['int', 'float', 'if', 'else', 'while', 'print']);

// Order matters: the first alternative that matches wins.
const TOKEN_RE = new RegExp(
  [
    String.raw`\/\/.*`, // line comment
    String.raw`\/\*`, // block comment start
    String.raw`\d+\.\d+(?:[eE][+-]?\d+)?`, // float
    String.raw`\d+[A-Za-z_]\w*`, // malformed identifier such as 9abc
    String.raw`\d+`, // integer
    String.raw`[A-Za-z_]\w*`, // identifier or keyword
    String.raw`==|!=|<=|>=|&&|\|\|`, // two-character operators
    String.raw`[+\-*\/%=<>!]`, // one-character operators
    String.raw`[(){};,]`, // separators
    String.raw`\s+`, // whitespace
    String.raw`[\s\S]`, // anything else (invalid)
  ].join('|'),
  'y',
);

function classify(text) {
  if (text.startsWith('//')) return 'tk-comment';
  if (/^\d+\.\d+/.test(text) || /^\d+$/.test(text)) return 'tk-number';
  if (/^\d/.test(text)) return 'tk-invalid';
  if (KEYWORDS.has(text)) return 'tk-keyword';
  if (/^[A-Za-z_]/.test(text)) return 'tk-ident';
  if (/^[(){};,]$/.test(text)) return 'tk-sep';
  if (/^\s+$/.test(text)) return '';
  if (/^(==|!=|<=|>=|&&|\|\||[+\-*/%=<>!])$/.test(text)) return 'tk-op';
  return 'tk-invalid';
}

function tokenizeLine(text, state) {
  const parts = [];
  let pos = 0;

  if (state.inBlock) {
    const end = text.indexOf('*/');
    if (end < 0) return [{ text, cls: 'tk-comment', start: 0 }];
    parts.push({ text: text.slice(0, end + 2), cls: 'tk-comment', start: 0 });
    pos = end + 2;
    state.inBlock = false;
  }

  while (pos < text.length) {
    TOKEN_RE.lastIndex = pos;
    const match = TOKEN_RE.exec(text);
    let token = match ? match[0] : text[pos];

    if (token === '/*') {
      const end = text.indexOf('*/', pos + 2);
      if (end < 0) {
        parts.push({ text: text.slice(pos), cls: 'tk-comment', start: pos });
        state.inBlock = true;
        break;
      }
      token = text.slice(pos, end + 2);
      parts.push({ text: token, cls: 'tk-comment', start: pos });
    } else {
      parts.push({ text: token, cls: classify(token), start: pos });
    }
    pos += token.length;
  }
  return parts;
}

/**
 * Splits the source into lines of coloured parts and attaches the worst
 * diagnostic severity to each line and to the token that starts at the error column.
 */
export function highlight(source, diagnostics = []) {
  const byLine = new Map();
  for (const d of diagnostics) {
    if (!byLine.has(d.line)) byLine.set(d.line, []);
    byLine.get(d.line).push(d);
  }

  const state = { inBlock: false };
  return source.split('\n').map((text, index) => {
    const lineDiags = byLine.get(index + 1) || [];
    const parts = tokenizeLine(text, state).map((part) => {
      const hit = lineDiags.find((d) => d.col - 1 === part.start);
      const severity = hit ? hit.severity : null;
      return { ...part, severity };
    });
    const severity = lineDiags.some((d) => d.severity === 'error')
      ? 'error'
      : lineDiags.length
        ? 'warning'
        : null;
    return { parts, severity };
  });
}
