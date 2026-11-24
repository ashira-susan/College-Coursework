
%{
#include <stdio.h>

int nmacro = 0, nheader = 0;
%}

%%
^#define    { nmacro++; }
^#include   { nheader++; }
.|\n        { }
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

    printf("Number of macros defined = %d\n", nmacro);
    printf("Number of header files included = %d\n", nheader);

    fclose(yyin);
    return 0;
}
