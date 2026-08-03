#!/usr/bin/env bash
set -euo pipefail

export AWS_PAGER=""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${ROOT_DIR}/low-cost-deploy/deploy.env}"

deploy_frontend=true
deploy_backend=true

usage() {
  cat <<'EOF'
Usage:
  low-cost-deploy/build_and_deploy.sh [--frontend-only | --backend-only]

Environment:
  DEPLOY_ENV_FILE=/absolute/path/to/deploy.env
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend-only)
      deploy_frontend=true
      deploy_backend=false
      ;;
    --backend-only)
      deploy_frontend=false
      deploy_backend=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing ${DEPLOY_ENV_FILE}. Copy low-cost-deploy/deploy.env.example and fill it in." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${DEPLOY_ENV_FILE}"
set +a

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Required command not found: ${cmd}" >&2
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deploy env value: ${name}" >&2
    exit 1
  fi
}

require_command aws
require_command docker
require_command python3

require_var AWS_REGION

if [[ "${deploy_frontend}" == true ]]; then
  require_command npm
  require_var AMPLIFY_APP_ID
  require_var AMPLIFY_BRANCH
  require_var FRONTEND_BUCKET
  require_var BACKEND_API_URL
fi

if [[ "${deploy_backend}" == true ]]; then
  require_var LIGHTSAIL_SERVICE_NAME
  require_var LIGHTSAIL_IMAGE_LABEL
  require_var LIGHTSAIL_CONTAINER_NAME
  require_var LIGHTSAIL_CONTAINER_PORT
  require_var LIGHTSAIL_HEALTH_CHECK_PATH
  require_var BACKEND_IMAGE_NAME
  require_var BACKEND_IMAGE_TAG
  require_var BACKEND_ENV_FILE
fi

if [[ "${deploy_frontend}" == true && ! "${BACKEND_API_URL}" =~ ^https?://.+/api/?$ ]]; then
  echo "BACKEND_API_URL must be a full API URL, for example: https://api.welearnsmart.com/api" >&2
  exit 1
fi

if [[ "${BACKEND_ENV_FILE}" = /* ]]; then
  BACKEND_ENV_FILE_ABS="${BACKEND_ENV_FILE}"
else
  BACKEND_ENV_FILE_ABS="${ROOT_DIR}/${BACKEND_ENV_FILE}"
fi
if [[ "${deploy_backend}" == true && ! -f "${BACKEND_ENV_FILE_ABS}" ]]; then
  echo "Missing backend env file: ${BACKEND_ENV_FILE_ABS}. Copy low-cost-deploy/backend.env.example and fill it in." >&2
  exit 1
fi

FRONTEND_DIST_DIR="${ROOT_DIR}/frontend/dist"

cleanup() {
  rm -rf "${FRONTEND_DIST_DIR}" 2>/dev/null || true
}

trap cleanup EXIT

deploy_frontend_step() {
  local amplify_job_id
  local amplify_job_status

  echo "Building frontend for ${BACKEND_API_URL}..."
  (
    cd "${ROOT_DIR}/frontend"
    VITE_API_URL="${BACKEND_API_URL}" npm run build
  )

  echo "Syncing frontend build to s3://${FRONTEND_BUCKET}/ ..."
  aws s3 sync \
    "${FRONTEND_DIST_DIR}/" \
    "s3://${FRONTEND_BUCKET}/" \
    --delete \
    --region "${AWS_REGION}"

  echo "Starting Amplify deployment..."
  aws amplify start-deployment \
    --app-id "${AMPLIFY_APP_ID}" \
    --branch-name "${AMPLIFY_BRANCH}" \
    --source-url "s3://${FRONTEND_BUCKET}" \
    --source-url-type BUCKET_PREFIX \
    --region "${AWS_REGION}" \
    >/tmp/amplify-deployment.json

  python3 - <<'PY'
import json
from pathlib import Path
payload = json.loads(Path("/tmp/amplify-deployment.json").read_text())
job = payload.get("jobSummary", {})
print(f"Amplify deployment started: jobId={job.get('jobId', 'unknown')} status={job.get('status', 'unknown')}")
PY

  amplify_job_id="$(
    python3 - <<'PY'
import json
from pathlib import Path
payload = json.loads(Path("/tmp/amplify-deployment.json").read_text())
print(payload.get("jobSummary", {}).get("jobId", ""))
PY
  )"

  if [[ -z "${amplify_job_id}" ]]; then
    echo "Could not determine Amplify deployment job id." >&2
    exit 1
  fi

  echo "Waiting for Amplify deployment to finish..."
  for _ in $(seq 1 60); do
    amplify_job_status="$(
      aws amplify get-job \
        --app-id "${AMPLIFY_APP_ID}" \
        --branch-name "${AMPLIFY_BRANCH}" \
        --job-id "${amplify_job_id}" \
        --region "${AWS_REGION}" \
        --query 'job.summary.status' \
        --output text
    )"

    case "${amplify_job_status}" in
      SUCCEED)
        echo "Amplify deployment succeeded."
        return
        ;;
      FAILED|CANCELLED)
        echo "Amplify deployment failed with status: ${amplify_job_status}" >&2
        exit 1
        ;;
      *)
        echo "Amplify deployment status: ${amplify_job_status}"
        sleep 10
        ;;
    esac
  done

  echo "Timed out waiting for Amplify deployment to finish." >&2
  exit 1
}

deploy_backend_step() {
  local backend_image_ref="${BACKEND_IMAGE_NAME}:${BACKEND_IMAGE_TAG}"
  local lightsail_image_ref=":${LIGHTSAIL_SERVICE_NAME}.${LIGHTSAIL_IMAGE_LABEL}.latest"
  local health_check_healthy_threshold="${LIGHTSAIL_HEALTH_CHECK_HEALTHY_THRESHOLD:-2}"
  local health_check_unhealthy_threshold="${LIGHTSAIL_HEALTH_CHECK_UNHEALTHY_THRESHOLD:-6}"
  local health_check_timeout_seconds="${LIGHTSAIL_HEALTH_CHECK_TIMEOUT_SECONDS:-5}"
  local health_check_interval_seconds="${LIGHTSAIL_HEALTH_CHECK_INTERVAL_SECONDS:-10}"
  local deployment_json
  local deployment_version
  local deployment_state
  local service_url

  echo "Building backend container image ${backend_image_ref}..."
  (
    cd "${ROOT_DIR}"
    docker build --platform linux/amd64 \
      -f aws-deploy/backend.Dockerfile.prod \
      -t "${backend_image_ref}" .
  )

  echo "Pushing backend image to Lightsail..."
  aws lightsail push-container-image \
    --service-name "${LIGHTSAIL_SERVICE_NAME}" \
    --label "${LIGHTSAIL_IMAGE_LABEL}" \
    --image "${backend_image_ref}" \
    --region "${AWS_REGION}" \
    >/tmp/lightsail-push.txt

  deployment_json="$(python3 - "${BACKEND_ENV_FILE_ABS}" "${LIGHTSAIL_CONTAINER_NAME}" "${lightsail_image_ref}" "${LIGHTSAIL_CONTAINER_PORT}" "${LIGHTSAIL_HEALTH_CHECK_PATH}" "${health_check_healthy_threshold}" "${health_check_unhealthy_threshold}" "${health_check_timeout_seconds}" "${health_check_interval_seconds}" <<'PY'
import json
import sys
from pathlib import Path

(
    env_path,
    container_name,
    image_ref,
    port,
    health_path,
    healthy_threshold,
    unhealthy_threshold,
    timeout_seconds,
    interval_seconds,
) = sys.argv[1:]
env = {}
for raw_line in Path(env_path).read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
        continue
    key, sep, value = line.partition("=")
    if not sep:
        raise SystemExit(f"Invalid backend env line: {raw_line}")
    env[key.strip()] = value.strip()

payload = {
    "containers": {
        container_name: {
            "image": image_ref,
            "environment": env,
            "ports": {
                str(port): "HTTP"
            }
        }
    },
    "publicEndpoint": {
        "containerName": container_name,
        "containerPort": int(port),
        "healthCheck": {
            "path": health_path,
            "successCodes": "200-399",
            "healthyThreshold": int(healthy_threshold),
            "unhealthyThreshold": int(unhealthy_threshold),
            "timeoutSeconds": int(timeout_seconds),
            "intervalSeconds": int(interval_seconds),
        }
    }
}
print(json.dumps(payload))
PY
)"

  echo "Creating Lightsail deployment..."
  aws lightsail create-container-service-deployment \
    --service-name "${LIGHTSAIL_SERVICE_NAME}" \
    --cli-input-json "${deployment_json}" \
    --region "${AWS_REGION}" \
    >/tmp/lightsail-deployment.json

  deployment_version="$(
    python3 - <<'PY'
import json
from pathlib import Path

payload = json.loads(Path("/tmp/lightsail-deployment.json").read_text())
service = payload.get("containerService", {})
deployment = service.get("nextDeployment") or service.get("currentDeployment") or {}
print(deployment.get("version", ""))
PY
  )"

  if [[ -z "${deployment_version}" ]]; then
    echo "Could not determine the Lightsail deployment version." >&2
    exit 1
  fi

  echo "Waiting for Lightsail deployment ${deployment_version} to finish..."
  for _ in $(seq 1 60); do
    deployment_state="$(aws lightsail get-container-service-deployments \
      --service-name "${LIGHTSAIL_SERVICE_NAME}" \
      --region "${AWS_REGION}" \
      --query "deployments[?version==\`${deployment_version}\`].state | [0]" \
      --output text)"

    case "${deployment_state}" in
      ACTIVE)
        service_url="$(aws lightsail get-container-services \
          --service-name "${LIGHTSAIL_SERVICE_NAME}" \
          --region "${AWS_REGION}" \
          --query 'containerServices[0].url' \
          --output text)"
        echo "Lightsail deployment active at ${service_url}"
        return
        ;;
      FAILED)
        echo "Lightsail deployment ${deployment_version} failed. Check its container logs in the Lightsail console." >&2
        exit 1
        ;;
      *)
        echo "Lightsail deployment ${deployment_version} state: ${deployment_state}"
        sleep 10
        ;;
    esac
  done

  echo "Timed out waiting for Lightsail deployment to become active." >&2
  exit 1
}

if [[ "${deploy_backend}" == true ]]; then
  deploy_backend_step
fi

if [[ "${deploy_frontend}" == true ]]; then
  deploy_frontend_step
fi

echo "Done."
