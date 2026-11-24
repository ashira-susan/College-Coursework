# Contributing to TaskBoard

Thank you for helping! Follow these rules so the team can work in parallel without breaking `main`.

## Workflow (GitHub Flow)
1. `main` is always working and is **protected** - nobody pushes to it directly.
2. Create a branch from an up-to-date `main`:
   ```bash
   git switch main && git pull
   git switch -c feature/<short-name>
   ```
   Prefixes: `feature/`, `fix/`, `docs/`, `chore/`.
3. Commit small, logical changes with clear messages (imperative mood: "Add task model").
4. Run the tests before pushing: `python -m pytest`.
5. Push the branch and open a **Pull Request** using the template.
6. At least **one teammate** reviews and approves. Address comments with new commits on the same branch.
7. The PR is merged with **Merge pull request**; then delete the branch.

## Commit message format
```
<type>: <short summary>

optional longer explanation
```
Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`.

## Code style
- Python 3.9+, follow PEP 8, add tests for new behaviour.
