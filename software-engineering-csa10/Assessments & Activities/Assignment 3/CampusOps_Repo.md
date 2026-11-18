# CampusOps – Assignment 1 Documentation

## 1. Project Details

**Project Name:** CampusOps – Campus Operations Management System  
**GitHub Repository:** https://github.com/ashira-susan/Campusops  
**Repository Owner:** Ashira B. Susan  
**Project Type:** Software Engineering / Version Control / Docker Deployment

## 2. GitHub Repository

The complete CampusOps project is maintained in the following GitHub repository:

[CampusOps – GitHub Repository](https://github.com/ashira-susan/Campusops)

The repository contains the application source code, frontend, backend, Docker configuration, documentation, scripts, and tests.

## 3. Repository and Git History

The repository work includes:

- Preserving the original Git commit history.
- Maintaining the project branches and release tags.
- Pushing the required branches and tags to GitHub.
- Verifying the commit graph and repository history.
- Working with feature branches and merging changes.
- Recording merge and conflict-resolution work.
- Creating a genuine Pull Request for review and integration.

**Evidence to include:**
- GitHub repository overview.
- Branch and tag listings.
- Git commit history.
- Commit graph.
- Pull Request and merge details.

## 4. Project Documentation

The repository includes the following documentation:

- `README.md` – Project overview, setup instructions, testing, and known limitations.
- `docs/DEPLOYMENT-CHECKLIST.md` – Docker deployment and verification checklist.
- `docs/REVIEW-sla-env-config.md` – Review notes for environment-configurable SLA settings.

## 5. Docker Deployment – Question 5

The project was deployed locally using Docker Desktop and Docker Compose.

**Deployment details:**

- Release version: `v1.1.1`
- Frontend: Nginx
- Backend: Two API instances (`api1` and `api2`)
- Database: SQLite with a persistent Docker volume
- Container orchestration: Docker Compose

**Application URL:**

http://localhost:8080

The deployment was verified successfully. Both backend API instances reported healthy status, the frontend opened successfully, and the administrator was able to log in to the dashboard.

**Evidence to include:**
- Docker Desktop running.
- Successful Docker image build.
- `docker compose ps` showing running services and healthy API instances.
- Browser showing the CampusOps application.
- Successful administrator dashboard login.

## 6. Assignment Submission Contents

The Assignment 1 folder should contain the following:

1. This `README.md` documentation file.
2. The completed assignment report in Word or PDF format.
3. GitHub repository and version-control evidence.
4. Pull Request and merge evidence.
5. Docker deployment screenshots for Question 5.
6. Any additional documents or evidence explicitly required by the assignment instructions.

## 7. Important Links

- **GitHub Repository:** https://github.com/ashira-susan/Campusops
- **Local Application:** http://localhost:8080

## 8. Conclusion

The CampusOps project was maintained using Git and GitHub, with its repository history, branches, and release tags preserved. The application was also successfully built and deployed locally using Docker Compose. The repository and supporting evidence are organized for Assignment 1 submission.
