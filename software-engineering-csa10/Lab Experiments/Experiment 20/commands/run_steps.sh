#!/usr/bin/env bash
# Guided runner - Experiment 20 - Team Project Repository with Branches, Pull Requests and README Documentation
# Run from INSIDE this experiment folder:   bash commands/run_steps.sh
# Each step prints the command, runs it, then waits so YOU can take a screenshot
# (Windows Win+Shift+S | Linux PrintScreen | macOS Cmd+Shift+4) and save it to ./screenshots/<name>.png
# Steps marked MANUAL are done in the browser / editor. Use WSL Ubuntu, Linux, macOS or Git Bash.

EXP_DIR="$(pwd)"
WORK="${WORK:-$HOME/git-lab}"; mkdir -p "$WORK"
R="$EXP_DIR/repo-files"
[ -z "${GH_USER:-}" ]   && read -r -p "Your GitHub username: " GH_USER
[ -z "${GIT_NAME:-}" ]  && read -r -p "Your name for commits (e.g. Ashira Bridget Susan S): " GIT_NAME
[ -z "${GIT_EMAIL:-}" ] && read -r -p "Your commit email (the one on your GitHub account): " GIT_EMAIL
export GH_USER GIT_NAME GIT_EMAIL EXP_DIR WORK R

n=0
step() {            # step <file-name> <command>
  n=$((n+1)); clear
  echo "=========== STEP $n  ->  screenshots/$1.png ==========="
  echo "\$ $2"; echo
  eval "$2"
  echo; read -r -p ">>> Take the screenshot now, then press Enter to continue... " _
}
manual() {          # manual <file-name> <instructions>
  n=$((n+1)); clear
  echo "=========== STEP $n (MANUAL)  ->  screenshots/$1.png ==========="
  printf '%b\n' "$2"; echo
  read -r -p ">>> Do it, take the screenshot, then press Enter... " _
}
step '01_git_config' 'git config --global user.name "$GIT_NAME" && git config --global user.email "$GIT_EMAIL" && git config --global --list'
manual '02_create_repo_and_team' '🌐 Create the repository and invite the team
github.com → **New repository** → `taskboard-team` (Public, no README). Then **Settings → Collaborators → Add people** (your teammates). Screenshot the repository and the collaborators list.'
step '03_clone_and_skeleton' 'cd "$WORK" && git clone https://github.com/$GH_USER/taskboard-team.git && cd taskboard-team && R="$EXP_DIR/repo-files" && cp "$R/LICENSE" "$R/.gitignore" "$R/CONTRIBUTING.md" "$R/pytest.ini" . && mkdir -p docs .github/ISSUE_TEMPLATE src/taskboard tests && cp "$R/docs/BRANCHING.md" docs/ && cp "$R/.github/PULL_REQUEST_TEMPLATE.md" .github/ && cp "$R/.github/ISSUE_TEMPLATE/"*.md .github/ISSUE_TEMPLATE/ && cp "$R/src/taskboard/__init__.py" src/taskboard/ && touch tests/.gitkeep && printf "# TaskBoard\n\n> README under construction.\n" > README.md && git add . && git commit -m "chore: project skeleton, templates and contributing guide" && git branch -M main && git log --oneline'
step '04_push_main' 'git push -u origin main'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '05_branch_protection' '🌐 Protect the main branch
**Settings → Branches → Add branch ruleset / protection rule** for `main`: require a pull request before merging (1 approval). Screenshot the rule.'
step '06_feature_task_model' 'R="$EXP_DIR/repo-files" && git switch -c feature/task-model && cp "$R/src/taskboard/tasks.py" src/taskboard/ && cp "$R/tests/test_tasks.py" tests/ && python3 -m venv /tmp/venv-lab && . /tmp/venv-lab/bin/activate && pip install -q pytest && python -m pytest -q && git add src tests && git commit -m "feat: add Task model and TaskBoard"'
step '07_push_task_model' 'git push -u origin feature/task-model'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '08_pull_request_1' '🌐 Pull request #1 (uses the PR template) and merge
**Compare & pull request** – the description is pre-filled from `.github/PULL_REQUEST_TEMPLATE.md`; tick the checklist. Ask a teammate to review/approve, then **Merge pull request**. Screenshot the PR with the template and the merged status.'
step '09_feature_cli' 'R="$EXP_DIR/repo-files" && git switch main && git pull origin main && git switch -c feature/cli && cp "$R/src/taskboard/storage.py" src/taskboard/ && git add src && git commit -m "feat: save and load tasks as JSON" && cp "$R/src/taskboard/cli.py" "$R/src/taskboard/__main__.py" src/taskboard/ && cp "$R/tests/test_cli.py" tests/ && . /tmp/venv-lab/bin/activate && python -m pytest -q && git add src tests && git commit -m "feat: add command line interface (add, list, done)" && git log --oneline'
step '10_push_cli' 'git push -u origin feature/cli'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '11_pull_request_2' '🌐 Pull request #2 and merge
Open the PR, request a review from a teammate, merge. Screenshot the PR (Files changed) and merged status.'
step '12_docs_and_ci' 'R="$EXP_DIR/repo-files" && git switch main && git pull origin main && git switch -c docs/readme-and-ci && cp "$R/README.md" . && sed -i "s#<owner>/<repo>#$GH_USER/taskboard-team#g; s#<repo>#taskboard-team#g; s#<username-1>#$GH_USER#g" README.md && mkdir -p .github/workflows && cp "$R/.github/workflows/ci.yml" .github/workflows/ && git add . && git commit -m "docs: write full README and add CI workflow" && git push -u origin docs/readme-and-ci'
manual '13_pull_request_3_with_ci' '🌐 Pull request #3 – CI check and merge
Open the PR; wait for the **CI** check (GitHub Actions) to turn green. Screenshot the PR showing the passing check, then merge it.'
step '14_final_state' '. /tmp/venv-lab/bin/activate; git switch main && git pull origin main && python -m pytest -q && git log --oneline --graph --all && git shortlog -sn --no-merges'
manual '15_github_overview' '🌐 Overview screenshots
Screenshot: (a) the repository home page with the rendered README, (b) **Pull requests → Closed** list showing the 3 merged PRs, (c) **Insights → Contributors** (or Network graph), (d) **Actions** tab with the green CI run.'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
