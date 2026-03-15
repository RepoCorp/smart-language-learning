# ECS Fargate Deploy Checklist (Minimal)

Replace placeholders: `<ACCOUNT_ID>`, `<REGION>`, `<CLUSTER_NAME>`, `<VPC_ID>`, `<SUBNET_IDS>`, `<SG_IDS>`, `<CERT_ARN>`.

## 1) Create ECR repositories

```bash
aws ecr create-repository --repository-name smart-language-learning-backend --region <REGION>
aws ecr create-repository --repository-name smart-language-learning-frontend --region <REGION>
```

## 2) Build and push images

```bash
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# Backend
docker build -f aws-deploy/backend.Dockerfile.prod -t smart-language-learning-backend:latest .
docker tag smart-language-learning-backend:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/smart-language-learning-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/smart-language-learning-backend:latest

# Frontend (inject API URL at build time)
docker build -f aws-deploy/frontend.Dockerfile.prod --build-arg VITE_API_URL=https://api.yourdomain.com/api -t smart-language-learning-frontend:latest .
docker tag smart-language-learning-frontend:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/smart-language-learning-frontend:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/smart-language-learning-frontend:latest
```

## 3) Create CloudWatch log groups

```bash
aws logs create-log-group --log-group-name /ecs/smart-language-learning-backend --region <REGION>
aws logs create-log-group --log-group-name /ecs/smart-language-learning-frontend --region <REGION>
```

## 4) Register task definitions

Update `ecs-task-backend.json` and `ecs-task-frontend.json` placeholders first.

```bash
aws ecs register-task-definition --cli-input-json file://aws-deploy/ecs-task-backend.json --region <REGION>
aws ecs register-task-definition --cli-input-json file://aws-deploy/ecs-task-frontend.json --region <REGION>
```

## 5) Create ALB target groups

- Backend target group health check path: `/api/health`
- Frontend target group health check path: `/health`

## 6) Create ECS services (Fargate)

- Backend service attached to backend target group on container port `8000`.
- Frontend service attached to frontend target group on container port `80`.
- Desired count: start with `1` each.

## 7) ALB listeners and routing

- HTTPS listener (443) with ACM certificate.
- Route `api.yourdomain.com` to backend target group.
- Route `app.yourdomain.com` to frontend target group.

## 8) Database and networking

- Create RDS PostgreSQL in private subnets.
- Allow backend task security group to connect to RDS:5432.
- Keep ALB public and ECS tasks in private subnets (recommended).

## 9) Smoke checks

- Backend: `https://api.yourdomain.com/api/health`
- Frontend: `https://app.yourdomain.com/session`

## 10) First hardening steps

- Set Django `ALLOWED_HOSTS` precisely.
- Rotate secrets in Secrets Manager.
- Add autoscaling policies for ECS services.
- Add CloudWatch alarms (5xx, target health, CPU, memory).
