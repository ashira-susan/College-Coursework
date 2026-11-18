# CSA1406 Compiler Design – Assignment 1
**Design and Implementation of a LEX-Based Lexical Analyzer for Secure Source Code Processing**

Report: `CSA1406_Assignment1_Lexical_Analyzer.docx` (editable, 40 pages).

## Build and run
```bash
sudo apt install flex gcc make     # or MSYS2/Cygwin/WSL on Windows
make                               # flex lexer.l && gcc lex.yy.c -o lexer
./lexer tests/t1_valid.c           # LINE | TOKEN TYPE | LEXEME + summary
make test                          # compares all 5 tests with expected/*.out.txt
```

## What it does
* Recognises 17 token categories of a C-like language (keywords, identifiers, 5 numeric forms, char/string literals, 6 operator families, delimiters, preprocessor lines); comments and white space are skipped.
* Reports 11 kinds of lexical error (invalid character, malformed numbers, unterminated string/char/comment, ...) and continues scanning.
* Flags 10 kinds of security finding (gets/strcpy/system..., `%n` format strings, path-traversal/shell strings, rand, goto/asm, #pragma, over-long identifiers, trigraphs, hidden control/non-ASCII bytes).

## Honesty note
The files in `expected/` were generated with `tools/lexsim.py`, a small simulator that reads the real rules from `lexer.l` and applies LEX's longest-match / first-rule semantics, because flex was not available where the project was prepared. The C code of `lexer.l` was syntax-checked with `tools/check_c.py` (gcc). Run `make test` on your machine: PASS means flex's output equals the expected output. Add your own screenshots to the report.

## Layout
`lexer.l` (specification) · `tests/` · `expected/` · `tools/` (lexsim.py, check_c.py, make_figures.py) · `figures/` · `docbuild/` (generates the docx: `cd docbuild && node build.js`).
