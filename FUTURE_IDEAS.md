# Todos


Que en la conversacion siempre empiece el usuario, puede ser solo un saludo
Que pueda seleccionar varias palabras para agregar al diccionario, no solo click en individuales si no que pueda seleccionar expresiones completas
Que al generar contenido pueda darse una lista de palabras para usar y/o pedir que primero las genere segun instrucciones
Que cuando uno complete los items de la sesion le haga fiesta
Lo de la cantidad de hints sigue fallando e incluso con una, y creo que incluso cuando una es menos del 30% esta marcandoloa como fallido
Confirmar la traduccion de las palabras es correcta. Me salio que der Bitte es "tener"
Cosas como Ja, und ich würde dir insgesamt 4,55 Euro zurückgeben würde la traduce como devolveria cuando realmente es volverse / llegar a ser y solo es devolveria junto con la plabra zuruckgeben
Pilas con palabras que pueden ser masculino o femenino, cuando busca la palabra base que si diferencie las dos (el doctor, la doctora)
Cuando testing palabras como 'bien', que actualmente tiene como in Ordnung, añadir alguna claridad
No reconoce cuando cumplio el objetivo en la conversacion 
Que haga superfiesta cuando uno aprenda x palabras nuevas en el día.
Que la imagen tenga solo la palabra y en la parte de abajo escrita la frase
Sigue sacando cosas raras como sein de stimmt


Poder ir al elemento desde otros tipos de testing
Seleccionar longitud del diálogo al crear


Que siempre reproduzca el audio en los tests
Que indefinido sea en sujeto
Add con diese diesels...
Mejorar lo de los helpers
Que el audio sea mas rapido y mas "ofuscado"
Revisar future and present tense ejercicios
Test con armar frase con palabras
Que uno pueda editar las palabras 
Que la conversacion tenga un boton para terminar y ahi la presenta corregida y la guarda para dejar agregar las palabras  
Si permitor no agregar turnos de un dialogo. Que si los guarde pero algo asi como marcados como aprendidos
Para las palabras seleccionadas no esta guardando el dialogo. Tambien mirar que guardar cuando son agregadas desde una conversacion
Que palabras o frases que tenga dificultad si le ponga a escribirlas y de pronto lo de la musica
Por que los goals son siempre tan similares? Siempre me pregunta por manzanas
Conversacion topic es requerido para poder empezar pero no se evidencia si se intenta impezar sin definirlo
Ensayar otros modelos
Seguridad de S3
Arreglar allowed hosts de Django
Mejorar velocidad de respuesta de la conversacion 
Que pida algo de definicion del usuario para que en las conversaciones ese sea siempre su rol
En lugar de validar longitud de entradas como el rol limitar desde el input
Remove some text in some places that I don't really need, like These notes are only used for this conversation and are not saved. 
Evaluar cuando se consigio el objetivo
Usar un model mejor para las preguntas (ENVs para distintos objetivos)
en los ejercicios no cortar el audio cuando terminan los 30 segundos, simplemente no seguir el bucle
Para la conversacion, en los detalles incluir quien soy yo y quien es el usuario, de pronto si guardar estas opciones en el backend
Ser mas especifico en el goal de la conversacion 
Usar servicio de autenticacion de Azure
Add settings to deploy files, like updated roles permissions, env...

Audio mas rapido y mas "ofuscado"

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
