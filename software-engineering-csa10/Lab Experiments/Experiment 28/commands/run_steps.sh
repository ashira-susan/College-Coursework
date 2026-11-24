#!/usr/bin/env bash
# Guided runner - Experiment 28 - Pulling Collaborator Changes from GitHub
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
manual '02_create_repo' '🌐 Create the shared repository
github.com → **New repository** → `team-notes`, Public, **tick '"'"'Add a README file'"'"'** → **Create**. (If you have a real teammate, add them under Settings → Collaborators.)'
step '03_clone' 'cd "$WORK" && git clone https://github.com/$GH_USER/team-notes.git && cd team-notes && git config pull.rebase false && git log --oneline'
manual '04_collaborator_commit' '🌐 Your '"'"'collaborator'"'"' pushes a change
Ask your teammate to push a commit – or play the teammate yourself: on github.com open the repo → **Add file → Create new file** → `ideas.md` with a few lines → **Commit changes** to `main`. Screenshot the new commit on GitHub.'
step '05_fetch_and_inspect' 'git status && git fetch origin && git status && git log HEAD..origin/main --oneline && git diff HEAD origin/main --stat'
step '06_pull' 'git pull origin main && ls && cat ideas.md && git log --oneline'
step '07_local_commit' 'printf '"'"'# Tasks\n\n- [ ] %s: design the UI\n'"'"' "$GIT_NAME" > tasks.md && git add tasks.md && git commit -m "Add tasks list"'
manual '08_second_collaborator_commit' '🌐 Collaborator pushes again
On github.com open `ideas.md` → pencil icon → add a line → **Commit changes** to `main`. Screenshot the commit.'
step '09_push_rejected' 'git push origin main; true'
step '10_pull_and_merge' 'git pull --no-edit origin main && git log --oneline --graph'
step '11_push' 'git push origin main && git status'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '12_github_commits_page' '🌐 Commits page on GitHub
Open the repository'"'"'s **commits** page. Screenshot the history showing the merge commit and both authors'"'"' commits.'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
