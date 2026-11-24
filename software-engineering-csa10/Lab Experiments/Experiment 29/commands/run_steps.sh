#!/usr/bin/env bash
# Guided runner - Experiment 29 - Feature Branch (feature-login) and Pull Request
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
manual '02_create_repo_with_starter_files' '🌐 Create the repository
github.com → **New repository** → `login-app` (Public, no README) → **uploading an existing file** → drag the files from `starter-files/` (README.md, index.html) → **Commit changes**. Screenshot the repository.'
step '03_clone' 'cd "$WORK" && git clone https://github.com/$GH_USER/login-app.git && cd login-app && git log --oneline && git branch -a'
step '04_create_feature_branch' 'git switch -c feature-login && git branch'
step '05_commit_login_ui' 'cp "$EXP_DIR/repo-files/login.html" . && mkdir -p css && cp "$EXP_DIR/repo-files/css/login.css" css/ && git status -s && git add login.html css/login.css && git commit -m "Add login page UI"'
step '06_commit_validation' 'mkdir -p js && cp "$EXP_DIR/repo-files/js/login.js" js/ && cp "$EXP_DIR/repo-files/index.html" . && git status -s && git add js/login.js index.html && git commit -m "Add login form validation and home page link" && git log --oneline'
manual '07_try_the_page' 'Try the page in a browser
Double-click `login.html` (or open it with Live Server). Screenshot the login page and also one with validation errors (wrong email / short password).'
step '08_push_feature_branch' 'git push -u origin feature-login'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '09_open_pull_request' '🌐 Open the pull request
On GitHub click **Compare & pull request**. Title: `Add login feature`. Paste the text from `PULL_REQUEST.md` into the description. Click **Create pull request**. Screenshot the PR page (Conversation tab) and the **Files changed** tab.'
manual '10_review_and_merge' '🌐 Review and merge
Add a review comment (you cannot approve your own PR – ask a classmate if you can). Click **Merge pull request → Confirm merge**. Screenshot the '"'"'Merged'"'"' purple status.'
manual '11_delete_branch_on_github' '🌐 Delete the branch
Click **Delete branch** on the merged PR. Screenshot.'
step '12_sync_local' 'git switch main && git pull origin main && git log --oneline --graph && git branch -d feature-login && git fetch --prune && git branch -a'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
