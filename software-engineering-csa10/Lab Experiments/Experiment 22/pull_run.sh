#!/usr/bin/env bash
# Remove the local copy, pull from Docker Hub and run it (proves the push worked).
# Usage:  DOCKERHUB_USER=yourname ./scripts/pull_run.sh [tag]
set -euo pipefail
: "${DOCKERHUB_USER:?Set DOCKERHUB_USER to your Docker Hub username}"
TAG="${1:-1.0}"
IMAGE="hello-dockerhub"

docker rmi -f "$DOCKERHUB_USER/$IMAGE:$TAG" "$DOCKERHUB_USER/$IMAGE:latest" "$IMAGE:$TAG" 2>/dev/null || true
docker images | grep "$IMAGE" || echo "(no local copy of $IMAGE - good)"
docker pull "$DOCKERHUB_USER/$IMAGE:$TAG"
docker run --rm "$DOCKERHUB_USER/$IMAGE:$TAG"
