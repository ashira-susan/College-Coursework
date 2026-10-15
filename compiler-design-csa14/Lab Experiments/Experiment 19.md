
# EXPERIMENT 19

## AIM
To write a C program to compute the LEADING set for the given grammar using an operator precedence parser.

**Grammar:**

- E → E + T | T
- T → T * F | F
- F → ( E ) | id

## PROGRAM

```c
#include <stdio.h>

char arr[18][3] = {
    {'E', '+', 'F'}, {'E', '*', 'F'},
    {'E', '(', 'F'}, {'E', ')', 'F'},
    {'E', 'i', 'F'}, {'E', '$', 'F'},
    {'F', '+', 'F'}, {'F', '*', 'F'},
    {'F', '(', 'F'}, {'F', ')', 'F'},
    {'F', 'i', 'F'}, {'F', '$', 'F'},
    {'T', '+', 'F'}, {'T', '*', 'F'},
    {'T', '(', 'F'}, {'T', ')', 'F'},
    {'T', 'i', 'F'}, {'T', '$', 'F'}
};

char prod[] = "EETTFF";

char res[6][3] = {
    {'E', '+', 'T'}, {'T', '\0'},
    {'T', '*', 'F'}, {'F', '\0'},
    {'(', 'E', ')'}, {'i', '\0'}
};

char stack[20][2];
int top = -1;

void install(char pro, char re)
{
    int i;

    for (i = 0; i < 18; i++)
    {
        if (arr[i][0] == pro && arr[i][1] == re)
        {
            arr[i][2] = 'T';
            break;
        }
    }

    if (top < 19)
    {
        top++;
        stack[top][0] = pro;
        stack[top][1] = re;
    }
}

int main()
{
    int i, j;
    char pro, re, pri = ' ';

    for (i = 0; i < 6; i++)
    {
        for (j = 0; j < 3 && res[i][j] != '\0'; j++)
        {
            if (res[i][j] == '+' || res[i][j] == '*' ||
                res[i][j] == '(' || res[i][j] == ')' ||
                res[i][j] == 'i' || res[i][j] == '$')
            {
                install(prod[i], res[i][j]);
                break;
            }
        }
    }

    while (top >= 0)
    {
        pro = stack[top][0];
        re = stack[top][1];
        top--;

        for (i = 0; i < 6; i++)
        {
            if (res[i][0] == pro && res[i][0] != prod[i])
            {
                install(prod[i], re);
            }
        }
    }

    printf("LEADING Table:\n");

    for (i = 0; i < 18; i++)
    {
        printf("%-8c %-8c %-8c\n",
               arr[i][0], arr[i][1],
               arr[i][2] == '\0' ? '-' : arr[i][2]);
    }

    printf("\nLEADING Sets:\n");

    for (i = 0; i < 18; i++)
    {
        if (pri != arr[i][0])
        {
            pri = arr[i][0];
            printf("\n%c -> ", pri);
        }

        if (arr[i][2] == 'T')
            printf("%c ", arr[i][1]);
    }

    printf("\n");
    return 0;
}
```

## OUTPUT

```text
LEADING Sets:

E -> + * ( i
F -> ( i
T -> * ( i
```

<img width="385" height="682" alt="image" src="https://github.com/user-attachments/assets/39cf7f51-9de6-41c4-bfdf-8b9454831313" />


## RESULT
Thus, the C program for computing the LEADING sets of the given grammar was implemented.
