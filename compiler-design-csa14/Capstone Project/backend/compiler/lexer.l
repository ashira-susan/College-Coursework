/* lexer.l - MODULE 1: Lexical analysis (Flex, LEX-compatible)
 *
 * Scans the source program and returns tokens to the parser. Every token is
 * also recorded in the token table so the GUI can display it. Whitespace and
 * comments are skipped; invalid characters and malformed lexemes are reported
 * as lexical errors and scanning continues.
 */
%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "common.h"
#include "parser.tab.h"

static int line_no = 1;
static int col_no  = 1;
static int comment_line, comment_col;
int lexer_done  = 0;              /* set once the end of input was reached */
int brace_depth = 0;              /* currently open '{' blocks */

/* Runs before every rule: records where the current lexeme starts. */
#define YY_USER_ACTION                                              \
    yylloc.first_line   = yylloc.last_line = line_no;               \
    yylloc.first_column = col_no;                                   \
    yylloc.last_column  = col_no + yyleng - 1;                      \
    col_no += yyleng;

#define RET(tok, cat) do {                                          \
        add_token(cat, #tok, yytext, yylloc.first_line, yylloc.first_column); \
        return tok;                                                 \
    } while (0)

static void bad(const char *msg) {
    add_token("INVALID", "INVALID", yytext, yylloc.first_line, yylloc.first_column);
    report("lexical", "error", yylloc.first_line, yylloc.first_column, "%s", msg);
}
%}

%option noyywrap nounput noinput

DIGIT   [0-9]
LETTER  [A-Za-z_]
ID      {LETTER}({LETTER}|{DIGIT})*
INT     {DIGIT}+
FLOAT   {DIGIT}+\.{DIGIT}+([eE][+-]?{DIGIT}+)?

%x COMMENT

%%

[ \t\r]+              { /* skip whitespace */ }
\n                    { line_no++; col_no = 1; }
"//"[^\n]*            { /* skip single-line comment */ }
"/*"                  { comment_line = yylloc.first_line;
                        comment_col  = yylloc.first_column;
                        BEGIN(COMMENT); }
<COMMENT>"*/"         { BEGIN(INITIAL); }
<COMMENT>\n           { line_no++; col_no = 1; }
<COMMENT>.            { /* skip comment text */ }
<COMMENT><<EOF>>      { report("lexical", "error", comment_line, comment_col,
                               "Unterminated comment: missing closing '*/'");
                        BEGIN(INITIAL);
                        yylloc.first_line = line_no; yylloc.first_column = col_no;
                        lexer_done = 1;
                        return 0; }

"int"                 { RET(KW_INT,   "KEYWORD"); }
"float"               { RET(KW_FLOAT, "KEYWORD"); }
"if"                  { RET(KW_IF,    "KEYWORD"); }
"else"                { RET(KW_ELSE,  "KEYWORD"); }
"while"               { RET(KW_WHILE, "KEYWORD"); }
"print"               { RET(KW_PRINT, "KEYWORD"); }

{FLOAT}               { yylval.str = xstrdup(yytext); RET(FLOAT_LIT, "FLOAT"); }
{INT}                 { yylval.str = xstrdup(yytext); RET(INT_LIT,   "INTEGER"); }
{ID}                  { yylval.str = xstrdup(yytext); RET(IDENTIFIER, "IDENTIFIER"); }

{DIGIT}+({LETTER}|{DIGIT})* {
                        char m[300];
                        snprintf(m, sizeof m,
                                 "Invalid token '%s': an identifier cannot start with a digit", yytext);
                        bad(m); }
{DIGIT}+\.            { bad("Malformed number: digits are required after the decimal point"); }

"=="                  { RET(EQ,      "OPERATOR"); }
"!="                  { RET(NE,      "OPERATOR"); }
"<="                  { RET(LE,      "OPERATOR"); }
">="                  { RET(GE,      "OPERATOR"); }
"&&"                  { RET(AND,     "OPERATOR"); }
"||"                  { RET(OR,      "OPERATOR"); }
"="                   { RET(ASSIGN,  "OPERATOR"); }
"<"                   { RET(LT,      "OPERATOR"); }
">"                   { RET(GT,      "OPERATOR"); }
"!"                   { RET(NOT,     "OPERATOR"); }
"+"                   { RET(PLUS,    "OPERATOR"); }
"-"                   { RET(MINUS,   "OPERATOR"); }
"*"                   { RET(STAR,    "OPERATOR"); }
"/"                   { RET(SLASH,   "OPERATOR"); }
"%"                   { RET(PERCENT, "OPERATOR"); }

"("                   { RET(LPAREN, "SEPARATOR"); }
")"                   { RET(RPAREN, "SEPARATOR"); }
"{"                   { brace_depth++; RET(LBRACE, "SEPARATOR"); }
"}"                   { if (brace_depth > 0) brace_depth--; RET(RBRACE, "SEPARATOR"); }
";"                   { RET(SEMI,   "SEPARATOR"); }
","                   { RET(COMMA,  "SEPARATOR"); }

"&"                   { bad("Invalid token '&': did you mean '&&'?"); }
"|"                   { bad("Invalid token '|': did you mean '||'?"); }

[\xC2-\xF4][\x80-\xBF]* {
                        char m[300];
                        snprintf(m, sizeof m,
                                 "Invalid character '%s' (non-ASCII; check for smart quotes or special symbols)", yytext);
                        bad(m); }
.                     { char m[64];
                        snprintf(m, sizeof m, "Invalid character '%s'", yytext);
                        bad(m); }

<<EOF>>               { yylloc.first_line = line_no; yylloc.first_column = col_no;
                        lexer_done = 1;
                        return 0; }

%%
