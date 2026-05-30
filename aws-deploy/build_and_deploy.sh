#!/usr/bin/env bash
set -euo pipefail

export AWS_PAGER=""

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-aws-deploy/deploy.env}"

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing ${DEPLOY_ENV_FILE}. Copy aws-deploy/deploy.env.example to ${DEPLOY_ENV_FILE} and fill in the values." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${DEPLOY_ENV_FILE}"
set +a

required_vars=(
  AWS_REGION
  AWS_ACCOUNT_ID
  ECS_CLUSTER
  BACKEND_SERVICE
  FRONTEND_SERVICE
  BACKEND_API_URL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required deploy env value: ${var_name}" >&2
    exit 1
  fi
done

if [[ ! "${BACKEND_API_URL}" =~ ^https?://.+/api/?$ ]]; then
  echo "BACKEND_API_URL must be a full API URL, for example: https://www.welearnsmart.com/api" >&2
  exit 1
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

BACKEND_REPOSITORY="smart-language-learning-backend"
FRONTEND_REPOSITORY="smart-language-learning-frontend"
IMAGE_TAG="latest"

BACKEND_IMAGE="${ECR_REGISTRY}/${BACKEND_REPOSITORY}:${IMAGE_TAG}"
FRONTEND_IMAGE="${ECR_REGISTRY}/${FRONTEND_REPOSITORY}:${IMAGE_TAG}"

aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

docker build --platform linux/amd64 -f aws-deploy/backend.Dockerfile.prod -t "${BACKEND_REPOSITORY}:latest" .
docker tag "${BACKEND_REPOSITORY}:${IMAGE_TAG}" "${BACKEND_IMAGE}"
docker push "${BACKEND_IMAGE}"

docker build --platform linux/amd64 -f aws-deploy/frontend.Dockerfile.prod --build-arg VITE_API_URL="${BACKEND_API_URL}" -t "${FRONTEND_REPOSITORY}:latest" .
docker tag "${FRONTEND_REPOSITORY}:${IMAGE_TAG}" "${FRONTEND_IMAGE}"
docker push "${FRONTEND_IMAGE}"

# TODO: When aws-deploy/ecs-task-backend.json and aws-deploy/ecs-task-frontend.json
# are updated and deployments slow down, consider switching back to immutable
# image tags plus fresh task definition revisions for better rollback/debugging.
#
# register_task_definition() {
#   local task_definition_file="$1"
#   local container_name="$2"
#   local image_uri="$3"
#
#   aws ecs register-task-definition \
#     --region "${AWS_REGION}" \
#     --cli-input-json "$(
#       jq \
#         --arg container_name "${container_name}" \
#         --arg image_uri "${image_uri}" \
#         '(.containerDefinitions[] | select(.name == $container_name) | .image) = $image_uri' \
#         "${task_definition_file}"
#     )" \
#     --query 'taskDefinition.taskDefinitionArn' \
#     --output text
# }
#
# BACKEND_TASK_DEFINITION_ARN="$(register_task_definition aws-deploy/ecs-task-backend.json "${BACKEND_CONTAINER_NAME}" "${BACKEND_IMAGE}")"
# FRONTEND_TASK_DEFINITION_ARN="$(register_task_definition aws-deploy/ecs-task-frontend.json "${FRONTEND_CONTAINER_NAME}" "${FRONTEND_IMAGE}")"

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${BACKEND_SERVICE}" \
  --force-new-deployment \
  --no-cli-pager

aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${FRONTEND_SERVICE}" \
  --force-new-deployment \
  --no-cli-pager

echo "Waiting for ECS services to become stable..."
aws ecs wait services-stable \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${BACKEND_SERVICE}" "${FRONTEND_SERVICE}"

echo "Backend image: ${BACKEND_IMAGE}"
echo "Frontend image: ${FRONTEND_IMAGE}"
