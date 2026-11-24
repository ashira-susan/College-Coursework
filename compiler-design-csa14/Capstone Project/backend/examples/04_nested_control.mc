// Nested control flow: largest of three numbers, then even numbers up to 10
int x = 14, y = 29, z = 7;
int largest = x;

if (y > largest) largest = y;
if (z > largest) largest = z;
print(largest);

int k = 1;
while (k <= 10) {
    if (k % 2 == 0) {
        print(k);
    }
    k = k + 1;
}
