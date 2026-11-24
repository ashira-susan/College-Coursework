// Four compiler phases shown as stations on one line. Each station reports the
// result of its phase for the last compile.

function errorsOf(report, kind) {
  return report.diagnostics.filter((d) => d.kind === kind && d.severity === 'error').length;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function buildPhases(report, busy) {
  if (!report) {
    return [
      { name: 'Lexical analysis', state: 'idle', note: 'LEX' },
      { name: 'Syntax analysis', state: 'idle', note: 'YACC' },
      { name: 'Semantic checks', state: 'idle', note: 'symbol table' },
      { name: 'Code generation', state: 'idle', note: 'three-address code' },
    ];
  }
  const lex = errorsOf(report, 'lexical');
  const syn = errorsOf(report, 'syntax');
  const sem = errorsOf(report, 'semantic');
  const generated = report.codeGenerated;

  return [
    {
      name: 'Lexical analysis',
      state: lex ? 'error' : 'ok',
      note: lex ? plural(lex, 'error') : plural(report.stats.tokens, 'token'),
    },
    {
      name: 'Syntax analysis',
      state: syn ? 'error' : 'ok',
      note: syn ? plural(syn, 'error') : 'grammar satisfied',
    },
    {
      name: 'Semantic checks',
      state: sem ? 'error' : 'ok',
      note: sem ? plural(sem, 'error') : plural(report.stats.symbols, 'symbol'),
    },
    {
      name: 'Code generation',
      state: generated ? 'ok' : 'blocked',
      note: generated ? plural(report.stats.instructions, 'instruction') : 'needs a clean build',
    },
  ].map((phase) => ({ ...phase, busy }));
}

const MARK = { ok: '✓', error: '✕', blocked: '–', idle: '' };

export default function Pipeline({ report, busy }) {
  const phases = buildPhases(report, busy);
  return (
    <ol className="pipeline" aria-label="Compilation phases">
      {phases.map((phase) => (
        <li key={phase.name} className={`station station-${phase.state} ${busy ? 'station-busy' : ''}`}>
          <span className="station-dot" aria-hidden="true">
            {MARK[phase.state]}
          </span>
          <span className="station-text">
            <span className="station-name">{phase.name}</span>
            <span className="station-note">{phase.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
