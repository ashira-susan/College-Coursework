# Screenshots to take for Experiment 17
1. `python -m pytest tests -v` (passed)
2. `docker build -t flask-api:1.0 .`
3. `docker run ...` + `curl` responses (/, /health, /api/students, POST)
4. `docker login` (hide your token) and `docker push` output
5. Docker Hub repository page in the browser
6. `kubectl cluster-info` / `kubectl get nodes`
7. `kubectl apply -f k8s/deployment.yaml` and `service.yaml`
8. `kubectl get deployments,pods,svc`
9. Browser/curl hitting the NodePort URL
10. `kubectl scale deployment flask-api --replicas=5` + `kubectl get pods`
11. Deleting a pod and the replacement being created
