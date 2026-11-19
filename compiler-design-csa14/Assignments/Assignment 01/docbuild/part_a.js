// Cover, guidelines, Task 1 (Introduction) and Task 2 (LEX specification design)
const L = require("./lib");
const { P, H1, H1n, H2, H3, NL, bullets, EQ, CODE, TBL, CAPT, FIG, NOTE, KEY, TODO, PLACE, SP, D } = L;
const { AlignmentType, Paragraph, TextRun } = D;
const BLANK = { t: "", fill: "FFF2CC" };

module.exports = function (X) {
  const out = [];
  // ---------------- COVER ----------------
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 }, children: [new TextRun({ text: "CSA1406 – COMPILER DESIGN", bold: true, size: 36, font: L.FONT, color: L.COLORS.head })] }));
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "ASSIGNMENT 1", bold: true, size: 30, font: L.FONT, color: L.COLORS.accent })] }));
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "Design and Implementation of a LEX-Based Lexical Analyzer for Secure Source Code Processing", bold: true, size: 26, font: L.FONT })] }));
  out.push(TBL([2300, 2519, 2300, 2519], [
    ["Field", "Details", "Field", "Details"],
    ["Student name", BLANK, "Register number", BLANK],
    ["Department / Section", BLANK, "Academic year / Semester", BLANK],
    ["Faculty name", BLANK, "Nature of assignment", "Individual"],
    ["Course", "CSA1406 – Compiler Design", "Total marks", "50"],
    ["Submission date", BLANK, "Evaluation date", BLANK],
  ], { fs: 18, firstColBold: true }));
  out.push(SP(120));
  out.push(H2("Mark sheet (rubric-based evaluation)"));
  out.push(TBL([600, 4000, 800, 1000, 3238], [
    ["Task", "Title", "Max", "Awarded", "Where answered in this document"],
    ["1", "Introduction and Problem Definition", "5", "", "Section 1"],
    ["2", "LEX Specification Design", "10", "", "Section 2"],
    ["3", "Token Recognition and Classification", "10", "", "Section 3 and Appendix A (complete program)"],
    ["4", "Lexical Error Detection and Security Analysis", "10", "", "Section 4"],
    ["5", "Implementation and Testing", "10", "", "Section 5 (five test cases with outputs)"],
    ["6", "Results, Discussion and Conclusion", "5", "", "Section 6"],
    [{ t: "Total", bold: true }, "", { t: "50", bold: true }, "", ""],
  ], { fs: 17, align: [AlignmentType.CENTER, undefined, AlignmentType.CENTER, AlignmentType.CENTER] }));
  out.push(SP(100));
  out.push(TBL([3212, 3213, 3213], [["", "", ""], ["Student signature", "Faculty signature", "Programme director"]], { noHeader: true, fs: 18 }));
  out.push(SP(80));
  out.push(TODO("Before you submit – read, then delete this box", [
    "**What is complete:** the full written report, the LEX program (`lexer.l`), five test files, the token tables and the analysis.",
    "**What you must do yourself:** (1) fill in the cover table; (2) install **flex + gcc**, run the commands of Section 5.1 and paste your own terminal screenshots into the yellow boxes – the assignment asks for evidence of genuine execution; (3) compare your output with the listings in Section 5.",
    "**Honest note on the output listings:** the program output printed in this document was produced with `tools/lexsim.py`, a small simulator that reads the *real rules of lexer.l* and applies LEX’s longest-match / first-rule semantics (flex was not available in the environment in which this report was prepared). Your flex build should print identical lines; if anything differs, trust your flex output and update the listing.",
  ]));

  // ---------------- Guidelines ----------------
  out.push(H1("Assignment Guidelines and Contents"));
  out.push(H2("Guidelines followed"));
  out.push(...bullets([
    "The assignment is individual work; all code, tables and explanations are written for the problem statement given.",
    "Every answer contains explanations, grammar/regular-expression rules, algorithms (DFA diagrams, longest-match procedure) and examples.",
    "Diagrams and tables are numbered and labelled; every LEX rule is listed together with the reason for its position in the specification.",
    "Sample input and the corresponding output are shown for valid programs, invalid tokens and security-related inputs.",
    "The assignment brief mentions parse trees, parsing tables, FIRST/FOLLOW sets and YACC. Those belong to the *syntax-analysis* phase; this assignment covers the **lexical-analysis** phase only. Section 1.5 shows precisely how the token stream produced here is the input of a YACC parser, so the work plugs into the next phase.",
  ]));
  out.push(H2("Contents"));
  out.push(TBL([1300, 6100, 2238], [
    ["Section", "Title", "Marks"],
    ["1", "Introduction and Problem Definition", "5"],
    ["2", "LEX Specification Design – regular expressions, DFAs and rules", "10"],
    ["3", "Token Recognition and Classification – the LEX program", "10"],
    ["4", "Lexical Error Detection and Security Analysis", "10"],
    ["5", "Implementation and Testing – five test cases", "10"],
    ["6", "Results, Discussion and Conclusion", "5"],
    ["A", "Appendix A – complete source code (lexer.l)", "–"],
    ["B", "Appendix B – repository guide, build files and verification tools", "–"],
    ["C", "Appendix C – submission checklist and references", "–"],
  ], { fs: 18, align: [AlignmentType.CENTER, undefined, AlignmentType.CENTER] }));
  out.push(SP(80));
  out.push(KEY("Summary of the solution", [
    "A single LEX specification (`lexer.l`, 186 lines) recognises **17 valid token categories** of a C-like language, reports **11 kinds of lexical error**, and raises **10 kinds of security finding** (unsafe library calls, `%n` format strings, path-traversal/shell strings, weak random generator, `goto`/inline assembly, `#pragma`, over-long identifiers, trigraphs, hidden control/non-ASCII bytes).",
    "Output format required by the assignment: **token type, token value (lexeme) and line number** – with a final summary of counts per category.",
    `Test evidence: five test files – a valid program (${X.res["T1 valid"].total} tokens), invalid tokens (${X.res["T2 invalid"].errors} errors), an unterminated comment, a security file (${X.res["T4 security"].security} findings) and an edge-case file (${X.res["T5 edge"].total} tokens).`,
  ]));

  // ---------------- TASK 1 ----------------
  out.push(H1("Section 1 – Introduction and Problem Definition (5 marks)"));
  out.push(H2("1.1 The compiler and its front end"));
  out.push(P("A **compiler** translates a program written in a source language into an equivalent program in a target language while reporting every error it finds. The translation is organised as a pipeline of *phases*. The first group of phases – the **front end** – analyses the source text and builds an internal representation; the second group – the **back end** – optimises and generates machine code. Because the front end only needs to understand the source language, it is independent of the target machine, which is why one front end can be combined with many back ends."));
  out.push(...FIG("phases", "Phases of a compiler; the lexical analyser (highlighted) is the first phase of the front end", 600));
  out.push(CAPT("Front-end phases and their responsibilities"));
  out.push(TBL([1900, 2300, 2700, 2738], [
    ["Phase", "Input", "Output", "Typical errors found"],
    ["Lexical analysis (scanner)", "stream of characters", "stream of tokens", "illegal characters, malformed numbers, unterminated strings/comments"],
    ["Syntax analysis (parser)", "tokens", "parse tree / syntax tree", "missing `;`, unbalanced braces, wrong statement structure"],
    ["Semantic analysis", "syntax tree + symbol table", "annotated tree", "undeclared variables, type mismatches"],
    ["Intermediate-code generation", "annotated tree", "three-address code", "–"],
  ], { fs: 17 }));
  out.push(H2("1.2 Lexical analysis"));
  out.push(P("**Lexical analysis** (scanning) reads the source program as a sequence of characters and groups them into the smallest meaningful units called **lexemes**. For each lexeme the scanner produces a **token** – a pair ⟨token name, attribute⟩ – that the parser consumes. Three terms are used throughout this report:"));
  out.push(CAPT("Token, pattern and lexeme"));
  out.push(TBL([1500, 4000, 4138], [
    ["Term", "Meaning", "Example"],
    ["Token", "A category of lexical unit passed to the parser (name + optional attribute)", "`IDENTIFIER`, `INTEGER_CONSTANT`, `ASSIGN_OP`"],
    ["Pattern", "A rule, usually a regular expression, that describes all lexemes of a token", "`[A-Za-z_][A-Za-z0-9_]*` for identifiers"],
    ["Lexeme", "The actual character sequence in the source matched by a pattern", "`sum`, `42`, `+=`"],
  ], { fs: 17, firstColBold: true }));
  out.push(SP(60));
  out.push(P("Besides tokenising, the scanner performs several housekeeping jobs: it removes white space and comments (which have no meaning for the later phases), keeps track of **line numbers** so that every later error message can point to the right place, and reports **lexical errors** – character sequences that do not match any pattern. Scanners are specified with regular expressions because the set of lexemes of each token class is a *regular language*, which can be recognised by a finite automaton in a single left-to-right pass and in linear time."));
  out.push(...FIG("scanner_parser", "Interaction between scanner, parser, symbol table and diagnostics", 520));
  out.push(H2("1.3 LEX and flex"));
  out.push(P("**LEX** (and its modern GNU implementation **flex**) is a *scanner generator*. The programmer writes a specification – regular expressions paired with C actions – and the tool converts all patterns into one deterministic finite automaton, emitted as C source (`lex.yy.c`) with a function `yylex()`. Every call of `yylex()` returns (or, in this assignment, prints) the next token. The generated scanner follows two rules that the design in Section 2 relies on:"));
  out.push(...bullets([
    "**Longest match:** among all patterns, the one that matches the longest prefix of the remaining input is selected (so `<=` is one token, not `<` followed by `=`).",
    "**Rule priority:** if two patterns match the same number of characters, the one listed *first* in the specification wins (so the keyword `if` is not an identifier, and `gets` is reported as an unsafe function before it can become a plain identifier).",
  ]));
  out.push(...FIG("workflow", "LEX tool-chain used in this assignment", 600));
  out.push(H2("1.4 Why automated source-code analysis matters for secure software"));
  out.push(P("Most security vulnerabilities are not exotic: they are repeated, well-known coding mistakes – unbounded copies, user-controlled format strings, shell commands built from input, and weak randomness. Finding them late (in testing or production) is expensive; finding them while the code is being read is cheap. Automated analysis at the lexical level has three attractive properties: it is **fast** (linear time, no build needed), it is **language-front-end only** (it works on code that does not yet compile), and it is **deterministic** (the same input always gives the same findings), so it can run as a pre-commit hook or CI step. A lexical scanner cannot prove a program safe, but it is an excellent first filter that flags *constructs* that deserve review, and it protects the later phases from malformed input."));
  out.push(CAPT("Examples of insecure constructs that are visible at the token level"));
  out.push(TBL([2300, 1300, 3000, 3038], [
    ["Construct", "Weakness (CWE)", "Why it is dangerous", "Lexical signature used here"],
    ["`gets`, `strcpy`, `strcat`, `sprintf`", "CWE-120, CWE-676", "no bounds check → buffer overflow", "identifier equal to a blacklisted name"],
    ["`system`, `popen`", "CWE-78", "command injection if argument contains input", "identifier equal to a blacklisted name"],
    ["`\"…%n…\"` in a format string", "CWE-134", "`%n` writes to memory; with attacker-controlled formats it gives arbitrary write", "string literal containing `%n`"],
    ["`\"../\"`, `\"/bin/sh\"`, `\"/etc/passwd\"`", "CWE-22, CWE-78", "path traversal, shell spawn, credential file access", "string literal containing these substrings"],
    ["`rand`, `srand`", "CWE-338", "predictable values unsuitable for secrets/tokens", "identifier equal to a blacklisted name"],
    ["Hidden bidirectional or control characters", "CWE-1007 / CVE-2021-42574", "source shown to a reviewer differs from what the compiler reads (“Trojan Source”)", "bytes outside printable ASCII"],
    ["Very long identifiers", "obfuscation", "hides intent; may be an overflow probe for the tool chain", "identifier longer than 31 characters"],
  ], { fs: 16 }));
  out.push(H2("1.5 Problem definition and scope"));
  out.push(KEY("Problem statement", ["Design and implement, using LEX, a lexical analyser for a C-like language that (a) recognises keywords, identifiers, numeric constants, operators, delimiters, strings, characters, comments and preprocessor lines; (b) prints for every token its **type, value and line number**; (c) detects **lexical errors** – invalid characters, malformed numbers, unterminated strings, characters and comments; and (d) flags **potentially unsafe constructs** for secure-code review."]));
  out.push(SP(60));
  out.push(P("**Objectives.** (1) Specify all token classes with regular expressions; (2) build the scanner with flex; (3) classify and display tokens; (4) detect and describe errors without stopping at the first one (the scanner reports the faulty lexeme and *continues*, so one run shows all problems); (5) test with valid, invalid and security-related inputs; (6) evaluate results and limitations."));
  out.push(P("**Scope and connection to the parser.** The scanner implements only the lexical phase. In a complete compiler the `EMIT(...)` calls in the actions are replaced by `return TOKEN_NAME;` statements, and a YACC (bison) grammar – whose parse trees, FIRST/FOLLOW sets and parsing tables belong to the next assignment – calls `yylex()` to obtain the tokens. The token names chosen here (`KEYWORD`, `IDENTIFIER`, `INTEGER_CONSTANT`, …) can be refined into one token per keyword when that grammar is written."));

  // ---------------- TASK 2 ----------------
  out.push(H1("Section 2 – LEX Specification Design (10 marks)"));
  out.push(H2("2.1 Structure of a LEX program"));
  out.push(P("A LEX source file has three parts separated by `%%`:"));
  out.push(...CODE(["definitions        /* C code in %{ %} and named regular expressions */", "%%", "rules              /* pattern   { C action } */", "%%", "user subroutines   /* main(), helper functions */"]));
  out.push(CAPT("Parts of `lexer.l` and their contents"));
  out.push(TBL([1800, 3000, 4838], [
    ["Part", "Content in lexer.l", "Purpose"],
    ["Definitions", "`#include` lines, counters, helper functions `emit`, `lex_error`, `security`, `show`; macros `EMIT`, `ERR`, `SEC`, `COMMENT`; options `noyywrap`, `yylineno`; named expressions `DIGIT`, `LETTER`, `IDENT`, `EXP`, `FSUF`, `ISUF`, `STRBODY`", "Everything the rules need; names make the rules short and readable"],
    ["Rules", "46 pattern–action pairs", "The scanner proper; order encodes priority"],
    ["User code", "`main()` which opens the file, prints the header, calls `yylex()` and prints the summary", "Driver program"],
  ], { fs: 17, firstColBold: true }));
  out.push(H2("2.2 Notation for regular expressions"));
  out.push(CAPT("LEX regular-expression operators used in this assignment"));
  out.push(TBL([1900, 4300, 3438], [
    ["Operator", "Meaning", "Example"],
    ["`x`", "the character x", "`a` matches a"],
    ["`\"s\"`", "the string s literally (operators lose special meaning)", "`\"++\"` matches ++"],
    ["`[abc]`, `[a-z]`", "any one character of the set / range", "`[0-9]`"],
    ["`[^abc]`", "any character *not* in the set", "`[^\\n]` : everything except newline"],
    ["`.`", "any character except newline", "`.` (catch-all rule)"],
    ["`r*`  `r+`  `r?`", "zero or more / one or more / optional", "`{DIGIT}+`"],
    ["`r{m,}`", "at least m repetitions", "`{LETTER}({LETTER}|{DIGIT}){31,}`"],
    ["`r|s`", "r or s", "`\"==\"|\"!=\"`"],
    ["`(r)`", "grouping", "`(0|[1-9]{DIGIT}*)`"],
    ["`{NAME}`", "macro defined in the definitions section", "`{IDENT}`"],
  ], { fs: 17 }));
  out.push(H2("2.3 Named definitions"));
  out.push(CAPT("Definitions section"));
  out.push(TBL([1400, 3600, 4638], [
    ["Name", "Regular expression", "Meaning"],
    ["DIGIT", "`[0-9]`", "a decimal digit"],
    ["LETTER", "`[A-Za-z_]`", "a letter or underscore (the underscore may start an identifier)"],
    ["IDENT", "`{LETTER}({LETTER}|{DIGIT})*`", "identifier = letter followed by letters/digits"],
    ["EXP", "`[eE][+-]?{DIGIT}+`", "floating-point exponent"],
    ["FSUF / ISUF", "`[fFlL]` / `[uUlL]`", "float / integer type suffixes"],
    ["STRBODY", "`([^\\\"\\\\\\n]|\\\\.)*`", "contents of a string: any character except quote, backslash, newline – or an escape sequence `\\x`"],
  ], { fs: 17, firstColBold: true }));
  out.push(H2("2.4 Token classes and their regular expressions"));
  out.push(P("The table gives, for every class required by the assignment (keywords, identifiers, numerical constants, operators, delimiters, comments) and the additional classes, the formal definition and examples. Together with the error rules of Section 4 these patterns partition all possible input."));
  out.push(CAPT("Token classes (valid tokens)"));
  out.push(TBL([1800, 4200, 3638], [
    ["Token type", "Regular expression (LEX)", "Examples"],
    ["KEYWORD", "`(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while)`", "`int`, `while`, `return`"],
    ["IDENTIFIER", "`{LETTER}({LETTER}|{DIGIT})*`", "`sum`, `_tmp1`, `ifx`"],
    ["INTEGER_CONSTANT", "`(0|[1-9]{DIGIT}*){ISUF}*`", "`0`, `42`, `123456789L`, `7u`"],
    ["OCTAL_CONSTANT", "`0[0-7]+{ISUF}*`", "`0755`"],
    ["HEX_CONSTANT", "`0[xX][0-9A-Fa-f]+{ISUF}*`", "`0xFF`, `0xDEADbeefUL`"],
    ["BINARY_CONSTANT", "`0[bB][01]+{ISUF}*`", "`0b1011`"],
    ["FLOAT_CONSTANT", "`{DIGIT}+\".\"{DIGIT}*({EXP})?{FSUF}?` | `\".\"{DIGIT}+({EXP})?{FSUF}?` | `{DIGIT}+{EXP}{FSUF}?`", "`3.14`, `.5`, `6.02e23`, `1e-9f`, `10.`"],
    ["CHAR_CONSTANT", "`'([^'\\\\\\n]|\\\\[^xX0-7\\n])'` | `'\\\\[xX][0-9A-Fa-f]+'` | `'\\\\[0-7]+'`", "`'A'`, `'\\n'`, `'\\x41'`, `'\\0'`"],
    ["STRING_LITERAL", "`\\\"{STRBODY}\\\"`", "`\"Sum = %d\\n\"`"],
    ["ARITHMETIC_OP", "`\"++\"|\"--\"|\"+\"|\"-\"|\"*\"|\"/\"|\"%\"`", "`+`, `++`, `%`"],
    ["RELATIONAL_OP", "`\"==\"|\"!=\"|\"<=\"|\">=\"|\"<\"|\">\"`", "`<=`, `!=`"],
    ["LOGICAL_OP", "`\"&&\"|\"||\"|\"!\"`", "`&&`, `!`"],
    ["BITWISE_OP", "`\"<<\"|\">>\"|\"&\"|\"|\"|\"^\"|\"~\"`", "`<<`, `^`"],
    ["ASSIGN_OP", "`\"<<=\"|\">>=\"|\"+=\"|\"-=\"|\"*=\"|\"/=\"|\"%=\"|\"&=\"|\"|=\"|\"^=\"|\"=\"`", "`=`, `+=`, `<<=`"],
    ["SPECIAL_OP", "`\"->\"|\".\"|\"?\"|\":\"`", "`->`, `?`"],
    ["DELIMITER", "`[(){}\\[\\];,]`", "`(`  `)`  `{`  `}`  `;`  `,`"],
    ["PREPROCESSOR", "`\"#\"[ \\t]*(include|define|undef|ifdef|ifndef|if|else|elif|endif)[^\\n]*`", "`#include <stdio.h>`"],
    ["(comment – skipped)", "`\"//\"[^\\n]*` | `\"/*\"([^*]|\\*+[^*/])*\\*+\"/\"`", "`// text`, `/* text */`"],
    ["(white space – skipped)", "`[ \\t\\r]+` and `\\n`", "blanks, tabs, newlines"],
  ], { fs: 15 }));
  out.push(H2("2.5 How the patterns are recognised – finite automata"));
  out.push(P("Each regular expression is converted by LEX into a finite automaton (Thompson construction → NFA, subset construction → DFA, minimisation), and all automata are merged into one DFA so the input is scanned only once. Figure 4 shows the Thompson NFA of the small expression `a(b|c)*` to illustrate the construction: every operator (concatenation, union, Kleene star) adds ε-transitions around the sub-automata. The following DFAs are the hand-drawn equivalents of the most important token classes of the specification; double circles are accepting states and dashed arrows lead to error situations that the specification catches with dedicated *error rules*."));
  out.push(...FIG("nfa_thompson", "Thompson NFA for a(b|c)* (illustration of the construction LEX performs for every pattern)", 520));
  out.push(H3("Identifiers and keywords"));
  out.push(...FIG("dfa_identifier", "DFA for IDENT = [A-Za-z_][A-Za-z0-9_]*", 330));
  out.push(P("A single DFA accepts both keywords and identifiers. LEX does not need a symbol-table lookup to separate them: the keyword pattern is listed **before** the identifier pattern, so when `int` is read both patterns match three characters and the earlier rule (KEYWORD) wins; for `integer` the identifier pattern matches seven characters against three for the keyword and therefore wins by longest match."));
  out.push(H3("Numeric constants"));
  out.push(...FIG("dfa_numbers", "DFA for integer, octal, hexadecimal, binary and floating-point constants with error transitions", 600));
  out.push(P("The DFA starts by looking at the first digit. A leading `0` leads to the octal/hex/binary branches, any other digit to decimal. A `.` or an exponent letter moves the automaton to the floating-point branch. Error situations are exactly the places where the next character cannot extend a valid constant: an `8` or `9` in an octal constant, `0x` with no digit, an exponent without digits, a second decimal point, or letters directly after a number. Each of these has its own error rule in the specification so the faulty constant is reported as *one* lexeme with a precise message, instead of being split into misleading tokens."));
  out.push(H3("Comments"));
  out.push(...FIG("dfa_comment", "DFA for line comments and block comments; end of file inside a block comment is an error", 560));
  out.push(P("The block-comment pattern `\"/*\"([^*]|\\*+[^*/])*\\*+\"/\"` reads any characters; a run of stars is accepted as long as it is not followed by `/`; the first `*/` closes the comment (so comments do not nest, as in C). A second pattern, `\"/*\"([^*]|\\*+[^*/])*\\**`, accepts the same prefix without the closing delimiter. For a terminated comment the first pattern is one or more characters longer and wins; if the file ends first, only the second pattern can match and the *unterminated comment* error is reported at the line where the comment started."));
  out.push(H3("String literals"));
  out.push(...FIG("dfa_string", "DFA for string literals; a newline or end of file before the closing quote is an error", 520));
  out.push(H2("2.6 Ordering of the rules"));
  out.push(P("Because ties are resolved by position, the order of the rules is part of the design. The table lists the order used in `lexer.l` and the reason for it."));
  out.push(CAPT("Rule order and justification"));
  out.push(TBL([600, 3100, 5938], [
    ["#", "Rule group", "Why it is placed here"],
    ["1", "Comments (line, block, unterminated block)", "`/` and `/*` must not be split into operators; the unterminated rule is shorter than the valid one, so it only fires when the valid one cannot"],
    ["2", "Preprocessor and `#pragma`", "Whole line is one token; `#pragma` is a security finding"],
    ["3", "Strings: `%n` → suspicious → valid → unterminated", "All three first patterns match the same text for dangerous strings; the first (most specific) wins the tie, the plain STRING rule comes after them"],
    ["4", "Character constants: valid forms → empty → multi-character → unterminated", "Valid forms first so that a tie with an error pattern (e.g. `'\\x41'`) is resolved in favour of the valid token"],
    ["5", "Numbers: error rules, floats, hex, binary, octal, invalid octal, decimal, malformed", "Longest match separates `1.5` from `1`; ties (e.g. `1e` matches both “exponent has no digits” and “digit followed by letter”) are resolved by listing the more specific error first"],
    ["6", "Unsafe functions, weak PRNG, `goto`/`asm`, keywords, long identifiers, identifiers", "Security names and keywords are fixed strings that tie with IDENT; they must come before it. The long-identifier rule must come before IDENT for the same reason"],
    ["7", "Operators and delimiters", "Distinct categories; longest match gives maximal munch (`<<=`, `->`, `++`)"],
    ["8", "Trigraphs, control characters, non-ASCII bytes", "Security findings for characters that no other rule accepts"],
    ["9", "White space, newline", "Skipped; line counting is done by `yylineno`"],
    ["10", "`.` (any other character)", "Must be **last**: a catch-all that turns every remaining character into an *invalid character* error, so the scanner never loops or silently discards input"],
  ], { fs: 16 }));
  out.push(H2("2.7 Worked example – how longest match and priority decide"));
  out.push(CAPT("Decisions the scanner takes on selected inputs"));
  out.push(TBL([1700, 3000, 2300, 2638], [
    ["Input", "Patterns that match (length)", "Winner", "Reason"],
    ["`if`", "KEYWORD (2), IDENT (2)", "KEYWORD", "tie → first rule"],
    ["`ifx`", "KEYWORD (2), IDENT (3)", "IDENTIFIER", "longest match"],
    ["`<<=`", "ASSIGN `<<=` (3), BITWISE `<<` (2), RELATIONAL `<` (1)", "ASSIGN_OP", "longest match"],
    ["`a+++b`", "`++` then `+`", "a, ++, +, b", "maximal munch – exactly as a C compiler"],
    ["`1.5`", "INTEGER `1` (1), FLOAT `1.5` (3)", "FLOAT_CONSTANT", "longest match"],
    ["`1.2.3`", "FLOAT `1.2` (3), malformed-float (5)", "LEXICAL_ERROR", "longest match"],
    ["`12abc`", "INTEGER `12` (2), malformed `12abc` (5)", "LEXICAL_ERROR", "longest match"],
    ["`gets`", "UNSAFE `gets` (4), IDENT (4)", "SECURITY_RISK", "tie → first rule"],
    ["`\"a%nb\"`", "`%n` rule, suspicious (no), STRING, all of length 6", "SECURITY_RISK", "tie → most specific rule listed first"],
  ], { fs: 16 }));
  return out;
};
