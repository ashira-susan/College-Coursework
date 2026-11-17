"""Program under analysis (its flow graph is in ../diagrams/exp08_flow_graph.png).

Node numbers in comments match the flow graph.
"""


def alternating_sum(n):
    total = 0              # node 1
    i = 1                  # node 1
    while i <= n:          # node 2  (predicate)
        if i % 2 == 0:     # node 3  (predicate)
            total += i     # node 4
        else:
            total -= i     # node 5
        i += 1             # node 6
    return total           # node 7


if __name__ == "__main__":
    print(alternating_sum(5))
