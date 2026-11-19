%{
/* tac.l : scanner for the three-address-code generator */
#include <string.h>
#include "y.tab.h"
%}
%%
[0-9]+                    { yylval.str = strdup(yytext); return NUM; }
[a-zA-Z_][a-zA-Z0-9_]*    { yylval.str = strdup(yytext); return ID;  }
[ \t\n]+                  ;
.                         { return yytext[0]; }
%%
int yywrap(void) { return 1; }
