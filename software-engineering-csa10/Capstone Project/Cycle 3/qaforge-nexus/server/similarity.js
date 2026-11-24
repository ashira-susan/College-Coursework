'use strict';
/**
 * Similarity engine for defect de-duplication (v3.0).
 *
 *   tokenize        O(L)            text -> normalised tokens (identifiers split on camelCase / punctuation)
 *   TF-IDF          O(N * L)        sublinear tf, smoothed idf, L2-normalised sparse vectors
 *   cosine          O(min(|a|,|b|)) sparse dot product
 *   MinHash         O(L * K)        K-permutation signature of the token-shingle set (Jaccard estimator)
 *   LSH banding     O(N * K)        b bands x r rows; items sharing any band bucket become candidates
 *
 *   Inverted index  O(N * L)        feature -> postings; candidates = docs sharing at least one *discriminative* feature
 *                                  (document frequency <= maxDf = max(20, sqrt(N))); exact cosine is computed only for candidates.
 *
 * Duplicate search over N defects (three interchangeable candidate generators, all re-ranked by exact cosine):
 *   brute  O(N^2 * L)                 exact, reference
 *   lsh    ~O(N * (K + c * L))        lossy on short, noisy texts (measured: see report)
 *   inv    O(N * L * sqrt(N)) worst   default: near-exact because pairs sharing only very common features have low idf-weighted cosine
 */

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'is', 'at', 'by', 'with', 'from', 'org', 'apache', 'commons', 'com', 'java', 'lang', 'test', 'tests', 'real', 'defect', 'dataset', 'https', 'http', 'github', 'rjust', 'defects4j', 'mit', 'source', 'modified', 'classes', 'trigger', 'buggy', 'fixed', 'revision', 'bug', 'report', 'issues']);

/** Remove tokens that would leak the label (report keys, revisions, bug numbers, URLs). */
function scrub(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, ' ')
    .replace(/\b[0-9a-f]{7,40}\b/g, ' ')
    .replace(/\bbug\s*#?\d+\b/gi, ' ')
    .replace(/\b(DEF|TC|REQ|RUN)-\d+\b/g, ' ');
}

function tokenize(text, { scrubIds = true } = {}) {
  const s = (scrubIds ? scrub(text) : String(text || ''))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
  const out = [];
  for (const t of s.split(/[^a-z0-9]+/)) if (t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)) out.push(t);
  return out;
}

/** 32-bit FNV-1a */
function fnv(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

const PRIME = 4294967291; // largest prime < 2^32
function makeHashFamily(k, seed = 1337) {
  let x = seed >>> 0; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  return Array.from({ length: k }, () => ({ a: (rnd() % (PRIME - 1)) + 1, b: rnd() % PRIME }));
}
// (a*h) mod m without BigInt: split h into 16-bit halves so every intermediate stays below 2^53
const mulmod = (a, h, m) => ((((a * (h >>> 16)) % m) * 65536) + a * (h & 0xffff)) % m;

class SimilarityIndex {
  /**
   * @param {object} o  k: signature length, bands: LSH bands (k must be divisible by bands), unigrams+bigrams used as features
   */
  constructor({ k = 64, bands = 16 } = {}) {
    if (k % bands) throw new Error('k must be divisible by bands');
    this.k = k; this.bands = bands; this.rows = k / bands; this.family = makeHashFamily(k);
    this.docs = []; this.df = new Map(); this.vecs = []; this.sigs = []; this.buckets = new Map(); this.built = false;
  }

  features(tokens) { // unigrams + bigrams capture phrase-level overlap ("string index", "index out")
    const f = new Set(tokens);
    for (let i = 0; i + 1 < tokens.length; i++) f.add(tokens[i] + '_' + tokens[i + 1]);
    return f;
  }

  /** Build the index over [{id, text}] in O(N * L + N * K). */
  build(docs) {
    this.docs = docs; this.df = new Map(); const feats = [];
    for (const d of docs) {
      const f = this.features(tokenize(d.text)); feats.push(f);
      for (const t of f) this.df.set(t, (this.df.get(t) || 0) + 1);
    }
    const n = docs.length;
    this.idf = (t) => Math.log((1 + n) / (1 + (this.df.get(t) || 0))) + 1;
    this.vecs = feats.map((f) => this.vectorOf(f));
    this.sigs = feats.map((f) => this.minhash(f));
    this.buckets = new Map();
    this.sigs.forEach((sig, i) => {
      if (!sig) return;
      for (let b = 0; b < this.bands; b++) {
        const key = b + ':' + sig.slice(b * this.rows, (b + 1) * this.rows).join(',');
        let arr = this.buckets.get(key); if (!arr) this.buckets.set(key, arr = []); arr.push(i);
      }
    });
    this.post = new Map(); // inverted index over discriminative features
    this.maxDf = Math.max(20, Math.ceil(Math.sqrt(n)));
    feats.forEach((f, i) => { for (const t of f) { if (this.df.get(t) > this.maxDf) continue; let a = this.post.get(t); if (!a) this.post.set(t, a = []); a.push(i); } });
    this.feats = feats; this.built = true; return this;
  }

  vectorOf(feats) {
    const v = new Map(); let norm = 0;
    for (const t of feats) { const w = this.idf(t); v.set(t, w); norm += w * w; }
    norm = Math.sqrt(norm) || 1; for (const [t, w] of v) v.set(t, w / norm);
    return v;
  }

  minhash(feats) {
    if (!feats.size) return null;
    const sig = new Array(this.k).fill(Infinity); const hs = [];
    for (const t of feats) hs.push(fnv(t));
    for (let j = 0; j < this.k; j++) {
      const { a, b } = this.family[j]; let m = Infinity;
      for (const h of hs) { const v = (mulmod(a, h, PRIME) + b) % PRIME; if (v < m) m = v; }
      sig[j] = m;
    }
    return sig;
  }

  static cosine(a, b) {
    if (a.size > b.size) [a, b] = [b, a];
    let s = 0; for (const [t, w] of a) { const o = b.get(t); if (o) s += w * o; }
    return s;
  }

  /** Candidate ids for a signature through LSH buckets. */
  candidates(sig) {
    const c = new Set();
    for (let b = 0; b < this.bands; b++) {
      const arr = this.buckets.get(b + ':' + sig.slice(b * this.rows, (b + 1) * this.rows).join(','));
      if (arr) for (const i of arr) c.add(i);
    }
    return c;
  }

  /** Candidate doc indices sharing a discriminative feature (inverted index). */
  candidatesInv(feats) {
    const c = new Set();
    for (const t of feats) { const a = this.post.get(t); if (a) for (const i of a) c.add(i); }
    return c;
  }

  /** Top-k most similar indexed docs to free text. mode: 'inv' (default), 'lsh' or 'brute'. */
  query(text, { k = 5, minScore = 0, mode = 'inv', excludeId = null } = {}) {
    const f = this.features(tokenize(text)); if (!f.size) return [];
    const v = this.vectorOf(f); const out = [];
    let pool;
    if (mode === 'brute') pool = this.docs.keys();
    else if (mode === 'lsh') pool = this.candidates(this.minhash(f));
    else pool = this.candidatesInv(f);
    for (const i of pool) {
      if (excludeId != null && this.docs[i].id === excludeId) continue;
      const s = SimilarityIndex.cosine(v, this.vecs[i]);
      if (s >= minScore) out.push({ id: this.docs[i].id, score: Math.round(s * 1e4) / 1e4 });
    }
    out.sort((x, y) => y.score - x.score); return out.slice(0, k);
  }

  /** All pairs with cosine >= threshold. brute: O(N^2); lsh: only bucket-mates. */
  pairs(threshold, { mode = 'inv' } = {}) {
    const res = []; const n = this.docs.length;
    if (mode === 'brute') {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const s = SimilarityIndex.cosine(this.vecs[i], this.vecs[j]); if (s >= threshold) res.push([this.docs[i].id, this.docs[j].id, s]);
      }
      return res;
    }
    if (mode === 'inv') {
      for (let i = 0; i < n; i++) {
        const cand = this.candidatesInv(this.feats[i]);
        for (const j of cand) { if (j <= i) continue; const s = SimilarityIndex.cosine(this.vecs[i], this.vecs[j]); if (s >= threshold) res.push([this.docs[i].id, this.docs[j].id, s]); }
      }
      return res;
    }
    const seen = new Set();
    for (const arr of this.buckets.values()) {
      for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) {
        const i = arr[x], j = arr[y]; const key = i < j ? i * n + j : j * n + i;
        if (seen.has(key)) continue; seen.add(key);
        const s = SimilarityIndex.cosine(this.vecs[i], this.vecs[j]); if (s >= threshold) res.push([this.docs[i].id, this.docs[j].id, s]);
      }
    }
    return res;
  }

  /** Duplicate clusters = connected components over the similarity graph (union-find, near-linear). */
  clusters(threshold, opts) {
    const parent = new Map(); const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const d of this.docs) parent.set(d.id, d.id);
    const pairs = this.pairs(threshold, opts);
    for (const [a, b] of pairs) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
    const groups = new Map();
    for (const d of this.docs) { const r = find(d.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(d.id); }
    return { clusters: [...groups.values()].filter((g) => g.length > 1), pairs };
  }
}

/** Build the text used to compare defects: title + modified classes + trigger tests + failure signature. */
function defectText(d) {
  const desc = String(d.description || '');
  const mod = (desc.match(/Modified classes:\n([\s\S]*?)(?:\nTrigger tests:|\n\n|$)/) || [, ''])[1];
  const trig = (desc.match(/Trigger tests:\n([\s\S]*?)(?:\n\n|$)/) || [, ''])[1];
  const title = String(d.title || '').replace(/^\S+:\s*/, ''); // strip "LANG-857:" prefix
  return [title, mod, trig, d.actual || ''].join('\n');
}

module.exports = { tokenize, scrub, SimilarityIndex, defectText, fnv };
