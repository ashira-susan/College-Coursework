
# EXPERIMENT 17

## AIM
To implement a Lexical Analyzer in C to scan and count the number of characters, words, and lines in a file.

## PROGRAM

```c
#include <stdio.h>

int main()
{
    char str[100];
    int words = 0, newline = 0, characters = 0;

    scanf("%99[^~]", str);

    for (int i = 0; str[i] != '\0'; i++)
    {
        if (str[i] == ' ')
        {
            words++;
        }
        else if (str[i] == '\n')
        {
            newline++;
            words++;
        }
        else
        {
            characters++;
        }
    }

    if (characters > 0)
    {
        words++;
        newline++;
    }

    printf("Total number of words      : %d\n", words);
    printf("Total number of lines      : %d\n", newline);
    printf("Total number of characters : %d\n", characters);

    return 0;
}
```

## INPUT

```text
void main()
{
int a;
int b;
a = b + c;
c = d * e;
}~
```

## OUTPUT

<img width="465" height="447" alt="image" src="https://github.com/user-attachments/assets/ad47a67f-311c-4b24-9b68-bc2064c891eb" />


## RESULT
Thus, the Lexical Analyzer was implemented to count the characters, words, and lines in the given input.
