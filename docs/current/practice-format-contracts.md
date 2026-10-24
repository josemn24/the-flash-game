# Contratos de presentación de práctica

Estado: vigente. Los 31 formatos de práctica tienen entradas específicas por formato.

`PracticeInputByFormat` y `PracticeInputProps<T>` están definidos en
`features/question-formats/practiceInputTypes.ts`. Cada entrada recibe una
`PracticeQuestionOfType<T>`, `locked` y sus operaciones locales. Las respuestas y los
borradores utilizan `AnswerValueOfType<T>` del contrato canónico.

`PracticeInput` relaciona formato y props mediante la unión discriminada
`{ context: "practice", format, props }`. `QuestionInput` recibe exclusivamente `{ input }` y
el registro despacha los 31 formatos mediante un `switch` exhaustivo, sin conversiones de tipo.
Se conservan `QuestionInput` y `QUESTION_INPUT_RENDERERS`. `rendererTypes.ts` contiene solamente
`ReviewProps`; los contratos de revisión no cambian.

## Operaciones y restauración

Todos los formatos reciben `onSubmit`, salvo código lógico: este mantiene
`onCodeAttempt: (code: string) => boolean`, `onProgress`, `initialAnswer` y el contador de intentos.
El resultado booleano conserva la limpieza, el mensaje de error y el foco de cada intento.

| Capacidad adicional             | Formatos                                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onProgress`                    | Clasificación, conectar parejas, reconstrucción del error, matching, Mini-Wordle, ordenar, pistas progresivas, Queens, Hashtag, sopa de letras, código lógico, Escape, memoria de parejas, mini nonograma, mini sudoku, tuberías, laberinto, Zip y memoria relámpago |
| `initialAnswer`                 | Clasificación, conectar parejas, reconstrucción del error, matching, Mini-Wordle, ordenar, pistas progresivas, Queens, Hashtag, sopa de letras y código lógico                                                                                                       |
| `onIncorrectAttempt`            | Matching, Queens y sopa de letras                                                                                                                                                                                                                                    |
| `onTimedResponseStart`          | Memoria relámpago, Simon, Mini-Wordle e imagen progresiva                                                                                                                                                                                                            |
| Revelación y contador de pistas | Pistas progresivas                                                                                                                                                                                                                                                   |

Estimación y mapa de calor conservan su estado local: no restauran borradores ni publican progreso.
`ShortTextInput` sigue siendo un control neutral compartido; su `PracticeInput` añade el contrato
local sin introducir DOM ni claves de montaje.

## Adaptación y composición

`createPracticeInput(source)` es una proyección pura y devuelve `null` cuando falta la pregunta.
Selecciona solamente los callbacks que consume cada formato, sin envolverlos. Comprueba los
borradores con los validadores anteriores y conserva sus referencias; un borrador inválido pasa
como `undefined`. No introduce validación adicional ni cambia la normalización de cada control.
Código lógico conserva el contador inicial cero. Pistas progresivas conserva su valor inicial
opcional y el valor alternativo propio de cada superficie.

Los ejemplos de biblioteca y las composiciones de práctica construyen el input local. Los
ensayos con proveedores en memoria reutilizan el motor y las vistas competitivas; Pirámide no
conserva dos controladores anteriores. `QuestionStage` y las superficies de cada modo reciben
el input separado de numeración, vidas, deadline, timeout y `onReady`.
Véanse [autoridades locales](local-pyramid-session.md) y [ensayos](rehearsals.md).

`withPracticeTimedResponseStart` permite interceptar únicamente los cuatro formatos con preparación.
No añade operaciones a los demás y conserva su envelope por referencia. Se mantienen las políticas
existentes: los cuatro inicios diferidos en `QuestionStage`, el tratamiento de Mini-Wordle en
Pirámide Flash Pop y la imagen progresiva en Narrative. Se conservan claves, montaje y cadenas de
callbacks, incluida la cadena `onReady` y armado de nivel de Pirámide Flash Pop.

## Frontera competitiva

El envelope competitivo incorpora `context: "competitive"`. Las comprobaciones de tipos rechazan
el intercambio de envelopes en los 21 formatos compartidos, incluso si sus props tienen la misma
estructura. Esta distinción pertenece a la UI; no modifica comandos, motor ni contratos HTTP.

Las entradas de práctica no admiten `pendingAnswer`, estado de envío, errores ni reintentos de
servidor. Los flujos competitivos mantienen esos estados en sus controladores y en los contratos
específicos que los consumen. El comprobador de arquitectura impide dependencias entre adaptadores,
fábricas y contratos de entrada de ambos contextos, permitiendo vistas y utilidades neutrales.

## Verificación

Las pruebas cubren los 31 contratos, operaciones obligatorias, restauraciones válidas e inválidas,
callbacks, controles habilitados y bloqueados, foco, reinicio, errores locales e inicios diferidos.
Las composiciones se verifican con sesiones simuladas o con el controlador local del ejemplo.
El recorrido `e2e/practice-input-contracts.spec.ts` abre el primer ejemplo de los 31 formatos a 390
y 1280 píxeles, verifica controles, temporizador, cierre y ausencia de peticiones competitivas;
incluye movimiento reducido y capturas para revisión visual. Se conservan la recuperación del
diccionario de Mini-Wordle, las fronteras locales y la matriz competitiva existente.

Véanse la [organización de formatos](question-format-organization.md), los
[contratos competitivos](competitive-format-contracts.md) y la
[arquitectura de servidor y cliente](architecture/server-client-architecture.md).
