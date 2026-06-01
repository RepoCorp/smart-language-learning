# Todos

Al ir arrastrando los bloques decir la palabra cuando es correcta (sintetizado)
The other exercise where with the cloze no se que no muestra la palabra en español si no que da la frase y un espacio en el que van apareciendo las letras una a una, en desorden para que el usuario la escriba cuando ya la haya identificado
Add a "dangerous" button to generate a small, simple, and the cheapest one possible image that represents the word, to the word item views.
Words box handler esta muy feo
I like the needs attention idea. What would it do with a word that is tagged as that?
In the create content window, make dialog lenght and language of required words a simple radio
When generating the exercises, send only the word in the target language
Que al escoger sesión procure no incluir frases y sus palabras juntas
Que cuando uno complete los items de la sesion le haga fiesta
Que haga superfiesta cuando uno aprenda x palabras nuevas en el día.
For word retry test no haga lo mismo que en el primer test si no que deje un input libre, sin ninguna validacion, y va mostrando en otra parte la palabra inicialmente escondida con placeholders para cada letra y va revelando letras aleatoriamente pero no la primera
- Usar frases mas complejas para el word retry test, de pronto sacandolas de los dialogos, la idea es que la frase sea muy relacionada con la palabra para que se pueda deducir
- Que no muestre la palabra en el otro idioma, simplemente la frase con el hueco.
- Si se equivoca al enviar la palabra muestre una imagen de la palabra y reemplaze la letra equivocada por una x
- Yo incluso consideraría no marcar inmediatamente la posición exacta del error en el primer intento. Ejemplo:Primer fallo:Hay 2 errores. Segundo fallo:Ahora sí se resaltan. Porque obligas a una revisión mental adicional. Pero esto habría que probarlo; demasiada dificultad también puede ser frustrante.
Frases:
- Primero autoevaluacion, si responde que falló la vuelve a mostrar en la sesión en ejercicio de bloques.
- El ejercicio va mostrando tres opciones para la siguiente palabra y no la añade si no es la correcta.
- Artículos van en el bloque con el noun.
- Que las opciones de los bloques sean del mismo tipo de palabra

- Una palabra marcada como dificil tiene prioridad para aparecer en las sessiones 

Que la palabra en la imagen sea completa por ejemplo herauskommen y que se muestre

# Trabajando en esto pero todavia no esta completo. Esta shelved lo que llevo. Buscar conversacin en Codex
Que indefinido sea en sujeto
Add con diese diesels...

ERRORES
Lo de la cantidad de hints sigue fallando e incluso con una, y creo que incluso cuando una es menos del 30% esta marcandoloa como fallido
Confirmar la traduccion de las palabras es correcta. Me salio que der Bitte es "tener"
Cosas como Ja, und ich würde dir insgesamt 4,55 Euro zurückgeben würde la traduce como devolveria cuando realmente es volverse / llegar a ser y solo es devolveria junto con la plabra zuruckgeben
Pilas con palabras que pueden ser masculino o femenino, cuando busca la palabra base que si diferencie las dos (el doctor, la doctora)
No reconoce cuando cumplio el objetivo en la conversacion 
Sigue sacando cosas raras como sein de stimmt
Mejorar lo de los helpers
Revisar future and present tense ejercicios
Para las palabras seleccionadas no esta guardando el dialogo. Tambien mirar que guardar cuando son agregadas desde una conversacion
Por que los goals son siempre tan similares? Siempre me pregunta por manzanas
Conversacion topic es requerido para poder empezar pero no se evidencia si se intenta impezar sin definirlo
Evaluar cuando se consigio el objetivo
"WARN[0003] Found orphan containers ... rt-language-learning-backend-run-736aefa1f30d]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up. "
Mejorar ejemplos de helpers y que la imagen lo represente mejor, como por ejemplo que es en el futuro o es como würde 
Que el helper no lo traduzca como palabra si no como una explicacion o algo asi 
Mas creatividad para la imagen 
Pareciera que no incluye el historial de las preguntas entonces no tiene contexto
En el celular a veces el teclado tapa el input de las preguntas
Mejorar UI de creacion de contenido
Mover unselect all, abrir ejercicios y cualquier otro boton que sea el mas usado a la izquierda


FEATURES
Cuando testing palabras como 'bien', que actualmente tiene como in Ordnung, añadir alguna claridad
Que la imagen tenga solo la palabra y en la parte de abajo escrita la frase
Que siempre reproduzca el audio en los tests
Que el audio sea mas rapido y mas "ofuscado"
Test con armar frase con palabras
Que la conversacion tenga un boton para terminar y ahi la presenta corregida y la guarda para dejar agregar las palabras  
Si permitor no agregar turnos de un dialogo. Que si los guarde pero algo asi como marcados como aprendidos
Que palabras o frases que tenga dificultad si le ponga a escribirlas y de pronto lo de la musica
Que pida algo de definicion del usuario para que en las conversaciones ese sea siempre su rol
Para la conversacion, en los detalles incluir quien soy yo y quien es el usuario, de pronto si guardar estas opciones en el backend
Si helper cambia con el genero hacer tambien ejercicios de todos
Incluir teoria de gramatica en los ejercicios

IMPROVEMENTS
Do not allow deleting phrases, only mark them as inactive or archived.
Ensayar otros modelos
Seguridad de S3
Arreglar allowed hosts de Django
Mejorar velocidad de respuesta de la conversacion 
En lugar de validar longitud de entradas como el rol limitar desde el input
Remove some text in some places that I don't really need, like These notes are only used for this conversation and are not saved. 
Usar un model mejor para las preguntas (ENVs para distintos objetivos)
en los ejercicios no cortar el audio cuando terminan los 30 segundos, simplemente no seguir el bucle
Ser mas especifico en el goal de la conversacion 
Usar servicio de autenticacion de Azure
Add settings to deploy files, like updated roles permissions, env...
Audio mas rapido y mas "ofuscado"
escoger el modelo apropiado para cada tarea (texto, audio, imagen, etc.)
Realmente crear cluster para que deploy no tenga que ser manual
Actualizar `aws-deploy/ecs-task-backend.json` y `aws-deploy/ecs-task-frontend.json`; ahora el script usa ARNs de task definitions porque esos archivos estan obsoletos.
Que primero genere una frase y después a esa misma frase le haga las conjugaciones
Create a script, using AWS deployment service, to create all the initial setup 

Alguna forma de preguntar conjugaciones en tests
Upgrade to React router v7
Push to github
Uasar mas variedad de voces

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
