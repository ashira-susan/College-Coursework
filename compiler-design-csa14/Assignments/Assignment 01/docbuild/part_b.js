// Task 3 (token recognition) and Task 4 (errors and security)
const L = require("./lib");
const { P, H1, H2, H3, NL, bullets, EQ, CODE, TBL, CAPT, FIG, NOTE, KEY, TODO, PLACE, SP, D } = L;
const { AlignmentType } = D;

module.exports = function (X) {
  const out = [];
  const sel = (name, from, to) => X.out[name].split("\n").slice(from, to);

  // ---------------- TASK 3 ----------------
  out.push(H1("Section 3 – Token Recognition and Classification (10 marks)"));
  out.push(P("This section explains the LEX program that recognises and classifies tokens and prints, for each, the **token type, token value and line number**. The complete source is reproduced in Appendix A and in the file `lexer.l` of the repository."));
  out.push(H2("3.1 Output format"));
  out.push(P("The scanner prints one row per token in three columns. Errors and security findings use the same layout and add an explanation after an arrow, so a reader can scan one column for the category and see all findings in source order."));
  out.push(...CODE([
    "LINE   TOKEN TYPE           LEXEME",
    "------ -------------------- ------------------------------",
    "8      KEYWORD              int",
    "8      IDENTIFIER           n",
    "8      ASSIGN_OP            =",
    "8      INTEGER_CONSTANT     10",
    "3      LEXICAL_ERROR        09   <-- Invalid digit in octal constant",
    "7      SECURITY_RISK        gets   <-- Unsafe library function (CWE-120/CWE-676/CWE-78)",
  ]));
  out.push(CAPT("Output columns"));
  out.push(TBL([1500, 2600, 5538], [
    ["Column", "Source in lexer.l", "Description"],
    ["LINE", "`yylineno` (corrected by `start_line()`)", "Line on which the lexeme **starts**. Flex increments `yylineno` while it matches a lexeme, so for a multi-line lexeme (a comment) the helper subtracts the newlines contained in the lexeme"],
    ["TOKEN TYPE", "first argument of `EMIT(\"…\")`, or `LEXICAL_ERROR` / `SECURITY_RISK`", "The class assigned by the rule"],
    ["LEXEME", "`yytext` through `show()`", "The matched text; control characters are printed as `.` and texts longer than 30 characters are truncated, so a table row always stays on one line"],
  ], { fs: 17, firstColBold: true }));
  out.push(H2("3.2 The definitions section: helper functions"));
  out.push(P("The code between `%{` and `%}` is copied unchanged into `lex.yy.c`. It defines counters, a table of category counters (`bump`) and four reporting functions. All actions call these functions through short macros, which keeps every rule on a single line."));
  out.push(...CODE([
    "static void emit(const char *type, const char *s, int len, int end_line)",
    "{",
    "    char buf[64];",
    "    show(s, len, buf);                                   /* printable copy of the lexeme  */",
    "    printf(\"%-6d %-20s %s\\n\", start_line(s, len, end_line), type, buf);",
    "    bump(type);                                          /* per-category statistics        */",
    "    total_tokens++;",
    "}",
    "",
    "#define EMIT(t)    emit(t, yytext, yyleng, yylineno)     /* valid token                    */",
    "#define ERR(m)     lex_error(m, yytext, yyleng, yylineno)/* lexical error + message        */",
    "#define SEC(m)     security(m, yytext, yyleng, yylineno) /* security finding               */",
    "#define SECHEX(m)  security_hex(m, yytext, yyleng, yylineno) /* same, bytes shown in hex   */",
    "#define COMMENT()  comment_count++                       /* comments are counted, not shown */",
  ]));
  out.push(CAPT("Meaning of the variables and functions provided by LEX"));
  out.push(TBL([1800, 7838], [
    ["Name", "Description"],
    ["`yytext`", "pointer to the characters of the current lexeme"],
    ["`yyleng`", "length of the current lexeme"],
    ["`yylineno`", "current line number; maintained automatically because of `%option yylineno`"],
    ["`yyin`", "input stream; `main()` sets it to the file given on the command line"],
    ["`yylex()`", "the generated scanner; runs until the end of input because no action returns a value"],
    ["`%option noyywrap`", "do not call `yywrap()` at end of file – removes the need to link the `-lfl` library"],
  ], { fs: 17, firstColBold: true }));
  out.push(H2("3.3 The rules section: recognising and classifying valid tokens"));
  out.push(P("The rules that produce valid tokens are shown below. Each line is *pattern, white space, action*. Figure 3 and Table 12 explain how the generated automaton chooses between them."));
  out.push(...CODE([
    "\"//\"[^\\n]*                                       { COMMENT(); }",
    "\"/*\"([^*]|\\*+[^*/])*\\*+\"/\"                       { COMMENT(); }",
    "\"#\"[ \\t]*(include|define|undef|ifdef|ifndef|if|else|elif|endif)[^\\n]*   { EMIT(\"PREPROCESSOR\"); }",
    "\\\"{STRBODY}\\\"                                      { EMIT(\"STRING_LITERAL\"); }",
    "'([^'\\\\\\n]|\\\\[^xX0-7\\n])'                          { EMIT(\"CHAR_CONSTANT\"); }",
    "{DIGIT}+\".\"{DIGIT}*({EXP})?{FSUF}?                 { EMIT(\"FLOAT_CONSTANT\"); }",
    "0[xX][0-9A-Fa-f]+{ISUF}*                           { EMIT(\"HEX_CONSTANT\"); }",
    "0[bB][01]+{ISUF}*                                  { EMIT(\"BINARY_CONSTANT\"); }",
    "0[0-7]+{ISUF}*                                     { EMIT(\"OCTAL_CONSTANT\"); }",
    "(0|[1-9]{DIGIT}*){ISUF}*                           { EMIT(\"INTEGER_CONSTANT\"); }",
    "(auto|break|case|char|const|...|while)             { EMIT(\"KEYWORD\"); }",
    "{IDENT}                                            { EMIT(\"IDENTIFIER\"); }",
    "\"<<=\"|\">>=\"|\"+=\"|...|\"=\"                          { EMIT(\"ASSIGN_OP\"); }",
    "\"==\"|\"!=\"|\"<=\"|\">=\"|\"<\"|\">\"                      { EMIT(\"RELATIONAL_OP\"); }",
    "\"&&\"|\"||\"|\"!\"                                      { EMIT(\"LOGICAL_OP\"); }",
    "[(){}\\[\\];,]                                       { EMIT(\"DELIMITER\"); }",
    "[ \\t\\r]+                                           { /* skip white space */ }",
    "\\n                                                 { /* line counted by yylineno */ }",
  ]));
  out.push(CAPT("Classification table: rule → token type → what the user sees"));
  out.push(TBL([2000, 2200, 5438], [
    ["Token type", "Action", "Notes"],
    ["KEYWORD, IDENTIFIER", "`EMIT(\"KEYWORD\")` / `EMIT(\"IDENTIFIER\")`", "same DFA, separated by rule order (Section 2.5)"],
    ["INTEGER / OCTAL / HEX / BINARY / FLOAT _CONSTANT", "`EMIT(\"…_CONSTANT\")`", "five numeric categories so that the base of the constant is visible (useful for later range checks)"],
    ["CHAR_CONSTANT, STRING_LITERAL", "`EMIT(...)`", "escape sequences allowed (`\\n`, `\\\"`, `\\x41`, `\\0`)"],
    ["ARITHMETIC / RELATIONAL / LOGICAL / BITWISE / ASSIGN / SPECIAL _OP", "`EMIT(\"…_OP\")`", "six operator families; maximal munch gives `<<=`, `->`, `++`"],
    ["DELIMITER", "`EMIT(\"DELIMITER\")`", "`( ) { } [ ] ; ,`"],
    ["PREPROCESSOR", "`EMIT(\"PREPROCESSOR\")`", "whole directive line is one token"],
    ["comments, white space", "no output", "comments are counted in the summary"],
  ], { fs: 16 }));
  out.push(H2("3.4 The user-code section"));
  out.push(P("`main()` opens the file named on the command line (or reads standard input), prints the header, calls `yylex()` once – it consumes the whole input because no action returns – and prints the summary. The exit status is 1 when lexical errors were found so that the scanner can be used in a build script."));
  out.push(...CODE([
    "int main(int argc, char *argv[])",
    "{",
    "    if (argc > 1) { yyin = fopen(argv[1], \"r\"); if (!yyin) { perror(argv[1]); return 2; } }",
    "    printf(\"%-6s %-20s %s\\n\", \"LINE\", \"TOKEN TYPE\", \"LEXEME\");",
    "    yylex();                                  /* scan the whole file */",
    "    /* ... print totals and the per-category table ... */",
    "    return error_count ? 1 : 0;",
    "}",
  ]));
  out.push(H2("3.5 Step-by-step trace"));
  out.push(P("Input line 9 of test T1: `    float avg = 0.0f;`  (the leading four blanks are part of the line). The scanner starts at the first blank and works as follows:"));
  out.push(CAPT("Trace of the scanner on one statement"));
  out.push(TBL([600, 2300, 3300, 1500, 1938], [
    ["Step", "Remaining input", "Matching rules (length)", "Selected", "Action / output"],
    ["1", "`    float avg…`", "white space (4)", "white space", "skipped"],
    ["2", "`float avg = 0.0f;`", "KEYWORD (5), IDENT (5)", "KEYWORD (first)", "`9 KEYWORD float`"],
    ["3", "` avg = 0.0f;`", "white space (1)", "white space", "skipped"],
    ["4", "`avg = 0.0f;`", "IDENT (3)", "IDENTIFIER", "`9 IDENTIFIER avg`"],
    ["5", "`= 0.0f;`", "ASSIGN `=` (1), RELATIONAL (no `==`)", "ASSIGN_OP", "`9 ASSIGN_OP =`"],
    ["6", "`0.0f;`", "INTEGER `0` (1), FLOAT `0.0f` (4)", "FLOAT_CONSTANT", "`9 FLOAT_CONSTANT 0.0f`"],
    ["7", "`;`", "DELIMITER (1)", "DELIMITER", "`9 DELIMITER ;`"],
  ], { fs: 16 }));
  out.push(SP(60));
  out.push(P("The first rows of the real output for test T1 (the complete listing is in Section 5.2):"));
  out.push(...CODE(sel("t1_valid", 0, 20)));
  out.push(H2("3.6 Line-number handling"));
  out.push(P("With `%option yylineno` flex counts newlines automatically – including those inside a multi-line comment or an unterminated string. At the time an action runs, `yylineno` already points to the *last* line of the lexeme. For single-line tokens this is the correct line. For multi-line lexemes the helper `start_line()` subtracts the number of newlines inside the lexeme, so the reported line is the one where the construct began. This matters for the error “unterminated comment”: the programmer needs to know where the comment was opened, not where the file ended (Test T3, Section 5.4)."));
  out.push(EQ("reported line = yylineno − (number of '\\n' characters in yytext)", "3.1"));
  out.push(H2("3.7 Statistics"));
  out.push(P("`bump()` keeps a small table of category names and counters in order of first appearance. At the end of the run the scanner prints the totals: valid tokens, comments skipped, lexical errors, security warnings and the count per category. These numbers are used in Section 6 to compare the test cases."));

  // ---------------- TASK 4 ----------------
  out.push(H1("Section 4 – Lexical Error Detection and Security Analysis (10 marks)"));
  out.push(H2("4.1 Philosophy: report, recover, continue"));
  out.push(P("A scanner must never stop silently or loop on bad input. The design follows three principles. **(1) Every character belongs to some rule** – the last rule `.` converts any unknown character into an error, so nothing is discarded. **(2) Dedicated error rules** recognise the *whole* faulty lexeme (for example `12abc` or `2.5e+`) and attach a precise message, instead of splitting it into misleading valid tokens. **(3) Recovery by skipping the lexeme:** after an error the scanner simply continues with the next character, which is the “panic-mode” strategy for the lexical level. One run therefore lists *all* problems of a file, which is important for a tool that is meant to be used as a review gate."));
  out.push(H2("4.2 Lexical errors detected"));
  out.push(CAPT("Lexical-error rules"));
  out.push(TBL([2700, 3100, 3838], [
    ["Error", "Pattern that detects it", "Example → message"],
    ["Invalid character", "`.` (last rule)", "`@` `$` `` ` `` `\\` → *Invalid character*"],
    ["Invalid octal digit", "`0[0-7]*[89]{DIGIT}*`", "`09` → *Invalid digit in octal constant*"],
    ["Identifier / constant starting with a digit; bad suffix", "`{DIGIT}+{IDENT}`", "`12abc`, `0xZ9` → *Malformed constant*"],
    ["Several decimal points", "`{DIGIT}+\".\"{DIGIT}+(\".\"{DIGIT}+)+`", "`1.2.3` → *more than one decimal point*"],
    ["Exponent without digits", "`{DIGIT}+(\".\"{DIGIT}*)?[eE][+-]?`", "`2.5e+`, `1e` → *exponent has no digits*"],
    ["Hex prefix without digits", "`0[xX]`", "`0x` → *Hexadecimal constant has no digits*"],
    ["Empty character constant", "`''`", "`''` → *Empty character constant*"],
    ["Multi-character constant", "`'(c)(c)+'`", "`'ab'` → *Multi-character constant*"],
    ["Unterminated character constant", "`'([^'\\\\\\n]|\\\\.)*`", "`'z;` → *Unterminated character constant*"],
    ["Unterminated string", "`\\\"{STRBODY}` (no closing quote)", "`\"no closing quote;` → *Unterminated string literal*"],
    ["Unterminated comment", "`\"/*\"([^*]|\\*+[^*/])*\\**`", "`/* never closed` → *Unterminated comment*"],
  ], { fs: 16 }));
  out.push(SP(60));
  out.push(NOTE("Why the error patterns are safe", ["Every error pattern is *shorter* than – or tied with and listed after – the corresponding valid pattern for correct input, so valid code is never reported. The valid pattern for `'\\x41'` is listed before the multi-character-constant error rule because both match six characters; the valid pattern for `1e5` matches three characters and wins over the exponent-without-digits error (two characters)."]));
  out.push(H2("4.3 Security analysis: potentially unsafe constructs"));
  out.push(P("Security rules do not stop compilation; they raise a `SECURITY_RISK` finding with a short explanation and a CWE reference. They are listed in order of the damage that the weakness typically causes."));
  out.push(CAPT("Security findings produced by the scanner"));
  out.push(TBL([1900, 2400, 1500, 3838], [
    ["Construct", "Rule", "CWE", "Risk and recommended alternative"],
    ["`gets`, `strcpy`, `strcat`, `sprintf`, `vsprintf`, `scanf`", "name list", "120 / 676", "unbounded copy or read → stack/heap overflow. Use `fgets`, `strncpy`/`strlcpy`, `strncat`, `snprintf`, `scanf(\"%15s\")`"],
    ["`system`, `popen`, `mktemp`, `tmpnam`", "name list", "78 / 377", "shell/command injection, predictable temporary files. Use `execv*` with an argument vector, `mkstemp`"],
    ["`%n` in a string", "string with `\"%\"[0-9hl]*\"n\"`", "134", "format-string write primitive. Never allow `%n`; use constant format strings"],
    ["`../`, `/bin/sh`, `/etc/passwd`, `cmd.exe`, `rm -rf` in a string", "string containing these substrings", "22 / 78", "path traversal, shell spawn, sensitive file. Canonicalise paths, avoid shells"],
    ["`rand`, `srand`", "name list", "338", "predictable PRNG. Use `getrandom`, `/dev/urandom`, CSPRNG"],
    ["`goto`, `asm`", "name list", "–", "unstructured control flow / inline assembly defeats analysis tools; review manually"],
    ["`#pragma …`", "preprocessor rule", "–", "can disable warnings, change packing/alignment and stack protection"],
    ["identifier longer than 31 characters", "`{LETTER}({LETTER}|{DIGIT}){31,}`", "–", "obfuscation or overflow probe; C89 guarantees only 31 significant characters"],
    ["trigraph `??=`, `??/`, `??(` …", "`\"??\"[=/'()!<>-]`", "–", "can hide characters (e.g. `??/` becomes a backslash) from human reviewers"],
    ["control characters, non-ASCII bytes", "`[\\x01-\\x08…]`, `[\\x80-\\xff]+`", "1007", "invisible or bidirectional Unicode (“Trojan Source”, CVE-2021-42574) makes displayed code differ from compiled code"],
  ], { fs: 15 }));
  out.push(SP(60));
  out.push(H3("Example findings produced by the scanner (test T4)"));
  const t4 = X.out["t4_security"].split("\n").filter(l => /SECURITY_RISK/.test(l));
  out.push(...CODE(t4.slice(0, 14)));
  out.push(H2("4.4 Detailed discussion of selected constructs"));
  out.push(H3("Format-string write: `%n`"));
  out.push(P("`printf(\"%n\", &x)` stores the number of characters printed so far into `x`. If an attacker controls the format string, `%n` gives an arbitrary memory write – a classic route to code execution (CWE-134). The rule matches any string literal that contains `%` followed by optional digits and length modifiers (`h`, `l`) and the letter `n`. The pattern for such strings is listed *before* the ordinary string rule: both match the same characters, and the tie is resolved in favour of the first rule."));
  out.push(H3("Hidden characters"));
  out.push(P("The Unicode right-to-left override (bytes `E2 80 AE` in UTF-8) can make a compiler read code in a different order from the one a reviewer sees. Because the scanner works byte by byte, `[\\x80-\\xff]+` matches the whole multi-byte sequence and prints it in hexadecimal (`<E2><80><AE>`), which makes the invisible character visible. Control characters such as BEL (`0x07`) are treated the same way. A legitimate program with non-ASCII text in comments or strings would also be flagged only if the characters occur *outside* comments and strings, because those rules consume them first; such a policy can be tightened or relaxed by moving the rule."));
  out.push(H3("Over-long identifiers"));
  out.push(P("C89 requires only 31 significant characters in internal identifiers. A 40-character name is rarely legitimate, may collide after truncation by older tool chains and is often used to obfuscate or to probe buffer limits in parsers. The pattern `{LETTER}({LETTER}|{DIGIT}){31,}` fires for 32 or more characters."));
  out.push(H2("4.5 Where lexical analysis stops: limitations of the security checks"));
  out.push(...bullets([
    "**Name-based rules cannot see context.** A user variable that happens to be called `system` is flagged (false positive), and `strcpy` called through a function pointer is not (false negative). A semantic analyser would use the symbol table to decide.",
    "**Data flow is invisible.** `printf(user_input)` – the most common format-string bug – cannot be detected, because the problem is the *origin* of the argument, not its spelling. Likewise buffer sizes versus copy lengths.",
    "**Macros and the preprocessor are not expanded.** A dangerous call hidden behind a `#define` is only seen after preprocessing.",
    "**Encoding assumptions.** Input is treated as bytes; legitimate UTF-8 in identifiers (allowed by C23) would be flagged.",
    "Conclusion: the scanner is a fast *first line of defence* that complements – not replaces – parsing, semantic analysis, static analysers and testing.",
  ]));
  return out;
};
