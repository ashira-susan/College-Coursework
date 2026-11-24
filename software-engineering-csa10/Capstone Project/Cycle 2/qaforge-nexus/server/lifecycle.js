'use strict';
/**
 * Defect identification & lifecycle management.
 *
 *   New -> Assigned -> In Progress -> Fixed -> Retesting -> Verified -> Closed
 *   with Reopened / Rejected / Deferred / Duplicate side paths.
 */
const { all, get, run, tx, now, nextCode } = require('./db');
const { notify, pj } = require('./util');
const { HttpError } = require('./lib/http');

const STATUSES = ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed', 'Reopened', 'Rejected', 'Deferred', 'Duplicate'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const DEFECT_TYPES = ['functional', 'ui', 'performance', 'security', 'data', 'usability'];
const SLA_HOURS = { Critical: 24, High: 72, Medium: 168, Low: 336 };
const SEV_BY_PRIO = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const PRIO_BY_SEV = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' };
const LIVE = ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened', 'Verified', 'Deferred'];
const ACTIVE_WORK = ['New', 'Assigned', 'In Progress', 'Reopened']; // SLA clock still running
const OPEN = ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened', 'Verified']; // not yet closed out

const FLOW = {
  New: ['Assigned', 'Rejected', 'Duplicate', 'Deferred'],
  Assigned: ['In Progress', 'Rejected', 'Duplicate', 'Deferred'],
  'In Progress': ['Fixed', 'Assigned', 'Deferred'],
  Fixed: ['Retesting', 'Reopened'],
  Retesting: ['Verified', 'Reopened'],
  Verified: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['In Progress', 'Assigned', 'Deferred'],
  Rejected: ['Reopened', 'Closed'],
  Deferred: ['Assigned', 'Closed'],
  Duplicate: ['Closed', 'Reopened'],
};

// target status -> who may move a defect there and what the request must carry
const RULES = {
  Assigned: { roles: ['admin', 'qa_manager'], needs: ['assignee_id'] },
  'In Progress': { roles: ['admin', 'qa_manager', 'developer'], assigneeOnly: true, needs: [] },
  Fixed: { roles: ['admin', 'qa_manager', 'developer'], assigneeOnly: true, needs: ['resolution'] },
  Retesting: { roles: ['admin', 'qa_manager', 'qa_engineer'], needs: [] },
  Verified: { roles: ['admin', 'qa_manager', 'qa_engineer'], needs: [] },
  Closed: { roles: ['admin', 'qa_manager', 'qa_engineer'], needs: [] },
  Reopened: { roles: ['admin', 'qa_manager', 'qa_engineer'], needs: ['note'] },
  Rejected: { roles: ['admin', 'qa_manager', 'developer'], assigneeOnly: true, needs: ['note'] },
  Deferred: { roles: ['admin', 'qa_manager', 'product_owner'], needs: ['note'] },
  Duplicate: { roles: ['admin', 'qa_manager', 'qa_engineer'], needs: ['duplicate_of'] },
};

const slaDue = (createdIso, severity) =>
  new Date(Date.parse(createdIso) + (SLA_HOURS[severity] || 168) * 3600e3).toISOString();

async function history(defectId, actorId, action, from, to, note, at) {
  await run('INSERT INTO defect_history(defect_id, actor_id, action, from_status, to_status, note, created_at) VALUES(?,?,?,?,?,?,?)',
    defectId, actorId || null, action, from || null, to || null, note || null, at || now());
}

/** Least-loaded active developer who is a member of the project. */
async function pickDeveloper(projectId) {
  return await get(
    `SELECT u.id, u.name,
            (SELECT COUNT(*) FROM defects d WHERE d.assignee_id = u.id
               AND d.status IN ('Assigned','In Progress','Reopened')) AS load
       FROM project_members pm JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ? AND u.role = 'developer' AND u.active = 1
      ORDER BY load ASC, u.id ASC LIMIT 1`, projectId);
}

/** Low-level transition (no permission checks). */
async function applyTransition(d, to, actorId, f = {}, at = now()) {
  const sets = ['status = ?', 'updated_at = ?'];
  const vals = [to, at];
  if (f.assignee_id) { sets.push('assignee_id = ?'); vals.push(f.assignee_id); }
  if (f.resolution) { sets.push('resolution = ?'); vals.push(f.resolution); }
  if (f.duplicate_of) { sets.push('duplicate_of = ?'); vals.push(f.duplicate_of); }
  if (to === 'Fixed') { sets.push('resolved_at = ?'); vals.push(at); }
  if (['Closed', 'Rejected', 'Duplicate'].includes(to)) { sets.push('closed_at = ?'); vals.push(at); }
  if (to === 'Reopened') { sets.push('reopen_count = reopen_count + 1', 'resolved_at = NULL', 'closed_at = NULL'); }
  await run(`UPDATE defects SET ${sets.join(', ')} WHERE id = ?`, ...vals, d.id);
  await history(d.id, actorId, 'transition', d.status, to, f.note, at);

  const link = `#/defects/${d.id}`;
  const label = `${d.code} ${d.title}`.slice(0, 90);
  if (to === 'Assigned' && f.assignee_id) await notify(f.assignee_id, `Defect assigned to you: ${label}`, link);
  if (to === 'Fixed') await notify(d.reporter_id, `Marked fixed - please retest: ${label}`, link);
  if (to === 'Reopened') await notify(d.assignee_id || f.assignee_id, `Defect reopened: ${label}`, link);
  if (to === 'Verified') await notify(d.assignee_id, `Fix verified by QA: ${label}`, link);
}

async function createDefect(projectId, d, actorId, opts = {}) {
  return await tx(async () => {
    const created = opts.createdAt || now();
    const severity = SEVERITIES.includes(d.severity) ? d.severity : 'Medium';
    const code = await nextCode(projectId, 'defect', 'DEF');
    const r = await run(
      `INSERT INTO defects(project_id, code, title, description, severity, priority, status, type, source,
         test_case_id, run_id, requirement_id, reporter_id, assignee_id, steps, expected, actual, evidence,
         environment, occurrences, created_at, updated_at, sla_due)
       VALUES (?,?,?,?,?,?, 'New', ?,?, ?,?,?,?, NULL, ?,?,?,?, ?, 1, ?,?,?)`,
      projectId, code, d.title, d.description, severity, PRIO_BY_SEV[severity], d.type || 'functional', d.source || 'manual',
      d.test_case_id, d.run_id, d.requirement_id, actorId, d.steps, d.expected, d.actual, d.evidence,
      d.environment, created, created, slaDue(created, severity));
    const id = Number(r.lastInsertRowid);
    await history(id, actorId, 'created', null, 'New',
      d.source === 'auto' ? 'Auto-created from a failed test execution' : 'Defect reported', created);

    const wantAssign = d.assignee_id || (opts.autoAssign !== false ? (await pickDeveloper(projectId) || {}).id : null);
    if (wantAssign) {
      const fresh = await get('SELECT * FROM defects WHERE id = ?', id);
      await applyTransition(fresh, 'Assigned', actorId,
        { assignee_id: wantAssign, note: d.assignee_id ? 'Assigned at creation' : 'Auto-assigned to least-loaded developer' },
        opts.createdAt ? new Date(Date.parse(created) + 600e3).toISOString() : now());
    }
    return await get('SELECT * FROM defects WHERE id = ?', id);
  });
}

function allowedTransitions(d, user) {
  return (FLOW[d.status] || [])
    .filter((to) => {
      const rule = RULES[to];
      if (!rule.roles.includes(user.role)) return false;
      if (rule.assigneeOnly && user.role === 'developer' && d.assignee_id !== user.id) return false;
      return true;
    })
    .map((to) => ({ to, needs: RULES[to].needs }));
}

async function transitionDefect(defectId, to, user, input = {}) {
  return await tx(async () => {
    const d = await get('SELECT * FROM defects WHERE id = ?', defectId);
    if (!d) throw new HttpError(404, 'Defect not found');
    const allowed = FLOW[d.status] || [];
    if (!allowed.includes(to)) throw new HttpError(409, `A defect in "${d.status}" cannot move to "${to}"`, { allowed });
    const rule = RULES[to];
    if (!rule.roles.includes(user.role)) throw new HttpError(403, `Your role cannot move a defect to "${to}"`);
    if (rule.assigneeOnly && user.role === 'developer' && d.assignee_id !== user.id) {
      throw new HttpError(403, 'Only the assigned developer can do this');
    }
    const f = { note: typeof input.note === 'string' ? input.note.trim().slice(0, 2000) : '' };
    if (rule.needs.includes('note') && f.note.length < 3) throw new HttpError(400, 'A note explaining the reason is required');

    if (rule.needs.includes('assignee_id') || (to === 'Reopened' && input.assignee_id)) {
      const a = await get('SELECT u.id, u.active FROM users u WHERE u.id = ?', Number(input.assignee_id));
      if (!a || !a.active) throw new HttpError(400, 'A valid active assignee is required');
      const member = await get('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?', d.project_id, a.id);
      if (!member) throw new HttpError(400, 'The assignee must be a member of the project');
      f.assignee_id = a.id;
    }
    if (rule.needs.includes('resolution')) {
      const res = typeof input.resolution === 'string' ? input.resolution.trim() : '';
      if (res.length < 3) throw new HttpError(400, 'A resolution note describing the fix is required');
      f.resolution = res.slice(0, 2000);
      f.note = f.note || f.resolution;
    }
    if (rule.needs.includes('duplicate_of')) {
      const ref = String(input.duplicate_of || '').trim();
      const dup = /^\d+$/.test(ref)
        ? await get('SELECT id, project_id FROM defects WHERE id = ?', Number(ref))
        : await get('SELECT id, project_id FROM defects WHERE project_id = ? AND code = ?', d.project_id, ref.toUpperCase());
      if (!dup || dup.project_id !== d.project_id || dup.id === d.id) throw new HttpError(400, 'duplicate_of must reference another defect in the same project');
      f.duplicate_of = dup.id;
      f.note = f.note || `Duplicate of defect #${dup.id}`;
    }
    if (to === 'Reopened' && !f.assignee_id && !d.assignee_id) {
      const dev = await pickDeveloper(d.project_id);
      if (dev) f.assignee_id = dev.id;
    }
    await applyTransition(d, to, user.id, f);
    return await get('SELECT * FROM defects WHERE id = ?', defectId);
  });
}

function evidenceText({ tc, result }) {
  const req = result.requestSnapshot || {};
  const lines = [];
  lines.push(`Request : ${req.method || ''} ${req.url || ''}`);
  if (req.body) lines.push(`Body    : ${String(req.body).slice(0, 400)}`);
  lines.push(`Response: HTTP ${result.responseStatus == null ? 'n/a' : result.responseStatus} in ${Math.round(result.durationMs)} ms`);
  if (result.responseExcerpt) lines.push(`Excerpt : ${String(result.responseExcerpt).slice(0, 600)}`);
  const failed = (result.assertionLog || []).filter((a) => !a.ok);
  if (failed.length) {
    lines.push('Failed assertions:');
    failed.forEach((a) => lines.push(`  - ${a.desc} (actual: ${a.actual === undefined ? 'n/a' : JSON.stringify(a.actual)})`));
  }
  if (result.failureReason) lines.push(`Reason  : ${result.failureReason}`);
  return lines.join('\n');
}

/**
 * Defect identification: turn a failed black-box result into a tracked defect,
 * de-duplicating against earlier defects for the same test case.
 */
async function autoDefectFromResult({ project, tc, run: runRow, result, actorId }) {
  return await tx(async () => {
    const evidence = evidenceText({ tc, result });
    const failed = (result.assertionLog || []).filter((a) => !a.ok);
    const actual = failed.length ? failed.map((a) => `${a.desc} -> got ${JSON.stringify(a.actual)}`).join('; ') : (result.failureReason || 'Test failed');
    const prev = await get('SELECT * FROM defects WHERE test_case_id = ? ORDER BY id DESC LIMIT 1', tc.id);

    if (prev) {
      const stamp = `Re-observed in ${runRow.code} (${project.key})`;
      if (LIVE.includes(prev.status) || ['Rejected', 'Duplicate'].includes(prev.status)) {
        await run('UPDATE defects SET occurrences = occurrences + 1, actual = ?, evidence = ?, run_id = ?, updated_at = ? WHERE id = ?',
          actual, evidence, runRow.id, now(), prev.id);
        await history(prev.id, actorId, 'reobserved', prev.status, prev.status, stamp);
        if (['Fixed', 'Verified', 'Retesting'].includes(prev.status)) {
          const fresh = await get('SELECT * FROM defects WHERE id = ?', prev.id);
          await applyTransition(fresh, 'Reopened', actorId, { note: `Failed again in ${runRow.code} after being marked ${prev.status}` });
          return { action: 'reopened', defect: await get('SELECT * FROM defects WHERE id = ?', prev.id) };
        }
        return { action: 'reobserved', defect: await get('SELECT * FROM defects WHERE id = ?', prev.id) };
      }
      if (prev.status === 'Closed') {
        await run('UPDATE defects SET occurrences = occurrences + 1, actual = ?, evidence = ?, run_id = ?, updated_at = ? WHERE id = ?',
          actual, evidence, runRow.id, now(), prev.id);
        const fresh = await get('SELECT * FROM defects WHERE id = ?', prev.id);
        await applyTransition(fresh, 'Reopened', actorId, { note: `Regression detected in ${runRow.code}` });
        return { action: 'reopened', defect: await get('SELECT * FROM defects WHERE id = ?', prev.id) };
      }
    }

    const sev = SEV_BY_PRIO[tc.priority] || 'Medium';
    const d = await createDefect(project.id, {
      title: `[Auto] ${tc.code} failed: ${tc.title}`.slice(0, 200),
      description: `Automatically raised by QAForge Nexus after test case ${tc.code} failed in ${runRow.code}.`,
      severity: sev,
      type: ['security', 'performance'].includes(tc.type) ? tc.type : 'functional',
      source: 'auto', test_case_id: tc.id, run_id: runRow.id, requirement_id: tc.requirement_id,
      steps: tc.steps_text || `${tc.method || 'GET'} ${tc.endpoint || ''}`,
      expected: tc.expected_text || (pj(tc.assertions, []) || []).map((a) => a.desc || `${a.type} ${a.op} ${JSON.stringify(a.value)}`).join('; '),
      actual, evidence, environment: runRow.environment,
    }, actorId);
    return { action: 'created', defect: d };
  });
}

module.exports = {
  STATUSES, SEVERITIES, DEFECT_TYPES, SLA_HOURS, FLOW, RULES, LIVE, OPEN, ACTIVE_WORK, SEV_BY_PRIO, PRIO_BY_SEV,
  slaDue, history, pickDeveloper, applyTransition, createDefect, allowedTransitions, transitionDefect, autoDefectFromResult,
};
