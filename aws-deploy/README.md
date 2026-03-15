# AWS Fargate Minimal Blueprint

This folder contains a minimal deployment blueprint for running Smart Language Learning on AWS with ECS Fargate.

## Target architecture

- ECS Cluster (Fargate launch type)
- Backend ECS Service behind an Application Load Balancer (ALB)
- Frontend ECS Service behind the same ALB (host/path rule)
- PostgreSQL on Amazon RDS (not in containers)
- Container images stored in Amazon ECR
- Secrets in AWS Secrets Manager

## Recommended DNS routing

- `app.yourdomain.com` -> frontend target group
- `api.yourdomain.com` -> backend target group

Alternative: single domain and ALB path routing:
- `/` -> frontend target group
- `/api/*` -> backend target group

## Files in this folder

- `backend.Dockerfile.prod`: production backend image (Gunicorn)
- `frontend.Dockerfile.prod`: production frontend image (Nginx serving built assets)
- `nginx.conf`: frontend Nginx config with API proxy support
- `ecs-task-backend.json`: ECS task definition template for backend
- `ecs-task-frontend.json`: ECS task definition template for frontend
- `env-backend.example`: backend environment variables template
- `env-frontend.example`: frontend environment variables template
- `deploy-checklist.md`: practical step-by-step deployment runbook

## Core decisions

1. Use ECS Fargate for low operational overhead.
2. Use RDS PostgreSQL for managed persistence.
3. Keep health checks at `/api/health` (backend) and `/health` (frontend).
4. Terminate TLS at ALB with ACM certificate.

## Before first deploy

1. Create ECR repositories (`smart-language-learning-backend`, `smart-language-learning-frontend`).
2. Build and push images using production Dockerfiles.
3. Create RDS PostgreSQL and security groups.
4. Create ECS execution/task roles.
5. Create ALB, listeners, and target groups.
6. Register task definitions and create ECS services.

See `deploy-checklist.md` for command skeletons.
