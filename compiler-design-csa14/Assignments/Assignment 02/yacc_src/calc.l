%{
/* calc.l : lexical analyzer for the desk calculator */
#include "y.tab.h"
#include <stdlib.h>
%}

%%
[0-9]+(\.[0-9]+)?   { yylval.dval = atof(yytext); return NUMBER; }
[a-z]               { yylval.ivar = yytext[0] - 'a';  return VAR; }
[ \t]+              ;                      /* skip blanks and tabs      */
\n                  { return '\n'; }       /* newline ends a statement  */
.                   { return yytext[0]; }  /* operators, brackets, '='  */
%%

int yywrap(void) { return 1; }
