#!/usr/bin/env bash
# Guided runner - Experiment 25 - Creating a GitHub Repository and Pushing a README File
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
step '01_git_version_and_config' 'git --version && git config --global user.name "$GIT_NAME" && git config --global user.email "$GIT_EMAIL" && git config --global --list'
manual '02_github_new_repository' '🌐 Create the empty repository on GitHub
github.com → **+** → **New repository** → name `hello-github`, **Public**, do NOT tick '"'"'Add a README'"'"' → **Create repository**. Screenshot the empty-repository page showing the quick-setup commands.'
step '03_init_project' 'mkdir -p "$WORK/hello-github" && cd "$WORK/hello-github" && git init -b main && ls -a'
step '04_create_readme' 'cp "$EXP_DIR/repo-files/README.md" "$EXP_DIR/repo-files/.gitignore" . && cat README.md && git status'
step '05_stage_and_commit' 'git add README.md .gitignore && git status && git commit -m "Add README and .gitignore" && git log --oneline'
step '06_connect_remote' 'git remote add origin https://github.com/$GH_USER/hello-github.git && git remote -v && git branch -M main'
step '07_push_to_github' 'git push -u origin main'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '08_github_repository_page' '🌐 Check the repository page
Refresh your repository on github.com. Screenshot it showing README.md rendered and the commit message.'
step '09_verify' 'git status && git log --oneline origin/main'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
