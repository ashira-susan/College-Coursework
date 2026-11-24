
%{
#include <stdio.h>

int yylineno = 0;
%}

%%
^(.*)\n    {
                printf("%4d\t%s", ++yylineno, yytext);
            }
%%

int yywrap(void)
{
    return 1;
}

int main(int argc, char *argv[])
{
    if (argc < 2)
    {
        printf("Usage: %s <filename>\n", argv[0]);
        return 1;
    }

    yyin = fopen(argv[1], "r");

    if (yyin == NULL)
    {
        printf("Unable to open file.\n");
        return 1;
    }

    yylex();

    fclose(yyin);
    return 0;
}
