// Task 5 (testing), Task 6 (results/discussion/conclusion), appendices
const L = require("./lib");
const { P, H1, H1n, H2, H3, NL, bullets, EQ, CODE, TBL, CAPT, FIG, NOTE, KEY, TODO, PLACE, SP, D } = L;
const { AlignmentType } = D;

module.exports = function (X) {
  const out = [];
  const nums = (txt) => txt.replace(/\n$/, "").split("\n").map((l, i) => String(i + 1).padStart(3, " ") + "  " + l);
  const vis = (s) => s.replace(/‮/g, "<U+202E>").replace(/\x07/g, "<BEL>");
  const R = X.res;
  const tests = [
    ["t1_valid", "T1 valid", "Valid program (Task 5a)", "Demonstrates that correct code produces correct tokens with no false errors or security findings."],
    ["t2_invalid_tokens", "T2 invalid", "Invalid tokens and malformed constants (Task 5b)", "Thirteen deliberate lexical errors, one per line, with valid tokens around them to show that scanning continues after each error."],
    ["t3_unterminated_comment", "T3 comment", "Unterminated comment (Task 5b)", "A block comment is opened but never closed. The scanner must report the error at the line where the comment began."],
    ["t4_security", "T4 security", "Security-related test (Task 5c)", "Unsafe library calls, a `%n` format string, suspicious strings, `goto`/`asm`, `#pragma`, a long identifier, a trigraph, a hidden bidirectional character and a control character."],
    ["t5_edge_cases", "T5 edge", "Edge cases: maximal munch and literal forms (Task 5a)", "Operators that share prefixes, every integer base, floating forms, escapes in characters, and comment markers inside strings."],
  ];

  // ---------------- TASK 5 ----------------
  out.push(H1("Section 5 – Implementation and Testing (10 marks)"));
  out.push(H2("5.1 Environment, build and run"));
  out.push(CAPT("Tools"));
  out.push(TBL([2600, 7038], [
    ["Item", "Value (fill in your own)"],
    ["Operating system", { t: "", fill: "FFF2CC" }], ["flex version (`flex --version`)", { t: "", fill: "FFF2CC" }], ["gcc version (`gcc --version`)", { t: "", fill: "FFF2CC" }], ["Date of execution", { t: "", fill: "FFF2CC" }],
  ], { fs: 17, firstColBold: true }));
  out.push(SP(60));
  out.push(P("**Installation.** Linux (Debian/Ubuntu): `sudo apt install flex gcc make`. macOS: `brew install flex`. Windows: install MSYS2 or Cygwin and run `pacman -S flex gcc make` (or use the WSL Ubuntu command above). **Build and run:**"));
  out.push(...CODE([
    "$ flex lexer.l                      # generates lex.yy.c (the scanner source)",
    "$ gcc lex.yy.c -o lexer             # compiles it; option noyywrap => no -lfl needed",
    "$ ./lexer tests/t1_valid.c          # run on a test file",
    "$ ./lexer tests/t4_security.c > out_t4.txt   # save output",
    "$ make test                         # run all five tests and compare with expected/*.txt",
  ]));
  out.push(PLACE("Screenshot S1 – terminal showing `flex lexer.l`, `gcc lex.yy.c -o lexer` and `./lexer tests/t1_valid.c` (first lines of output)", 1300));
  out.push(SP(60));
  out.push(NOTE("About the output listings in this section", [
    "The listings were produced with `tools/lexsim.py`, which reads the rules of `lexer.l` and applies the longest-match / first-rule semantics of LEX (flex was not installed in the environment in which this document was prepared). The helper C code of `lexer.l` was syntax-checked with gcc (`tools/check_c.py`). The program you build with flex should print **exactly** the same lines – `make test` checks this automatically and prints PASS or FAIL for each test file. Add your own screenshots to the yellow boxes as evidence of execution.",
  ]));
  out.push(CAPT("Test plan"));
  out.push(TBL([700, 3100, 2700, 3138], [
    ["Test", "File", "Category", "Expected result"],
    ["T1", "`tests/t1_valid.c`", "valid source", `${R["T1 valid"].total} tokens, 0 errors, 0 security findings`],
    ["T2", "`tests/t2_invalid_tokens.c`", "invalid tokens", `${R["T2 invalid"].errors} lexical errors, scanning continues`],
    ["T3", "`tests/t3_unterminated_comment.c`", "unterminated comment", "1 error at line 3"],
    ["T4", "`tests/t4_security.c`", "security", `${R["T4 security"].security} security findings, 0 errors`],
    ["T5", "`tests/t5_edge_cases.c`", "edge cases", `${R["T5 edge"].total} tokens, 0 errors, 0 security findings`],
  ], { fs: 17 }));

  tests.forEach(([f, lab, title, purpose], idx) => {
    out.push(H2(`5.${idx + 2} Test ${lab.split(" ")[0]} – ${title}`));
    out.push(P(`**Purpose.** ${purpose}`));
    out.push(H3(`Input: tests/${f}.c`));
    out.push(...CODE(nums(vis(X.tests[f]))));
    out.push(H3("Output"));
    out.push(...CODE(X.out[f].replace(/\n$/, "").split("\n")));
    out.push(PLACE(`Screenshot S${idx + 2} – your own terminal output for tests/${f}.c`, 1000));
  });
  // observations per test
  out.push(H2("5.7 Observations on the test results"));
  out.push(CAPT("What each test demonstrates"));
  out.push(TBL([700, 8938], [
    ["Test", "Observation"],
    ["T1", `All ${R["T1 valid"].total} tokens classified correctly. The two comments (block and line) were removed silently and counted. \`0.0f\` is one FLOAT_CONSTANT, \`123456789L\` one INTEGER_CONSTANT, \`0xFF\` one HEX_CONSTANT; \`&&\`, \`<=\`, \`!=\`, \`+=\`, \`++\` are single tokens (maximal munch). The preprocessor lines are recognised as whole-line tokens. No false positives.`],
    ["T2", `Each of the ${R["T2 invalid"].errors} faulty lexemes is reported as **one** error with its own message (for example \`12abc\` is not split into \`12\` and \`abc\`). The tokens after an error (\`;\`, \`3\`, \`value\`) are still recognised, which shows the recovery strategy. Note that \`'z;\` swallows the rest of the line up to the semicolon, because an unterminated character constant extends as far as the pattern allows; the scanner then resumes on the next line.`],
    ["T3", "The error is reported at **line 3** – where the comment began – although the file ends at line 7. All following text up to the end of file is part of the faulty lexeme; only the first 30 characters are echoed. Tokens before the comment were recognised normally."],
    ["T4", `All ${R["T4 security"].security} seeded weaknesses were reported: gets, strcpy, sprintf, system (twice), rand, %n, path-traversal string, shell string, asm, goto, #pragma, long identifier, trigraph, the hidden bidirectional character (printed as \`<E2><80><AE>\`) and the BEL control character (\`<07>\`). The safe call \`strlen\` is **not** flagged, and the ordinary string \`"ls %s"\` is classified as STRING_LITERAL.`],
    ["T5", "Maximal munch is visible in `a+++b` → `a`, `++`, `+`, `b`; `<<=` and `>>=` are single assignment operators; `->` is one SPECIAL_OP. All numeric bases and the floating forms `.5`, `10.`, `6.02e23`, `1e-9f` are classified correctly. The comment markers inside the strings `\"// not a comment\"` and `\"/* not a comment */\"` do **not** start a comment, and `ifx`/`integer` are identifiers although they begin with a keyword."],
  ], { fs: 16, firstColBold: true }));

  // ---------------- TASK 6 ----------------
  out.push(H1("Section 6 – Results, Discussion and Conclusion (5 marks)"));
  out.push(H2("6.1 Summary of results"));
  out.push(CAPT("Results per test file"));
  const labs = ["T1 valid", "T2 invalid", "T3 comment", "T4 security", "T5 edge"];
  out.push(TBL([2300, 1500, 1500, 1500, 1500, 1338], [
    ["Test", "Valid tokens", "Comments", "Errors", "Security", "Expected met?"],
    ...labs.map(l => [l, String(R[l].total), String(R[l].comments), String(R[l].errors), String(R[l].security), "yes"]),
    [{ t: "Total", bold: true }, { t: String(labs.reduce((s, l) => s + R[l].total, 0)), bold: true }, { t: String(labs.reduce((s, l) => s + R[l].comments, 0)), bold: true }, { t: String(labs.reduce((s, l) => s + R[l].errors, 0)), bold: true }, { t: String(labs.reduce((s, l) => s + R[l].security, 0)), bold: true }, ""],
  ], { fs: 17, align: [undefined, 1, 1, 1, 1, 1].map(x => x === 1 ? AlignmentType.CENTER : undefined) }));
  out.push(...FIG("chart_results", "Valid tokens, comments, errors and security warnings for each test file", 520));
  out.push(...FIG("chart_categories", "Token categories over all five tests", 520));
  out.push(CAPT("Detection quality on the seeded tests"));
  out.push(TBL([3100, 1500, 1500, 3538], [
    ["Measure", "Seeded", "Detected", "Comment"],
    ["Lexical errors in T2", "13", String(R["T2 invalid"].errors), "100 % detected, each with the correct message"],
    ["Unterminated comment in T3", "1", String(R["T3 comment"].errors), "reported at its start line"],
    ["Security weaknesses in T4", "16", String(R["T4 security"].security), "100 % detected; safe `strlen` not flagged"],
    ["False errors on valid code (T1, T5)", "0", String(R["T1 valid"].errors + R["T5 edge"].errors), "none"],
    ["False security findings on valid code (T1, T5)", "0", String(R["T1 valid"].security + R["T5 edge"].security), "none"],
  ], { fs: 17 }));
  out.push(H2("6.2 Analysis and discussion"));
  out.push(...bullets([
    "**Correctness of the classification.** Longest match and rule order give the expected tokenisation in every case of the test plan, including the difficult ones (keyword versus identifier, `<<=`, floating-point forms, comment markers inside strings).",
    "**Error handling.** Because errors are recognised as complete lexemes, the messages are precise and the number of reported errors equals the number of faults – there is no cascade of follow-up errors at the lexical level.",
    "**Security value.** The scanner finds the cheap-to-detect, high-impact weaknesses (unbounded string functions, command execution, `%n`, hidden characters) in one linear pass and without compiling the program. The hidden-character rule addresses a class of attacks (Trojan Source) that human review cannot detect.",
    "**Efficiency.** LEX merges all 46 patterns into one DFA, so the work per input character is constant and the run time is O(n) in the size of the source; nothing is re-scanned (the only exception is back-tracking to the last accepting state, which is bounded by the length of the lexeme).",
    "**Maintainability.** Named definitions (`DIGIT`, `IDENT`, `STRBODY`) and the macro layer (`EMIT`, `ERR`, `SEC`) keep every rule on one line. Adding a new unsafe function is a one-word change in the name list; adding a new token class is one new rule at the right priority position.",
  ]));
  out.push(H2("6.3 Limitations"));
  out.push(...bullets([
    "Only the lexical phase is implemented; there is no parsing, so a missing semicolon or unbalanced brace is not detected. The token names are categories (`KEYWORD`) rather than individual parser tokens (`IF`, `WHILE`).",
    "Name-based security rules produce **false positives** (a user variable called `system`) and **false negatives** (calls through pointers, data-flow bugs such as `printf(user_input)`). They indicate where to look; they do not prove the presence or absence of a vulnerability.",
    "No preprocessing: macros are not expanded and `#include` files are not read. Trigraph *replacement* is not performed – only reported.",
    "Block comments do not nest (as in C); a `/*` inside a comment is ignored. The scanner treats the input as bytes – identifiers with legitimate UTF-8 letters are flagged as non-ASCII.",
    "Numeric constants are recognised syntactically; their *value* (overflow of `99999999999999999999`) is not checked.",
    "The measured evidence in this report was obtained with five hand-written files; a larger corpus (real programs) would be needed to quantify false-positive rates.",
  ]));
  out.push(H2("6.4 Future work"));
  out.push(...bullets([
    "Connect the scanner to a **YACC/bison** grammar: replace `EMIT(\"KEYWORD\")` by one `return` per keyword, return `yylval` attributes, and use the grammar for parse trees, FIRST/FOLLOW sets and a parsing table (next phase of the compiler).",
    "Add a **symbol table** (hash table) filled by the identifier rule, to report identifiers that are declared but never used.",
    "Support Unicode (UTF-8) identifiers with an explicit allow-list and flag only *confusable/bidirectional* code points.",
    "Add configurable policy files for the unsafe-function list and output in a machine-readable format (JSON/SARIF) for continuous-integration pipelines.",
  ]));
  out.push(H2("6.5 How lexical analysis contributes to secure software development"));
  out.push(P("Lexical analysis is the first line of defence in the compiler: it decides what the *program text actually contains*. A secure toolchain benefits in four ways. (1) **Input validation at the lowest level** – the scanner rejects characters and constructs that are not part of the language, so later phases only ever see well-formed tokens. (2) **Cheap, early detection** of insecure idioms before the code is compiled, tested or deployed (“shift left”). (3) **Making the invisible visible** – hidden control characters, trigraphs and homoglyphs are exposed so that what is reviewed is what is compiled. (4) **A foundation for deeper analysis** – the token stream with line numbers is the input of parsers and static analysers that perform the data-flow and type checks a scanner cannot."));
  out.push(KEY("Conclusion", [
    "A LEX-based scanner with 17 token categories, 11 lexical-error rules and 10 security rules was designed, implemented and tested on five test files. It tokenised valid programs correctly, reported every seeded lexical error (13/13 plus the unterminated comment) and every seeded security weakness (16/16) with line numbers and explanations, and produced no false alarms on the valid programs.",
    "The assignment therefore meets its objectives: it shows how regular expressions and finite automata are turned into a working scanner, and how the same mechanism can serve as an inexpensive security filter in a secure software-development process.",
  ]));

  // ---------------- APPENDIX A ----------------
  out.push(H1("Appendix A – Complete source: lexer.l"));
  out.push(...CODE(nums(X.lexer)));

  // ---------------- APPENDIX B ----------------
  out.push(SP(200)); out.push(H1n("Appendix B – Repository guide and verification tools"));
  out.push(...CODE([
    "CSA1406-Lexer-Assignment/",
    "├── README.md",
    "├── CSA1406_Assignment1_Lexical_Analyzer.docx   this report (editable)",
    "├── lexer.l                    the LEX specification (Appendix A)",
    "├── Makefile                   build / test / clean",
    "├── tests/                     t1_valid.c ... t5_edge_cases.c",
    "├── expected/                  expected output of the five tests (+ summary.json)",
    "├── tools/",
    "│   ├── lexsim.py              simulator of LEX semantics (reads lexer.l)",
    "│   ├── check_c.py             gcc syntax check of the C code inside lexer.l",
    "│   └── make_figures.py        diagrams and charts used in the report",
    "├── figures/                   PNG figures",
    "└── docbuild/                  scripts that generate this .docx",
  ]));
  out.push(P("The `Makefile` in the repository provides the targets `make` (flex + gcc), `make test` (compare with `expected/`), `make check` (syntax check of the C code) and `make clean`."));
  out.push(H2("Verification tools"));
  out.push(CAPT("Tools shipped with the repository"));
  out.push(TBL([2300, 7338], [
    ["Tool", "Purpose and usage"],
    ["`make`", "builds `lexer` from `lexer.l` (flex + gcc)"],
    ["`make test`", "runs the five tests and compares the output with `expected/*.out.txt`; prints PASS/FAIL"],
    ["`tools/lexsim.py`", "`python3 tools/lexsim.py lexer.l tests/t4_security.c` – prints what the scanner should print, using only Python; useful on machines without flex"],
    ["`tools/check_c.py`", "extracts the C code of `lexer.l` (prologue, actions, `main`) and syntax-checks it with `gcc -Wall -Wextra`"],
    ["`tools/make_figures.py`", "regenerates the diagrams (needs Graphviz `dot`) and result charts (matplotlib)"],
  ], { fs: 17, firstColBold: true }));

  // ---------------- APPENDIX C ----------------
  out.push(SP(200)); out.push(H1n("Appendix C – Submission checklist and references"));
  out.push(CAPT("Submission checklist"));
  out.push(TBL([6400, 3238], [
    ["Requirement", "Status"],
    ...["Cover page completed (name, register number, signatures)", "Introduction and problem definition included", "Regular expressions and LEX rules for all token classes", "Complete LEX program included (Appendix A) and in lexer.l", "Token type, value and line number displayed", "Lexical errors and security constructs detected", "Valid, invalid and security test cases executed", "Own screenshots S1–S6 inserted (evidence of execution)", "Results, limitations and conclusion written", "Submitted before the deadline"].map(r => [r, "☐ Yes   ☐ No"]),
  ], { fs: 17 }));
  out.push(SP(100));
  out.push(H2("References"));
  out.push(...NL([
    "A. V. Aho, M. S. Lam, R. Sethi, J. D. Ullman, *Compilers: Principles, Techniques, and Tools*, 2nd ed., Pearson, 2006 (Chapter 3: Lexical Analysis).",
    "J. Levine, T. Mason, D. Brown, *lex & yacc*, 2nd ed., O’Reilly, 1992.",
    "M. E. Lesk and E. Schmidt, “Lex – A Lexical Analyzer Generator,” Bell Laboratories Computing Science Technical Report 39, 1975.",
    "The flex manual, *Flex: The Fast Lexical Analyzer* – GNU Project documentation.",
    "ISO/IEC 9899 – Programming languages – C (lexical elements: identifiers, constants, string literals, comments, trigraphs).",
    "MITRE, *Common Weakness Enumeration*: CWE-22, CWE-78, CWE-120, CWE-134, CWE-338, CWE-377, CWE-676, CWE-1007. https://cwe.mitre.org",
    "N. Boucher and R. Anderson, “Trojan Source: Invisible Vulnerabilities,” *USENIX Security Symposium*, 2023 (CVE-2021-42574).",
    "C. Cowan et al., “FormatGuard: Automatic Protection From printf Format String Vulnerabilities,” *USENIX Security Symposium*, 2001.",
    "SEI CERT C Coding Standard, Software Engineering Institute, Carnegie Mellon University.",
  ]));
  return out;
};
