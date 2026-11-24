
%{
#include <stdio.h>

int flag = 0;
%}

%%
[a-z0-9._]+@[a-z]+(\.com|\.in)    { flag = 1; }
.|\n                              { }
%%

int main(void)
{
    printf("Enter Email Address:\n");
    yylex();

    if (flag == 1)
        printf("Accepted\n");
    else
        printf("Not Accepted\n");

    return 0;
}

int yywrap(void)
{
    return 1;
}
