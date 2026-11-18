%{
/* ==========================================================================
 *  CSA1406 - Compiler Design  |  Assignment 1
 *  Secure Lexical Analyzer for a C-like language (LEX / flex specification)
 *
 *  Output : one line per token  ->  LINE | TOKEN TYPE | LEXEME
 *           lexical errors and security findings are printed in-line and
 *           summarised at the end of the run.
 *
 *  Build  : flex lexer.l && gcc lex.yy.c -o lexer
 *  Run    : ./lexer tests/t1_valid.c
 * ========================================================================== */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_TYPES 32
static const char *type_names[MAX_TYPES];
static int         type_counts[MAX_TYPES];
static int         n_types = 0;
static int total_tokens = 0, comment_count = 0, error_count = 0, security_count = 0;

/* count one occurrence of a category (keeps first-seen order) */
static void bump(const char *type)
{
    int i;
    for (i = 0; i < n_types; i++)
        if (strcmp(type_names[i], type) == 0) { type_counts[i]++; return; }
    if (n_types < MAX_TYPES) { type_names[n_types] = type; type_counts[n_types++] = 1; }
}

/* line on which the lexeme STARTED (yylineno already points to its last line) */
static int start_line(const char *s, int len, int end_line)
{
    int i, n = 0;
    for (i = 0; i < len; i++) if (s[i] == '\n') n++;
    return end_line - n;
}

/* printable copy of a lexeme: control characters -> '.', long text truncated */
static void show(const char *s, int len, char *out)
{
    int i, m = len > 30 ? 30 : len;
    for (i = 0; i < m; i++)
        out[i] = ((unsigned char)s[i] < 32 || (unsigned char)s[i] > 126) ? '.' : s[i];
    out[m] = '\0';
    if (len > 30) strcat(out, "...");
}

static void emit(const char *type, const char *s, int len, int end_line)
{
    char buf[64];
    show(s, len, buf);
    printf("%-6d %-20s %s\n", start_line(s, len, end_line), type, buf);
    bump(type);
    total_tokens++;
}

static void lex_error(const char *msg, const char *s, int len, int end_line)
{
    char buf[64];
    show(s, len, buf);
    printf("%-6d %-20s %s   <-- %s\n", start_line(s, len, end_line), "LEXICAL_ERROR", buf, msg);
    bump("LEXICAL_ERROR");
    error_count++;
}

static void security(const char *msg, const char *s, int len, int end_line)
{
    char buf[64];
    show(s, len, buf);
    printf("%-6d %-20s %s   <-- %s\n", start_line(s, len, end_line), "SECURITY_RISK", buf, msg);
    bump("SECURITY_RISK");
    security_count++;
}

/* same as security() but prints the raw bytes in hex (non-ASCII / control chars) */
static void security_hex(const char *msg, const char *s, int len, int end_line)
{
    char buf[64];
    int i, pos = 0;
    for (i = 0; i < len && pos < 40; i++)
        pos += sprintf(buf + pos, "<%02X>", (unsigned char)s[i]);
    buf[pos] = '\0';
    printf("%-6d %-20s %s   <-- %s\n", start_line(s, len, end_line), "SECURITY_RISK", buf, msg);
    bump("SECURITY_RISK");
    security_count++;
}

#define EMIT(t)      emit(t, yytext, yyleng, yylineno)
#define ERR(m)       lex_error(m, yytext, yyleng, yylineno)
#define SEC(m)       security(m, yytext, yyleng, yylineno)
#define SECHEX(m)    security_hex(m, yytext, yyleng, yylineno)
#define COMMENT()    comment_count++
%}

%option noyywrap
%option yylineno

DIGIT       [0-9]
LETTER      [A-Za-z_]
IDENT       {LETTER}({LETTER}|{DIGIT})*
EXP         [eE][+-]?{DIGIT}+
FSUF        [fFlL]
ISUF        [uUlL]
STRBODY     ([^\"\\\n]|\\.)*

%%

"//"[^\n]*                                         { COMMENT(); }
"/*"([^*]|\*+[^*/])*\*+"/"                         { COMMENT(); }
"/*"([^*]|\*+[^*/])*\**                            { ERR("Unterminated comment (no closing */)"); }

"#"[ \t]*(include|define|undef|ifdef|ifndef|if|else|elif|endif)[^\n]*   { EMIT("PREPROCESSOR"); }
"#"[ \t]*pragma[^\n]*                              { SEC("#pragma can silently change compiler/security behaviour"); }

\"{STRBODY}"%"[0-9hl]*"n"{STRBODY}\"               { SEC("Format string with %n (CWE-134: memory write via printf)"); }
\"{STRBODY}("../"|"..\\"|"/bin/sh"|"/etc/passwd"|"cmd.exe"|"rm -rf"){STRBODY}\"   { SEC("Suspicious string: path traversal / shell / sensitive file (CWE-22, CWE-78)"); }
\"{STRBODY}\"                                      { EMIT("STRING_LITERAL"); }
\"{STRBODY}                                        { ERR("Unterminated string literal"); }

'([^'\\\n]|\\[^xX0-7\n])'                          { EMIT("CHAR_CONSTANT"); }
'\\[xX][0-9A-Fa-f]+'                               { EMIT("CHAR_CONSTANT"); }
'\\[0-7]+'                                         { EMIT("CHAR_CONSTANT"); }
''                                                 { ERR("Empty character constant"); }
'([^'\\\n]|\\.)([^'\\\n]|\\.)+'                    { ERR("Multi-character constant"); }
'([^'\\\n]|\\.)*                                   { ERR("Unterminated character constant"); }

{DIGIT}+"."{DIGIT}+("."{DIGIT}+)+                  { ERR("Malformed floating constant (more than one decimal point)"); }
{DIGIT}+("."{DIGIT}*)?[eE][+-]?                    { ERR("Malformed floating constant (exponent has no digits)"); }
{DIGIT}+"."{DIGIT}*({EXP})?{FSUF}?                 { EMIT("FLOAT_CONSTANT"); }
"."{DIGIT}+({EXP})?{FSUF}?                         { EMIT("FLOAT_CONSTANT"); }
{DIGIT}+{EXP}{FSUF}?                               { EMIT("FLOAT_CONSTANT"); }
0[xX]                                              { ERR("Hexadecimal constant has no digits"); }
0[xX][0-9A-Fa-f]+{ISUF}*                           { EMIT("HEX_CONSTANT"); }
0[bB][01]+{ISUF}*                                  { EMIT("BINARY_CONSTANT"); }
0[0-7]+{ISUF}*                                     { EMIT("OCTAL_CONSTANT"); }
0[0-7]*[89]{DIGIT}*                                { ERR("Invalid digit in octal constant"); }
(0|[1-9]{DIGIT}*){ISUF}*                           { EMIT("INTEGER_CONSTANT"); }
{DIGIT}+{IDENT}                                    { ERR("Malformed constant / identifier cannot start with a digit"); }

(gets|strcpy|strcat|sprintf|vsprintf|scanf|system|popen|mktemp|tmpnam)   { SEC("Unsafe library function (CWE-120/CWE-676/CWE-78)"); }
(rand|srand)                                       { SEC("Weak pseudo-random generator (CWE-338)"); }
(goto|asm|__asm__)                                 { SEC("goto/inline assembly hinders static analysis"); }
(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while)   { EMIT("KEYWORD"); }
{LETTER}({LETTER}|{DIGIT}){31,}                    { SEC("Identifier longer than 31 characters (possible obfuscation / overflow probe)"); }
{IDENT}                                            { EMIT("IDENTIFIER"); }

"<<="|">>="|"+="|"-="|"*="|"/="|"%="|"&="|"|="|"^="|"="     { EMIT("ASSIGN_OP"); }
"=="|"!="|"<="|">="|"<"|">"                        { EMIT("RELATIONAL_OP"); }
"&&"|"||"|"!"                                      { EMIT("LOGICAL_OP"); }
"<<"|">>"|"&"|"|"|"^"|"~"                          { EMIT("BITWISE_OP"); }
"++"|"--"|"+"|"-"|"*"|"/"|"%"                      { EMIT("ARITHMETIC_OP"); }
"->"|"."|"?"|":"                                   { EMIT("SPECIAL_OP"); }
[(){}\[\];,]                                       { EMIT("DELIMITER"); }

"??"[=/'()!<>-]                                    { SEC("Trigraph sequence (can hide characters from reviewers)"); }
[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]                   { SECHEX("Control character in source (possible obfuscation)"); }
[\x80-\xff]+                                       { SECHEX("Non-ASCII bytes (homoglyph / bidirectional 'Trojan Source' risk)"); }

[ \t\r]+                                           { /* skip white space */ }
\n                                                 { /* line counted by yylineno */ }
.                                                  { ERR("Invalid character"); }

%%

int main(int argc, char *argv[])
{
    int i;
    if (argc > 1) {
        yyin = fopen(argv[1], "r");
        if (!yyin) { perror(argv[1]); return 2; }
    }
    printf("%-6s %-20s %s\n", "LINE", "TOKEN TYPE", "LEXEME");
    printf("------ -------------------- ------------------------------\n");
    yylex();
    printf("\n================ SUMMARY ================\n");
    printf("Valid tokens        : %d\n", total_tokens);
    printf("Comments skipped    : %d\n", comment_count);
    printf("Lexical errors      : %d\n", error_count);
    printf("Security warnings   : %d\n", security_count);
    printf("---------- tokens by type ---------------\n");
    for (i = 0; i < n_types; i++)
        printf("%-20s %d\n", type_names[i], type_counts[i]);
    return error_count ? 1 : 0;
}
