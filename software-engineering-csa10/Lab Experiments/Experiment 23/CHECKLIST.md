# Screenshots to take for Experiment 23
1. `docker build` of backend and frontend, and `docker push`
2. `kubectl get nodes` (cluster running)
3. `kubectl apply -f ...` for each manifest
4. `kubectl -n multi-app get all` (pods, services, deployments)
5. `kubectl -n multi-app get pvc` (Bound)
6. Browser: the web page with saved messages and the backend pod name
7. `kubectl -n multi-app scale deployment backend --replicas=5` + `get pods`
8. Browser/curl showing different pod names after scaling
9. Deleting a backend pod and its replacement appearing
10. Deleting the postgres pod and data still present
11. (Optional) `kubectl get hpa`
