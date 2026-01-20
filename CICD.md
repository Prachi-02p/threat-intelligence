 CI/CD Pipeline Guide – Threat Intelligence Dashboard

This document describes the Continuous Integration and Continuous Deployment (CI/CD) setup used in the **Threat Intelligence Dashboard** project.

It is intended to help contributors and reviewers understand:
- How CI/CD is organized in this repository
- Which tools are involved
- How the pipeline behaves during build and deployment

This document does **not** explain how to create the CI/CD pipeline step by step.

---

## 🔁 CI/CD Overview

### Continuous Integration (CI)
The CI process ensures that:
- The latest code is always fetched from GitHub
- Backend and frontend Docker images are built consistently
- Build issues are detected early

### Continuous Deployment (CD)
The CD process ensures that:
- The application is deployed using Docker Compose
- Existing containers are replaced safely
- The latest version of the application is always running

---

## 🧰 Tools Used

| Tool | Purpose |
|-----|--------|
| GitHub | Source code repository |
| Jenkins | CI/CD automation server |
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| FastAPI | Backend API |
| React | Frontend UI |
| MongoDB | Database |

---

## 🏗️ CI/CD Flow

Code Push to GitHub
↓
Jenkins
↓
Docker Image Build
↓
Docker Compose Deployment
↓
Application Running

yaml
Copy code

---

## 📁 Required Files for CI/CD

For the CI/CD pipeline to function correctly, **all required files must exist in the GitHub repository**.

> Jenkins works only with files present in GitHub.  
> Local-only files are ignored.

### Repository Structure (Relevant to CI/CD)

threat-intelligence/
├── backend/
│ ├── Dockerfile # Builds the FastAPI backend image
│ ├── main.py
│ └── requirements.txt
│
├── frontend/
│ ├── Dockerfile # Builds the React frontend image
│ └── package.json
│
├── docker-compose.yml # Defines all application services
├── .env.example # Template for environment variables
└── Jenkinsfile # CI/CD pipeline definition

yaml
Copy code

---

## 📄 File Responsibilities

**docker-compose.yml**  
Defines all services (backend, frontend, database), networking, ports, and dependencies.  
This file is used directly by Jenkins during deployment.

**.env.example**  
Contains placeholder environment variables.  
This file is committed to GitHub and is used by Jenkins to generate the `.env` file at runtime.

**.env**  
Not committed to GitHub.  
Generated dynamically during the pipeline execution to avoid exposing secrets.

**Jenkinsfile**  
Contains the complete CI/CD pipeline logic.  
Jenkins reads this file using **Pipeline from SCM**, ensuring the pipeline is version-controlled.

---

## 🔐 Environment Variable Strategy

The project follows a secure and standard environment handling approach:

- `.env` is ignored by Git
- `.env.example` is committed to GitHub
- Jenkins creates `.env` dynamically during deployment

This approach:
- Prevents sensitive data leakage
- Enables clean CI/CD execution
- Follows industry DevOps best practices

---

## ⚙️ Pipeline Behavior (High Level)

During execution, the pipeline performs the following actions:

1. Cleans the Jenkins workspace
2. Clones the GitHub repository
3. Prepares environment variables
4. Builds Docker images
5. Stops any running containers
6. Deploys the application using Docker Compose

The pipeline stops immediately if any stage fails.

---

## ▶️ Pipeline Trigger

Current trigger:
- Manual execution from Jenkins

Future enhancements may include:
- GitHub Webhooks (auto-deploy on push)
- Scheduled builds
- Multi-branch pipelines

---

## 🚨 Common CI/CD Issues

| Issue | Cause |
|-----|------|
| `.env not found` | `.env.example` missing in GitHub |
| Docker daemon error | Docker Desktop not running |
| Build failure | Dependency or Dockerfile issue |
| Port conflict | Existing containers running |

All issues can be analyzed using Jenkins **Console Output**.

---

## 🔒 Security Notes

- Secrets are never committed to GitHub
- Runtime configuration is handled by Jenkins
- Jenkins access should be restricted in real environments
- Additional security checks can be added in future

---

## 🚀 Future Improvements

- GitHub webhook integration
- Docker image versioning
- Security scanning (Trivy, OWASP)
- Cloud or Kubernetes deployment
- Monitoring and alerting integration

---

## ✅ Summary

This CI/CD setup provides:
- Automated builds
- Reliable deployments
- Secure environment handling
- Version-controlled pipeline logic

The pipeline reflects real-world DevOps practices and is designed to scale with future requirements.

---

**CI/CD is a continuous improvement process, not a one-time configuration.**
