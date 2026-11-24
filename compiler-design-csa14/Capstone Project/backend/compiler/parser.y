/* parser.y - MODULE 2 (syntax analysis + error detection) and
 *            MODULE 3 (intermediate code generation), Bison / YACC-compatible.
 *
 * Grammar summary
 *   program   -> stmt*
 *   stmt      -> decl | assignment | if | while | print | block | ';'
 *   expr      -> arithmetic, relational and logical expressions
 *
 * Syntax errors are reported with the line/column of the offending token and
 * the parser recovers at the next ';' (the "error" production) so that several
 * mistakes can be found in one run. Three-address code is generated while
 * parsing (syntax-directed translation) for programs without errors.
 */
%code requires {
#include "common.h"
}

%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "common.h"

int  yylex(void);
void yyerror(const char *msg);

extern int  lexer_done;
extern int  brace_depth;
extern FILE *yyin;

static VarType cur_decl_type = TY_INT;     /* type of the declaration being parsed */

static int is_zero_literal(const char *s) {
    return isdigit((unsigned char)s[0]) && strtod(s, NULL) == 0.0;
}

/* Generates   t = l op r   and works out the result type. */
static Attr binop(const char *op, Attr l, Attr r, int line, int col) {
    Attr a;
    int arith = !strcmp(op, "+") || !strcmp(op, "-") || !strcmp(op, "*") ||
                !strcmp(op, "/") || !strcmp(op, "%");

    if (!strcmp(op, "%") && (l.type == TY_FLOAT || r.type == TY_FLOAT))
        report("semantic", "error", line, col,
               "Operator '%%' requires integer operands");
    if ((!strcmp(op, "/") || !strcmp(op, "%")) && is_zero_literal(r.place))
        report("semantic", "warning", line, col, "Division by zero");

    a.place = new_temp();
    a.type  = (arith && (l.type == TY_FLOAT || r.type == TY_FLOAT)) ? TY_FLOAT : TY_INT;
    emit(op, l.place, r.place, a.place);
    return a;
}

/* Warns when a float value is stored into an int variable. */
static void check_narrowing(const char *name, VarType target, int value_type, int line, int col) {
    if (target == TY_INT && value_type == TY_FLOAT)
        report("semantic", "warning", line, col,
               "Assigning a float value to int variable '%s' loses the fractional part", name);
}
%}

%locations
%define parse.error verbose

%union {
    char *str;
    int   ival;
    Attr  a;
}

%token END_OF_FILE 0 "end of input"
%token <str> IDENTIFIER "identifier"
%token <str> INT_LIT    "integer constant"
%token <str> FLOAT_LIT  "float constant"
%token KW_INT "'int'"  KW_FLOAT "'float'"  KW_IF "'if'"  KW_ELSE "'else'"
%token KW_WHILE "'while'"  KW_PRINT "'print'"
%token PLUS "'+'" MINUS "'-'" STAR "'*'" SLASH "'/'" PERCENT "'%'"
%token ASSIGN "'='" EQ "'=='" NE "'!='" LT "'<'" GT "'>'" LE "'<='" GE "'>='"
%token AND "'&&'" OR "'||'" NOT "'!'"
%token LPAREN "'('" RPAREN "')'" LBRACE "'{'" RBRACE "'}'" SEMI "';'" COMMA "','"

%type <a>    expr
%type <ival> if_head while_head

/* precedence: lowest first */
%precedence LOWER_THAN_ELSE
%precedence KW_ELSE
%left  OR
%left  AND
%left  EQ NE
%left  LT GT LE GE
%left  PLUS MINUS
%left  STAR SLASH PERCENT
%precedence NOT UMINUS

%%

program
    : top_list
    ;

/* Top level: a stray '}' is reported on its own instead of swallowing the
 * next statement through error recovery. */
top_list
    : %empty
    | top_list stmt
    | top_list RBRACE
        { report("syntax", "error", @2.first_line, @2.first_column,
                 "Unmatched '}': there is no open '{' to close"); }
    ;

stmt_list
    : %empty
    | stmt_list stmt
    ;

stmt
    : decl_stmt
    | assign_stmt
    | if_stmt
    | while_stmt
    | print_stmt
    | block
    | SEMI                              /* empty statement */
    | error SEMI  { yyerrok; }          /* recovery: skip to the next ';' */
    ;

block
    : LBRACE stmt_list RBRACE
    ;

/* ---------------- declarations ---------------- */

decl_stmt
    : type_spec declarator_list SEMI
    ;

type_spec
    : KW_INT    { cur_decl_type = TY_INT;   }
    | KW_FLOAT  { cur_decl_type = TY_FLOAT; }
    ;

declarator_list
    : declarator
    | declarator_list COMMA declarator
    ;

declarator
    : IDENTIFIER
        {
            if (!declare_sym($1, cur_decl_type, @1.first_line))
                report("semantic", "error", @1.first_line, @1.first_column,
                       "Variable '%s' is already declared", $1);
        }
    | IDENTIFIER ASSIGN expr
        {
            if (!declare_sym($1, cur_decl_type, @1.first_line))
                report("semantic", "error", @1.first_line, @1.first_column,
                       "Variable '%s' is already declared", $1);
            check_narrowing($1, cur_decl_type, $3.type, @2.first_line, @2.first_column);
            emit("=", $3.place, NULL, $1);
        }
    ;

/* ---------------- assignment ---------------- */

assign_stmt
    : IDENTIFIER ASSIGN expr SEMI
        {
            int i = lookup_sym($1);
            if (i < 0)
                report("semantic", "error", @1.first_line, @1.first_column,
                       "Undeclared variable '%s'", $1);
            else
                check_narrowing($1, sym_type(i), $3.type, @2.first_line, @2.first_column);
            emit("=", $3.place, NULL, $1);
        }
    ;

print_stmt
    : KW_PRINT LPAREN expr RPAREN SEMI
        { emit("print", $3.place, NULL, NULL); }
    ;

/* ---------------- control flow ---------------- */

/* if_head emits "ifFalse cond goto Lelse" and passes Lelse up.
 * An error inside the parentheses recovers at the closing ')'. */
if_head
    : KW_IF LPAREN expr RPAREN
        {
            $$ = new_label();
            emit_iffalse($3.place, $$);
        }
    | KW_IF LPAREN error RPAREN
        { $$ = new_label(); yyerrok; }
    ;

if_stmt
    : if_head stmt %prec LOWER_THAN_ELSE
        { emit_label($1); }
    | if_head stmt KW_ELSE
        {
            $<ival>$ = new_label();     /* Lend */
            emit_goto($<ival>$);
            emit_label($1);             /* Lelse: */
        }
      stmt
        { emit_label($<ival>4); }
    ;

/* while_head emits the loop-start label and passes it up. */
while_head
    : KW_WHILE
        {
            $$ = new_label();           /* Lstart */
            emit_label($$);
        }
    ;

while_stmt
    : while_head LPAREN expr RPAREN
        {
            $<ival>$ = new_label();     /* Lend */
            emit_iffalse($3.place, $<ival>$);
        }
      stmt
        {
            emit_goto($1);
            emit_label($<ival>5);
        }
    | while_head LPAREN error RPAREN stmt
        { yyerrok; }
    ;

/* ---------------- expressions ---------------- */

expr
    : expr PLUS    expr  { $$ = binop("+",  $1, $3, @2.first_line, @2.first_column); }
    | expr MINUS   expr  { $$ = binop("-",  $1, $3, @2.first_line, @2.first_column); }
    | expr STAR    expr  { $$ = binop("*",  $1, $3, @2.first_line, @2.first_column); }
    | expr SLASH   expr  { $$ = binop("/",  $1, $3, @2.first_line, @2.first_column); }
    | expr PERCENT expr  { $$ = binop("%",  $1, $3, @2.first_line, @2.first_column); }
    | expr LT      expr  { $$ = binop("<",  $1, $3, @2.first_line, @2.first_column); }
    | expr GT      expr  { $$ = binop(">",  $1, $3, @2.first_line, @2.first_column); }
    | expr LE      expr  { $$ = binop("<=", $1, $3, @2.first_line, @2.first_column); }
    | expr GE      expr  { $$ = binop(">=", $1, $3, @2.first_line, @2.first_column); }
    | expr EQ      expr  { $$ = binop("==", $1, $3, @2.first_line, @2.first_column); }
    | expr NE      expr  { $$ = binop("!=", $1, $3, @2.first_line, @2.first_column); }
    | expr AND     expr  { $$ = binop("&&", $1, $3, @2.first_line, @2.first_column); }
    | expr OR      expr  { $$ = binop("||", $1, $3, @2.first_line, @2.first_column); }
    | MINUS expr %prec UMINUS
        {
            $$.place = new_temp();
            $$.type  = $2.type;
            emit("uminus", $2.place, NULL, $$.place);
        }
    | NOT expr
        {
            $$.place = new_temp();
            $$.type  = TY_INT;
            emit("!", $2.place, NULL, $$.place);
        }
    | LPAREN expr RPAREN  { $$ = $2; }
    | INT_LIT             { $$.place = $1; $$.type = TY_INT;   }
    | FLOAT_LIT           { $$.place = $1; $$.type = TY_FLOAT; }
    | IDENTIFIER
        {
            int i = lookup_sym($1);
            if (i < 0) {
                report("semantic", "error", @1.first_line, @1.first_column,
                       "Undeclared variable '%s'", $1);
                $$.type = TY_INT;
            } else {
                $$.type = sym_type(i);
            }
            $$.place = $1;
        }
    ;

%%

/* Turns Bison's message into a friendlier one and records it. */
void yyerror(const char *msg) {
    char buf[400], clean[400];
    size_t j = 0;
    for (size_t i = 0; msg[i] && j < sizeof clean - 1; i++)
        if (msg[i] != '"') clean[j++] = msg[i];     /* drop the alias quotes */
    clean[j] = '\0';

    if (strncmp(clean, "syntax error, ", 14) == 0)
        snprintf(buf, sizeof buf, "Syntax error: %s", clean + 14);
    else
        snprintf(buf, sizeof buf, "%s", clean);

    if (strstr(buf, "unexpected end of input") && brace_depth > 0)
        snprintf(buf, sizeof buf,
                 "Syntax error: unexpected end of input, missing '}' to close a block");

    report("syntax", "error", yylloc.first_line, yylloc.first_column, "%s", buf);
}

int main(int argc, char **argv) {
    int text_mode = 0;
    const char *path = NULL;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--text")) text_mode = 1;
        else path = argv[i];
    }
    if (path) {
        yyin = fopen(path, "r");
        if (!yyin) { fprintf(stderr, "cannot open %s\n", path); return 2; }
    }

    yyparse();

    /* Keep scanning so the token table and lexical errors are complete even
     * when the parser gave up early. */
    while (!lexer_done && yylex() != 0) { }

    if (text_mode) print_text(); else print_json();
    return 0;
}
