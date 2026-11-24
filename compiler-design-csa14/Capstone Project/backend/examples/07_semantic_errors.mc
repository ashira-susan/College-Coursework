// Semantic errors and warnings: the syntax is fine, the meaning is not
int a = 5;
int a = 6;                    // already declared
total = a + 1;                // undeclared variable
float f = 2.5;
int n = f;                    // float stored in an int
print(a % 0);                 // division by zero
float g = f % 2;              // % needs integers
