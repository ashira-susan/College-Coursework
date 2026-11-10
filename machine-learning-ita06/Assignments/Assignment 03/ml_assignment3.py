"""ITA06 Machine Learning - Assignment 3 (CO3). Run: python ml_assignment3.py
Every number in the report is produced here (global seed 42 unless stated)."""
import itertools, json, math, os
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.optimize import linprog

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figs"); os.makedirs(OUT, exist_ok=True)
SEED = 42
R = {}                                   # results store -> results.json
def save(name):
    plt.tight_layout(); plt.savefig(f"{OUT}/{name}.png", dpi=170); plt.close()

# =============================== Q1 ===========================================
def posterior(prior, tpr, fpr, k):       # P(faulty | k independent positives)
    num = prior * tpr**k
    return num / (num + (1 - prior) * fpr**k)
R["q1_bayes"] = [posterior(.03, .95, .08, k) for k in (1, 2)]
R["q1_prior_sweep"] = {p: posterior(p, .95, .08, 1) for p in (.01, .03, .10, .30)}

ATTR = [("High", "Normal"), ("Heavy", "Light"), ("High", "Low")]
D = [(("High", "Heavy", "High"), 1), (("High", "Heavy", "Low"), 1), (("Normal", "Light", "Low"), 0),
     (("High", "Light", "High"), 0), (("Normal", "Heavy", "High"), 1), (("Normal", "Light", "High"), 0)]
AB = {"High": "H", "Normal": "N", "Heavy": "Hv", "Light": "Lt", "Low": "L", "?": "?", "0": "∅"}
fmt = lambda h: "<" + ",".join(AB[a] for a in h) + ">"
covers = lambda h, x: all(a == "?" or a == b for a, b in zip(h, x))     # "0" = empty constraint
more_general = lambda h1, h2: all(a == "?" or a == b or b == "0" for a, b in zip(h1, h2))

def find_s(D):
    s, tr = ["0"] * 3, []
    for x, y in D:
        if y:
            for i, v in enumerate(x):
                s[i] = v if s[i] == "0" else (s[i] if s[i] == v else "?")
        tr.append(fmt(s))
    return tr

def cand_elim(D):
    S, G, tr = [("0",) * 3], [("?",) * 3], []
    for x, y in D:
        if y:
            G = [g for g in G if covers(g, x)]
            nS = []
            for s in S:
                if covers(s, x): nS.append(s); continue
                m = tuple(v if si == "0" else (si if si == v else "?") for si, v in zip(s, x))
                if any(more_general(g, m) for g in G): nS.append(m)
            S = nS
        else:
            S = [s for s in S if not covers(s, x)]
            nG = []
            for g in G:
                if not covers(g, x): nG.append(g); continue
                for i in range(3):
                    if g[i] == "?":
                        for v in ATTR[i]:
                            if v != x[i]:
                                h = g[:i] + (v,) + g[i + 1:]
                                if any(more_general(h, s) for s in S): nG.append(h)
            nG = list(dict.fromkeys(nG))
            G = [g for g in nG if not any(g != o and more_general(o, g) for o in nG)]
        tr.append(([fmt(s) for s in S], [fmt(g) for g in G]))
    return tr
R["q1_finds"], R["q1_ce"] = find_s(D), cand_elim(D)

HYP = list(itertools.product(("High", "Normal", "?"), ("Heavy", "Light", "?"), ("High", "Low", "?"))) + [("0",) * 3]
VS = [h for h in HYP if all(covers(h, x) == bool(y) for x, y in D[:3])]
R["q1_vs"] = [fmt(h) for h in VS]
def post(prior, lik):
    z = sum(p * l for p, l in zip(prior, lik)); return [p * l / z for p, l in zip(prior, lik)]
uni, mine = [1 / 3] * 3, [.20, .35, .45]            # order of VS: <H,Hv,?>, <H,?,?>, <?,Hv,?>
R["q1_post_uniform"] = post(uni, [1] * 3)
R["q1_post_mine"] = post(mine, [1] * 3)
eta = .1
def lik_noisy(h, data):
    err = sum(covers(h, x) != bool(y) for x, y in data); return (1 - eta) ** (len(data) - err) * eta ** err
L6 = [lik_noisy(h, D) for h in VS]
R["q1_L6"] = L6
R["q1_noisy_uniform"] = post(uni, L6)
R["q1_noisy_mine"] = post(mine, L6)
R["q1_noisy_strong"] = post([.01, .98, .01], L6)
for p in np.arange(.34, 1, .001):                    # smallest prior on <H,?,?> that flips MAP
    if np.argmax(post([(1 - p) / 2, p, (1 - p) / 2], L6)) == 1: R["q1_flip_p"] = float(p); break
xnew = ("Normal", "Heavy", "Low")
pred = [int(covers(h, xnew)) for h in VS]
R["q1_newx"] = {"pred": pred, "vote_uniform": sum(p * q for p, q in zip(R["q1_post_uniform"], pred)),
                "vote_mine": sum(p * q for p, q in zip(R["q1_post_mine"], pred))}

fig, ax = plt.subplots(figsize=(6.6, 1.9)); ax.axis("off")
pos = {"G1": (.12, .5), "G2": (.5, .5), "S": (.88, .5)}
nodes = [("<?,Hv,?>  (G)", .12, .78), ("<H,?,?>  (G)", .12, .22), ("<H,Hv,?>  (S)", .62, .5)]
for t, x, y in nodes: ax.text(x, y, t, ha="center", va="center", bbox=dict(boxstyle="round", fc="#dbeafe", ec="#1d4ed8"))
for y in (.78, .22): ax.annotate("", (.5, .54 if y > .5 else .46), (.22, y), arrowprops=dict(arrowstyle="->"))
ax.text(.9, .5, "more specific →", va="center", fontsize=8); ax.text(.0, .5, "← more general", va="center", fontsize=8, ha="left")
ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.set_title("Version space after D1–D3 (S and G boundaries)", fontsize=9); save("q1_vs")

# =============================== Q2 ===========================================
L = math.log2(200); dl = lambda nodes, err, c=12: nodes * c + err * L
R["q2"] = {"log2_200": L, "A": [6 * 12, 8 * L, dl(6, 8)], "B": [25 * 12, 1 * L, dl(25, 1)], "c_star": 7 * L / 19}
post_h = np.array([.30, .25, .20, .15, .10]); pr = np.array([1, 0, 0, 1, 0])      # 1 = '+'
R["q2"]["vote"] = {"+": float(post_h[pr == 1].sum()), "-": float(post_h[pr == 0].sum())}
rng = np.random.default_rng(SEED); N = 200_000
true = rng.choice(5, N, p=post_h); gibbs = rng.choice(5, N, p=post_h)
bo = int(R["q2"]["vote"]["+"] > R["q2"]["vote"]["-"])
R["q2"]["gibbs_exact"] = 2 * .45 * .55; R["q2"]["bo_exact"] = min(.45, .55)
R["q2"]["gibbs_mc"] = float((pr[gibbs] != pr[true]).mean()); R["q2"]["bo_mc"] = float((bo != pr[true]).mean())

# =============================== Q3 ===========================================
class CatNB:
    """Categorical Naive Bayes, integer-coded features, log-space, add-alpha smoothing."""
    def __init__(s, alpha=1.0, K=None): s.a, s.K = alpha, K
    def fit(s, X, y):
        s.cls = np.unique(y); d = X.shape[1]; s.K = s.K or [int(X[:, j].max()) + 1 for j in range(d)]
        s.prior = np.array([(y == c).mean() for c in s.cls])
        s.cpt = [np.stack([(np.bincount(X[y == c, j], minlength=s.K[j]) + s.a) / ((y == c).sum() + s.a * s.K[j])
                           for c in s.cls]) for j in range(d)]
        return s
    def log_joint(s, X):
        with np.errstate(divide="ignore"):
            out = np.tile(np.log(s.prior), (len(X), 1))
            for j in range(X.shape[1]): out += np.log(s.cpt[j][:, X[:, j]]).T
        return out
    def predict_proba(s, X):
        lj = s.log_joint(X); m = lj.max(1, keepdims=True)           # log-sum-exp trick
        with np.errstate(invalid="ignore"):
            p = np.exp(lj - m); return p / p.sum(1, keepdims=True)
    def predict(s, X): return s.cls[s.log_joint(X).argmax(1)]

LOAN = [("High", "Salaried", "Good", 1), ("High", "Self-employed", "Good", 1), ("Medium", "Salaried", "Good", 1),
        ("Medium", "Self-employed", "Poor", 0), ("Low", "Salaried", "Poor", 0), ("Low", "Self-employed", "Poor", 0),
        ("Medium", "Salaried", "Poor", 1), ("Low", "Salaried", "Good", 1), ("High", "Self-employed", "Poor", 0),
        ("Low", "Self-employed", "Good", 0)]
ENC = [{"High": 0, "Medium": 1, "Low": 2, "Very High": 3}, {"Salaried": 0, "Self-employed": 1}, {"Good": 0, "Poor": 1}]
enc = lambda rows: np.array([[ENC[j][v] for j, v in enumerate(r[:3])] for r in rows])
XL, yL = enc(LOAN), np.array([r[3] for r in LOAN]); KL = [4, 2, 2]      # 'Very High' reserved as unseen value
nb0 = CatNB(0, KL).fit(XL, yL)
R["q3_prior"] = nb0.prior.tolist()
R["q3_cpt"] = {n: nb0.cpt[j][:, :(3 if j == 0 else KL[j])].tolist() for j, n in enumerate(["Income(H,M,L)", "Employment(S,SE)", "Credit(G,P)"])}
qs = {"A (Low,Self-emp,Poor)": ("Low", "Self-employed", "Poor"), "B (Medium,Salaried,Good)": ("Medium", "Salaried", "Good")}
R["q3_manual"] = {}
for n, q in qs.items():
    xq = enc([q]); lj = np.exp(nb0.log_joint(xq))[0]; R["q3_manual"][n] = {"score_No": lj[0], "score_Yes": lj[1], "post": nb0.predict_proba(xq)[0].tolist()}
xv = enc([("Very High", "Salaried", "Good")])
R["q3_mle_vh"] = np.exp(nb0.log_joint(xv))[0].tolist()
R["q3_alpha"] = {}
for a in (0.1, 1, 5):
    m = CatNB(a, KL).fit(XL, yL); R["q3_alpha"][a] = {"scores": np.exp(m.log_joint(xv))[0].tolist(), "post": m.predict_proba(xv)[0].tolist(),
                                                     "P(VH|Yes)": float(m.cpt[0][1, 3]), "P(VH|No)": float(m.cpt[0][0, 3])}
from sklearn.naive_bayes import CategoricalNB
sk = CategoricalNB(alpha=1.0, min_categories=KL).fit(XL, yL); mine1 = CatNB(1.0, KL).fit(XL, yL)
Xt = np.vstack([enc([q for q in qs.values()]), xv])
R["q3_verify"] = {"mine": mine1.predict_proba(Xt).tolist(), "sklearn": sk.predict_proba(Xt).tolist(),
                  "max_abs_diff": float(np.abs(mine1.predict_proba(Xt) - sk.predict_proba(Xt)).max())}
R["q3_underflow"] = {"product": float(0.3 ** 2000), "log": 2000 * math.log(0.3)}

def gen(n, seed, flip=.05):
    """y~Bern(.5); 4 informative binary features; x5,x6 = noisy copies of x1 (redundant)."""
    r = np.random.default_rng(seed); y = r.integers(0, 2, n)
    p1 = np.array([[.25, .40, .40, .45], [.75, .60, .60, .55]])[y]
    X = (r.random((n, 4)) < p1).astype(int)
    cp = [X[:, 0] ^ (r.random(n) < flip) for _ in range(2)]
    return np.column_stack([X] + cp).astype(int), y
acc = lambda p, y: float(((p > .5).astype(int) == y).mean())
def logloss(p, y): p = np.clip(p, 1e-12, 1 - 1e-12); return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())
def reliability(p, y, bins=8):
    idx = np.clip((p * bins).astype(int), 0, bins - 1); xs, ys = [], []
    for b in range(bins):
        m = idx == b
        if m.sum() >= 20: xs.append(p[m].mean()); ys.append(y[m].mean())
    return xs, ys
def split(seed, n=2000):
    X, y = gen(n, seed); k = int(.7 * n); return X[:k], y[:k], X[k:], y[k:]
Xtr, ytr, Xte, yte = split(SEED)
m4 = CatNB(1).fit(Xtr[:, :4], ytr); m6 = CatNB(1).fit(Xtr, ytr)
p4, p6 = m4.predict_proba(Xte[:, :4])[:, 1], m6.predict_proba(Xte)[:, 1]
R["q3_exp"] = {"without": {"acc": acc(p4, yte), "ll": logloss(p4, yte), "mean_conf": float(np.maximum(p4, 1 - p4).mean())},
               "with": {"acc": acc(p6, yte), "ll": logloss(p6, yte), "mean_conf": float(np.maximum(p6, 1 - p6).mean())},
               "corr_x1_x5": float(np.corrcoef(Xtr[:, 0], Xtr[:, 4])[0, 1]), "n_train": len(ytr), "n_test": len(yte)}

# =============================== Q4 ===========================================
pP, pC = .10, .05; pO = {(1, 1): .95, (1, 0): .60, (0, 1): .80, (0, 0): .02}; pA = {1: .90, 0: .05}; pS = {1: .70, 0: .01}
f = lambda pr, v: pr if v else 1 - pr
def joint(p, c, o, a, s): return f(pP, p) * f(pC, c) * f(pO[(p, c)], o) * f(pA[o], a) * f(pS[o], s)
IDX = dict(P=0, C=1, O=2, A=3, S=4)
def enum_query(q, ev):                   # inference by enumeration -> (distribution, #joint terms summed)
    res, terms = {}, 0
    for qv in (0, 1):
        tot = 0.0
        for v in itertools.product((0, 1), repeat=5):
            if v[IDX[q]] != qv or any(v[IDX[k]] != e for k, e in ev.items()): continue
            tot += joint(*v); terms += 1
        res[qv] = tot
    z = sum(res.values()); return {k: x / z for k, x in res.items()}, terms
R["q4_queries"] = {}
for name, q, ev in [("P(O=T)", "O", {}), ("P(C=T|A=T)", "C", {"A": 1}), ("P(C=T|A=T,P=T)", "C", {"A": 1, "P": 1}),
                    ("P(C=T)", "C", {}), ("P(C=T|O=T)", "C", {"O": 1}), ("P(C=T|P=T)", "C", {"P": 1})]:
    d, t = enum_query(q, ev); R["q4_queries"][name] = {"value": d[1], "terms": t}
R["q4_manual_O_terms"] = [pP * pC * .95, pP * (1 - pC) * .60, (1 - pP) * pC * .80, (1 - pP) * (1 - pC) * .02]
R["q4_params"] = {"bn": 1 + 1 + 4 + 2 + 2, "full": 2 ** 5 - 1}
def sample_bn(n, seed):
    r = np.random.default_rng(seed); P = r.random(n) < pP; C = r.random(n) < pC
    O = r.random(n) < np.vectorize(lambda p, c: pO[(int(p), int(c))])(P, C)
    A = r.random(n) < np.where(O, pA[1], pA[0]); S = r.random(n) < np.where(O, pS[1], pS[0])
    return np.column_stack([P, C, O, A, S]).astype(int)
data = sample_bn(1000, SEED); R["q4_est"] = {}
for n in (50, 200, 1000):
    d = data[:n]; row = {}
    for (p, c), true_p in pO.items():
        m = (d[:, 0] == p) & (d[:, 1] == c); row[f"{'TF'[1-p]}{'TF'[1-c]}"] = {"n": int(m.sum()), "est": (float(d[m, 2].mean()) if m.sum() else None), "true": true_p}
    errs = [abs(v["est"] - v["true"]) for v in row.values() if v["est"] is not None]
    R["q4_est"][n] = {"cells": row, "mae": float(np.mean(errs)), "undefined": sum(v["est"] is None for v in row.values()),
                      "pP": float(d[:, 0].mean()), "pC": float(d[:, 1].mean()),
                      "pA|O": [float(d[d[:, 2] == o, 3].mean()) for o in (1, 0)], "pS|O": [float(d[d[:, 2] == o, 4].mean()) for o in (1, 0)]}
fig, ax = plt.subplots(figsize=(4.6, 2.5)); ax.axis("off")
xy = {"P": (0, 1), "C": (2, 1), "O": (1, 0), "A": (0, -1), "S": (2, -1)}
lab = {"P": "P\nPower surge", "C": "C\nCoolant fail", "O": "O\nOverheat", "A": "A\nAlarm", "S": "S\nShutdown"}
for k, (x, y) in xy.items(): ax.text(x, y, lab[k], ha="center", va="center", fontsize=7.5, bbox=dict(boxstyle="round,pad=.4", fc="#fef3c7", ec="#b45309"))
for a, b in [("P", "O"), ("C", "O"), ("O", "A"), ("O", "S")]:
    (x1, y1), (x2, y2) = xy[a], xy[b]; ax.annotate("", (x2 * .8 + x1 * .2, y2 * .8 + y1 * .2), (x1 * .8 + x2 * .2, y1 * .8 + y2 * .2), arrowprops=dict(arrowstyle="-|>", color="k"))
ax.set_xlim(-.6, 2.6); ax.set_ylim(-1.5, 1.5); save("q4_net")

# =============================== Q5 ===========================================
npdf = lambda x, mu, var: np.exp(-(x - mu) ** 2 / (2 * var)) / np.sqrt(2 * np.pi * var)
def em_step(x, pi, mu, var):
    dens = pi * npdf(x[:, None], mu, var); ll = float(np.log(dens.sum(1)).sum())      # LL of the incoming parameters
    r = dens / dens.sum(1, keepdims=True); Nk = r.sum(0)
    mu2 = (r * x[:, None]).sum(0) / Nk
    var2 = np.maximum((r * (x[:, None] - mu2) ** 2).sum(0) / Nk, 1e-6)
    return Nk / len(x), mu2, var2, ll, r
loglik = lambda x, pi, mu, var: float(np.log((pi * npdf(x[:, None], mu, var)).sum(1)).sum())
def em(x, pi, mu, var, tol=1e-6, maxit=1000):
    """Convergence rule: stop when |LL_t - LL_{t-1}| < tol (1e-6) or after maxit iterations."""
    lls = []
    for it in range(maxit):
        pi, mu, var, ll, r = em_step(x, pi, mu, var); lls.append(ll)
        if it > 0 and abs(lls[-1] - lls[-2]) < tol: break
    lls.append(loglik(x, pi, mu, var)); return pi, mu, var, lls, r
x7 = np.array([1.8, 2.5, 3.1, 5.0, 7.6, 8.4, 9.0])
pi0, mu0, var0 = np.array([.5, .5]), np.array([2., 8.]), np.array([1., 1.])
pi1, mu1, var1, ll0, r7 = em_step(x7, pi0, mu0, var0)
R["q5_manual"] = {"r1": r7[:, 0].tolist(), "r2": r7[:, 1].tolist(), "Nk": r7.sum(0).tolist(), "pi": pi1.tolist(), "mu": mu1.tolist(),
                  "var": var1.tolist(), "ll_before": ll0, "ll_after": loglik(x7, pi1, mu1, var1)}
rg = np.random.default_rng(SEED); n = 500; z = (rg.random(n) < .6).astype(int)
TRUE = dict(pi=[.4, .6], mu=[2., 6.], var=[1., 2.25])
xs = np.where(z == 1, rg.normal(6, 1.5, n), rg.normal(2, 1.0, n))
runs = []
for s in range(10):
    r_ = np.random.default_rng(s); mu_i = r_.uniform(xs.min(), xs.max(), 2); v_i = np.full(2, r_.uniform(.5, 4))
    pi_, mu_, var_, lls, _ = em(xs, np.array([.5, .5]), mu_i, v_i)
    runs.append({"seed": s, "init_mu": mu_i.tolist(), "ll": lls[-1], "pi": pi_.tolist(), "mu": mu_.tolist(), "var": var_.tolist(), "iters": len(lls) - 1,
                 "swapped": bool(mu_[0] > mu_[1]), "monotone": bool(np.all(np.diff(lls) >= -1e-9)), "lls": lls})
R["q5_runs"] = runs
best = max(runs, key=lambda d: d["ll"])
def fit_k(K, tries=10):
    bestk = None
    for s in range(tries):
        r_ = np.random.default_rng(100 + s)
        out = em(xs, np.full(K, 1 / K), r_.uniform(xs.min(), xs.max(), K), np.full(K, r_.uniform(.5, 4)))
        if bestk is None or out[3][-1] > bestk[3][-1]: bestk = out
    return bestk
R["q5_bic"] = {}
for K in (1, 2, 3):
    pi_, mu_, var_, lls, _ = fit_k(K); p = 3 * K - 1
    R["q5_bic"][K] = {"ll": lls[-1], "params": p, "bic": p * math.log(n) - 2 * lls[-1], "mu": np.round(mu_, 2).tolist(), "pi": np.round(pi_, 3).tolist()}
def kmeans(x, K, r):
    mu = r.choice(x, K, replace=False)
    for _ in range(200):
        lab = np.abs(x[:, None] - mu).argmin(1); new = np.array([x[lab == k].mean() if (lab == k).any() else mu[k] for k in range(K)])
        if np.allclose(new, mu): break
        mu = new
    lab = np.abs(x[:, None] - mu).argmin(1); return mu, lab, float(((x - mu[lab]) ** 2).sum())
km = min((kmeans(xs, 2, np.random.default_rng(s)) for s in range(10)), key=lambda t: t[2])
order = np.argsort(km[0]); mu_k = km[0][order]; lab_k = np.where(km[1] == order[0], 0, 1)
pi_k = np.bincount(lab_k) / n; var_k = np.array([xs[lab_k == k].var() for k in (0, 1)])
_, _, _, _, rb = em(xs, np.array([.5, .5]), np.array(best["init_mu"]), np.full(2, 1.))
bm = np.array(best["mu"]); lab_em = rb.argmax(1)
if bm[0] > bm[1]: lab_em = 1 - lab_em
R["q5_hard"] = {"km_mu": mu_k.tolist(), "km_pi": pi_k.tolist(), "km_var": var_k.tolist(), "km_ll": loglik(xs, pi_k, mu_k, var_k),
                "km_acc": float((lab_k == z).mean()), "em_acc": float((lab_em == z).mean()), "em_ll": best["ll"],
                "ambiguous": int((rb.max(1) < .9).sum())}
fig, axs = plt.subplots(1, 3, figsize=(10, 2.7))
for r_ in runs: axs[0].plot(r_["lls"], lw=.9)
axs[0].set(xlabel="iteration", ylabel="log-likelihood", title="(a) LL per EM iteration (10 inits)"); axs[0].set_ylim(best["ll"] - 400, best["ll"] + 20)
g = np.linspace(xs.min() - 1, xs.max() + 1, 400); bp, bmu, bv = np.array(best["pi"]), np.array(best["mu"]), np.array(best["var"])
axs[1].hist(xs, 40, density=True, color="#cbd5e1"); axs[1].plot(g, (bp * npdf(g[:, None], bmu, bv)).sum(1), "r", label="EM mixture")
axs[1].axvline(mu_k.mean(), color="g", ls="--", label="k-means boundary"); axs[1].legend(fontsize=7); axs[1].set(title="(b) Fit on 500 readings", xlabel="reading")
Ks = [1, 2, 3]; axs[2].bar(Ks, [R["q5_bic"][k]["bic"] for k in Ks], color="#6366f1"); axs[2].set(xticks=Ks, xlabel="components K", ylabel="BIC (lower = better)", title="(c) Model selection")
axs[2].set_ylim(min(R["q5_bic"][k]["bic"] for k in Ks) - 100, max(R["q5_bic"][k]["bic"] for k in Ks) + 30); save("q5")

# =============================== Q6 ===========================================
pac = lambda n, e, d: math.ceil((math.log(3 ** int(n) + 1) + math.log(1 / d)) / e)
R["q6_table"] = {f"eps={e},delta={d}": pac(10, e, d) for e in (.1, .05) for d in (.05, .01)}
def find_s_sim(n, m, trials, rng, tgt=(0, 1)):
    """Target: x1 AND NOT x2 (2 literals), uniform examples. Exact error = P(target) - P(h)."""
    X = rng.random((trials, m, n)) < .5; pm = X[:, :, tgt[0]] & ~X[:, :, tgt[1]]
    lp = np.all(X | ~pm[:, :, None], 1); ln = np.all(~X | ~pm[:, :, None], 1)       # literals surviving
    cnt = lp.sum(1) + ln.sum(1); dead = (lp & ln).any(1)
    return .25 - np.where(dead, 0.0, 2.0 ** -cnt)
rg = np.random.default_rng(SEED); ms = [5, 10, 20, 30, 40, 60, 80, 140, 280]; sim = {}
for m in ms:
    e = find_s_sim(10, m, 500, rg); sim[m] = {"mean_err": float(e.mean()), "frac_.1": float((e <= .1).mean()), "frac_.05": float((e <= .05).mean())}
R["q6_sim"] = sim
vcb = lambda d, e=.1, dl=.05: math.ceil((4 * math.log2(2 / dl) + 8 * d * math.log2(13 / e)) / e)
R["q6_vc"] = {"interval": vcb(2), "halfplane": vcb(3), "rectangle": vcb(4)}
def separable(P, lab):                   # linear separability by LP feasibility
    A = [[-(2 * l - 1) * p[0], -(2 * l - 1) * p[1], -(2 * l - 1)] for p, l in zip(P, lab)]
    return linprog([0, 0, 0], A_ub=A, b_ub=[-1] * len(P), bounds=[(None, None)] * 3).status == 0
tri = [(0, 0), (1, 0), (0, 1)]; sq = [(0, 0), (1, 1), (1, 0), (0, 1)]
R["q6_shatter"] = {"halfplane_3pts": all(separable(tri, l) for l in itertools.product((0, 1), repeat=3)),
                   "halfplane_4pts_all": all(separable(sq, l) for l in itertools.product((0, 1), repeat=4))}
dia = [(0, 1), (1, 0), (0, -1), (-1, 0)]
def rect_ok(P, lab):                     # smallest axis-aligned box around positives must exclude negatives
    pos = [p for p, l in zip(P, lab) if l]
    if not pos: return True
    x0, x1, y0, y1 = min(p[0] for p in pos), max(p[0] for p in pos), min(p[1] for p in pos), max(p[1] for p in pos)
    return not any(x0 <= p[0] <= x1 and y0 <= p[1] <= y1 for p, l in zip(P, lab) if not l)
R["q6_shatter"]["rect_4pts"] = all(rect_ok(dia, l) for l in itertools.product((0, 1), repeat=4))
R["q6_shatter"]["rect_5pts_fail"] = not all(rect_ok(dia + [(0, 0)], l) for l in itertools.product((0, 1), repeat=5))
def interval_ok(P, lab):                 # smallest interval around positives must exclude negatives
    pos = [p for p, l in zip(P, lab) if l]
    return not pos or not any(min(pos) <= p <= max(pos) for p, l in zip(P, lab) if not l)
R["q6_shatter"]["interval_2pts"] = all(interval_ok([1, 2], l) for l in itertools.product((0, 1), repeat=2))
R["q6_shatter"]["interval_3pts_fail"] = not all(interval_ok([1, 2, 3], l) for l in itertools.product((0, 1), repeat=3))
fig, axs = plt.subplots(2, 3, figsize=(10, 5.2))
ns = np.arange(1, 101); axs[0, 0].plot(ns, [pac(n, .05, .05) for n in ns]); axs[0, 0].set(xlabel="n (features)", ylabel="m", title="(a) m vs n  (ε=δ=0.05)")
es = np.linspace(.01, .3, 100); axs[0, 1].plot(es, [pac(10, e, .05) for e in es]); axs[0, 1].set(xlabel="ε", ylabel="m", title="(b) m vs ε  (n=10, δ=0.05)")
ds = np.logspace(-4, -.5, 100); axs[0, 2].semilogx(ds, [pac(10, .05, d) for d in ds]); axs[0, 2].set(xlabel="δ", ylabel="m", title="(c) m vs δ  (n=10, ε=0.05)")
axs[1, 0].plot(ms, [sim[m]["mean_err"] for m in ms], "o-", label="mean true error"); axs[1, 0].axhline(.05, color="r", ls=":", label="ε=0.05")
axs[1, 0].axvline(280, color="k", ls="--", label="PAC bound m=280"); axs[1, 0].set(xlabel="m", ylabel="error", title="(d) Find-S: error vs m"); axs[1, 0].legend(fontsize=7)
axs[1, 1].plot(ms, [sim[m]["frac_.05"] for m in ms], "s-"); axs[1, 1].axhline(.95, color="r", ls=":"); axs[1, 1].axvline(280, color="k", ls="--")
axs[1, 1].set(xlabel="m", ylabel="P(error ≤ 0.05)", title="(e) success fraction (need ≥ 0.95)")
for P, c, mk in [(dia, "tab:blue", "o")]: axs[1, 2].scatter(*zip(*P), s=60, c=c)
axs[1, 2].add_patch(plt.Rectangle((0, -1), 1, 2, fc="none", ec="r", ls="--")); axs[1, 2].text(-1.4, -1.5, "box of {top,right,bottom} excludes left", fontsize=7)
axs[1, 2].set(title="(f) 4 points shattered by rectangles", xlim=(-1.5, 1.5), ylim=(-1.6, 1.5), aspect="equal"); save("q6")

# ---- Part C: mistake bounds
rg = np.random.default_rng(SEED); NB = 6; Hs = np.arange(2 ** NB)                 # H = monotone conjunctions over 6 vars (64 hyps)
def halving_run(T=100):
    tgt = int(rg.integers(2 ** NB)); alive = np.ones(2 ** NB, bool); mist = 0
    for _ in range(T):
        x = int(rg.integers(2 ** NB)); preds = (x & Hs) == Hs
        vote = int(preds[alive].sum() * 2 > alive.sum()); y = int((x & tgt) == tgt)
        mist += vote != y; alive &= (preds == bool(y))
    return mist
hm = [halving_run() for _ in range(2000)]
R["q6_halving"] = {"mean": float(np.mean(hm)), "max": int(max(hm)), "bound": math.log2(64)}
def conj_learner(n, target, X):
    hyp = np.ones(2 * n, bool); mist = 0                                          # all literals: predicts negative
    for x in X:
        lit = np.concatenate([x, ~x]); pred = bool(np.all(lit[hyp]))
        y = bool(np.all(x[target])) if len(target) else True
        if pred != y: mist += 1; hyp &= lit                                       # only positives cause mistakes
    return mist
n = 10; rg = np.random.default_rng(SEED); mm = []
for t in range(3000):
    tgt = np.where(rg.random(n) < rg.choice([.1, .3, .6]))[0]; pb = rg.choice([.5, .8, .95])
    mm.append(conj_learner(n, tgt, rg.random((300, n)) < pb))
adv = [np.array([j != i for j in range(n)]) for i in range(n)]
R["q6_conj"] = {"max": int(max(mm)), "mean": float(np.mean(mm)), "bound": n + 1,
                "adv": conj_learner(n, np.array([], int), [np.ones(n, bool)] + adv)}
Xd = [1, 2, 3, 4]; C = [tuple(int(x >= t) for x in Xd) for t in range(1, 6)]      # thresholds, |C| = 5
from functools import lru_cache
@lru_cache(None)
def opt(V):
    best = 0
    for i in range(len(Xd)):
        V0 = tuple(c for c in V if c[i] == 0); V1 = tuple(c for c in V if c[i] == 1)
        o = lambda S: opt(S) if S else -1e9
        val = min(max(o(V1) if pr == 1 else o(V0), 1 + (o(V0) if pr == 1 else o(V1))) for pr in (0, 1)) if V0 and V1 else 0
        best = max(best, val)
    return best
vc = max(len(S) for r_ in range(1, 5) for S in itertools.combinations(range(4), r_) if len({tuple(c[i] for i in S) for c in C}) == 2 ** len(S))
R["q6_opt"] = {"vc": vc, "opt": opt(tuple(C)), "log2": math.log2(len(C)), "size": len(C)}

# =============================== Q7 ===========================================
class TAN:
    """Tree-augmented NB for binary features: each feature has the class + at most one feature parent (CMI max spanning tree)."""
    def __init__(s, alpha=1.): s.a = alpha
    def fit(s, X, y):
        n, d = X.shape; a = s.a; s.d = d; s.prior = np.bincount(y, minlength=2) / n; W = np.zeros((d, d))
        for i in range(d):
            for j in range(i + 1, d):
                for c in (0, 1):
                    m = y == c; cnt = np.array([[((X[m, i] == u) & (X[m, j] == v)).sum() for v in (0, 1)] for u in (0, 1)]) + a
                    P = cnt / cnt.sum(); W[i, j] += m.mean() * (P * np.log(P / (P.sum(1, keepdims=True) * P.sum(0, keepdims=True)))).sum()
        W = W + W.T; s.par = [-1] * d; tree = {0}
        while len(tree) < d:
            i, j = max(((i, j) for i in tree for j in range(d) if j not in tree), key=lambda e: W[e]); s.par[j] = i; tree.add(j)
        s.W = W; s.t = []
        for j in range(d):
            p = s.par[j]
            if p < 0: s.t.append(np.array([[(((X[:, j] == v) & (y == c)).sum() + a) / ((y == c).sum() + 2 * a) for v in (0, 1)] for c in (0, 1)]))
            else: s.t.append(np.array([[[(((X[:, j] == v) & (X[:, p] == u) & (y == c)).sum() + a) / (((X[:, p] == u) & (y == c)).sum() + 2 * a)
                                         for v in (0, 1)] for u in (0, 1)] for c in (0, 1)]))
        return s
    def predict_proba(s, X):
        lj = np.tile(np.log(s.prior), (len(X), 1))
        for j in range(s.d):
            for c in (0, 1): lj[:, c] += np.log(s.t[j][c, X[:, j]] if s.par[j] < 0 else s.t[j][c, X[:, s.par[j]], X[:, j]])
        p = np.exp(lj - lj.max(1, keepdims=True)); return p / p.sum(1, keepdims=True)
tan = TAN(1).fit(Xtr, ytr); pt = tan.predict_proba(Xte)[:, 1]
R["q7_seed42"] = {"NB4": [acc(p4, yte), logloss(p4, yte)], "NB6": [acc(p6, yte), logloss(p6, yte)], "TAN6": [acc(pt, yte), logloss(pt, yte)]}
R["q7_parents"] = tan.par
R["q7_params"] = {"NB6": 1 + 6 * 2, "TAN6": 1 + 2 + 5 * 4}
res = {k: [] for k in ("NB4", "NB6", "TAN6")}; pool = {k: ([], []) for k in res}
for s in range(100, 120):
    a, b, c_, d_ = split(s)
    for k, p in (("NB4", CatNB(1).fit(a[:, :4], b).predict_proba(c_[:, :4])[:, 1]), ("NB6", CatNB(1).fit(a, b).predict_proba(c_)[:, 1]),
                 ("TAN6", TAN(1).fit(a, b).predict_proba(c_)[:, 1])):
        res[k].append((acc(p, d_), logloss(p, d_))); pool[k][0].append(p); pool[k][1].append(d_)
R["q7_20seeds"] = {k: {"acc": [float(np.mean([r[0] for r in v])), float(np.std([r[0] for r in v]))],
                       "ll": [float(np.mean([r[1] for r in v])), float(np.std([r[1] for r in v]))]} for k, v in res.items()}
import time
t0 = time.perf_counter(); [CatNB(1).fit(Xtr, ytr) for _ in range(20)]; t_nb = (time.perf_counter() - t0) / 20
t0 = time.perf_counter(); [TAN(1).fit(Xtr, ytr) for _ in range(20)]; t_tan = (time.perf_counter() - t0) / 20
R["q7_fit_time_ms"] = {"NB6": t_nb * 1e3, "TAN6": t_tan * 1e3}
fig, axs = plt.subplots(1, 3, figsize=(10, 2.9))
ax = axs[0]; ax.axis("off"); ax.set_xlim(-.5, 5.5); ax.set_ylim(-3, 1.4); ax.set_title("(a) learned TAN structure (arrows: parent→child)", fontsize=8)
ax.text(2.5, 1, "Y (class)", ha="center", bbox=dict(boxstyle="round", fc="#fee2e2", ec="r"), fontsize=8)
for j in range(6):
    ax.text(j, -1, f"x{j+1}", ha="center", bbox=dict(boxstyle="round", fc="#dbeafe", ec="b"), fontsize=8)
    ax.annotate("", (j, -.75), (2.5, .8), arrowprops=dict(arrowstyle="->", color="r", alpha=.35))
    if tan.par[j] >= 0: ax.annotate("", (j, -1.15), (tan.par[j], -1.15), arrowprops=dict(arrowstyle="->", connectionstyle="arc3,rad=.45", color="b"))
for k, c in (("NB4", "tab:green"), ("NB6", "tab:red"), ("TAN6", "tab:blue")):
    xs_, ys_ = reliability(np.concatenate(pool[k][0]), np.concatenate(pool[k][1])); axs[1].plot(xs_, ys_, "o-", c=c, label={"NB4": "NB, 4 features", "NB6": "NB, +2 redundant", "TAN6": "TAN, +2 redundant"}[k], ms=3)
axs[1].plot([0, 1], [0, 1], "k:"); axs[1].set(xlabel="predicted P(y=1)", ylabel="observed frequency", title="(b) reliability (20 seeds pooled)"); axs[1].legend(fontsize=7)
axs[2].boxplot([[r[1] for r in res[k]] for k in res], tick_labels=["NB4", "NB6", "TAN6"]); axs[2].set(ylabel="test log-loss", title="(c) log-loss over 20 seeds"); save("q7")

json.dump(R, open(os.path.join(HERE, "results.json"), "w"), indent=1, default=float)
print("done")
