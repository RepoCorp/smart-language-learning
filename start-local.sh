#!/usr/bin/env sh
set -eu

docker compose up -d --build

echo "Waiting for services to be ready..."

deadline=$(( $(date +%s) + 180 ))

while :; do
  now=$(date +%s)
  if [ "$now" -ge "$deadline" ]; then
    echo "Timed out waiting for services."
    docker compose ps
    exit 1
  fi

  backend_cid=$(docker compose ps -q backend || true)
  frontend_cid=$(docker compose ps -q frontend || true)

  if [ -n "$backend_cid" ] && [ -n "$frontend_cid" ]; then
    backend_status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$backend_cid" 2>/dev/null || true)
    frontend_status=$(docker inspect --format '{{.State.Status}}' "$frontend_cid" 2>/dev/null || true)

    if [ "$backend_status" = "healthy" ] && [ "$frontend_status" = "running" ]; then
      break
    fi
  fi

  sleep 2
done

frontend_port=$(docker compose port frontend 5173 | awk -F: 'END{print $NF}')
backend_port=$(docker compose port backend 8000 | awk -F: 'END{print $NF}')

echo
echo "System is up. URLs:"
echo "- Frontend session: http://localhost:${frontend_port}/session"
echo "- API session: http://localhost:${backend_port}/api/session"
echo "- API health: http://localhost:${backend_port}/api/health"
echo "- Django admin: http://localhost:${backend_port}/admin"
