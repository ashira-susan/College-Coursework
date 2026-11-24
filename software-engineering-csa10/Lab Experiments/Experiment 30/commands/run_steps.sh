#!/usr/bin/env bash
# Guided runner - Experiment 30 - Forking, Feature Branch and Pull Request to the Original Repository
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
[ -z "${UPSTREAM_OWNER:-}" ] && read -r -p "Owner of the ORIGINAL repository (classmate / 2nd account / octocat): " UPSTREAM_OWNER
[ -z "${REPO:-}" ]           && read -r -p "Name of the original repository (e.g. Spoon-Knife): " REPO
export UPSTREAM_OWNER REPO
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
manual '02_fork_the_repository' '🌐 Fork the original repository
Open `https://github.com/<UPSTREAM_OWNER>/<REPO>` → **Fork** → **Create fork**. Screenshot your fork page.'
step '03_clone_fork_add_upstream' 'cd "$WORK" && git clone https://github.com/$GH_USER/$REPO.git && cd "$REPO" && git remote add upstream https://github.com/$UPSTREAM_OWNER/$REPO.git && git remote -v'
step '04_create_feature_branch' 'git switch -c "feature/add-greeting-$GH_USER" && git branch'
step '05_implement_feature' 'mkdir -p greetings && printf "Hello from %s!\n" "$GH_USER" > "greetings/$GH_USER.txt" && echo "- Greeting added by @$GH_USER" >> README.md && git status -s && git add . && git commit -m "Add greeting from $GH_USER" && git log --oneline | head -5'
step '06_fetch_upstream' 'git fetch upstream && git log --oneline --graph --all | head -15'
step '07_rebase_on_upstream' 'git fetch upstream && git remote set-head upstream -a >/dev/null && BASE=$(git symbolic-ref --short refs/remotes/upstream/HEAD | cut -d/ -f2) && git rebase upstream/"$BASE" && git log --oneline --graph | head -10'
step '08_push_feature_branch' 'git push -u origin "feature/add-greeting-$GH_USER"'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '09_open_pull_request' '🌐 Open the pull request to the original repository
Click **Compare & pull request**. Base repository = ORIGINAL repo; head = your fork `feature/add-greeting-<you>`. Use the text in `PULL_REQUEST.md`. Screenshot the PR (Conversation + Files changed).'
manual '10_maintainer_merges' '🌐 Maintainer reviews and merges
The original owner merges (or comments). Screenshot the PR status.'
step '11_sync_fork_main' 'git fetch upstream && git remote set-head upstream -a >/dev/null && BASE=$(git symbolic-ref --short refs/remotes/upstream/HEAD | cut -d/ -f2) && git switch "$BASE" && git fetch upstream && git merge --ff-only upstream/"$BASE" && git push origin "$BASE" && git log --oneline --graph | head -10'
step '12_delete_branch' 'git branch -d "feature/add-greeting-$GH_USER" || git branch -D "feature/add-greeting-$GH_USER"; git push origin --delete "feature/add-greeting-$GH_USER"; git branch -a'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
