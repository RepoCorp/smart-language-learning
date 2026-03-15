# Todos

Arreglar todos los usos de español y aleman en el codigo.
Añadir manejo del casing para todos los idiomas usando el modelo 
escoger el modelo apropiado para cada tarea (texto, audio, imagen, etc.)

# Future Ideas

## Deployment and operations

- Add environment-based settings modules (`dev`, `staging`, `prod`).
- Use AWS ECS Fargate for initial cloud deployment.
- Move PostgreSQL from container to AWS RDS PostgreSQL.
- Add CI/CD pipeline (build, test, push image, deploy).
- Add centralized logs and metrics (CloudWatch + alarms).
- Add container image scanning in CI.

## API and backend

- Add authentication and user model.
- Persist per-user progress instead of global progress.
- Add content management endpoints (or admin workflows) for item creation and updates.
- Add stricter API validation and error envelopes.
- Add pagination and filtering for future admin/content APIs.
- Add idempotency strategy for review submissions.

## Spaced repetition - User study plan

- Upgrade from fixed intervals to SM-2 or FSRS.
- Track answer quality score, latency, and streak.
- Add adaptive hint penalties and confidence scoring.
- Start the session asking for a time commitment and adjust session size dynamically. 
- Add article handling (e.g. for gendered languages) and more complex item types (e.g. sentences, audio).
- Añadir imagen de dancing apple ... 
- Add a free context input that won't be saved 

## Frontend

- Add session summary page (accuracy, reviewed/new counts, next due preview).
- Improve UX states (loading skeletons, retries, empty state actions).
- Add i18n support for UI language.

## Quality and tooling

- Add Python linting and formatting configuration (`ruff`, `black`, `isort`).
- Add static typing checks (`mypy`) and stricter type coverage over time.
- Add frontend lint/format tooling (`eslint`, `prettier`).
- Add pre-commit hooks for backend and frontend checks.
- Add Factories for test data generation.

## Testing

- Increase backend unit test coverage for SRS edge cases.
- Add API contract tests.
- Expand frontend tests for full session flows and failure handling.
- Add end-to-end tests later (Playwright/Cypress) when UI stabilizes.
