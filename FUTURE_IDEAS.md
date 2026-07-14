# Todos

## PRIORITARIO
Ningun otro arreglito que no sea vital!!! 

## COSAS IMPORTANTES QUE VAMOS A EMPEZAR A HACER:
- Introducir gramatica, gradualmente. Empecemos con sustantivos.
  - Añadir la informacion del genero y mostrarlo de alguna manera en la UI
  - Revisar los ejercicios, que si se cubran las principales formas gramaticales y que permita abrir una ventana para cada una de ellas que de una pequeña explicacion y que muestre las equivalentes de otras palabras del mismo genero


## COSAS QUE NO DEBERIAN ESPERAR PERO QUE VAN A TENER QUE ESPERAR:
- Refactor (Lo vamos a ir haciendo gradualmente)
- Mejorar prompts

## New functionalities 
De las conversaciones saca errores. Darle al modelo la lista de errores que tenemos incluidas y el dice si/cuales de esos están y sugiere repasarlo. Que sea bien empatico 😂
Alguna celebración cuando finalmente logra la palabra. En ejercicio typing. Depronto incluso que la celebración ayude, como que las letras hagan la ola

## PROBLEMAS/ERRORES/MEJORAS PARA IR HACIENDO:

### Tier 1
Algun security by obscurity, que igual deje el pin sencillo.
In the create content window, make dialog lenght and language of required words a simple radio
En diálogos en item view y creo que diálogos también, que no scrolls back

#### PROMPTS/MODEL WORK
En pregunta mejorar las respuestas, incluyendo quitar el que dice si esta relacionado
Problema con palabras que toma como.expresion como.bitte y gleichfalls
Validar ejercicios, traducciones y esas cosas con otro modelo
Confirmar la traduccion de las palabras es correcta. Me salio que der Bitte es "tener"
el redo the item info using the best model esta funcionando peor que antes
Sigue sacando cosas raras como sein de stimmt
Cosas como Ja, und ich würde dir insgesamt 4,55 Euro zurückgeben würde la traduce como devolveria cuando realmente es volverse / llegar a ser y solo es devolveria junto con la plabra zuruckgeben
Confirmar la traduccion de las palabras es correcta. Me salio que der Bitte es "tener"

## FUTURE WORK (some important, some not so important)
Que el usuario pueda pedir que el item sea re-evaluado por un mejor modelo. estaba implementado en el regenerar palabra, pero no estaba funcionando bien. Añadi un todo con Codex para volverlo a implementar mas adelante.  
Que en repeticion alguna manera de pedir que pronuncie la palabra/frase una vez al hacer click
Delay entre frases de ejercicio repeticion
Que no se pueda typear la opcion correcta en error completando la palabra si no que hay que mover el cuadrito a ver si entra en la palabra. De pronto mostrar todo el alfabeto y las pistas resaltadas
en bloques no repetir audio desde el principio si no desde el ppio de la frase, es decir ppio o despues de un punto
En ejercicios u otra parte tambien poner ejemplos en otros contextos, no solo de donde vino la palabra
Revisar otros dialogos de las palabras separado de rehacer palabra
Que la pregunta común llene el input pero permita escribir
Recrear audio de un turno en particular que pudo haber quedado regu
Correr todos los diálogos y regenerar los que se necesite
Ejercicios de expresiones no pueden ser como las frases
En la sección de calentar palabra que muestre los espacios para cada letra
Spread items from same phrase considering sides
Que los ejercicios de un helper sean otros usos del helpee
Cómo hacer para que en el ejercicio de bloques sea más entrecomillas fácil equivocarse
El segundo ejercicio de palabra, el teclado completo, se va pendiendo la tecla qué es y se mueve al puesto como bloque. De pronto que prenda tres opciones pero de un color no verde, y cuando uno toca la que si es se pone verde y después uno la arrastra
en las ventanas, como generar contenido, limpiar y que las opciones empiecen colapsadas y solo abra el area si se hace click en ella
Que al escoger sesión procure no incluir frases y sus palabras juntas
Que la palabra en la imagen sea completa por ejemplo herauskommen y que se muestre
Cuales son las diferencias entre los dialog windows para ver si se puede unificar mas (botones, scrolling...) (from item, from dialogs, from create content, and even conversation)
Que indefinido sea en sujeto
Add con diese diesels...
Ejercicio de escribir la palabra muchas veces, como lo de los treinta minutos. Pero algo que sea rapido: dibujandola sobre preescrita, con letras de teclado que se iluminan, con mover letras…?
Ponga pa practicar cuando se equivoca en el articulo
Añadir mucha más Metadata a las palabras (desde la gramática) y usarla en ejercicios
a difficult phrase exercise to type the phrase
Modo no audio en ninguna parte (como cuando uno esta en publico y no puede escuchar)
ejercicio de Ordenar letras
Slider para tamaño session, separado para review y para aprender
Que los ejercicios de bloques capturen esas reglas de órdenes y grupos de palabras gramaticales
Memorización de reglas, como lo de algunos casos en los que los sustantivos tienen un género en particular (PONS)
Que se pueda explicar algún problema que uno tenga con aprenderse algo y le haga ejercicios acorde
Pronunciacion patterns tambien
Que los dialogos puedan ser A1, A2...
ejercicio palabra aleman espanol arrastrar la palabra a la imagen, siempre la imagen debe estar en la misma direccion, las imagenes estan al rededor de la palabra
Revelar pistas rascando, en lugar de solo mostrar la letra tiene que rasca y gana
Que la imagen asociada a la palabra, o la palabra tenga una especie de carta, tenga un borde con un color dependiendo del tipo de la palabra, y/o una forma diferente de carta para el genero o alguna otra clasificacion
Secuencia: recuperacion activa (ejercicio dificil o auto evaluacion) si falla un ejerccio de asociasion visual/motriz (auditiva?) y despues otro intento de recuperacion
Gratificacion: asociada a la palabra, no solo confeti. Por ejemplo arrastrando palabra a la imagen, cuando llegue se encaja con la imagen de una manera satisfactoria, se agranda, suena, un sonido corto de exito, aparece la respuesta, de pronto una fusion de la imagen y la palab
Que en los bloques uno tenga que armar sub bloques para ayudar con la estructura de la frase, o poner de entrada algunas palabras y solo tenga que ubicar en las que se ha equivocado en el pasado
Add a "dangerous" button to generate a small, simple, and the cheapest one possible image that represents the word, to the word item views.
Que cuando uno complete los items de la sesion le haga fiesta
Pilas con palabras que pueden ser masculino o femenino, cuando busca la palabra base que si diferencie las dos (el doctor, la doctora)
Mejorar lo de los helpers
Revisar future and present tense ejercicios
Para las palabras seleccionadas añadir funcionalidad a guardar cuando son agregadas desde una conversacion
Mejorar ejemplos de helpers y que la imagen lo represente mejor, como por ejemplo que es en el futuro o es como würde 
Que el helper no lo traduzca como palabra si no como una explicacion o algo asi 
Mas creatividad para la imagen 
Mejorar UI de creacion de contenido
Mover unselect all, abrir ejercicios y cualquier otro boton que sea el mas usado a la izquierda
Cuando testing palabras como 'bien', que actualmente tiene como in Ordnung, añadir alguna claridad
Que la imagen tenga solo la palabra y en la parte de abajo escrita la frase
Test con armar frase con palabras
Que pida algo de definicion del usuario para que en las conversaciones ese sea siempre su rol
Para la conversacion, en los detalles incluir quien soy yo y quien es el usuario, de pronto si guardar estas opciones en el backend
Si helper cambia con el genero hacer tambien ejercicios de todos
Incluir teoria de gramatica en los ejercicios
Ensayar otros modelos
Seguridad de S3
Arreglar allowed hosts de Django
En lugar de validar longitud de entradas como el rol limitar desde el input
Remove some text in some places that I don't really need, like These notes are only used for this conversation and are not saved. 
Usar un model mejor para las preguntas (ENVs para distintos objetivos)
en los ejercicios no cortar el audio cuando terminan los 30 segundos, simplemente no seguir el bucle
Usar servicio de autenticacion de Azure
Add settings to deploy files, like updated roles permissions, env...
escoger el modelo apropiado para cada tarea (texto, audio, imagen, etc.)
Actualizar `aws-deploy/ecs-task-backend.json` y `aws-deploy/ecs-task-frontend.json`; ahora el script usa ARNs de task definitions porque esos archivos estan obsoletos.
Que primero genere una frase y después a esa misma frase le haga las conjugaciones
Create a script, using AWS deployment service, to create all the initial setup
Alguna forma de preguntar conjugaciones en tests
Upgrade to React router v7

OTROS IDIOMAS
Apostrofes en frances



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
- 
