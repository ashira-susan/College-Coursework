# Screenshots to take for Experiment 18
1. `docker compose up -d --build` (Jenkins container running) and `docker ps`
2. Jenkins unlock page / dashboard at http://localhost:8081
3. Credentials page showing `dockerhub-creds` (never show the token)
4. Pipeline job configuration (SCM + Script Path)
5. **Build Now** and the **Stage View** with all stages green
6. Console Output of the build (ending with `Finished: SUCCESS`)
7. `docker ps` showing `flask-cicd-demo`, and browser/curl on `http://localhost:5000`
8. Docker Hub repository showing the pushed tags
9. A second build triggered after a code change (Build History)
10. (Optional) a failed build caused by a broken test
