# Screenshots to take for Experiment 19
1. Repository file tree showing `.github/workflows/cd.yml`
2. Secrets page (names only: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
3. Self-hosted runner page showing **Idle**
4. Actions tab: workflow run with all jobs green
5. Expanded logs of the `test`, `build-and-push` and `deploy` jobs
6. Docker Hub repository with the pushed tags
7. `docker ps` + `curl http://localhost:5001/` on the deployed container
8. A second run after changing the code (shows continuous deployment)
