
# EXPERIMENT 20

## AIM
To write a C program to compute the TRAILING set for the given grammar using an operator precedence parser.

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

char prod[6] = "EETTFF";

char res[6][3] = {
    {'E', '+', 'T'}, {'T', '\0', '\0'},
    {'T', '*', 'F'}, {'F', '\0', '\0'},
    {'(', 'E', ')'}, {'i', '\0', '\0'}
};

char stack[30][2];
int top = -1;

void install(char pro, char re)
{
    int i;

    for (i = 0; i < 18; i++)
    {
        if (arr[i][0] == pro && arr[i][1] == re)
        {
            if (arr[i][2] != 'T' && top < 29)
            {
                arr[i][2] = 'T';
                top++;
                stack[top][0] = pro;
                stack[top][1] = re;
            }
            break;
        }
    }
}

int main()
{
    int i, j;
    char pro, re, pri = ' ';

    for (i = 0; i < 6; i++)
    {
        for (j = 2; j >= 0; j--)
        {
            if (res[i][j] == '+' || res[i][j] == '*' ||
                res[i][j] == '(' || res[i][j] == ')' ||
                res[i][j] == 'i' || res[i][j] == '$')
            {
                install(prod[i], res[i][j]);
                break;
            }
            else if (res[i][j] == 'E' ||
                     res[i][j] == 'F' || res[i][j] == 'T')
            {
                if (j > 0 &&
                    (res[i][j - 1] == '+' || res[i][j - 1] == '*' ||
                     res[i][j - 1] == '(' || res[i][j - 1] == ')' ||
                     res[i][j - 1] == 'i' || res[i][j - 1] == '$'))
                {
                    install(prod[i], res[i][j - 1]);
                    break;
                }
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
                install(prod[i], re);
        }
    }

    printf("TRAILING Table:\n");

    for (i = 0; i < 18; i++)
    {
        printf("%-8c %-8c %-8c\n",
               arr[i][0], arr[i][1],
               arr[i][2] == '\0' ? '-' : arr[i][2]);
    }

    printf("\nTRAILING Sets:\n");

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
TRAILING Sets:

E -> 
F -> 
T ->
```

<img width="400" height="657" alt="image" src="https://github.com/user-attachments/assets/1bd2b317-b953-4a97-851d-a47ec787e3e8" />







## RESULT
Thus, the C program for computing the TRAILING sets of the given grammar was implemented.
