#!/usr/bin/env bash
# Guided runner - Experiment 27 - Committing and Pushing Changes to GitHub
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
manual '02_create_repo' '🌐 Create the repository
github.com → **New repository** → `commit-demo`, Public, **tick '"'"'Add a README file'"'"'** → **Create**. Screenshot it.'
step '03_clone' 'cd "$WORK" && git clone https://github.com/$GH_USER/commit-demo.git && cd commit-demo && git log --oneline'
step '04_first_commit' 'cp "$EXP_DIR/repo-files/versions/calculator_v1.py" calculator.py && git status && git add calculator.py && git diff --staged && git commit -m "Add calculator with add()"'
step '05_second_commit' 'cp "$EXP_DIR/repo-files/versions/calculator_v2.py" calculator.py && git diff && git commit -am "Add subtract()"'
step '06_gitignore_and_readme' 'echo run.log > run.log && echo '"'"'*.log'"'"' > .gitignore && cp "$EXP_DIR/repo-files/README.md" README.md && git status -s && git add README.md .gitignore && git commit -m "Add README and .gitignore"'
step '07_review_history' 'git log --oneline && git show --stat HEAD && git status'
step '08_push' 'git push origin main'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '09_github_commit_history' '🌐 Commit history on GitHub
On the repository page click the **N commits** link. Screenshot the commit list.'
step '10_verify' 'git status && git log origin/main --oneline'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
