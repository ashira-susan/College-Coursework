# Experiment 17 – Flask API Containerized with Docker, Pushed to Docker Hub and Deployed on Kubernetes

**Tools:** Docker, Docker Hub, Kubernetes (minikube / Docker Desktop)  |  **Course Outcome:** CO3

## Aim
To containerize a Flask REST API, push the image to Docker Hub and deploy it on a Kubernetes cluster.

## Prerequisites
Docker, a Docker Hub account, `kubectl`, and a local cluster (`minikube start --driver=docker`, or Docker Desktop → Settings → Kubernetes → Enable).

## Project structure
```
Exp17-Flask-API-Docker-Kubernetes/
├── app/app.py            Flask API (/, /health, /api/students CRUD)
├── tests/test_app.py     5 unit tests
├── requirements.txt
├── Dockerfile
├── k8s/deployment.yaml   3 replicas, probes, resource limits
├── k8s/service.yaml      NodePort service (30007)
├── output/               real test + API output from a local run
└── screenshots/
```

## API endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Welcome message + serving pod name |
| GET | `/health` | Health check |
| GET | `/api/students` | List students |
| GET | `/api/students/<id>` | One student |
| POST | `/api/students` | Add (`name`, `department`) |
| DELETE | `/api/students/<id>` | Delete |

## Part A – Run tests locally
```bash
pip install -r requirements.txt pytest
python -m pytest tests -v
```
Real output: [`output/pytest_output.txt`](output/pytest_output.txt) (5 passed)

## Part B – Docker
```bash
docker build -t flask-api:1.0 .
docker run -d -p 5000:5000 --name flask-api flask-api:1.0
curl http://localhost:5000/
curl http://localhost:5000/api/students
curl -X POST -H "Content-Type: application/json" \
     -d '{"name":"Meena","department":"IT"}' http://localhost:5000/api/students
docker stop flask-api && docker rm flask-api
```
Real API responses from a local run of this code: [`output/api_calls_local.txt`](output/api_calls_local.txt)

## Part C – Push to Docker Hub
```bash
docker login                                   # username + access token
docker tag flask-api:1.0 <dockerhub-username>/flask-api:1.0
docker push <dockerhub-username>/flask-api:1.0
```
Verify at `https://hub.docker.com/r/<dockerhub-username>/flask-api`.

## Part D – Deploy on Kubernetes
1. Edit `k8s/deployment.yaml` and replace `<dockerhub-username>` with your username.
```bash
kubectl cluster-info
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl get deployments
kubectl get pods -o wide
kubectl get svc flask-api-service

# access the service
minikube service flask-api-service --url      # minikube
# Docker Desktop Kubernetes:  http://localhost:30007

# scaling and self-healing demo
kubectl scale deployment flask-api --replicas=5
kubectl delete pod <one-pod-name>             # a new pod is created automatically
kubectl logs deployment/flask-api

# clean up
kubectl delete -f k8s/
```
Refresh `/` several times: `served_by` changes between pod names – that is the Service load-balancing across replicas.

## Expected output (what you should see)
- `kubectl get pods` → 3 pods `flask-api-xxxxx` with `1/1 Running`
- `kubectl get svc` → `flask-api-service  NodePort  80:30007/TCP`
- `curl <url>/health` → `{"status":"UP"}`

## Screenshots to submit
See [`screenshots/CHECKLIST.md`](screenshots/CHECKLIST.md).

## Viva questions
1. **Pod vs Deployment?** A Pod is the smallest runnable unit; a Deployment manages replicas and rolling updates of Pods.
2. **Why a Service?** Pods are ephemeral with changing IPs; a Service gives a stable address and load-balances.
3. **What is NodePort?** Exposes the Service on a static port (30000–32767) on every node.
4. **Why readiness and liveness probes?** Readiness gates traffic; liveness restarts a stuck container.
5. **Why gunicorn instead of `flask run`?** The Flask dev server is not meant for production.

## Troubleshooting
| Problem | Fix |
|---|---|
| `ImagePullBackOff` | Wrong username/tag or private repo – check `kubectl describe pod <pod>` |
| `ErrImageNeverPull`/local image | Push to Docker Hub, or `minikube image load flask-api:1.0` |
| Cannot reach NodePort (minikube) | Use `minikube service flask-api-service --url` |

## Result
The Flask API was containerized, published to Docker Hub and deployed on Kubernetes with 3 replicas behind a NodePort Service.
