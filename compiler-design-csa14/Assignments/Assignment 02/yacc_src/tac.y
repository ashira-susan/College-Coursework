%{
/* tac.y : translates assignment statements into three-address code */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int  yylex(void);
void yyerror(const char *s);
int  tmp = 0;                                   /* temporary counter   */

char *newtemp(void) { char *s = malloc(8); sprintf(s, "t%d", ++tmp); return s; }
void  emit(const char *r, const char *a, char op, const char *b)
      { printf("%-4s = %s %c %s\n", r, a, op, b); }
%}

%union { char *str; }
%token <str> ID NUM
%type  <str> expr

%left '+' '-'
%left '*' '/'
%right UMINUS

%%
prog : prog stmt
     | stmt
     ;

stmt : ID '=' expr ';'     { printf("%-4s = %s\n\n", $1, $3); tmp = 0; }
     | error ';'           { yyerrok; tmp = 0; }
     ;

expr : expr '+' expr       { $$ = newtemp(); emit($$, $1, '+', $3); }
     | expr '-' expr       { $$ = newtemp(); emit($$, $1, '-', $3); }
     | expr '*' expr       { $$ = newtemp(); emit($$, $1, '*', $3); }
     | expr '/' expr       { $$ = newtemp(); emit($$, $1, '/', $3); }
     | '-' expr %prec UMINUS { $$ = newtemp(); printf("%-4s = - %s\n", $$, $2); }
     | '(' expr ')'        { $$ = $2; }
     | ID                  { $$ = $1; }
     | NUM                 { $$ = $1; }
     ;
%%
void yyerror(const char *s) { fprintf(stderr, "Error: %s\n", s); }
int main(void) { return yyparse(); }
