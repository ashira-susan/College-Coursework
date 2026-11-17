"""Experiment 4 - Find the length of a string (reference implementation).

Mirrors the RAPTOR flowchart in ../diagrams/exp04_flowchart.png:
walk through the string one character at a time and count each character.
"""


def string_length(s: str) -> int:
    count = 0          # count <- 0
    i = 1              # i <- 1 (RAPTOR strings are 1-indexed)
    n = len(s)         # n <- Length_Of(s)  (loop bound only)
    while i <= n:      # Is i <= n ?
        count = count + 1
        i = i + 1
    return count


if __name__ == "__main__":
    tests = ["hello", "RAPTOR", "Hello World", "a", "", "12345 67890"]
    print("Experiment 4: Length of a String")
    print("-" * 40)
    for t in tests:
        result = string_length(t)
        assert result == len(t)
        print(f'Input : "{t}"')
        print(f"Length: {result}")
        print()
    print("All test cases passed.")
