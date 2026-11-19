#!/usr/bin/env python3
"""Syntax-check the C parts of lexer.l (prologue, every rule action, user code) with gcc,
without needing flex.  Usage: python3 tools/check_c.py lexer.l"""
import re, sys, subprocess, tempfile, os
t = open(sys.argv[1]).read()
pro = re.search(r'%\{(.*?)%\}', t, re.S).group(1)
parts = re.split(r'^%%\s*$', t, flags=re.M)
acts = []
for l in parts[1].splitlines():
    if l and l[0] not in ' \t':
        m = re.search(r'\s(\{\s*[A-Z]+\([^;]*\);\s*\}|\{\s*/\*.*\*/\s*\})\s*$', l)
        if m: acts.append(m.group(1))
        else: print("no action parsed:", l)
code = "#include <stdio.h>\nextern char *yytext; extern int yyleng, yylineno; extern FILE *yyin; int yylex(void);\n" + pro + \
       "\nvoid actions(void){\n" + "\n".join(acts) + "\n}\n" + parts[2]
p = os.path.join(tempfile.mkdtemp(), "chk.c"); open(p, "w").write(code)
r = subprocess.run(["gcc", "-Wall", "-Wextra", "-fsyntax-only", p])
print("C syntax check:", "OK (%d actions)" % len(acts) if r.returncode == 0 else "FAILED")
