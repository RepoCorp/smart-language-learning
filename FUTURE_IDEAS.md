# Todos


Que en la conversacion siempre empiece el usuario, puede ser solo un saludo

Que pueda seleccionar varias palabras para agregar al diccionario, no solo click en individuales si no que pueda seleccionar expresiones completas

Que al generar contenido pueda darse una lista de palabras para usar y/o pedir que primero las genere segun instrucciones
Arreglar la generacion de frases para los ejercicios
Posibilidad de regenerar otras cosas, como las traducciones que a veces estan mal, especialmente en el ejercicio

Que cuando uno complete los items de la sesion le haga fiesta

Que los ejercicios de palabras sea checkbixes con las distintas combinaciones más comunes. Al guardar una palabra guardar la base, sin conjugación, sin pluralidad... En los ejercicios dependiendo del tipo de palabra hace los ejemplos (singular, plural, dativo, presente...) para cada uno hay un botón que explicará la gramatica. (Como funcionará con lo de reflexivos y no se que más? Mirar coso de PONS)

Cuando esta testeando o estudiando poder marcar un elemento como equivocado, ya sea en audio, texto, traduccion, ejercicio... Re crearlo
Lo de la cantidad de hints sigue fallando e incluso con una, y creo que incluso cuando una es menos del 30% esta marcandoloa como fallido
Confirmar la traduccion de las palabras es correcta. Me salio que der Bitte es "tener"
Y una frase que represente la palabra de la forma más simple pero más particular a esa palabra y que se pueda representar en una imagen memorable
Cosas como Ja, und ich würde dir insgesamt 4,55 Euro zurückgeben würde la traduce como devolveria cuando realmente es volverse / llegar a ser y solo es devolveria junto con la plabra zuruckgeben
Pilas con palabras que pueden ser masculino o femenino, cuando busca la palabra base que si diferencie las dos (el doctor, la doctora)
Cuando testing palabras como 'bien', que actualmente tiene como in Ordnung, añadir alguna claridad
No reconoce cuando cumplio el objetivo en la conversacion 
Que haga superfiesta cuando uno aprenda x palabras nuevas en el día.
Poder añadir palabra manualmente
Que la imagen tenga solo la palabra y en la parte de abajo escrita la frase
Sigue sacando cosas raras como sein de stimmt
Que muestre cuantas palabras ha aprendido
Color a botón marcar aprendido
Poder mutear audio en ejercicio
Poder ir al elemento desde otros tipos de testing
Que indefinido sea en sujeto
Mejorar lo de los helpers
Que el audio sea mas rapido y mas "ofuscado"
Regenerate audio
Revisar future and present tense ejercicios
Add con diese diesels...
Test con armar frase con palabras 
Que siempre reproduzca el audio en los tests
Seleccionar longitud del diálogo al crear

Que uno pueda editar las palabras 
Que la conversacion tenga un boton para terminar y ahi la presenta corregida y la guarda para dejar agregar las palabras  
Si permitor no agregar turnos de un dialogo. Que si los guarde pero algo asi como marcados como aprendidos
Para las palabras seleccionadas no esta guardando el dialogo. Tambien mirar que guardar cuando son agregadas desde una conversacion
Que palabras o frases que tenga dificultad si le ponga a escribirlas y de pronto lo de la musica
Eliminar silencios antes del audio de las frases. Algunas frases lo tienen.
Cuidado con los articulos, incluirlos siempre en las palabras para idiomas que manejan generos
Por que los goals son siempre tan similares? Siempre me pregunta por manzanas
Conversacion topic es requerido para poder empezar pero no se evidencia si se intenta impezar sin definirlo
Frases de ejercicios, el repeat usa el audio que ya tiene generado 
Palabras de ejercicios usa text to speech local
el tema del casing en aleman. Solo mayusculas para sustantivos
Ensayar otros modelos
Seguridad de S3
Arreglar allowed hosts de Django
Repetir audio al final o ppio de los tests
Make sure audio is in the same language as the text
Failed to delete item
When adding a new word from the conversation the translation is wrong 
Mejorar velocidad de respuesta de la conversacion 
Que pida algo de definicion del usuario para que en las conversaciones ese sea siempre su rol
En lugar de validar longitud de entradas como el rol limitar desde el input
Remove some text in some places that I don't really need, like These notes are only used for this conversation and are not saved. 
Evaluar cuando se consigio el objetivo
Session store algunos de los parametros  
Regenerate audio afectaria a todo el mundo, arreglar de alguna manera. Posiblemente arreglando el codigo para que no haya necesidad de regenerarlo
Safety when creating users and super users, and other things in general
Usar un model mejor para las preguntas (ENVs para distintos objetivos)
Cuidado con el audio que usa ingles muchas veces para palabras en aleman
en los ejercicios no cortar el audio cuando terminan los 30 segundos, simplemente no seguir el bucle
Do not force finishing of the session on countdown end, just on completing the planned session. Actually don't use a countdown, just a timer.
Para la conversacion, en los detalles incluir quien soy yo y quien es el usuario, de pronto si guardar estas opciones en el backend
Ser mas especifico en el goal de la conversacion 
Usar servicio de autenticacion de Azure
Celular friendly
DNS y certificado SSL
Add settings to deploy files, like updated roles permissions, env...
Que header no este fixed para que sea mas facil en mobil 
Creando content en un mobil, las palabras nuevas salen todas desordenadas
Alguna manera de revisar repeticion de palabras que pueden ser la misma pero con alguna minima diferencia en como la traducen, pero realmente es lo mismo

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
