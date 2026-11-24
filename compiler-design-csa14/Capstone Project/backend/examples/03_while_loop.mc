// A while loop: factorial of 5 and the sum 1..10
int n = 5, fact = 1;
while (n > 1) {
    fact = fact * n;
    n = n - 1;
}
print(fact);

int i = 1, sum = 0;
while (i <= 10) {
    sum = sum + i;
    i = i + 1;
}
print(sum);
