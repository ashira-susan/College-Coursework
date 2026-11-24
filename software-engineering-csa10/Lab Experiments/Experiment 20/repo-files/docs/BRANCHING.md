# Branching Strategy

```
main      o-----o-----------o-----------o------------o   (always deployable, protected)
           \   /             \         /             \
feature/    o-o  task-model    o--o--o   cli           o  docs/readme-and-ci
```

| Branch | Purpose | Created from | Merged into |
|--------|---------|--------------|-------------|
| `main` | Stable, reviewed code | - | - |
| `feature/<name>` | New functionality | `main` | `main` via PR |
| `fix/<name>` | Bug fixes | `main` | `main` via PR |
| `docs/<name>` | Documentation changes | `main` | `main` via PR |

## Branch protection (GitHub settings)
Settings -> Branches -> Add rule for `main`:
- Require a pull request before merging (1 approval)
- Require status checks to pass (CI workflow `CI`)
- Do not allow force pushes
