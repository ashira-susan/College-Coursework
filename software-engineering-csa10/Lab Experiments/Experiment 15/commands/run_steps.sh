#!/usr/bin/env bash
# Guided runner - Experiment 15 - Working with Git Branches and Resolving Merge Conflicts
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
step '02_first_commit' 'mkdir -p "$WORK/branch-demo" && cd "$WORK/branch-demo" && git init -b main && printf '"'"'Welcome to Git Lab\nTheme: light\nVersion: 1.0\n'"'"' > welcome.txt && git add welcome.txt && git commit -m "Initial welcome file" && git branch'
step '03_two_branches' 'git switch -c feature-dark && sed -i '"'"'s/Theme: light/Theme: dark/'"'"' welcome.txt && git commit -am "Switch theme to dark" && git switch main && git switch -c feature-blue && sed -i '"'"'s/Theme: light/Theme: blue/'"'"' welcome.txt && git commit -am "Switch theme to blue" && git switch main && git branch && git log --oneline --graph --all'
step '04_fast_forward_merge' 'git merge feature-dark && cat welcome.txt'
step '05_conflict' 'git merge feature-blue; git status; cat welcome.txt'
manual '06_resolve_in_vscode' 'Resolve the conflict in VS Code
Open the folder in VS Code (`code .`) → open `welcome.txt`. Screenshot the conflict view (Accept Current / Accept Incoming / Accept Both). Then edit the Theme line to `Theme: dark-blue`, remove all marker lines and save. Screenshot the resolved file.
   *Fallback without an editor:* `printf '"'"'Welcome to Git Lab\nTheme: dark-blue\nVersion: 1.0\n'"'"' > welcome.txt`'
step '07_finish_merge' 'cat welcome.txt && git add welcome.txt && git status && git commit -m "Merge feature-blue: combine dark and blue theme" && git log --oneline --graph --all'
step '08_abort_demo' 'git switch -c feature-red && sed -i '"'"'s/Theme: dark-blue/Theme: red/'"'"' welcome.txt && git commit -qam "Switch theme to red" && git switch -q main && sed -i '"'"'s/Theme: dark-blue/Theme: green/'"'"' welcome.txt && git commit -qam "Switch theme to green" && git merge feature-red; git merge --abort; git status'
step '09_cleanup_branches' 'git branch -d feature-dark feature-blue && git branch -D feature-red && git branch'
manual '10_create_github_repo' '🌐 Create the empty repository on GitHub
github.com → **New repository** → `branch-demo`, Public, no README → **Create**.'
step '11_push' 'git remote add origin https://github.com/$GH_USER/branch-demo.git && git push -u origin main && git branch -a'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
step '12_push_a_branch' 'git switch -c feature-footer && echo "Footer: Git Lab" >> welcome.txt && git commit -am "Add footer line" && git push -u origin feature-footer && git switch main'
manual '13_github_branches' '🌐 Branches on GitHub
On the repository page open the branch dropdown (or **Branches**). Screenshot showing `main` and `feature-footer`; also screenshot the **commits** page showing the merge commit.'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
