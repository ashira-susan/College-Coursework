import { useMemo, useState } from 'react';
import GrammarView from './GrammarView.jsx';

export const TABS = [
  { id: 'problems', label: 'Problems' },
  { id: 'tac', label: 'Three-address code' },
  { id: 'quads', label: 'Quadruples' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'output', label: 'Output' },
  { id: 'grammar', label: 'Language' },
];

const CATEGORY_CLASS = {
  KEYWORD: 'chip-keyword',
  IDENTIFIER: 'chip-ident',
  INTEGER: 'chip-number',
  FLOAT: 'chip-number',
  OPERATOR: 'chip-op',
  SEPARATOR: 'chip-sep',
  INVALID: 'chip-invalid',
};

function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

/* ---------------- Problems ---------------- */

function ProblemsView({ report, onJump }) {
  if (!report) return <Empty title="Nothing compiled yet">Press Compile or Ctrl + Enter.</Empty>;
  if (!report.diagnostics.length) {
    return <Empty title="No problems found">Every phase finished without errors or warnings.</Empty>;
  }
  return (
    <ul className="problems">
      {report.diagnostics.map((d, i) => (
        <li key={i}>
          <button type="button" className={`problem problem-${d.severity}`} onClick={() => onJump(d.line, d.col)}>
            <span className="problem-kind">{d.kind}</span>
            <span className="problem-msg">{d.message}</span>
            <span className="problem-pos mono">
              {d.line}:{d.col}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Tokens ---------------- */

function TokensView({ report }) {
  const [filter, setFilter] = useState('ALL');
  const categories = useMemo(() => {
    const counts = {};
    (report?.tokens || []).forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [report]);

  if (!report) return <Empty title="Nothing compiled yet">Tokens appear here after the lexical analysis.</Empty>;
  if (!report.tokens.length) return <Empty title="No tokens">The program is empty.</Empty>;

  const shown = filter === 'ALL' ? report.tokens : report.tokens.filter((t) => t.category === filter);

  return (
    <div className="stack-tight">
      <div className="filters" role="group" aria-label="Filter tokens by category">
        {['ALL', ...Object.keys(categories)].map((c) => (
          <button
            key={c}
            type="button"
            className={`filter ${filter === c ? 'filter-on' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c === 'ALL' ? `All ${report.tokens.length}` : `${c.toLowerCase()} ${categories[c]}`}
          </button>
        ))}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Line:Col</th>
            <th>Category</th>
            <th>Token</th>
            <th>Lexeme</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((t, i) => (
            <tr key={i}>
              <td className="mono muted">
                {t.line}:{t.col}
              </td>
              <td>
                <span className={`chip ${CATEGORY_CLASS[t.category] || ''}`}>{t.category.toLowerCase()}</span>
              </td>
              <td className="mono">{t.name}</td>
              <td className="mono">{t.lexeme}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Symbols ---------------- */

function SymbolsView({ report }) {
  if (!report) return <Empty title="Nothing compiled yet">The symbol table is built while parsing.</Empty>;
  if (!report.symbols.length) return <Empty title="No variables declared" />;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Declared on line</th>
        </tr>
      </thead>
      <tbody>
        {report.symbols.map((s) => (
          <tr key={s.name}>
            <td className="mono">{s.name}</td>
            <td className="mono">{s.type}</td>
            <td className="mono">{s.line}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- Three-address code ---------------- */

function TacView({ report }) {
  const [copied, setCopied] = useState(false);
  if (!report) return <Empty title="Nothing compiled yet">Press Compile or Ctrl + Enter.</Empty>;
  if (!report.codeGenerated) {
    return (
      <Empty title="No code generated">
        Intermediate code is only produced for programs without errors. Open the Problems tab to see what to fix.
      </Empty>
    );
  }
  if (!report.tac.length) return <Empty title="No instructions">The program has no executable statements.</Empty>;

  const text = report.tac.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable on plain http */
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'program.tac';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack-tight">
      <div className="toolbar">
        <span className="muted">
          {report.stats.instructions} instructions · {report.stats.temporaries} temporaries · {report.stats.labels} labels
        </span>
        <span className="toolbar-actions">
          <button type="button" className="btn-small" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn-small" onClick={download}>
            Download .tac
          </button>
        </span>
      </div>
      <ol className="tac">
        {report.tac.map((line, i) => {
          const isLabel = line.endsWith(':');
          const isJump = line.startsWith('goto') || line.startsWith('ifFalse');
          return (
            <li key={i} className={isLabel ? 'tac-label' : isJump ? 'tac-jump' : ''}>
              <span className="tac-no">{i}</span>
              <code>{line}</code>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- Quadruples ---------------- */

function QuadsView({ report }) {
  if (!report) return <Empty title="Nothing compiled yet" />;
  if (!report.codeGenerated || !report.quads.length) {
    return <Empty title="No quadruples">They are generated together with the three-address code.</Empty>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Operator</th>
          <th>Arg 1</th>
          <th>Arg 2</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {report.quads.map((q) => (
          <tr key={q.index}>
            <td className="mono muted">{q.index}</td>
            <td className="mono">{q.op}</td>
            <td className="mono">{q.arg1 ?? '–'}</td>
            <td className="mono">{q.arg2 ?? '–'}</td>
            <td className="mono">{q.result ?? '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- Output (running the generated code) ---------------- */

function OutputView({ report }) {
  if (!report) return <Empty title="Nothing compiled yet" />;
  if (!report.codeGenerated) {
    return <Empty title="Nothing to run">Fix the errors first; only valid programs can run.</Empty>;
  }
  const run = report.execution;
  if (!run) return <Empty title="Not executed" />;

  const names = Object.keys(run.variables);
  return (
    <div className="stack">
      <section>
        <h3>Printed output</h3>
        {run.output.length ? (
          <pre className="terminal">{run.output.join('\n')}</pre>
        ) : (
          <p className="muted">The program did not print anything. Use print(expr); to see values.</p>
        )}
        {run.error && <p className="run-error">{run.error}</p>}
        <p className="muted">
          The three-address code was executed by a small interpreter ({run.steps} steps) to confirm it behaves like the
          source program.
        </p>
      </section>
      {names.length > 0 && (
        <section>
          <h3>Final variable values</h3>
          <table className="table">
            <tbody>
              {names.map((n) => (
                <tr key={n}>
                  <th scope="row" className="mono">
                    {n}
                  </th>
                  <td className="mono">{run.variables[n]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/* ---------------- Panel ---------------- */

export default function ResultPanel({ report, tab, onTab, onJump }) {
  const problemCount = report ? report.diagnostics.length : 0;
  const hasErrors = report ? report.errorCount > 0 : false;

  const badge = (id) => {
    if (!report) return null;
    if (id === 'problems' && problemCount) return { n: problemCount, tone: hasErrors ? 'bad' : 'warn' };
    if (id === 'tokens') return { n: report.stats.tokens, tone: 'plain' };
    if (id === 'symbols' && report.stats.symbols) return { n: report.stats.symbols, tone: 'plain' };
    return null;
  };

  return (
    <section className="results" aria-label="Compiler results">
      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          const b = badge(t.id);
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'tab-on' : ''}`}
              onClick={() => onTab(t.id)}
            >
              {t.label}
              {b && <span className={`badge badge-${b.tone}`}>{b.n}</span>}
            </button>
          );
        })}
      </div>
      <div className="tab-body" role="tabpanel">
        {tab === 'problems' && <div className="pad"><ProblemsView report={report} onJump={onJump} /></div>}
        {tab === 'tac' && <div className="pad"><TacView report={report} /></div>}
        {tab === 'quads' && <div className="pad"><QuadsView report={report} /></div>}
        {tab === 'tokens' && <div className="pad"><TokensView report={report} /></div>}
        {tab === 'symbols' && <div className="pad"><SymbolsView report={report} /></div>}
        {tab === 'output' && <div className="pad"><OutputView report={report} /></div>}
        {tab === 'grammar' && <GrammarView />}
      </div>
    </section>
  );
}
