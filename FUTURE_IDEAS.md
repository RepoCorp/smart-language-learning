# Todos

Arreglar la generacion de frases para los ejercicios
The first time you generate content it is always returning just one phrase
Links to words from dialog turns and phrase pages
Posibilidad de regenerar otras cosas, como las traducciones que a veces estan mal, especialmente en el ejercicio
Que cuando esta viendo una frase y le da click a la palabra, se la muestre y le permita marcarla para empezar a testearla
Si la palabra no esta que permita añadirla
Que el test de un sentido y el otro no los haga seguido al menos la primera vez

Usar Load Balancer 
Ensayar otros modelos
Seguridad de S3
Arreglar allowed hosts de Django
Hacer menu para moverse entre funciones en lugar de los links que hay ahora
Aleman a español es seleccion multiple
Repetir audio al final o ppio de los tests

Add settings to deploy files, like updated roles permissions, env...

Audio mas rapido y mas "ofuscado"
Crear multiple dialogos a la vez

red semántica: si hay tres palabras que se relacionan, hacer el ejercicio de la frase con las tres palabras: 
Ich esse die Lederhose.
Ich esse die Jacke.
Ich esse die Schuhe.
Que las frases hagan sentido absurdo


Arreglar todos los usos de español y aleman en el codigo.
Añadir manejo del casing para todos los idiomas usando el modelo 
escoger el modelo apropiado para cada tarea (texto, audio, imagen, etc.)
Opcion para escuchar todos los dialogos

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
