# La Pirámide: contrato funcional y referencia para proveedores

Estado: contrato vigente de Pirámide. La referencia de la fase 0 se documentó el 2026-10-18 sobre
el recorrido competitivo existente; aquella entrega añadió documentación y pruebas. La unificación
se completó con el [cierre de la fase 6 el 2026-10-19](../archive/reports/qa-through-2026-10-21.md#cierre-de-la-fase-6--2026-10-19).

Las [decisiones aprobadas](../decisions/decisions.md), la
[política de recuperación](../decisions/adr/0003-attempt-lifecycle-and-concurrency.md) y el
[contrato del intento](attempt-lifecycle.md) conservan su precedencia. Los requisitos de un
proveedor local descritos al final fijaron el objetivo de la fase 0; su implementación y composición
consolidadas se documentan en [Autoridades locales](local-pyramid-session.md).
La introducción posterior del puerto y del adaptador remoto se documenta en
[Proveedores de sesión](game-session-providers.md). La sección 8 conserva los resultados de la
fase 0 y la sección 9 describe la frontera compartida vigente.

## 1. Partida, contenido y autoridad

- El modo `pyramid` tiene siete niveles ordenados, con briefing, versión de pregunta, duración y
  peso publicados. Los pesos suman 100; los siete niveles no son siete formatos fijos.
- Los formatos y versiones admitidos proceden de
  [`competitiveQuestionTypesFor("pyramid")`](../../lib/question-formats/definitions.ts).
  Actualmente son 21. Los formatos exclusivos de práctica no quedan admitidos por esta unificación.
- La página inicial recibe metadatos y briefings. Las preguntas se entregan progresivamente, y las
  soluciones permanecen en el servidor durante el juego. Preparar autoriza el contenido del nivel
  actual; la presentación competitiva lo mantiene oculto hasta confirmar la activación.
- Ver la introducción no consume un intento. Iniciar crea o recupera el único intento oficial del
  jugador en esa publicación. Los comandos posteriores no crean intentos por nivel.
- Identidad, permisos, recepción, evaluación, plazos, puntos y cierre los confirma el servidor.
  Borradores, foco, marcas X, gestos y animaciones son estado de interacción del navegador.

## 2. Secuencia y tiempos

| Situación             | Contenido y operaciones                                                            | Reloj y progresión                                                  |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Introducción          | Metadatos; permite iniciar si la publicación y los permisos lo admiten.            | No hay nivel activo.                                                |
| Briefing              | Mapa y condiciones del siguiente nivel.                                            | No consume tiempo del nivel.                                        |
| Preparación           | Entrega solo el ejercicio autorizado; la vista muestra carga y bloquea respuestas. | `presentedAt` y `deadlineAt` son nulos; no existe intervalo activo. |
| Activación confirmada | Se muestra el ejercicio y se habilitan sus controles.                              | El servidor fija el intervalo y el plazo individual.                |
| Interacción pendiente | Se conserva la entrada enviada y se bloquean escrituras incompatibles.             | La espera no extiende el plazo confirmado.                          |
| Progreso intermedio   | Actualiza las pistas, oportunidades o eventos autorizados.                         | Continúa el mismo nivel y el mismo plazo.                           |
| Resolución confirmada | Muestra feedback; si es correcta pasa al siguiente briefing o solicita cierre.     | El nivel ya tiene una evaluación final; no se vuelve a responder.   |
| Resultado y revisión  | Resultado terminal y preguntas alcanzadas autorizadas.                             | No permite repetir el intento oficial.                              |

Solo la activación inicia el reloj de Pirámide. Repetir el mismo comando de activación devuelve su
respuesta original; activar otra vez la interacción ya abierta conserva su inicio y deadline.
`attempts.deadline_at` permanece nulo: no hay un reloj global de Pirámide.

El deadline del nivel es el instante de activación más la duración publicada de la pregunta.
El cierre ordinario de la publicación impide iniciar un intento nuevo, pero no recorta el reloj
ni impide continuar los niveles de un intento iniciado válidamente. Cancelación, pérdida de
permisos y reconciliación de inactividad siguen sus reglas propias.

Esta precisión sustituye la descripción anterior de un nivel limitado por la ventana de
publicación. El comportamiento ya existe en
[`activate_interaction`](../../supabase/schemas/99_pyramid_activation.sql) y está caracterizado en
[`s15_pyramid_authoritative.test.sql`](../../supabase/tests/s15_pyramid_authoritative.test.sql),
que completa los niveles restantes después de cerrar la publicación. No es un cambio de regla.

La recepción y el tiempo efectivos proceden del servidor. El temporizador visual solicita la
resolución temporal; su llegada a cero no acredita ni finaliza por sí sola el intento.

## 3. Resolución, puntos y estados

- Solo una resolución final `correct` supera un nivel. `partial`, `incorrect` o `unanswered`
  terminan el ascenso con `failed`; una validación intermedia fallida no es una resolución final.
- El jugador conserva los puntos anteriores. Por defecto, un nivel no superado aporta cero, incluso si el
  evaluador produjo crédito parcial. Conectar parejas, Sopa de letras y Queens pueden acreditar
  puntos al vencer el reloj si su opción está activa en la versión.
- Una resolución correcta usa el peso y las reglas de puntuación del formato, incluida velocidad
  o penalizaciones cuando correspondan. No se sustituye por un premio fijo por nivel.
- Siete niveles correctos producen `summit`, con independencia del total obtenido. Llegar al
  briefing del séptimo nivel no basta. El total oficial lo suma el servidor desde las evaluaciones.
- `summit` y `failed` cierran como `completed`; fallar el ascenso no equivale a abandonar.
  `abandoned` conserva un motivo separado y no acredita el intento. `expired` describe la
  publicación no iniciada, no es un estado de `Attempt`.
- La revisión de sesión, idempotencia y acreditación impiden aplicar dos veces el mismo cierre.
  El ranking mantiene el comparador común; los niveles superados no añaden un desempate nuevo.

Las señales visuales de desenlace y las evaluaciones pueden existir antes de confirmar `complete`.
No se deben confundir con el estado terminal persistido ni mostrar un cierre aceptado antes de
recibir su confirmación.

### Crédito al vencer el reloj en Conectar parejas

`modeConfig.connectPairsTimeoutPartialCredit: true` activa esta regla por versión en Pirámides con
al menos un nivel de Conectar parejas. El seed de instalaciones nuevas la activa en Cumbre lógica v2.
Las instalaciones existentes preparan y publican sus versiones desde el portal superadmin.
El servidor usa el último tablero válido guardado antes del límite del nivel. Un envío final recibido
a tiempo tiene prioridad.

- Con un tablero incompleto, el crédito es el menor de `peso − 1`,
  `floor(peso × parejas conectadas / parejas totales)` y
  `floor(peso × casillas en rutas completas / casillas totales)`. Las rutas abiertas solo aparecen
  en la revisión. Un crédito positivo se registra como `partial`, suma al ranking y termina el ascenso.
- Un tablero completo guardado a tiempo se registra como acierto. Puntúa por velocidad con la hora
  del guardado y abre el siguiente nivel. Una interrupción antes del límite sin envío final no acredita
  el borrador. Los reintentos reutilizan la resolución guardada.

### Crédito al vencer el reloj en Sopa de letras y Queens

El editor permite activar `wordSearchTimeoutPartialCredit` y `queensTimeoutPartialCredit`
por separado. Cada opción requiere un nivel de su formato y puede coexistir con las otras.
Para activar la regla en una publicación, selecciona una versión publicada con la opción activa.

- En Sopa de letras se cuentan las palabras distintas que el servidor confirmó antes del límite.
  Las selecciones incorrectas no suman. La última palabra encontrada a tiempo cierra con un acierto.
- En Queens se compara el último tablero guardado a tiempo con la solución. Solo cuentan las coronas
  propias bien colocadas. Un tablero completo y válido se puntúa por velocidad a la hora del guardado,
  con las penalizaciones previas. El tercer fallo de validación sigue cerrando el nivel con cero.
- El parcial es `min(peso − 1, floor(peso × aciertos / elementos por resolver))`. No tiene descuento
  por tiempo ni por fallos previos. Suma al ranking y termina el ascenso. Una resolución final
  aceptada a tiempo tiene prioridad y una interrupción antes del límite no acredita el borrador.

### Crédito al confirmar o vencer en Emparejamiento, Clasificación y Ordenación

Las opciones de versión `matchingPartialCredit`, `classificationPartialCredit` y
`orderingPartialCredit` se activan de forma independiente. Cada una exige un nivel de su formato.

- Se cuenta cada pareja correcta, cada elemento en su categoría correcta o cada elemento en su posición
  exacta, según el formato. Un parcial positivo usa `min(peso − 1, floor(peso × aciertos / total))`
  tanto al confirmar como al vencer. Aporta puntos al cierre del intento y termina el ascenso.
- La confirmación completa recibida a tiempo tiene prioridad. Sin ella, el servidor evalúa al vencer
  el último borrador aceptado antes del límite. Un borrador resuelto puntúa por velocidad según su hora
  de guardado y permite avanzar. El orden inicial sin movimientos y la recuperación antes del límite
  sin confirmación aportan cero.

## 4. Queens: una interacción puede continuar después de un fallo

Al completar las `N` coronas, incluidas las pistas fijas, el control solicita validación del tablero
completo. Los borradores se ordenan antes de esa validación en la cola común.

| Acción confirmada                                              | Consecuencia                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Editar o guardar un borrador                                   | No consume una oportunidad ni produce una respuesta final.                                           |
| Enviar un tablero incompleto, con exceso de coronas o inválido | Se rechaza; no consume una oportunidad.                                                              |
| Primera validación completa incorrecta                         | Quedan dos oportunidades; mantiene nivel y plazo.                                                    |
| Segunda validación completa incorrecta                         | Queda una oportunidad; mantiene nivel y plazo.                                                       |
| Tercera validación completa incorrecta                         | Resolución `incorrect`, cero puntos y `failureReason: attempts_exhausted`; termina el ascenso.       |
| Acertar sin fallos, con uno o con dos fallos previos           | Supera el nivel; conserva la penalización correspondiente.                                           |
| Repetir la misma validación idempotente                        | Devuelve el mismo resultado sin consumir otra oportunidad.                                           |
| Reutilizar su clave con otro tablero                           | Conflicto de idempotencia, sin nueva mutación.                                                       |
| Validar después del deadline                                   | Rechazo temporal; no consume una oportunidad adicional y requiere la resolución temporal autorizada. |

La penalización es `round(puntosDelNivel × 0.05)` por validación incorrecta. Con un peso de 14 y
respuesta inmediata, acertar tras cero, uno o dos fallos concede respectivamente 14, 13 o 12 puntos.
Las solicitudes inválidas y las marcas X no cuentan como validaciones fallidas. El límite de tres
es por prueba, y no se comparte entre niveles ni se configura como vidas de Supervivencia.

## 5. Reintento y recuperación son operaciones distintas

- **Confirmación perdida:** conservar operación, payload, revisión y clave originales. Reintentar
  confirma lo que ocurrió sin consumir otro intento o reiniciar tiempos. Un error de transporte no
  demuestra rechazo; no permite seguir enviando acciones incompatibles.
- **Rechazo definitivo:** no mostrar un acierto ni descontar una oportunidad no confirmada. Una
  versión obsoleta exige reconciliar, en lugar de sustituir la revisión del comando rechazado.
- **Recuperación sin nivel activo:** conserva el briefing o preparación sin inventar una respuesta
  ni iniciar un temporizador. Recuperar no equivale a activar.
- **Recepción final pendiente:** se conserva y evalúa antes de resolver la interrupción; no se
  reemplaza una respuesta ya recibida por una respuesta nula.
- **Nivel activo interrumpido:** el servidor cierra el intervalo y reconstruye la resolución desde
  la recepción y los eventos privados del formato. Para una respuesta nula de Pirámide, el evaluador
  devuelve `unanswered` con cero puntos, salvo el crédito al vencer cuando está activo para el
  formato. Una resolución no correcta
  impide continuar y cierra el ascenso como `completed` / `failed`.
- **Abandono explícito:** termina como `abandoned`, no reanuda y no concede otro intento oficial.
  Cerrar una pestaña por sí solo no demuestra abandono; la inactividad se reconcilia en servidor.

Los casos de recuperación con eventos específicos de formatos requieren su caracterización
correspondiente. Esta fase fija la respuesta nula y la prioridad de la recepción final; no declara
probada la equivalencia de recuperación de los 21 formatos. Los borradores locales tampoco
sustituyen recepciones aceptadas.

## 6. Resultado y revisión

`summit` muestra «Cima conquistada»; `failed`, «Ascenso terminado». Se distinguen niveles alcanzados
de niveles superados. La revisión presenta los siete niveles; los no alcanzados muestran «No
alcanzado» y carecen de payload y solución. No hay botón para repetir una competición terminal.
Recargar el resultado conserva el estado aceptado.

El resultado propio y la revisión histórica de miembros usan sus permisos existentes. El
espectador no obtiene contenido jugable ni soluciones por acceder directamente a una URL.

## 7. Matriz de referencia de la fase 0

Los identificadores se conservan para ampliar las pruebas con el futuro proveedor local. Las
expectativas son ejemplos observables; un cliente simulado verifica coordinación, pero no prueba
las garantías SQL ni equivale a implementar el segundo proveedor.

| ID     | Comportamiento                                                                | Referencia automatizada                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PYR-01 | Introducción y briefing sin pregunta jugable ni timer                         | [E2E Queens](../../e2e/pyramid-queens.spec.ts), [vista competitiva](../../components/game/modes/flash-pop/ServerFlashPopPyramidGame.test.tsx)                                                                                                                |
| PYR-02 | Preparar no activa; activar y reintentar no reinician el plazo                | [motor](../../features/game/competitive/core/sessionEngine.test.ts), [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql)                                                                                                                      |
| PYR-03 | Sin reloj global; duración individual completa y continuación tras el cierre  | [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql)                                                                                                                                                                                           |
| PYR-04 | Solo `correct` avanza; parcial/fallo no puntúan; siete aciertos producen cima | [progreso](../../features/pyramid/pyramidRules.test.ts), [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql)                                                                                                                                  |
| PYR-05 | Progreso Queens intermedio, tres fallos y penalización según peso             | [motor](../../features/game/competitive/core/sessionEngine.test.ts), [evaluador](../../server/evaluation/competitive-evaluator.test.ts), [SQL Queens](../../supabase/tests/pyramid_queens_attempts.test.sql), [E2E Queens](../../e2e/pyramid-queens.spec.ts) |
| PYR-06 | Entradas inválidas y borradores no consumen oportunidades                     | [SQL Queens](../../supabase/tests/pyramid_queens_attempts.test.sql)                                                                                                                                                                                          |
| PYR-07 | Repetición sin doble efecto y conflicto si cambia el payload                  | [SQL Queens](../../supabase/tests/pyramid_queens_attempts.test.sql), [E2E Queens](../../e2e/pyramid-queens.spec.ts)                                                                                                                                          |
| PYR-08 | Recuperación sin reloj, respuesta nula y recepción pendiente                  | [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql), [evaluador](../../server/evaluation/competitive-evaluator.test.ts), [casos de uso](../../application/use-cases/attempts.test.ts)                                                         |
| PYR-09 | Resultado derivado, cierre y acreditación únicos                              | [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql), [SQL Queens](../../supabase/tests/pyramid_queens_attempts.test.sql)                                                                                                                      |
| PYR-10 | Revisión bloqueada en niveles futuros, sin replay y resultado tras recarga    | [E2E Queens](../../e2e/pyramid-queens.spec.ts), [E2E S15](../../e2e/s15-pyramid.spec.ts)                                                                                                                                                                     |
| PYR-11 | Rechazo temporal sin consumir otro intento de Queens                          | [SQL Queens](../../supabase/tests/pyramid_queens_attempts.test.sql)                                                                                                                                                                                          |
| PYR-12 | Solo contenido público y permisos de juego/revisión                           | [SQL S15](../../supabase/tests/s15_pyramid_authoritative.test.sql), [integración S15](../../scripts/integration/scenarios/s15.mjs)                                                                                                                           |

## 8. Verificación reproducible y límites

Comprobación focal sin backend:

```bash
npm test -- features/pyramid/pyramidRules.test.ts features/game/competitive/core/sessionEngine.test.ts features/game/competitive/core/commandExecutor.test.ts server/evaluation/competitive-evaluator.test.ts application/use-cases/attempts.test.ts components/game/modes/flash-pop/ServerFlashPopPyramidGame.test.tsx
npm run docs:check
npm run type-architecture
```

Con Docker y Supabase local disponibles, el verificador SQL crea y elimina una base temporal;
no reinicia los datos del proyecto. El runner E2E utiliza un stack aislado y lo limpia al terminar:

```bash
npm run supabase:schema:test -- --test=s15_pyramid_authoritative.test.sql
npm run supabase:schema:test -- --test=pyramid_queens_attempts.test.sql
E2E_INTEGRATION_SCENARIOS=s15 npm run test:e2e:isolated -- e2e/pyramid-queens.spec.ts e2e/s15-pyramid.spec.ts
```

Los resultados de la referencia inicial y la narración de su ejecución se conservan en el
[informe del 2026-10-18](../archive/reports/qa-through-2026-10-21.md#contrato-de-pirámide-referencia-inicial--2026-10-18).
Son evidencia fechada, no una ejecución actual de las comprobaciones anteriores.

## 9. Frontera compartida tras la fase 6

Estado: completada el 2026-10-19; [criterios de cierre y evidencia](../archive/reports/qa-through-2026-10-21.md#cierre-de-la-fase-6--2026-10-19).

Todas las entradas jugables de Pirámide usan `usePyramidGameSession` y `PyramidGameView`.
La composición competitiva conecta el proveedor remoto; la local recibe `LocalPyramidDefinition`
y crea una autoridad en memoria. El catálogo, los controles y los resolutores de la biblioteca
didáctica no constituyen otra composición de partidas de Pirámide.

El resumen de resultado y el progreso mínimo del lobby son tipos neutrales de gameplay. Se
retiraron el controlador local anterior, sus transiciones, su almacenamiento y las dos vistas
sustituidas. La entrada local antigua con preguntas de práctica ya no se admite. Las soluciones
mock pertenecen a la definición privada y al proveedor, y solo se proyectan para revisión terminal.

Repetir, cambiar de desafío o versión y recargar crean una ejecución nueva. Los diccionarios
públicos de Mini-Wordle se preparan antes de construir el proveedor; su carga no activa plazos.
El callback local de resultado se emite una vez por cierre confirmado, tanto para cima como para
ascenso fallido, sin duplicarse al revisar o volver al resultado. El backend conserva su contrato,
autorización, evaluación, ranking y acreditación.
