# ITA06 Machine Learning - Assignment 1 (code)

Requirements: Python 3.8+ and matplotlib (only for figs.py). No ML library is used.

Files
- ml.py    : conjunctive hypotheses ("?" and "∅"), covers(), more-general-than, Candidate Elimination (prints S and G after every example, reports an empty version space).
- id3.py   : entropy, information gain, gain ratio, recursive ID3 with max-depth / min-samples / min-gain controls, prediction (unseen value -> node majority), rules, metrics.
- exp.py   : Task 10 experiments (LOOCV, learning/depth/noise curves, Dataset C generator). Random seed 42.
- exp2.py  : decision-threshold and noise experiments used in Task 11.
- tests.py : test cases TC1-TC8.  Run: python3 tests.py
- figs.py  : regenerates the figures.

Run:  python3 ml.py   (Candidate Elimination traces)   |   python3 id3.py   (ID3 tables, trees)   |   python3 tests.py
Policies: tie on gain -> first attribute in column order; tied leaf -> "Yes"; unseen attribute value -> majority class of the current node.
