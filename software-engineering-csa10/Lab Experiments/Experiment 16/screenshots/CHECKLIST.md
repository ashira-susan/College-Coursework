# Screenshots to take for Experiment 16
1. `docker --version` (Docker installed)
2. `docker build -t static-website:1.0 .` (full build output)
3. `docker images` showing `static-website`
4. `docker run -d -p 8080:80 --name static-site static-website:1.0`
5. `docker ps` showing the container running
6. Browser: `http://localhost:8080` (Home page, address bar visible)
7. Browser: `http://localhost:8080/about.html`
8. `docker logs static-site`
9. `docker stop static-site` and `docker rm static-site`
