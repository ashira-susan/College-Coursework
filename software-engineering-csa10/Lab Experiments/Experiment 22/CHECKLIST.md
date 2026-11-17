# Screenshots to take for Experiment 22
1. `docker login` -> `Login Succeeded`
2. `docker build -t hello-dockerhub:1.0 .` and `docker images`
3. `docker run --rm hello-dockerhub:1.0`
4. `docker tag ...` and `docker push ...` (layers pushed, digest shown)
5. Docker Hub web page showing your repository and tags
6. `docker rmi ...` and `docker images` (local copy gone)
7. `docker pull <user>/hello-dockerhub:1.0`
8. `docker run --rm <user>/hello-dockerhub:1.0` (runs from the pulled image)
