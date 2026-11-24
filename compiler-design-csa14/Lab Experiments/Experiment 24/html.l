
%{
#include <stdio.h>

int tags = 0;
%}

%%
"<"[^>]*>    {
                 tags++;
                 printf("%s\n", yytext);
             }

.|\n         { }
%%

int yywrap(void)
{
    return 1;
}

int main(void)
{
    FILE *f;
    char file[100];

    printf("Enter File Name: ");
    scanf("%99s", file);

    f = fopen(file, "r");

    if (f == NULL)
    {
        printf("Unable to open file.\n");
        return 1;
    }

    yyin = f;
    yylex();

    printf("\nNumber of HTML tags: %d\n", tags);

    fclose(f);
    return 0;
}
