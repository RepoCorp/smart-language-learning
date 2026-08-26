#!/usr/bin/env bash
set -euo pipefail

export AWS_PAGER=""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${ROOT_DIR}/low-cost-deploy/deploy.env}"
ALERT_EMAIL=""
ALERT_PERIOD_SECONDS=300

usage() {
  cat <<'EOF'
Usage:
  low-cost-deploy/configure_error_email_alerts.sh --email you@example.com [--period-seconds 300]

The email subscription must be confirmed from the message sent by AWS before
alerts can be delivered.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      if [[ $# -lt 2 ]]; then
        echo "--email requires an email address." >&2
        exit 1
      fi
      ALERT_EMAIL="${2:-}"
      shift
      ;;
    --period-seconds)
      if [[ $# -lt 2 ]]; then
        echo "--period-seconds requires a value." >&2
        exit 1
      fi
      ALERT_PERIOD_SECONDS="${2:-}"
      shift
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
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_command aws

if [[ -z "${ALERT_EMAIL}" ]]; then
  echo "An alert email is required. Use --email you@example.com." >&2
  exit 1
fi
if [[ -z "${AWS_REGION:-}" ]]; then
  echo "Missing required deploy env value: AWS_REGION" >&2
  exit 1
fi
if ! [[ "${ALERT_PERIOD_SECONDS}" =~ ^[0-9]+$ ]] || (( ALERT_PERIOD_SECONDS < 60 || ALERT_PERIOD_SECONDS > 86400 || ALERT_PERIOD_SECONDS % 60 != 0 )); then
  echo "--period-seconds must be a whole number of seconds from 60 to 86400, divisible by 60." >&2
  exit 1
fi

LIGHTSAIL_SERVICE_NAME="${LIGHTSAIL_SERVICE_NAME:-welearnsmart-backend}"
LIGHTSAIL_CONTAINER_NAME="${LIGHTSAIL_CONTAINER_NAME:-backend}"
LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-/${LIGHTSAIL_SERVICE_NAME}/${LIGHTSAIL_CONTAINER_NAME}}"
TOPIC_NAME="${CLOUDWATCH_ALERT_TOPIC_NAME:-welearnsmart-backend-errors}"
METRIC_NAMESPACE="${CLOUDWATCH_ALERT_METRIC_NAMESPACE:-WeLearnSmart}"
METRIC_NAME="${CLOUDWATCH_ALERT_METRIC_NAME:-BackendErrorCount}"
ALARM_NAME="${CLOUDWATCH_ALERT_ALARM_NAME:-welearnsmart-backend-errors}"

echo "Creating or updating SNS topic ${TOPIC_NAME}..."
TOPIC_ARN="$(aws sns create-topic \
  --name "${TOPIC_NAME}" \
  --region "${AWS_REGION}" \
  --query TopicArn \
  --output text)"

echo "Subscribing ${ALERT_EMAIL}..."
aws sns subscribe \
  --topic-arn "${TOPIC_ARN}" \
  --protocol email \
  --notification-endpoint "${ALERT_EMAIL}" \
  --region "${AWS_REGION}" \
  >/dev/null

echo "Creating or updating the ERROR log metric filter..."
aws logs put-metric-filter \
  --log-group-name "${LOG_GROUP}" \
  --filter-name "${ALARM_NAME}" \
  --filter-pattern "ERROR" \
  --metric-transformations "metricName=${METRIC_NAME},metricNamespace=${METRIC_NAMESPACE},metricValue=1" \
  --region "${AWS_REGION}"

echo "Creating or updating CloudWatch alarm ${ALARM_NAME}..."
aws cloudwatch put-metric-alarm \
  --alarm-name "${ALARM_NAME}" \
  --alarm-description "Email when the backend logs an ERROR" \
  --namespace "${METRIC_NAMESPACE}" \
  --metric-name "${METRIC_NAME}" \
  --statistic Sum \
  --period "${ALERT_PERIOD_SECONDS}" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "${TOPIC_ARN}" \
  --region "${AWS_REGION}"

echo "Alert configured for ${LOG_GROUP}."
echo "Confirm the AWS subscription email sent to ${ALERT_EMAIL}; alerts cannot be delivered until then."
