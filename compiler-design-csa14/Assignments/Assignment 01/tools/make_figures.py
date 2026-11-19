#!/usr/bin/env python3
"""Generates all diagrams (Graphviz) and charts (matplotlib) used in the report -> figures/"""
import subprocess, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import lexsim
ROOT = os.path.join(os.path.dirname(__file__), "..")
FIG = os.path.join(ROOT, "figures"); os.makedirs(FIG, exist_ok=True)
FONT = 'fontname="Helvetica"'

def dot(name, src):
    p = os.path.join(FIG, name + ".dot"); open(p, "w").write(src)
    subprocess.run(["dot", "-Tpng", "-Gdpi=170", p, "-o", os.path.join(FIG, name + ".png")], check=True)
    os.remove(p)

BASE = f'graph [{FONT} bgcolor="white" pad=0.25]; node [{FONT} fontsize=11]; edge [{FONT} fontsize=10];'

# 1 --- compiler phases
dot("phases", f'''digraph G {{ rankdir=LR; {BASE}
 node [shape=box style="rounded,filled" fillcolor="#DEEAF6" color="#2E75B6" margin="0.15,0.1"];
 src [label="Source\\nprogram" shape=note fillcolor="#FFF2CC" color="#BF9000"];
 lex [label="Lexical\\nanalysis\\n(LEX)" fillcolor="#C6E0B4" color="#548235" penwidth=2];
 syn [label="Syntax\\nanalysis\\n(YACC)"]; sem [label="Semantic\\nanalysis"]; ir [label="Intermediate\\ncode"]; opt [label="Code\\noptimisation" fillcolor="#EDEDED" color="#7F7F7F"]; gen [label="Code\\ngeneration" fillcolor="#EDEDED" color="#7F7F7F"];
 tgt [label="Target\\ncode" shape=note fillcolor="#FFF2CC" color="#BF9000"];
 src->lex [label="characters"]; lex->syn [label="tokens"]; syn->sem [label="parse tree"]; sem->ir [label="annotated tree"]; ir->opt; opt->gen; gen->tgt;
 st [label="Symbol table &\\nerror handler" shape=box style="filled" fillcolor="#F2F2F2" color="#7F7F7F"];
 lex->st [style=dashed dir=both constraint=false]; syn->st [style=dashed dir=both constraint=false]; sem->st [style=dashed dir=both constraint=false];
 subgraph cluster_f {{ label="FRONT END (analysis)"; style="dashed"; color="#2E75B6"; fontcolor="#1F3864"; lex; syn; sem; ir; }}
 subgraph cluster_b {{ label="BACK END (synthesis)"; style="dashed"; color="#7F7F7F"; fontcolor="#595959"; opt; gen; }}
}}''')

# 2 --- scanner/parser interaction
dot("scanner_parser", f'''digraph G {{ rankdir=LR; {BASE}
 node [shape=box style="rounded,filled" fillcolor="#DEEAF6" color="#2E75B6" margin="0.2,0.12"];
 s [label="Source file\\n(characters)" shape=note fillcolor="#FFF2CC" color="#BF9000"];
 l [label="Lexical analyser\\nyylex()" fillcolor="#C6E0B4" color="#548235" penwidth=2];
 p [label="Parser\\nyyparse()"];
 s -> l [label="read chars"]; 
 p -> l [label="getNextToken()" color="#C00000" fontcolor="#C00000"];
 l -> p [label="token + attribute\\n(type, lexeme, line)" color="#2E75B6" fontcolor="#2E75B6"];
 t [label="Symbol table" shape=cylinder fillcolor="#F2F2F2" color="#7F7F7F"];
 l -> t [label="install\\nidentifier" style=dashed];
 r [label="Security report\\n(errors, risks)" shape=note fillcolor="#FCE4D6" color="#C55A11"];
 l -> r [style=dashed label="diagnostics"];
}}''')

# 3 --- flex workflow
dot("workflow", f'''digraph G {{ rankdir=LR; {BASE}
 node [shape=box style="rounded,filled" fillcolor="#DEEAF6" color="#2E75B6" margin="0.18,0.12"];
 l [label="lexer.l\\n(LEX specification)\\n definitions | rules | user code" shape=note fillcolor="#FFF2CC" color="#BF9000"];
 f [label="flex\\n(LEX compiler)" fillcolor="#C6E0B4" color="#548235"];
 c [label="lex.yy.c\\n(DFA tables + yylex())" shape=note];
 g [label="gcc"  fillcolor="#C6E0B4" color="#548235"];
 e [label="lexer\\n(executable)" shape=component];
 i [label="source.c\\n(test input)" shape=note fillcolor="#FFF2CC" color="#BF9000"];
 o [label="token stream\\n+ errors + security\\nreport" shape=note fillcolor="#FCE4D6" color="#C55A11"];
 l->f->c->g->e; i->e; e->o;
}}''')

# 4 --- decision flow of longest match
dot("longest_match", f'''digraph G {{ rankdir=TB; {BASE}
 node [shape=box style="rounded,filled" fillcolor="#DEEAF6" color="#2E75B6" margin="0.15,0.1"];
 a [label="Start at next unread character" shape=ellipse fillcolor="#FFF2CC" color="#BF9000"];
 b [label="Run all rule patterns (merged DFA)\\nin parallel from this position"];
 c [label="Remember the LONGEST prefix\\nthat reached an accepting state" ];
 d [label="Several rules accept the same length?" shape=diamond fillcolor="#FFF2CC" color="#BF9000"];
 e [label="Choose the rule written FIRST in lexer.l"];
 f [label="Choose the single longest rule"];
 g [label="Set yytext / yyleng, advance input,\\nexecute action (EMIT / ERR / SEC / skip)" fillcolor="#C6E0B4" color="#548235"];
 h [label="No pattern matches?\\n(catch-all '.' rule is the last rule,\\nso an unknown char is reported as an error)" shape=box fillcolor="#FCE4D6" color="#C55A11"];
 a->b->c->d; d->e [label="yes"]; d->f [label="no"]; e->g; f->g; g->a [label="repeat until EOF" style=dashed]; b->h [style=dashed label="nothing accepts"]; h->g [style=dashed];
}}''')

def dfa(name, body, extra=""):
    dot(name, f'''digraph G {{ rankdir=LR; {BASE} {extra}
 node [shape=circle style=filled fillcolor="#DEEAF6" color="#2E75B6" width=0.5 fixedsize=false];
 start [shape=point width=0.1 color="#1F3864"];
 {body}
}}''')

# 5 --- identifier DFA
dfa("dfa_identifier", '''
 q0 [label="q0"]; q1 [label="q1" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 start->q0; q0->q1 [label="letter | _"]; q1->q1 [label="letter | digit | _"];
 d [label="dead" fillcolor="#FCE4D6" color="#C55A11"]; q0->d [label="digit / other" style=dashed color="#C55A11" fontcolor="#C55A11"];
''')

# 6 --- numeric constants DFA
dfa("dfa_numbers", '''
 q0 [label="q0"]; z [label="zero\\n(0)" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 dec [label="decimal\\n[1-9][0-9]*" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 oct [label="octal\\n0[0-7]+" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 x [label="0x"]; hex [label="hex\\ndigits" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 b [label="0b"]; bin [label="binary\\ndigits" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 dot1 [label="d+ ."]; fl [label="float\\nd+.d*" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 e1 [label="e / E"]; e2 [label="e sign"]; ex [label="exponent\\ndigits" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 err [label="ERROR\\n(malformed)" fillcolor="#FCE4D6" color="#C55A11" shape=box style="rounded,filled"];
 start->q0; q0->z [label="0"]; q0->dec [label="1-9"]; dec->dec [label="0-9"]; dec->dot1 [label="."]; z->dot1 [label="."]; dot1->fl [label="digit"]; fl->fl [label="0-9"];
 z->oct [label="0-7"]; oct->oct [label="0-7"]; z->x [label="x|X"]; x->hex [label="hex digit"]; hex->hex [label="hex digit"];
 z->b [label="b|B"]; b->bin [label="0|1"]; bin->bin [label="0|1"];
 dec->e1 [label="e|E"]; fl->e1 [label="e|E"]; e1->e2 [label="+|-"]; e1->ex [label="digit"]; e2->ex [label="digit"]; ex->ex [label="0-9"];
 oct->err [label="8|9" color="#C55A11" fontcolor="#C55A11" style=dashed]; x->err [label="no digit" color="#C55A11" fontcolor="#C55A11" style=dashed];
 e1->err [label="no digit" color="#C55A11" fontcolor="#C55A11" style=dashed]; fl->err [label="second '.'" color="#C55A11" fontcolor="#C55A11" style=dashed];
 dec->err [label="letter" color="#C55A11" fontcolor="#C55A11" style=dashed];
''', 'ranksep=0.5; nodesep=0.35;')

# 7 --- comment DFA
dfa("dfa_comment", '''
 q0 [label="q0"]; s [label="/"]; sl [label="//...\\nline comment" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 c1 [label="in /*\\ncomment"]; c2 [label="saw *\\n(inside)"]; ok [label="comment\\nclosed */" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 eof [label="EOF reached\\nUNTERMINATED\\nCOMMENT" shape=box style="rounded,filled" fillcolor="#FCE4D6" color="#C55A11"];
 start->q0; q0->s [label="/"]; s->sl [label="/"]; sl->sl [label="any except \\\\n"]; s->c1 [label="*"]; c1->c1 [label="any except *"]; c1->c2 [label="*"]; c2->c2 [label="*"]; c2->c1 [label="any except * and /"]; c2->ok [label="/"];
 c1->eof [label="EOF" style=dashed color="#C55A11" fontcolor="#C55A11"]; c2->eof [label="EOF" style=dashed color="#C55A11" fontcolor="#C55A11"];
''')

# 8 --- string DFA
dfa("dfa_string", '''
 q0 [label="q0"]; s1 [label="in string"]; es [label="after \\\\"]; ok [label="STRING_LITERAL" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 err [label="UNTERMINATED\\nSTRING" shape=box style="rounded,filled" fillcolor="#FCE4D6" color="#C55A11"];
 start->q0; q0->s1 [label="\\""]; s1->s1 [label="any except \\", \\\\, newline"]; s1->es [label="\\\\"]; es->s1 [label="any except newline"]; s1->ok [label="\\""];
 s1->err [label="newline / EOF" style=dashed color="#C55A11" fontcolor="#C55A11"]; es->err [label="newline" style=dashed color="#C55A11" fontcolor="#C55A11"];
''')

# 9 --- Thompson NFA for  a(b|c)*
dot("nfa_thompson", f'''digraph G {{ rankdir=LR; {BASE}
 node [shape=circle style=filled fillcolor="#DEEAF6" color="#2E75B6" width=0.45];
 start [shape=point width=0.1];
 s0 [label="0"]; s1 [label="1"]; s2 [label="2"]; s3 [label="3"]; s4 [label="4"]; s5 [label="5"]; s6 [label="6"]; s7 [label="7"]; s8 [label="8"]; s9 [label="9" shape=doublecircle fillcolor="#C6E0B4" color="#548235"];
 start->s0; s0->s1 [label="a"]; s1->s2 [label="ε"]; s1->s8 [label="ε" constraint=false]; s2->s3 [label="ε"]; s2->s5 [label="ε"]; s3->s4 [label="b"]; s5->s6 [label="c"]; s4->s7 [label="ε"]; s6->s7 [label="ε"]; s7->s2 [label="ε" constraint=false]; s7->s8 [label="ε"]; s8->s9 [label="ε"];
 s1->s8 [style=invis];
}}''')

# 10 --- matplotlib charts from real run results
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
tests = [("t1_valid", "T1 valid"), ("t2_invalid_tokens", "T2 invalid"), ("t3_unterminated_comment", "T3 comment"), ("t4_security", "T4 security"), ("t5_edge_cases", "T5 edge")]
res = {}
for f, lab in tests:
    _, r = lexsim.run(os.path.join(ROOT, "lexer.l"), os.path.join(ROOT, "tests", f + ".c")); res[lab] = r
json.dump({k: {"total": v["total"], "comments": v["comments"], "errors": v["errors"], "security": v["security"]} for k, v in res.items()}, open(os.path.join(ROOT, "expected", "summary.json"), "w"), indent=1)
labs = list(res)
fig, ax = plt.subplots(figsize=(7.5, 3.6), dpi=170)
w = 0.2; xs = range(len(labs))
for i, (key, col, nm) in enumerate([("total", "#2E75B6", "valid tokens"), ("comments", "#7F7F7F", "comments skipped"), ("errors", "#C55A11", "lexical errors"), ("security", "#BF9000", "security warnings")]):
    b = ax.bar([x + (i - 1.5) * w for x in xs], [res[l][key] for l in labs], w, label=nm, color=col)
    for r in b: ax.text(r.get_x() + r.get_width() / 2, r.get_height() + 1.5, int(r.get_height()), ha="center", fontsize=7)
ax.set_xticks(list(xs)); ax.set_xticklabels(labs, fontsize=8); ax.set_ylabel("count"); ax.set_title("Lexer results per test file", fontsize=10)
ax.legend(fontsize=8, frameon=False); ax.spines[["top", "right"]].set_visible(False); fig.tight_layout(); fig.savefig(os.path.join(FIG, "chart_results.png")); plt.close(fig)

# token distribution for all tests combined
tot = {}
for r in res.values():
    for t, c in r["counts"].items(): tot[t] = tot.get(t, 0) + c
items = sorted(tot.items(), key=lambda kv: kv[1])
fig, ax = plt.subplots(figsize=(7.5, 4.2), dpi=170)
cols = {"LEXICAL_ERROR": "#C55A11", "SECURITY_RISK": "#BF9000"}
ax.barh([k for k, _ in items], [v for _, v in items], color=[cols.get(k, "#2E75B6") for k, _ in items])
for i, (k, v) in enumerate(items): ax.text(v + 1, i, str(v), va="center", fontsize=7)
ax.set_title("Token categories over all five test files", fontsize=10); ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout(); fig.savefig(os.path.join(FIG, "chart_categories.png")); plt.close(fig)
print("figures ok", os.listdir(FIG))
