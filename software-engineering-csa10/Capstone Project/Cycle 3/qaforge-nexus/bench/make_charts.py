"""Charts for the performance report. Palette validated with dataviz validate_palette.js: amber v2.0, blue v3.0, magenta LSH."""
import json, os, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results'); OUT = os.path.join(os.path.dirname(R), '..', 'docs', 'perf')
os.makedirs(OUT, exist_ok=True)
A2, A3, AL, INK, MUTE, GRID = '#D97706', '#1D4ED8', '#B91C7A', '#1F2937', '#6B7280', '#E5E7EB'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'axes.edgecolor': GRID, 'axes.labelcolor': MUTE, 'xtick.color': MUTE, 'ytick.color': MUTE, 'axes.titlecolor': INK, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': .6, 'figure.dpi': 200})
v2 = json.load(open(f'{R}/v2-latency.json')); v3 = json.load(open(f'{R}/v3-latency.json')); acc = json.load(open(f'{R}/accuracy.json'))
X = [s['total_defects'] for s in v2['scales']]
def line(ax, ys, color, label, ls='-', dy=1.0):
    ax.plot(X, ys, ls, color=color, lw=2, marker='o', ms=5, mec='white', mew=1)
    ax.annotate(f'{label}\n{ys[-1]:,.0f} ms' if ys[-1] >= 10 else f'{label}\n{ys[-1]:.1f} ms', (X[-1], ys[-1]), xytext=(7, 0), textcoords='offset points', ha='left', va='center', color=color, fontsize=7.5, fontweight='bold')
fig, axs = plt.subplots(2, 3, figsize=(10.5, 5.6)); axs = axs.ravel()
panels = [('traceability', 'Traceability matrix'), ('list_first_page', 'Defect list, first page'), ('search_exact', 'Search (exact term)'), ('dashboard', 'Dashboard'), ('page_mid_offset', 'Deep page (middle of list)'), ('search_typo', 'Search (one-typo term)')]
for ax, (k, t) in zip(axs, panels):
    a = [s['endpoints'][k]['p50'] for s in v2['scales']]; b = [s['endpoints'][k]['p50'] for s in v3['scales']]
    line(ax, a, A2, 'v2.0', dy=1); line(ax, b, A3, 'v3.0', dy=-1)
    if k == 'page_mid_offset':
        c = [s['endpoints']['page_mid_cursor']['p50'] for s in v3['scales']]; ax.plot(X, c, '--', color=A3, lw=1.5, marker='o', ms=4, mec='white'); ax.annotate('cursor\n%.1f ms' % c[-1], (X[-1], c[-1]), xytext=(7, -16), textcoords='offset points', ha='left', va='center', color=A3, fontsize=7)
    ax.set_xlim(X[0] * .7, X[-1] * 9); ax.set_xscale('log'); ax.set_yscale('log'); ax.set_title(t, fontsize=9.5, loc='left', fontweight='bold'); ax.set_xticks(X); ax.set_xticklabels(['0.2k', '1.2k', '10k', '100k']); ax.minorticks_off()
    if k == 'search_typo': ax.annotate('v2.0: 0 results found', (X[0], a[0]), xytext=(8, 12), textcoords='offset points', color=A2, fontsize=7.5)
for ax in axs[::3]: ax.set_ylabel('median latency (ms, log)')
for ax in axs[3:]: ax.set_xlabel('defects in database')
fig.tight_layout(); fig.savefig(f'{OUT}/fig1_latency.png'); plt.close(fig)

sc = acc['scaling']['rows']; N = [r['n'] for r in sc]
fig, ax = plt.subplots(figsize=(7.2, 4))
nb = [r['n'] for r in sc if 'brute_pairs_ms' in r]
ax.plot(nb, [r['brute_pairs_ms'] for r in sc if 'brute_pairs_ms' in r], color=A2, lw=2, marker='o', ms=5, mec='white'); ax.annotate('brute force O(n²)', (nb[-1], sc[len(nb) - 1]['brute_pairs_ms']), xytext=(-6, 8), textcoords='offset points', ha='right', color=A2, fontsize=8.5, fontweight='bold')
ax.plot(N, [r['inv_pairs_ms'] for r in sc], color=A3, lw=2, marker='o', ms=5, mec='white'); ax.annotate('inverted index (v3.0 default)', (N[-1], sc[-1]['inv_pairs_ms']), xytext=(-6, 8), textcoords='offset points', ha='right', color=A3, fontsize=8.5, fontweight='bold')
ax.plot(N, [r['lsh_pairs_ms'] for r in sc], color=AL, lw=2, marker='o', ms=5, mec='white'); ax.annotate('MinHash-LSH (lossy)', (N[-1], sc[-1]['lsh_pairs_ms']), xytext=(-6, -14), textcoords='offset points', ha='right', color=AL, fontsize=8.5, fontweight='bold')
ax.set_xscale('log'); ax.set_yscale('log'); ax.set_xticks(N); ax.set_xticklabels([f'{n:,}' for n in N]); ax.minorticks_off(); ax.set_xlabel('defects compared'); ax.set_ylabel('time to find all duplicate pairs (ms, log)'); ax.set_title('Duplicate scan: time vs corpus size', loc='left', fontsize=10, fontweight='bold')
fig.tight_layout(); fig.savefig(f'{OUT}/fig2_dedup_scaling.png'); plt.close(fig)

def bars(ax, labels, vals, cols, fmt='{:.1f}%', ymax=None):
    b = ax.bar(labels, vals, color=cols, width=.62, edgecolor='white', linewidth=2)
    for r, v in zip(b, vals): ax.annotate(fmt.format(v), (r.get_x() + r.get_width() / 2, v), xytext=(0, 3), textcoords='offset points', ha='center', fontsize=8.5, color=INK)
    ax.grid(axis='x', visible=False); ax.set_ylim(0, ymax or max(vals) * 1.18)
n = acc['dedup_noisy']; fig, ax = plt.subplots(figsize=(6.4, 3.8))
bars(ax, ['v2.0\nexact title', 'v3.0\nMinHash-LSH', 'v3.0\ninverted index', 'v3.0\nbrute force'], [100 * n['v2_exact_title']['hit_at_1'], 100 * n['v3_lsh']['hit_at_1'], 100 * n['v3_inverted']['hit_at_1'], 100 * n['v3_brute']['hit_at_1']], [A2, AL, A3, A3], ymax=115)
ax.set_ylabel('original found at rank 1 (%)'); ax.set_title('Re-reported defects (25% words dropped, typos, reordered)', loc='left', fontsize=9.5, fontweight='bold'); fig.tight_layout(); fig.savefig(f'{OUT}/fig3_dedup_accuracy.png'); plt.close(fig)

sv = acc['search']['variants']; fig, ax = plt.subplots(figsize=(7, 3.8)); names = [('exact_case', 'exact case'), ('lowercase', 'lower case'), ('one_typo', 'one typo'), ('lowercase_typo', 'lower case + typo')]
import numpy as np; x = np.arange(4); w = .36
b2 = ax.bar(x - w / 2, [100 * sv[k]['v2']['recall_at_20'] for k, _ in names], w, color=A2, edgecolor='white', linewidth=2); b3 = ax.bar(x + w / 2, [100 * sv[k]['v3']['recall_at_20'] for k, _ in names], w, color=A3, edgecolor='white', linewidth=2)
for bs, c in ((b2, A2), (b3, A3)):
    for r in bs: ax.annotate(f'{r.get_height():.0f}', (r.get_x() + r.get_width() / 2, r.get_height()), xytext=(0, 3), textcoords='offset points', ha='center', fontsize=8.5, color=INK)
ax.set_xticks(x); ax.set_xticklabels([l for _, l in names]); ax.set_ylim(0, 118); ax.set_ylabel('recall@20 (%)'); ax.grid(axis='x', visible=False)
ax.text(.0, 1.02, 'v2.0', color=A2, transform=ax.transAxes, fontweight='bold', fontsize=9); ax.text(.07, 1.02, 'v3.0', color=A3, transform=ax.transAxes, fontweight='bold', fontsize=9)
ax.set_title('Search recall by query style', loc='right', fontsize=10, fontweight='bold'); fig.tight_layout(); fig.savefig(f'{OUT}/fig4_search.png'); plt.close(fig)

o = acc['apfd']['overall']; fig, ax = plt.subplots(figsize=(7, 3.8))
bars(ax, ['v2.0\nsuite order', 'random\n(mean of 200)', 'last-failed\nfirst', 'v3.0\nrisk score', 'optimal\n(upper bound)'], [o['v2_suite_order'], o['random_mean'], o['last_failed_first'], o['v3_risk'], o['optimal']], [A2, '#9CA3AF', '#9CA3AF', A3, '#D1D5DB'], fmt='{:.3f}', ymax=.85)
ax.set_ylabel('APFD (higher is better)'); ax.set_title('Test prioritisation: fault detection speed', loc='left', fontsize=10, fontweight='bold'); fig.tight_layout(); fig.savefig(f'{OUT}/fig5_apfd.png'); plt.close(fig)
print('charts ok')
