#!/usr/bin/env bash
# Build, tag and push the image to Docker Hub.
# Usage:  DOCKERHUB_USER=yourname ./scripts/push.sh [tag]
set -euo pipefail
: "${DOCKERHUB_USER:?Set DOCKERHUB_USER to your Docker Hub username}"
TAG="${1:-1.0}"
IMAGE="hello-dockerhub"

docker login                                   # enter username + access token
docker build -t "$IMAGE:$TAG" .
docker tag   "$IMAGE:$TAG" "$DOCKERHUB_USER/$IMAGE:$TAG"
docker tag   "$IMAGE:$TAG" "$DOCKERHUB_USER/$IMAGE:latest"
docker push  "$DOCKERHUB_USER/$IMAGE:$TAG"
docker push  "$DOCKERHUB_USER/$IMAGE:latest"
echo "Pushed: https://hub.docker.com/r/$DOCKERHUB_USER/$IMAGE"
