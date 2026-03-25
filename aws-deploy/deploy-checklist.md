# ECS Fargate Deploy Checklist (Minimal)

Replace placeholders: `<ACCOUNT_ID>`, `<REGION>`, `<CLUSTER_NAME>`, `<VPC_ID>`, `<SUBNET_IDS>`, `<SG_IDS>`, `<CERT_ARN>`.

## 1) Create ECR repositories

```bash
aws ecr create-repository --repository-name smart-language-learning-backend --region us-east-1
aws ecr create-repository --repository-name smart-language-learning-frontend --region us-east-1
```

## 2) Build and push images

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 330056673401.dkr.ecr.us-east-1.amazonaws.com

# Backend
docker build --platform linux/amd64 -f aws-deploy/backend.Dockerfile.prod -t smart-language-learning-backend:latest .
docker tag smart-language-learning-backend:latest 330056673401.dkr.ecr.us-east-1.amazonaws.com/smart-language-learning-backend:latest
docker push 330056673401.dkr.ecr.us-east-1.amazonaws.com/smart-language-learning-backend:latest


# Frontend (inject API URL at build time)
docker build --platform linux/amd64 -f aws-deploy/frontend.Dockerfile.prod --build-arg VITE_API_URL=http://sll-alb-1301042143.us-east-1.elb.amazonaws.com/api -t smart-language-learning-frontend:latest .
docker tag smart-language-learning-frontend:latest 330056673401.dkr.ecr.us-east-1.amazonaws.com/smart-language-learning-frontend:latest
docker push 330056673401.dkr.ecr.us-east-1.amazonaws.com/smart-language-learning-frontend:latest
```
330056673401.dkr.ecr.us-east-1.amazonaws.com/smart-language-learning-frontend:latest

arn:aws:secretsmanager:us-east-1:330056673401:secret:sll-OfCtnN/OPENAI_API_KEY


## 3) Create CloudWatch log groups

```bash
aws logs create-log-group --log-group-name /ecs/smart-language-learning-backend --region us-east-1
aws logs create-log-group --log-group-name /ecs/smart-language-learning-frontend --region us-east-1
```

## 4) Register task definitions

Update `ecs-task-backend.json` and `ecs-task-frontend.json` placeholders first.
These task definitions are pinned to `X86_64`; keep image builds on `linux/amd64` unless you explicitly switch both to `ARM64`.

```bash
aws ecs register-task-definition --cli-input-json file://aws-deploy/ecs-task-backend.json --region us-east-1
aws ecs register-task-definition --cli-input-json file://aws-deploy/ecs-task-frontend.json --region us-east-1
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
