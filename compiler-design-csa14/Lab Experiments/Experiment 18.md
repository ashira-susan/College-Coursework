
# EXPERIMENT 18

## AIM
To implement the back end of a compiler in C by generating machine-level instructions from three-address intermediate code.

## PROGRAM

```c
#include <stdio.h>
#include <string.h>

int main()
{
    int n, i, j;
    char a[50][50];

    printf("Enter the number of intermediate codes: ");
    scanf("%d", &n);

    getchar();

    for (i = 0; i < n; i++)
    {
        printf("Enter the three-address code %d: ", i + 1);
        fgets(a[i], sizeof(a[i]), stdin);
        a[i][strcspn(a[i], "\n")] = '\0';
    }

    printf("\nThe generated code is:\n");

    for (i = 0; i < n; i++)
    {
        char result = a[i][0];
        char operand1 = a[i][2];
        char op = a[i][3];
        char operand2 = a[i][4];

        printf("mov %c,R%d\n", operand1, i);

        if (op == '-')
            printf("sub %c,R%d\n", operand2, i);
        else if (op == '+')
            printf("add %c,R%d\n", operand2, i);
        else if (op == '*')
            printf("mul %c,R%d\n", operand2, i);
        else if (op == '/')
            printf("div %c,R%d\n", operand2, i);

        printf("mov R%d,%c\n\n", i, result);
    }

    return 0;
}
```

## INPUT

```text
2
a=b+c
d=n*d
```

## OUTPUT

<img width="580" height="531" alt="image" src="https://github.com/user-attachments/assets/5bbca383-1136-4740-8b8a-ed56dead0c13" />


## RESULT
Thus, the back end of the compiler was implemented successfully by generating target instructions from the given three-address code.
