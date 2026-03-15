# Smart Language Learning (Prototype)

Web prototype for language learning (Spanish -> German) using simple spaced repetition.

## Stack

- Backend: Django + Django REST Framework (typed Python annotations)
- Frontend: React + TypeScript (Vite)
- Database: PostgreSQL
- Local/dev and base deployment packaging: Docker / Docker Compose

## Implemented behavior

- Single `Item` table for both words and phrases (`item_type=word|phrase`).
- Learning session in `/session` with 5 items.
- Session priority:
  1. Due review items (`due_at <= now`).
  2. If not enough, new items.
  3. If still not enough, upcoming review items (earliest `due_at` first).
- Word and phrase reviews are tested in both directions (`Spanish -> German` and `German -> Spanish`) with separate progress per direction.
- New items show full content (example sentence, notes, audio URL).
- Content creation flow from a user topic with preview + confirmation before saving (including per-word checkbox selection).
  - If `OPENAI_API_KEY` is set, phrase generation uses ChatGPT API.
  - If not set (or request fails), it falls back to the local simple template.
- Top bar in all pages with counts for ready reviews, future reviews, and not-started items.
- Review for words: text input + letter hints.
- Review for phrases: multiple choice.
- Simple fixed spaced-repetition intervals: `1, 3, 7, 14, 30` days.
- Health check endpoint: `GET /api/health`.

## Project structure

- `backend/` Django/DRF API
- `frontend/` React app with `/session`
- `docker-compose.yml` services: `db`, `backend`, `frontend`
- `FUTURE_IDEAS.md` future roadmap and improvements

## Run locally

```bash
./start-local.sh
```

URLs:
- Frontend: http://localhost:5173/session
- API session endpoint: http://localhost:8000/api/session
- API health endpoint: http://localhost:8000/api/health
- Django admin: http://localhost:8000/admin

The backend runs migrations and seed loading automatically on startup.

If you prefer the raw compose command:

```bash
docker compose up --build
```

Optional environment variables for AI phrase generation:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Tests (minimal structure)

Backend:

```bash
docker compose run --rm backend pytest
```

Frontend:

```bash
docker compose run --rm frontend npm test -- --run
```

## API endpoints

- `GET /api/health`
- `GET /api/overview-stats`
- `GET /api/session?size=5`
- `POST /api/review`
- `POST /api/seen` (mark a new item as shown without grading)
- `POST /api/content/preview`
- `POST /api/content/confirm`

Review payload:

```json
{
  "item_id": 1,
  "correct": true,
  "direction": "es_to_de"
}
```

## AWS container service suggestion

Recommended first option: **Amazon ECS with Fargate**.

Why:
- Lower operational overhead than EKS for this prototype.
- Native support for container health checks, autoscaling, and CloudWatch logs.
- Straightforward split into 2 services (frontend and backend) and one managed DB (RDS PostgreSQL).

Good alternatives:
- **AWS App Runner**: even simpler for small services, but less flexible for multi-service networking.
- **EKS**: best when you already need Kubernetes-level control.

## Fargate blueprint

A minimal, practical ECS Fargate blueprint is included in:

- [aws-deploy/README.md](aws-deploy/README.md)
- [aws-deploy/deploy-checklist.md](aws-deploy/deploy-checklist.md)
