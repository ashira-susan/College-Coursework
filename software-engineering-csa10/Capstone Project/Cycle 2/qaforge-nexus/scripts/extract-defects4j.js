'use strict';
/**
 * Builds server/datasets/defects4j-subset.json from a checkout of https://github.com/rjust/defects4j
 * (only framework/projects is needed):
 *
 *   git clone --depth 1 --filter=blob:none --sparse https://github.com/rjust/defects4j.git d4j
 *   (cd d4j && git sparse-checkout set framework/projects)
 *   node scripts/extract-defects4j.js d4j
 *
 * Dataset: Defects4J - René Just, Darioush Jalali, Michael D. Ernst, "Defects4J: A Database of Existing Faults to Enable
 * Controlled Testing Studies for Java Programs", ISSTA 2014. MIT licence. Every record below is a real, reproducible bug.
 */
const fs = require('node:fs');
const path = require('node:path');

const SELECT = [
  { id: 'Lang', key: 'LANG', name: 'Apache Commons Lang', repo: 'https://github.com/apache/commons-lang', tracker: 'Apache JIRA' },
  { id: 'Cli', key: 'CLI', name: 'Apache Commons CLI', repo: 'https://github.com/apache/commons-cli', tracker: 'Apache JIRA' },
  { id: 'Csv', key: 'CSV', name: 'Apache Commons CSV', repo: 'https://github.com/apache/commons-csv', tracker: 'Apache JIRA' },
  { id: 'Chart', key: 'CHART', name: 'JFreeChart', repo: 'https://github.com/jfree/jfreechart', tracker: 'SourceForge tracker' },
  { id: 'Time', key: 'TIME', name: 'Joda-Time', repo: 'https://github.com/JodaOrg/joda-time', tracker: 'GitHub issues' },
];
const root = path.join(process.argv[2] || 'd4j', 'framework', 'projects');
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

function parseTriggers(txt) {
  const out = []; let cur = null;
  for (const line of txt.split('\n')) {
    if (line.startsWith('--- ')) { cur = { name: line.slice(4).trim(), trace: [] }; out.push(cur); } else if (cur && line.trim()) cur.trace.push(line.replace(/\t/g, '  '));
  }
  return out.map((t) => ({ name: t.name, trace: t.trace.slice(0, 12) }));
}
function parsePatch(txt) {
  let added = 0; let removed = 0; const files = [];
  const excerpt = [];
  for (const l of txt.split('\n')) {
    if (l.startsWith('diff --git')) files.push(l.split(' b/')[1]);
    else if (l.startsWith('+') && !l.startsWith('+++')) { added++; if (excerpt.length < 14) excerpt.push(l); } else if (l.startsWith('-') && !l.startsWith('---')) { removed++; if (excerpt.length < 14) excerpt.push(l); }
  }
  return { files, added, removed, excerpt };
}

const projects = [];
let total = 0;
for (const p of SELECT) {
  const dir = path.join(root, p.id);
  const rows = read(path.join(dir, 'active-bugs.csv')).trim().split('\n').slice(1).map((l) => l.split(','));
  const bugs = rows.map(([bugId, buggy, fixed, reportId, reportUrl]) => ({
    bugId: Number(bugId), reportId: reportId === 'UNKNOWN' ? `${p.key}-D4J-${bugId}` : /^\d+$/.test(reportId) ? `${p.key}-${reportId}` : reportId.toUpperCase(),
    // some JFreeChart bugs have no recorded upstream report
    reportUrl: /^https?:/.test(reportUrl) ? reportUrl : null, buggyRevision: buggy, fixedRevision: fixed,
    triggerTests: parseTriggers(read(path.join(dir, 'trigger_tests', bugId))),
    modifiedClasses: read(path.join(dir, 'modified_classes', `${bugId}.src`)).split('\n').map((s) => s.trim()).filter(Boolean),
    patch: parsePatch(read(path.join(dir, 'patches', `${bugId}.src.patch`))),
  })).filter((b) => b.triggerTests.length && b.modifiedClasses.length);
  projects.push({ key: p.key, name: p.name, repo: p.repo, tracker: p.tracker, bugs });
  total += bugs.length;
}
const out = {
  dataset: 'Defects4J', version: 'master (2026-11)', licence: 'MIT', source: 'https://github.com/rjust/defects4j',
  citation: 'Just, R., Jalali, D., Ernst, M.D. Defects4J: A Database of Existing Faults to Enable Controlled Testing Studies for Java Programs. ISSTA 2014.',
  total, projects,
};
fs.writeFileSync(path.join(__dirname, '..', 'server', 'datasets', 'defects4j-subset.json'), JSON.stringify(out));
console.log('projects', projects.map((p) => `${p.key}:${p.bugs.length}`).join(' '), 'total', total);
