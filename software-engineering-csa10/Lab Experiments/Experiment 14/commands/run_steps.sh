#!/usr/bin/env bash
# Guided runner - Experiment 14 - Fork-and-Pull-Request Collaboration Workflow using Git and GitHub
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
Open `https://github.com/<UPSTREAM_OWNER>/<REPO>` → click **Fork** → **Create fork**. Screenshot your fork page showing '"'"'forked from <owner>/<repo>'"'"'.'
step '03_clone_fork_add_upstream' 'cd "$WORK" && git clone https://github.com/$GH_USER/$REPO.git && cd "$REPO" && git remote -v && git remote add upstream https://github.com/$UPSTREAM_OWNER/$REPO.git && git remote -v'
step '04_create_branch' 'git switch -c "add-$GH_USER-profile" && git branch'
step '05_make_contribution' 'mkdir -p contributors && printf "# %s\n\n- GitHub: @%s\n" "$GIT_NAME" "$GH_USER" > "contributors/$GH_USER.md" && echo "| $GIT_NAME | @$GH_USER | contributors/$GH_USER.md |" >> CONTRIBUTORS.md && git status -s && git add . && git commit -m "Add $GH_USER to contributors" && git log --oneline | head -5'
step '06_push_branch_to_fork' 'git push -u origin "add-$GH_USER-profile"'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '07_open_pull_request' '🌐 Open the pull request
Click **Compare & pull request** on your fork. Check: base repository = the ORIGINAL repo, base = default branch; head repository = your fork. Use the text in `PULL_REQUEST.md`. Screenshot the PR (Conversation and Files changed).'
step '08_update_after_review' 'printf "\n## Skills\n- Git and GitHub\n" >> "contributors/$GH_USER.md" && git commit -am "Address review: add skills section" && git push && git log --oneline | head -5'
manual '09_maintainer_merges' '🌐 Maintainer merges the PR
The original repository'"'"'s owner (classmate / your second account) clicks **Merge pull request**. Screenshot the PR showing '"'"'Merged'"'"' (or the open PR if nobody merges – ask your faculty whether that is accepted).'
step '10_sync_fork' 'git fetch upstream && git remote set-head upstream -a >/dev/null && BASE=$(git symbolic-ref --short refs/remotes/upstream/HEAD | cut -d/ -f2) && git switch "$BASE" && git fetch upstream && git merge upstream/"$BASE" && git push origin "$BASE" && git log --oneline --graph | head -12'
step '11_cleanup' 'git branch -d "add-$GH_USER-profile" || git branch -D "add-$GH_USER-profile"; git push origin --delete "add-$GH_USER-profile"; git branch -a'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
