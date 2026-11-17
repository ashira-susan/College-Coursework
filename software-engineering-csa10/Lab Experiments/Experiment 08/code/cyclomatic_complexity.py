"""Experiment 8 - Cyclomatic complexity of a flow graph.

Computes V(G) three ways and checks they agree:
  1. V(G) = E - N + 2P        (edges, nodes, connected components P = 1)
  2. V(G) = Predicate nodes + 1
  3. V(G) = Number of regions (bounded regions + the outer region)
"""

# Flow graph of sample_program.py
NODES = [1, 2, 3, 4, 5, 6, 7]
EDGES = [
    (1, 2),
    (2, 3),  # while-condition True
    (2, 7),  # while-condition False
    (3, 4),  # if True
    (3, 5),  # if False
    (4, 6),
    (5, 6),
    (6, 2),  # loop back
]
REGIONS = {
    "R1": "loop body area: 2-3-4-6-2 (if-true branch)",
    "R2": "loop body area: 2-3-5-6-2 (if-false branch)",
    "R3": "outside region",
}


def cyclomatic_complexity(nodes, edges, components=1):
    return len(edges) - len(nodes) + 2 * components


def predicate_nodes(nodes, edges):
    """A predicate node has more than one outgoing edge."""
    return [n for n in nodes if sum(1 for a, _ in edges if a == n) > 1]


if __name__ == "__main__":
    n, e = len(NODES), len(EDGES)
    p = predicate_nodes(NODES, EDGES)
    v1 = cyclomatic_complexity(NODES, EDGES)
    v2 = len(p) + 1
    v3 = len(REGIONS)

    print("Experiment 8: Cyclomatic Complexity of a Flow Graph")
    print("-" * 52)
    print(f"Nodes (N)            : {n}  {NODES}")
    print(f"Edges (E)            : {e}")
    print(f"Predicate nodes      : {len(p)}  {p}")
    print(f"Regions              : {v3}  {list(REGIONS)}")
    print()
    print(f"Method 1  V(G) = E - N + 2 = {e} - {n} + 2 = {v1}")
    print(f"Method 2  V(G) = P + 1     = {len(p)} + 1 = {v2}")
    print(f"Method 3  V(G) = Regions   = {v3}")
    assert v1 == v2 == v3
    print()
    print(f"Cyclomatic complexity V(G) = {v1}")
    print(f"Independent paths: {v1}")
    print("  Path 1: 1-2-7")
    print("  Path 2: 1-2-3-4-6-2-7")
    print("  Path 3: 1-2-3-5-6-2-7")
