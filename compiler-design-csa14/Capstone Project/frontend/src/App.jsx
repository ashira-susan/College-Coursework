import { useCallback, useEffect, useRef, useState } from 'react';
import CodeEditor from './components/CodeEditor.jsx';
import Pipeline from './components/Pipeline.jsx';
import ResultPanel from './components/ResultPanel.jsx';
import { compileSource, getExamples, getHealth } from './api.js';

const STARTER = `// MiniCC: write a program, then press Compile (Ctrl + Enter)
int a = 12, b = 5;
float average = (a + b) / 2.0;

if (a > b) {
    print(a - b);
} else {
    print(b - a);
}

int i = 1;
while (i <= 3) {
    print(i * i);
    i = i + 1;
}
`;

export default function App() {
  const [source, setSource] = useState(STARTER);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [examples, setExamples] = useState([]);
  const [health, setHealth] = useState(null);
  const [live, setLive] = useState(true);
  const [tab, setTab] = useState('tac');

  const editorRef = useRef(null);
  const sequence = useRef(0);

  const compile = useCallback(async (code, { focusResults = false } = {}) => {
    const id = ++sequence.current;
    setBusy(true);
    try {
      const result = await compileSource(code);
      if (id !== sequence.current) return; // a newer request replaced this one
      setReport(result);
      setProblem(null);
      if (focusResults) setTab(result.errorCount > 0 ? 'problems' : 'tac');
    } catch (err) {
      if (id === sequence.current) setProblem(err.message);
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }, []);

  // Load backend info and examples once.
  useEffect(() => {
    getHealth().then(setHealth).catch((err) => setProblem(err.message));
    getExamples().then(setExamples).catch(() => {});
    compile(STARTER);
  }, [compile]);

  // Compile shortly after the person stops typing.
  useEffect(() => {
    if (!live) return undefined;
    const timer = setTimeout(() => compile(source), 450);
    return () => clearTimeout(timer);
  }, [source, live, compile]);

  const runNow = useCallback(() => compile(source, { focusResults: true }), [compile, source]);

  function loadExample(id) {
    const example = examples.find((e) => e.id === id);
    if (!example) return;
    setSource(example.source);
    compile(example.source, { focusResults: true });
  }

  const diagnostics = report ? report.diagnostics : [];
  const tools = health?.tools;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>MiniCC</h1>
          <p>
            Lexical analysis, syntax analysis and three-address code with{' '}
            {tools?.flex ? tools.flex : 'Flex'} and {tools?.bison ? tools.bison.replace('(GNU Bison) ', '') : 'Bison'}
          </p>
        </div>
        <Pipeline report={report} busy={busy} />
      </header>

      {problem && (
        <div className="banner" role="alert">
          {problem}
        </div>
      )}
      {health && !health.compilerReady && (
        <div className="banner" role="alert">
          {health.problem}
        </div>
      )}

      <main className="workspace">
        <section className="editor-panel" aria-label="Source program">
          <div className="editor-bar">
            <label className="example-picker">
              <span>Example</span>
              <select value="" onChange={(e) => loadExample(e.target.value)} disabled={!examples.length}>
                <option value="" disabled>
                  Load a program…
                </option>
                {examples.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="live-toggle">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              Compile as I type
            </label>

            <button type="button" className="btn-ghost" onClick={() => setSource('')}>
              Clear
            </button>
            <button type="button" className="btn-primary" onClick={runNow} disabled={busy && !live}>
              {busy ? 'Compiling…' : 'Compile'}
            </button>
          </div>

          <CodeEditor ref={editorRef} value={source} onChange={setSource} diagnostics={diagnostics} onRun={runNow} />

          <div className="status-bar" aria-live="polite">
            {report ? (
              <>
                <span className={report.errorCount ? 'status-bad' : 'status-ok'}>
                  {report.errorCount
                    ? `${report.errorCount} error${report.errorCount === 1 ? '' : 's'}`
                    : 'Compiled successfully'}
                </span>
                {report.warningCount > 0 && (
                  <span className="status-warn">
                    {report.warningCount} warning{report.warningCount === 1 ? '' : 's'}
                  </span>
                )}
                <span className="muted">{report.stats.tokens} tokens</span>
              </>
            ) : (
              <span className="muted">Waiting for the first compile…</span>
            )}
          </div>
        </section>

        <ResultPanel
          report={report}
          tab={tab}
          onTab={setTab}
          onJump={(line, col) => editorRef.current?.jumpTo(line, col)}
        />
      </main>
    </div>
  );
}
