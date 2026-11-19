#!/usr/bin/env python3
"""
lexsim.py - minimal LEX/flex semantics simulator (for verification when flex is unavailable)

It READS the real rules from lexer.l (definitions + rules section), translates each flex
pattern to a Python regular expression and applies flex's two rules:
   1. the rule that matches the LONGEST prefix of the remaining input wins
   2. on a tie, the rule that appears FIRST in the file wins
The actions (EMIT/ERR/SEC/SECHEX/COMMENT) are re-implemented with the same output format
as the C helper functions in lexer.l.

Usage:  python3 tools/lexsim.py lexer.l tests/t1_valid.c
Note : this is NOT a replacement for flex; the authoritative output is the one produced by
       `flex lexer.l && gcc lex.yy.c -o lexer`.  The two should be identical.
"""
import re, sys

def split_sections(text):
    parts = re.split(r'^%%\s*$', text, flags=re.M)
    return parts[0], parts[1], parts[2] if len(parts) > 2 else ""

def parse_defs(defs):
    d = {}
    for line in defs.splitlines():
        m = re.match(r'^([A-Z_][A-Z_0-9]*)\s+(\S.*?)\s*$', line)
        if m and not line.startswith('%'):
            d[m.group(1)] = m.group(2)
    return d

def convert(pat, defs):
    """flex regular expression -> python regular expression"""
    out, i, n = [], 0, len(pat)
    while i < n:
        c = pat[i]
        if c == '"':                       # quoted literal
            j = i + 1; lit = ""
            while pat[j] != '"':
                if pat[j] == '\\':
                    nxt = pat[j + 1]
                    lit += {'n': '\n', 't': '\t', 'r': '\r'}.get(nxt, nxt); j += 2
                else:
                    lit += pat[j]; j += 1
            out.append(re.escape(lit)); i = j + 1
        elif c == '[':                     # character class
            j = i + 1; body = "["
            if pat[j] == '^': body += '^'; j += 1
            while pat[j] != ']':
                if pat[j] == '\\':
                    nxt = pat[j + 1]
                    if nxt in '"':  body += '"'
                    elif nxt in '[]\\-^': body += '\\' + nxt
                    elif nxt == 'x': body += pat[j:j + 4]; j += 2
                    else: body += '\\' + nxt
                    j += 2
                else:
                    ch = pat[j]; body += '\\' + ch if ch == '[' else ch; j += 1
            out.append(body + "]"); i = j + 1
        elif c == '{':
            j = pat.index('}', i); name = pat[i + 1:j]
            if re.fullmatch(r'\d+(,\d*)?', name): out.append('{' + name + '}')
            else: out.append('(?:' + convert(defs[name], defs) + ')')
            i = j + 1
        elif c == '\\':
            nxt = pat[i + 1]
            out.append({'n': r'\n', 't': r'\t', 'r': r'\r'}.get(nxt, re.escape(nxt)) if nxt != 'x' else pat[i:i + 4])
            i += 4 if nxt == 'x' else 2
        elif c == '.':
            out.append(r'[^\n]'); i += 1
        else:
            out.append(c); i += 1
    return "".join(out)

def parse_rules(rules, defs):
    res = []
    for line in rules.splitlines():
        if not line.strip() or line[0] in ' \t':
            continue
        i, inq, inb = 0, False, False       # pattern ends at first unquoted white space
        while i < len(line):
            ch = line[i]
            if ch == '\\': i += 2; continue
            if inq:
                if ch == '"': inq = False
            elif inb:
                if ch == ']': inb = False
            elif ch == '"': inq = True
            elif ch == '[': inb = True
            elif ch in ' \t': break
            i += 1
        pat, act = line[:i], line[i:].strip()
        res.append((pat, re.compile(convert(pat, defs), re.S), act))
    return res

def show(s):
    out = "".join('.' if ord(c) < 32 or ord(c) > 126 else c for c in s[:30])
    return out + ("..." if len(s) > 30 else "")

def run(lfile, src_file):
    d, r, _ = split_sections(open(lfile, encoding="utf-8").read())
    defs = parse_defs(d)
    rules = parse_rules(r, defs)
    data = open(src_file, "rb").read().decode("latin-1")
    pos, out = 0, []
    order, counts = [], {}
    total = comments = errors = secs = 0

    def bump(t):
        if t not in counts: order.append(t); counts[t] = 0
        counts[t] += 1

    out.append("%-6s %-20s %s" % ("LINE", "TOKEN TYPE", "LEXEME"))
    out.append("------ -------------------- ------------------------------")
    while pos < len(data):
        best, bl, bact = None, 0, None
        for pat, rx, act in rules:
            m = rx.match(data, pos)
            if m and m.end() - pos > bl:
                best, bl, bact = pat, m.end() - pos, act
        if best is None:                       # flex default rule: echo
            pos += 1; continue
        text = data[pos:pos + bl]
        line = data.count("\n", 0, pos) + 1
        m = re.search(r'(EMIT|ERR|SECHEX|SEC)\("([^"]*)"\)|COMMENT\(\)', bact)
        if m:
            kind = m.group(1)
            if m.group(0) == "COMMENT()": comments += 1
            elif kind == "EMIT":
                out.append("%-6d %-20s %s" % (line, m.group(2), show(text))); bump(m.group(2)); total += 1
            elif kind == "ERR":
                out.append("%-6d %-20s %s   <-- %s" % (line, "LEXICAL_ERROR", show(text), m.group(2))); bump("LEXICAL_ERROR"); errors += 1
            elif kind == "SEC":
                out.append("%-6d %-20s %s   <-- %s" % (line, "SECURITY_RISK", show(text), m.group(2))); bump("SECURITY_RISK"); secs += 1
            elif kind == "SECHEX":
                hx = ""
                for ch in text:
                    if len(hx) >= 40: break
                    hx += "<%02X>" % ord(ch)
                out.append("%-6d %-20s %s   <-- %s" % (line, "SECURITY_RISK", hx, m.group(2))); bump("SECURITY_RISK"); secs += 1
        pos += bl
    out.append("")
    out.append("================ SUMMARY ================")
    out.append("Valid tokens        : %d" % total)
    out.append("Comments skipped    : %d" % comments)
    out.append("Lexical errors      : %d" % errors)
    out.append("Security warnings   : %d" % secs)
    out.append("---------- tokens by type ---------------")
    for t in order: out.append("%-20s %d" % (t, counts[t]))
    return "\n".join(out) + "\n", dict(total=total, comments=comments, errors=errors, security=secs, counts=counts, order=order)

if __name__ == "__main__":
    text, _ = run(sys.argv[1], sys.argv[2])
    sys.stdout.write(text)
