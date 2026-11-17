# Experiment 19 – Continuous Deployment of a Dockerized Application using GitHub Actions

**Tools:** GitHub Actions, Docker, Docker Hub  |  **Course Outcome:** CO5

## Aim
To automate testing, image building, publishing and deployment of a Dockerized Flask app with a GitHub Actions workflow triggered on every push.

## Pipeline flow
```
git push (main) → [test] pytest → [build-and-push] image → Docker Hub → [deploy] pull + run container → smoke test
```

## Project structure
```
Exp19-GitHub-Actions-CD-Docker/
├── app/app.py
├── tests/test_app.py
├── requirements.txt
├── Dockerfile
├── .github/workflows/cd.yml          workflow for a STANDALONE repo
├── monorepo-variant/exp19-cd.yml     same workflow for the College-Coursework repo
├── output/pytest_output.txt          real local test run
└── screenshots/
```

## ⚠️ Where the workflow file must live
GitHub only runs workflows located in **`.github/workflows/` at the root of a repository**. A workflow inside `software-engineering-csa10/Lab Experiments/Exp19.../.github/` will **not** run. Choose one:

- **Option A (recommended): separate repo.** Create a new repo (e.g. `flask-cd-demo`), copy the contents of this folder into its root (including `.github/`), and push. Link it from your coursework repo's README.
- **Option B: keep it in College-Coursework.** Copy `monorepo-variant/exp19-cd.yml` to `.github/workflows/exp19-cd.yml` at the **root** of `College-Coursework`. It only triggers when files in this experiment's folder change and uses that folder as the build context.

## Step 1 – Docker Hub access token
Docker Hub → Account Settings → Security → **New Access Token** (Read & Write). Copy it.

## Step 2 – GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**
| Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | your Docker Hub username |
| `DOCKERHUB_TOKEN` | the access token from Step 1 |

## Step 3 – Register a self-hosted runner (for the deploy job)
The `deploy` job runs on your own machine, which needs Docker installed.
Repo → **Settings → Actions → Runners → New self-hosted runner** → follow the commands shown for your OS, then start it (`./run.sh` / `run.cmd`). The runner must show **Idle**.

*No machine to use? Remove the `deploy` job: the pipeline then ends after the image is published on Docker Hub, which still demonstrates CI + delivery.*

## Step 4 – Trigger the workflow
```bash
git add .
git commit -m "Add CD workflow"
git push origin main
```
Repo → **Actions** tab → open the run → watch the three jobs: `Run unit tests` → `Build and push image to Docker Hub` → `Deploy container (self-hosted runner)`.

## Step 5 – Verify
```bash
docker ps                               # flask-cd-demo running on port 5001
curl http://localhost:5001/             # {"message":"Hello from the CI/CD pipeline!", ...}
curl http://localhost:5001/health
```
Docker Hub → `<username>/flask-cd-demo` shows `latest` and a tag with the commit SHA.

**Show continuous deployment:** edit the message in `app/app.py`, push, and refresh – the running container is replaced automatically.

## Real local test output (same tests the workflow runs)
```
tests/test_app.py::test_home PASSED
tests/test_app.py::test_health PASSED
tests/test_app.py::test_add PASSED
3 passed
```
Full file: [`output/pytest_output.txt`](output/pytest_output.txt)

## Expected result
Actions tab shows a green check ✔ for all three jobs.

## Screenshots to submit
See [`screenshots/CHECKLIST.md`](screenshots/CHECKLIST.md).

## Viva questions
1. **What is GitHub Actions?** GitHub's built-in CI/CD platform driven by YAML workflows.
2. **Workflow, job, step, runner?** A workflow contains jobs; jobs contain steps; a runner is the machine executing a job.
3. **Why use secrets?** Credentials stay encrypted and are not visible in the repository or logs.
4. **What does `needs:` do?** Makes a job wait for another job to succeed.
5. **Continuous Delivery vs Deployment?** Delivery prepares a release-ready artifact; Deployment pushes it to production automatically.

## Troubleshooting
| Problem | Fix |
|---|---|
| Workflow does not appear | File must be in `.github/workflows/` at the repo root |
| `unauthorized` on push | Check both secrets and that the token has Read & Write |
| Deploy job stays "Waiting for a runner" | Start the self-hosted runner (must be Idle) |
| Port 5001 busy | Change the `-p 5001:5000` mapping in the workflow |

## Result
Every push to `main` is automatically tested, built, published to Docker Hub and deployed as a running container.
