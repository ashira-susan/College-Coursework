# Experiment 23 – Multi-Container Application (Frontend, Backend, Database) on Kubernetes with Scaling

**Tools:** Docker, Kubernetes  |  **Course Outcome:** CO3

## Aim
To deploy a three-tier application – Nginx frontend, Flask backend and PostgreSQL database – on Kubernetes and demonstrate scaling of the backend.

## Architecture
```
Browser ──► frontend-service (NodePort 30080) ──► frontend pods (Nginx)
                                                      │  /api/*
                                                      ▼
                                       backend-service (ClusterIP :5000) ──► backend pods (Flask) ×N
                                                                                   │
                                                                                   ▼
                                                              postgres-service (ClusterIP :5432) ──► postgres pod + PVC
```

## Project structure
```
Exp23-Multi-Container-Kubernetes/
├── frontend/   index.html, nginx.conf, Dockerfile
├── backend/    app.py, requirements.txt, Dockerfile
├── k8s/        00-namespace, 01-db-secret, 02-database, 03-backend, 04-frontend, 05-hpa
├── tests/      test_backend.py (4 tests)
├── docker-compose.yml   run the same 3 tiers locally without Kubernetes
├── deploy.sh            build, push and apply everything
├── output/pytest_output.txt
└── screenshots/
```

## Backend API
| Path | Purpose |
|---|---|
| `GET /api/health` | liveness (no DB access) |
| `GET /api/ready` | readiness (database reachable) |
| `GET /api/info` | name of the pod that answered – shows load-balancing |
| `GET/POST /api/messages` | read / save messages in PostgreSQL |

## Part A – Test locally with Docker Compose (optional but recommended)
```bash
docker compose up -d --build
# open http://localhost:8080 , add a message
docker compose down -v
```
Backend unit tests (use SQLite fallback): `pip install -r backend/requirements.txt pytest` then `python -m pytest tests -v` → [`output/pytest_output.txt`](output/pytest_output.txt) (4 passed).

## Part B – Build and push images
```bash
export DOCKERHUB_USER=<your-username>
docker login
docker build -t $DOCKERHUB_USER/multi-backend:1.0  ./backend
docker build -t $DOCKERHUB_USER/multi-frontend:1.0 ./frontend
docker push $DOCKERHUB_USER/multi-backend:1.0
docker push $DOCKERHUB_USER/multi-frontend:1.0
```
Edit the `image:` lines in `k8s/03-backend.yaml` and `k8s/04-frontend.yaml` (replace `<dockerhub-username>`), **or** run `./deploy.sh`, which does build + push + deploy in one go using a rendered copy of the manifests.

## Part C – Deploy to Kubernetes
```bash
minikube start --driver=docker            # skip if using Docker Desktop Kubernetes
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-db-secret.yaml
kubectl apply -f k8s/02-database.yaml
kubectl apply -f k8s/03-backend.yaml
kubectl apply -f k8s/04-frontend.yaml

kubectl -n multi-app get pods -w          # wait until all are Running / Ready
kubectl -n multi-app get all
kubectl -n multi-app get pvc

# open the app
minikube service frontend-service -n multi-app        # minikube
# Docker Desktop Kubernetes:  http://localhost:30080
```

## Part D – Scaling demonstration
```bash
# before: 2 backend replicas
kubectl -n multi-app get pods -l app=backend

# scale up
kubectl -n multi-app scale deployment backend --replicas=5
kubectl -n multi-app get pods -l app=backend
kubectl -n multi-app get deployment backend

# click "Ask backend again" in the web page several times:
# the pod name changes -> traffic is load-balanced across replicas
# (or: for i in 1 2 3 4 5 6; do curl -s http://<url>/api/info; echo; done)

# scale down
kubectl -n multi-app scale deployment backend --replicas=1
```
**Self-healing:** `kubectl -n multi-app delete pod <backend-pod>` – Kubernetes creates a replacement immediately.

**Data persistence:** `kubectl -n multi-app delete pod -l app=postgres` – after the new database pod is Ready, the saved messages are still shown (data lives on the PVC).

**Optional autoscaling:**
```bash
minikube addons enable metrics-server
kubectl apply -f k8s/05-hpa.yaml
kubectl -n multi-app get hpa
```

## Clean up
```bash
kubectl delete namespace multi-app
```

## Expected output (what you should see)
- `kubectl -n multi-app get pods` → 2× `backend`, 2× `frontend`, 1× `postgres`, all `1/1 Running`
- After scaling → 5 `backend` pods
- Web page shows different `Backend pod that answered` values on refresh; saved messages persist

## Screenshots to submit
See [`screenshots/CHECKLIST.md`](screenshots/CHECKLIST.md).

## Viva questions
1. **Why is the database a Deployment with 1 replica and a PVC?** Databases are stateful; the PVC keeps data when the pod is replaced (production often uses a StatefulSet).
2. **How does the frontend find the backend?** Cluster DNS resolves the Service name `backend-service`; Nginx proxies `/api/` to it.
3. **ClusterIP vs NodePort?** ClusterIP is internal only; NodePort also exposes the Service outside the cluster.
4. **Why a Secret for the DB password?** Keeps credentials out of images and plain manifests (note: Secrets are only base64-encoded unless encryption is enabled).
5. **Horizontal vs vertical scaling?** Horizontal adds more pods; vertical gives a pod more CPU/memory.
6. **Why separate liveness and readiness probes?** Readiness removes a pod from traffic while the DB is unavailable; liveness restarts a hung process.

## Troubleshooting
| Problem | Fix |
|---|---|
| Backend pods `0/1 Running` | DB is still starting – readiness passes once PostgreSQL is Ready; check `kubectl -n multi-app logs deploy/backend` |
| `ImagePullBackOff` | Username/tag wrong in manifests or repository is private |
| Frontend `CrashLoopBackOff: host not found in upstream` | Apply `03-backend.yaml` (creates `backend-service`) before the frontend |
| NodePort unreachable on minikube | Use `minikube service frontend-service -n multi-app` |
| HPA shows `<unknown>` | Enable metrics-server and wait ~1 minute |

## Result
A frontend–backend–database application was deployed on Kubernetes, and the backend was scaled up and down while traffic was load-balanced and data persisted.
