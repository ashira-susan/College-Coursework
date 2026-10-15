
# EXPERIMENT 21

## AIM
To write a LEX specification file to count the number of characters, words, and lines in a C source file.

## PROGRAM

**File: `count_lines.l`**

```lex
%{
#include <stdio.h>

int nchar = 0, nword = 0, nline = 0;
%}

%%
\n          { nline++; nchar++; }
[^ \t\n]+   { nword++; nchar += yyleng; }
.           { nchar++; }
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
        printf("Error opening file.\n");
        return 1;
    }

    yylex();

    printf("Number of characters = %d\n", nchar);
    printf("Number of words = %d\n", nword);
    printf("Number of lines = %d\n", nline);

    fclose(yyin);
    return 0;
}
```

## INPUT

**File: `sample.c`**

```c
#include <stdio.h>
int main()
{
int number1, number2, sum;
printf("Enter two integers: ");
scanf("%d %d", &number1, &number2);
sum = number1 + number2;
printf("%d + %d = %d", number1, number2, sum);
return 0;
}
```

## OUTPUT

```text
G:\lex>flex count_lines.l
G:\lex>gcc lex.yy.c
G:\lex>a.exe sample.c

Number of characters = 233
Number of words = 33
Number of lines = 10
```

## RESULT
Thus, the LEX specification was implemented to count the characters, words, and lines in a C source file.
