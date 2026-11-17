# Experiment 18 – CI/CD Pipeline with Jenkins for a Containerized Application

**Tools:** Jenkins, Docker, GitHub, Docker Hub  |  **Course Outcome:** CO4

## Aim
To build a Jenkins CI/CD pipeline that tests, builds, pushes and deploys a containerized Flask application automatically.

## Pipeline flow
```
GitHub push → Jenkins → Checkout → Unit Tests → Build Image → Push to Docker Hub → Deploy container → Smoke Test
```

## Project structure
```
Exp18-Jenkins-CICD-Docker/
├── app/app.py              Flask app (/, /health, /add/<a>/<b>)
├── tests/test_app.py       3 unit tests
├── requirements.txt
├── Dockerfile              multi-stage: test stage runs pytest inside the build
├── Jenkinsfile             declarative pipeline (6 stages)
├── jenkins/
│   ├── Dockerfile          Jenkins image with Docker CLI
│   └── docker-compose.yml  starts Jenkins on http://localhost:8081
├── output/pytest_output.txt   real local test run
└── screenshots/
```

## Step 1 – Start Jenkins (inside Docker)
```bash
cd jenkins
docker compose up -d --build
docker logs jenkins          # copy the initial admin password
# or: docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Open `http://localhost:8081` → paste the password → **Install suggested plugins** → create the admin user.

> Lab setup note: Jenkins runs as root with the Docker socket mounted so that pipeline stages can use Docker. Do not use this configuration in production.

## Step 2 – Add Docker Hub credentials
**Manage Jenkins → Credentials → System → Global → Add Credentials**
- Kind: *Username with password*
- Username: your Docker Hub username
- Password: a Docker Hub **access token** (Docker Hub → Account Settings → Security → New Access Token)
- ID: `dockerhub-creds`

## Step 3 – Push this experiment to GitHub
Edit `Jenkinsfile` and set `DOCKERHUB_USER` to your username, then commit and push.

## Step 4 – Create the pipeline job
1. **New Item** → name `flask-cicd-pipeline` → **Pipeline** → OK
2. **Pipeline → Definition:** *Pipeline script from SCM* → SCM: *Git*
3. Repository URL: `https://github.com/ashira-susan/College-Coursework.git`, Branch: `*/main`
4. **Script Path:** `software-engineering-csa10/Lab Experiments/Exp18-Jenkins-CICD-Docker/Jenkinsfile`
5. Save → **Build Now**

*(If you keep this experiment in its own repo, the script path is simply `Jenkinsfile`.)*

## Step 5 – Automatic trigger (optional)
- Pipeline → **Build Triggers → Poll SCM** → schedule `H/2 * * * *` (works on localhost), **or**
- GitHub webhook to `http://<public-url>/github-webhook/` (needs a public URL, e.g. ngrok) with *GitHub hook trigger* enabled.

## Step 6 – Verify
```bash
docker ps                              # flask-cicd-demo running on port 5000
curl http://localhost:5000/health      # {"status":"UP"}
curl http://localhost:5000/add/2/3     # {"result":5}
```
Docker Hub → `<username>/flask-cicd-demo` shows tags `latest` and the build number.

Demonstrate CI: change the message in `app/app.py`, commit, push → a new build starts and the deployed version changes. Break a test on purpose → pipeline fails at **Unit Tests** and nothing is deployed.

## Real local test output (same tests the pipeline runs)
```
tests/test_app.py::test_home PASSED
tests/test_app.py::test_health PASSED
tests/test_app.py::test_add PASSED
3 passed
```
Full file: [`output/pytest_output.txt`](output/pytest_output.txt)

## Expected Jenkins result
Stage View shows all stages green: Checkout → Unit Tests → Build Image → Push to Docker Hub → Deploy → Smoke Test, and console ends with `Finished: SUCCESS`.

## Screenshots to submit
See [`screenshots/CHECKLIST.md`](screenshots/CHECKLIST.md).

## Viva questions
1. **CI vs CD?** CI automatically builds and tests every commit; CD automatically releases/deploys the tested build.
2. **What is a Jenkinsfile?** Pipeline-as-code stored in the repo.
3. **Declarative vs scripted pipeline?** Declarative has a fixed structured syntax (`pipeline { ... }`); scripted is free-form Groovy.
4. **Why a multi-stage Dockerfile?** The `test` stage fails the build if tests fail; the final image stays small and contains no test tools.
5. **Why Docker Hub credentials in Jenkins?** So the password is never written in the Jenkinsfile.

## Troubleshooting
| Problem | Fix |
|---|---|
| `docker: command not found` in pipeline | Use the Jenkins image from `jenkins/Dockerfile` (includes Docker CLI) |
| `permission denied ... docker.sock` | Compose file runs Jenkins as `root`; restart with `docker compose up -d` |
| `denied: requested access` on push | Check `DOCKERHUB_USER` in Jenkinsfile and the credentials ID |
| Port 5000 already in use | Change `-p 5000:5000` in the Deploy stage |

## Result
A Jenkins pipeline automatically tested, built, published and deployed the containerized application on every change.
