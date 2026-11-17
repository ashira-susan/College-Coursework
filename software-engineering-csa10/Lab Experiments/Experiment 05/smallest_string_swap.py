"""Experiment 5 - Lexicographically smallest string by swapping two characters.

Rule: at most ONE swap of two characters is allowed.
Greedy idea (same as the RAPTOR flowchart):
  scan i from left to right; find the smallest character to the right of i
  (take its LAST occurrence); if it is smaller than s[i], swap and stop.
"""
from itertools import combinations


def smallest_by_one_swap(s: str) -> str:
    chars = list(s)
    n = len(chars)
    i = 0
    while i < n - 1:
        min_pos = i + 1
        j = i + 2
        while j < n:                       # find smallest char right of i
            if chars[j] <= chars[min_pos]: # <= keeps the LAST occurrence
                min_pos = j
            j += 1
        if chars[min_pos] < chars[i]:      # a swap improves the string
            chars[i], chars[min_pos] = chars[min_pos], chars[i]
            break
        i += 1
    return "".join(chars)


def brute_force(s: str) -> str:
    best = s
    for a, b in combinations(range(len(s)), 2):
        t = list(s)
        t[a], t[b] = t[b], t[a]
        best = min(best, "".join(t))
    return best


if __name__ == "__main__":
    tests = ["dcba", "abcd", "bab", "cbaa", "zyx", "hello", "banana", "a"]
    print("Experiment 5: Lexicographically smallest string (one swap)")
    print("-" * 58)
    print(f"{'Input':<10}{'Output':<10}{'Brute-force check'}")
    for t in tests:
        out = smallest_by_one_swap(t)
        assert out == brute_force(t), (t, out, brute_force(t))
        print(f"{t:<10}{out:<10}{'match'}")
    print()
    print("All test cases verified against brute force.")
