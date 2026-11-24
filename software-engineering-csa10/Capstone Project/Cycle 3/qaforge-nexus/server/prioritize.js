'use strict';
/**
 * Risk-based test prioritisation (v3.0).
 *
 * For each test case a risk score in [0,1] is computed from its result history (newest first):
 *   ewma   exponentially weighted failure rate      sum(alpha*(1-alpha)^i * fail_i)           O(h)
 *   flip   state-change rate (flakiness signal)      transitions / (h-1)
 *   open   linked open defect weight                 Critical 1, High .75, Medium .5, Low .25
 *   prio   test priority weight                      P1 1, P2 .66, P3 .33, P4 .1
 *   score = 0.55*ewma + 0.15*flip + 0.20*open + 0.10*prio     (weights fixed a priori, not tuned on the evaluation)
 * Ordering is a sort: O(n log n) in the number of cases. Ties keep the original order (stable sort).
 * Unknown history (never run) gets a prior of 0.5 so new tests are scheduled early, not last.
 */
const W = { ewma: 0.55, flip: 0.15, open: 0.20, prio: 0.10 };
const OPEN_W = { Critical: 1, High: 0.75, Medium: 0.5, Low: 0.25 };
const PRIO_W = { P1: 1, P2: 0.66, P3: 0.33, P4: 0.1 };
const ALPHA = 0.5;

function riskScore({ hist = [], openSeverity = null, priority = 'P2' }) {
  const fails = hist.map((s) => (s === 'passed' ? 0 : 1)); // hist newest -> oldest
  let ewma, flip = 0;
  if (!fails.length) ewma = 0.5;
  else { ewma = 0; let wsum = 0; fails.forEach((f, i) => { const w = ALPHA * Math.pow(1 - ALPHA, i); ewma += w * f; wsum += w; }); ewma /= wsum; }
  if (fails.length > 1) { let t = 0; for (let i = 1; i < fails.length; i++) if (fails[i] !== fails[i - 1]) t++; flip = t / (fails.length - 1); }
  const open = openSeverity ? OPEN_W[openSeverity] || 0.5 : 0;
  const prio = PRIO_W[priority] ?? 0.5;
  return W.ewma * ewma + W.flip * flip + W.open * open + W.prio * prio;
}

/** order: array of ids; failing: Set of ids that fail. APFD = 1 - sum(TF_i)/(n*m) + 1/(2n), faults = failing tests (1:1). */
function apfd(order, failing) {
  const n = order.length, m = failing.size; if (!n || !m) return null;
  let sum = 0; order.forEach((id, i) => { if (failing.has(id)) sum += i + 1; });
  return 1 - sum / (n * m) + 1 / (2 * n);
}

module.exports = { riskScore, apfd, W };
