# Project notes

Use this file when writing the report, preparing screenshots and getting ready for the viva.

## 1. Architecture

```
 React UI  ──HTTP /api/compile──▶  FastAPI  ──stdin──▶  minicc (Flex + Bison + C)
 (editor, tabs)                   (runner.py)           │
      ▲                                                  ├─ lexer.l   tokens, lexical errors
      │          JSON report                             ├─ parser.y  syntax + semantic errors, TAC
      └──────────────────────────────◀───────────────────┘  common.c  symbol table, quadruples, JSON
                         interpreter.py runs the quadruples to show program output
```

Flex and Bison are the GNU replacements for LEX and YACC. They read the same `.l` and `.y` formats,
so the project is a LEX/YACC project.

## 2. How each module works

**Lexical analysis (`lexer.l`).** Regular expressions define each token. Flex picks the longest match, and
the first rule when lengths tie, so `==` beats `=`, and `9abc` is caught as an invalid token before it can be
read as the integer `9`. Comments and whitespace are skipped while line and column are tracked. Invalid
characters (`$`, `@`, `&`, smart quotes) are reported and scanning continues.

**Syntax analysis (`parser.y`).** Bison builds an LALR(1) parser from the grammar.
Operator precedence and associativity are declared with `%left` and `%precedence`, and the dangling `else` is
resolved with `%prec LOWER_THAN_ELSE`. Error recovery uses the `error` token:
`stmt: error ';'` skips to the next semicolon, and a bad condition recovers at `)`. This lets one run
report several errors. The grammar has no shift/reduce or reduce/reduce conflicts.

**Intermediate code generation.** Code is produced during parsing (syntax-directed translation).
Each expression carries an attribute `{place, type}`. A binary operation creates a temporary:
`t3 = t1 + t2`. Control flow uses labels:

```
if (c) S1 else S2          while (c) S
    ifFalse c goto L1      L1:
    S1                         ifFalse c goto L2
    goto L2                    S
L1: S2                         goto L1
L2:                        L2:
```

Code is shown only for error-free programs, as in a real compiler.

## 3. Grammar

```
program      → statement*
statement    → declaration | assignment | if_stmt | while_stmt | print_stmt | block | ';'
block        → '{' statement* '}'
declaration  → type declarator (',' declarator)* ';'
type         → 'int' | 'float'
declarator   → IDENTIFIER ('=' expr)?
assignment   → IDENTIFIER '=' expr ';'
if_stmt      → 'if' '(' expr ')' statement ('else' statement)?
while_stmt   → 'while' '(' expr ')' statement
print_stmt   → 'print' '(' expr ')' ';'
expr         → expr binop expr | ('-' | '!') expr | '(' expr ')' | INTEGER | FLOAT | IDENTIFIER
```

Precedence, high to low: `! unary-`, `* / %`, `+ -`, `< > <= >=`, `== !=`, `&&`, `||`.

## 4. Test plan (screenshots for the report)

Run `python tests/run_tests.py` (36 checks) and capture the app for these programs:

| Example in the app | Shows |
|---|---|
| Arithmetic | tokens, precedence in the TAC (`t1 = b * 2` before `t2 = a + t1`) |
| If else | `ifFalse`, `goto`, labels |
| While loop | loop labels and back jump; Output tab shows 120 and 55 |
| Nested control | if inside while |
| Syntax errors | several syntax errors with line:col, code not generated |
| Lexical errors | invalid token `2total`, `@`, `&`, unterminated comment |
| Semantic errors | redeclaration, undeclared variable, narrowing and `%` problems |

## 5. Suggested report outline

1. Introduction and objectives
2. Phases of a compiler (short theory: lexical, syntax, semantic, ICG, optimisation, code generation)
3. Language specification (tokens, grammar, precedence)
4. System design (architecture diagram, modules, data flow)
5. Implementation: lexer.l, parser.y, TAC scheme, error handling, web interface
6. Results: screenshots from section 4, test table
7. Limitations and future work
8. Conclusion, references (Aho, Lam, Sethi, Ullman, *Compilers: Principles, Techniques and Tools*; the Flex and Bison manuals)

## 6. Likely viva questions

- **LEX vs Flex, YACC vs Bison?** Flex and Bison are the GNU versions; same file format, more features.
- **What is `yylval` / `yylloc`?** `yylval` passes a token's value to the parser; `yylloc` passes its line and column.
- **How are shift/reduce conflicts resolved?** By precedence and associativity declarations; the dangling else by `%prec`.
- **What is panic-mode recovery?** On an error the parser discards input until a synchronising token (`;` or `)`) and continues.
- **Why three-address code?** Each instruction has at most one operator and three addresses, so it is easy to optimise and to translate to machine code.
- **Quadruples vs triples?** Quadruples store the result name explicitly; triples refer to results by instruction index.
- **What does `ifFalse` do?** Jumps to the label when the condition is zero.
- **LALR(1) meaning?** Look-Ahead LR with one token of lookahead; Bison's default parsing method.

## 7. Limitations and ideas for more marks

- One global scope (add block scopes with a stack of symbol tables).
- No functions, arrays or strings. `for` loops, `else if`, `break` and `continue` would be natural next steps.
- Add an optimisation pass on the quadruples: constant folding (`2 * 3` → `6`), dead temporaries, strength reduction.
- Generate target code (x86-64 or a small stack machine) from the TAC.
- Show the parse tree or an abstract syntax tree in the UI.
- Show the DFA/NFA for the token patterns in the report.
