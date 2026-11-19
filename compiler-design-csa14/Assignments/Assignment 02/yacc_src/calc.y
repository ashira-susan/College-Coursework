%{
/* calc.y : YACC grammar and semantic actions for the desk calculator */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

int  yylex(void);
void yyerror(const char *msg);

double sym[26];                 /* values of the variables a .. z       */
int    line = 1;                /* current input line (for messages)    */
%}

%union { double dval; int ivar; }

%token <dval> NUMBER
%token <ivar> VAR
%type  <dval> expr

%left  '+' '-'                  /* lowest precedence, left associative  */
%left  '*' '/'
%right UMINUS                   /* unary minus                          */
%right '^'                      /* highest precedence, right assoc.     */

%%
program : /* empty */
        | program stmt
        ;

stmt    : '\n'                      { line++; }
        | expr '\n'                 { printf("= %g\n", $1); line++; }
        | VAR '=' expr '\n'         { sym[$1] = $3;
                                      printf("%c = %g\n", 'a' + $1, $3); line++; }
        | error '\n'                { yyerrok; line++; }     /* recovery */
        ;

expr    : NUMBER                    { $$ = $1; }
        | VAR                       { $$ = sym[$1]; }
        | expr '+' expr             { $$ = $1 + $3; }
        | expr '-' expr             { $$ = $1 - $3; }
        | expr '*' expr             { $$ = $1 * $3; }
        | expr '/' expr             { if ($3 == 0)
                                      { yyerror("division by zero"); YYERROR; }
                                      $$ = $1 / $3; }
        | expr '^' expr             { $$ = pow($1, $3); }
        | '-' expr %prec UMINUS     { $$ = -$2; }
        | '(' expr ')'              { $$ = $2; }
        ;
%%

void yyerror(const char *msg) { fprintf(stderr, "Error (line %d): %s\n", line, msg); }

int main(void) {
    printf("Calculator ready. Enter expressions (Ctrl-D to exit).\n");
    return yyparse();
}
