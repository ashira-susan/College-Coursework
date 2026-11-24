#!/usr/bin/env bash
# Guided runner - Experiment 26 - Cloning a GitHub Repository and Editing Files Locally
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
manual '02_create_repo_with_starter_files' '🌐 Create the repository you will clone
github.com → **New repository** → `student-notes` (Public, no README) → **Create**. Click **uploading an existing file**, drag the two files from this folder'"'"'s `starter-files/` (README.md, notes.md) → **Commit changes**. Screenshot the repository.'
step '03_clone' 'cd "$WORK" && git clone https://github.com/$GH_USER/student-notes.git && cd student-notes && ls -a && git remote -v && git log --oneline'
step '04_edit_files' 'printf '"'"'\n## Added locally\n- git clone copies the full history to my computer.\n- I edited this file in my own editor.\n'"'"' >> notes.md && printf '"'"'1. Learn git add / commit / push\n2. Try branches\n3. Open a pull request\n'"'"' > todo.txt && ls && cat notes.md'
manual '05_edit_in_vscode' 'Edit in VS Code (optional)
Run `code .` in the repository folder, change a line in `notes.md` by hand and save. Screenshot VS Code showing the modified file in the Source Control panel.'
step '06_status_and_diff' 'git status && git diff'
step '07_add_commit' 'git add notes.md todo.txt && git commit -m "Update notes and add todo list" && git log --oneline'
step '08_push' 'git push origin main'   # asks for your GitHub login: password = Personal Access Token (hide it in the screenshot)
manual '09_github_shows_changes' '🌐 See the changes on GitHub
Open the repository on github.com. Screenshot the updated file list and the latest commit message (and optionally the commit'"'"'s diff).'
clear; echo "All steps done. Put your screenshots in ./screenshots/ and commit them to your repository."
