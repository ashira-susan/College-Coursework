# Experiment 22 – Push and Pull Docker Images using Docker Hub

**Tools:** Docker Hub, Docker CLI  |  **Course Outcome:** CO3

## Aim
To build a Docker image, push it to Docker Hub, remove the local copy, and pull and run it again from the registry.

## Prerequisites
- Docker installed
- Free Docker Hub account: https://hub.docker.com
- Access token: Docker Hub → Account Settings → Security → **New Access Token**

## Project structure
```
Exp22-DockerHub-Push-Pull/
├── app/hello.py            small Python program printing container info
├── Dockerfile
├── scripts/push.sh         build + tag + push
├── scripts/pull_run.sh     remove local image, pull from Docker Hub, run
├── output/local_run_output.txt   real output of hello.py (run locally)
└── screenshots/
```

## Manual steps (use these for your screenshots)
Replace `<user>` with your Docker Hub username.
```bash
cd Exp22-DockerHub-Push-Pull

# 1. log in (enter username, then the access token as password)
docker login

# 2. build
docker build -t hello-dockerhub:1.0 .
docker images hello-dockerhub

# 3. test locally
docker run --rm hello-dockerhub:1.0

# 4. tag with your Docker Hub namespace
docker tag hello-dockerhub:1.0 <user>/hello-dockerhub:1.0
docker tag hello-dockerhub:1.0 <user>/hello-dockerhub:latest

# 5. push
docker push <user>/hello-dockerhub:1.0
docker push <user>/hello-dockerhub:latest
#    verify: https://hub.docker.com/r/<user>/hello-dockerhub

# 6. delete local copies (simulates another machine)
docker rmi <user>/hello-dockerhub:1.0 <user>/hello-dockerhub:latest hello-dockerhub:1.0
docker images hello-dockerhub          # nothing listed

# 7. pull from Docker Hub and run
docker pull <user>/hello-dockerhub:1.0
docker run --rm <user>/hello-dockerhub:1.0

# 8. log out
docker logout
```

## Script version
```bash
export DOCKERHUB_USER=<user>
./scripts/push.sh 1.0
./scripts/pull_run.sh 1.0
```

## Output
Output of the program itself (real run of `app/hello.py` on the development machine; inside a container, hostname/OS values will differ):
```
============================================
 Hello from a container pulled from Docker Hub!
============================================
Container hostname : vm
Python version     : 3.12.3
OS / architecture  : Linux x86_64
Image version      : dev
Time (UTC)         : 2026-11-17 08:56:49
```
Raw file: [`output/local_run_output.txt`](output/local_run_output.txt)

Inside the container you should see `Image version : 1.0` and the container ID as hostname.

## Screenshots to submit
See [`screenshots/CHECKLIST.md`](screenshots/CHECKLIST.md).

## Useful commands
| Command | Purpose |
|---|---|
| `docker search nginx` | Search Docker Hub |
| `docker pull nginx:alpine` | Download an image |
| `docker tag SRC TARGET` | Add a name/tag to an image |
| `docker push <user>/repo:tag` | Upload an image |
| `docker rmi IMAGE` | Delete a local image |
| `docker image history IMAGE` | Show layers |

## Viva questions
1. **What is Docker Hub?** A cloud registry for storing and sharing Docker images.
2. **Why tag before pushing?** The tag must include `<namespace>/<repo>` so Docker knows where to push.
3. **Why an access token instead of the password?** Tokens are revocable and limited in scope.
4. **What is the `latest` tag?** A default tag – just a label, not automatically the newest build.
5. **Public vs private repository?** Public images can be pulled by anyone; private ones need login.

## Troubleshooting
| Problem | Fix |
|---|---|
| `requested access to the resource is denied` | Tag must start with your username; run `docker login` |
| `unauthorized: incorrect username or password` | Use an access token with Read & Write |
| `pull access denied` | Repository is private or the name is misspelled |

## Result
The image was pushed to Docker Hub, the local copy was deleted, and the image was successfully pulled and run from the registry.
