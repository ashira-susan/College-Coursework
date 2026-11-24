// Arithmetic expressions, precedence and mixed int/float types
int a = 12, b = 5;
float ratio;

int sum = a + b * 2;          // * binds tighter than +
int rem = a % b;
ratio = (a + b) / 2.0;

print(sum);
print(rem);
print(ratio);
