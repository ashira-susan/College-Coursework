#!/usr/bin/env bash
# Deploy the whole stack to the current Kubernetes context (minikube / Docker Desktop / kind).
# Usage: DOCKERHUB_USER=yourname ./deploy.sh
set -euo pipefail
: "${DOCKERHUB_USER:?Set DOCKERHUB_USER first}"

docker build -t "$DOCKERHUB_USER/multi-backend:1.0"  ./backend
docker build -t "$DOCKERHUB_USER/multi-frontend:1.0" ./frontend
docker push "$DOCKERHUB_USER/multi-backend:1.0"
docker push "$DOCKERHUB_USER/multi-frontend:1.0"

# put your username into the manifests (works on a copy, originals stay untouched)
rm -rf .rendered && mkdir .rendered
for f in k8s/*.yaml; do sed "s#<dockerhub-username>#$DOCKERHUB_USER#g" "$f" > ".rendered/$(basename "$f")"; done

kubectl apply -f .rendered/00-namespace.yaml
kubectl apply -f .rendered/01-db-secret.yaml
kubectl apply -f .rendered/02-database.yaml
kubectl apply -f .rendered/03-backend.yaml
kubectl apply -f .rendered/04-frontend.yaml

kubectl -n multi-app rollout status deployment/postgres
kubectl -n multi-app rollout status deployment/backend
kubectl -n multi-app rollout status deployment/frontend
kubectl -n multi-app get all
echo "Open the app with:  minikube service frontend-service -n multi-app   (or http://localhost:30080 on Docker Desktop)"
