# Contratos funcionales recomendados por modo

## Estado del documento

Última actualización: 2026-09-15.

Este documento consolida el comportamiento observado en los modos actuales y las recomendaciones
funcionales que deben guiar las siguientes fases. No define tablas, APIs, endpoints ni detalles de
implementación. Cuando una regla aparece como **Recomendación**, debe considerarse una propuesta de
comportamiento y no una decisión irreversible hasta confirmarla en `docs/decisions/decisions.md`.
La política de recuperación de interacción iniciada que figura en este documento ya está confirmada
por la decisión y ADR de 2026-09-15.

La jerarquía documental aplicable es la descrita en [`README.md`](README.md): los ADR y las
decisiones generales prevalecen sobre este documento; este documento prevalece sobre descripciones
históricas del prototipo.

## Reglas comunes

Estas reglas se aplican a cualquier modo cuando se juega dentro de una sala:

- Ver la introducción no crea un intento. El intento competitivo se crea al iniciar la partida y
  pasa a `inProgress`.
- Si la publicación cierra antes de iniciar, se muestra `expired`. No existe intento, resultado,
  revisión ni participación que contabilizar.
- Si el modo llega a su final reglamentario, el intento pasa a `completed`, incluso con cero Flash
  Points. Los resultados internos del modo no crean estados globales `passed` o `failed`.
- Si un intento iniciado se abandona, pasa a `abandoned` y se proyecta como `notCompleted`. Es
  terminal: no se reanuda ni se repite.
- `inProgress` significa reanudar el mismo intento, no empezar una nueva partida.
- En el MVP solo la sesión que inició el intento puede reanudarlo. Un segundo navegador o dispositivo
  se bloquea; no existe transferencia de control entre dispositivos.
- Cerrar una pestaña, perder conectividad u observar `offline` no demuestra que el jugador haya
  abandonado. Solo la acción explícita e idempotente de abandonar termina el intento como
  `abandoned`; el abandono automático queda para una política posterior de actividad.
- `invalidated` queda fuera del ranking y de la acreditación competitiva. La revisión visible de un
  intento invalidado requiere una decisión administrativa específica y nunca es la consecuencia de
  recuperar una interrupción.
- El tiempo de una pregunta o ronda produce el resultado temporal definido por el modo —normalmente
  `unanswered`—. No equivale por sí solo a `expired`, `abandoned` ni a un fallo global del desafío.
- Mientras el intento está en progreso no se muestran soluciones. Tras `completed` o `abandoned`,
  si hubo un intento iniciado, el jugador puede consultar sus respuestas y las respuestas correctas.
- En competición no hay replay después de un estado terminal. Los previews sin `roomContext`
  conservan el replay para exploración y QA.

### Tipos de tiempo

Cada contrato debe distinguir tres relojes:

1. **Tiempo de respuesta:** límite de una pregunta, nivel o ronda. Lo consume la mecánica y puede
   producir `unanswered`.
2. **Ventana de publicación:** determina si el desafío está disponible o `expired` antes de crear
   un intento.
3. **Actividad del intento:** checkpoints y heartbeat que permiten detectar abandono. El abandono
   automático todavía no está implementado; los eventos del navegador son solo avisos auxiliares.

No se recomienda añadir un tiempo total común a todos los modos sin que el contenido del modo lo
requiera. Si existe, debe documentarse aparte del tiempo de respuesta.

### Recuperación de una interacción iniciada

El servidor considera **consumida** una interacción desde que ha confirmado su unidad temporal e
intervalo antes de entregar el payload público. Esta regla también cubre una respuesta HTTP perdida:
el servidor no puede demostrar que el navegador no llegó a ver el contenido y no debe conceder una
segunda oportunidad ni otro reloj.

Al reanudar con la cookie de la sesión controladora, el servidor resuelve primero los hechos ya
aceptados:

1. Si existe una recepción de respuesta, la reconcilia y evalúa idempotentemente antes de preparar
   contenido nuevo. Nunca la sustituye por `unanswered`.
2. Si no existe recepción, cierra atómicamente el intervalo abierto y aplica la consecuencia de
   recuperación del modo. La misma pregunta, nivel o letra visible no se vuelve a entregar.
3. Solo después reconstruye el siguiente estado autorizado. Un token de otra sesión sigue recibiendo
   un bloqueo; recuperar no transfiere el control.

`unanswered` y `timeout` son resultados de respuesta, no `invalidated`. El motivo técnico de cierre
puede conservar la interrupción para auditoría, pero no crea una respuesta adicional salvo que el
modo deba registrar una como no contestada.

### Ranking por desafío

Los cinco modos actuales usan provisionalmente el mismo comparador para el ranking de cada desafío:

1. Más Flash Points.
2. Menor duración efectiva del intento: la suma de `AttemptAnswer.timeUsedMs`, incluyendo respuestas
   temporizadas o no contestadas, pero excluyendo cuenta atrás y esperas externas.
3. `startedAt` más antiguo, conservado al reanudar el mismo intento.

Si los tres valores coinciden, se comparte posición con ranking de competición (`1, 1, 3`). La hora
absoluta de finalización (`completedAt`) y métricas como `lastCorrectAt` siguen disponibles para
historial y análisis, pero no son criterios competitivos. El ranking de temporada solo usa Flash
Points acumulados.

## 1. Flash clásico (`flash`)

### Contrato recomendado

- **Inicio:** al confirmar el inicio del desafío —en el shell competitivo, después de la cuenta
  atrás— se crea o recupera el único intento. Ver la introducción no lo consume.
- **Duración:** un `timeLimit` por pregunta. No se recomienda inferir un límite total adicional a
  partir de la suma de esos tiempos.
- **Agotamiento del tiempo:** se registra una respuesta `unanswered` usando el borrador o los
  intentos disponibles cuando el formato lo permita; después se avanza a la siguiente pregunta.
  En la última pregunta, el flujo termina.
- **Finalización:** se completa al terminar la secuencia ordenada de preguntas, aunque todas las
  respuestas sean incorrectas o no contestadas y el total sea cero.
- **Estado global:** `inProgress` mientras quedan preguntas; `completed` al terminar la última.
- **Recuperación y abandono:** si la pregunta temporizada activa no tiene una recepción aceptada,
  se registra `unanswered` con cero puntos y se avanza; si era la última, se completa el flujo.
  Abandonar explícitamente sigue marcando `abandoned` y no permite reanudar ni repetir.
- **Checkpoint recomendado:** índice de pregunta, resultados aceptados, respuesta en curso,
  intentos de código, pistas reveladas, deadline de la pregunta y último estado de transición.
  No debe contener la solución privada.
- **Resultado y revisión:** mostrar Flash Points, desglose, tiempos y las respuestas del jugador
  junto con la solución cuando el intento sea terminal. No mostrar soluciones durante la partida.
- **Ranking:** aplica el comparador común de ranking por desafío.
- **Replay:** permitido en preview; oculto en competición con `roomContext`.

### Observación de implementación

`useGameSession` ya modela la secuencia, los timers por pregunta, el timeout y un snapshot. El shell
`Flash Pop` conecta la reanudación de sala; `FlashGameApp` independiente conserva el flujo de
preview. La persistencia autoritativa del checkpoint debe quedar para la fase de servidor.

## 2. Alfabeto (`alphabet`)

### Contrato recomendado

- **Inicio:** la partida empieza después de la cuenta atrás y consume el único intento competitivo.
  Cada letra se visita en el mismo intento; `Pasar` no crea una oportunidad nueva.
- **Duración:** un límite total de partida (`challenge.timeLimit`). No se recomienda añadir un
  timer independiente por letra mientras la mecánica siga siendo de vueltas.
- **Agotamiento del tiempo:** se finaliza la partida; las letras pendientes pasan a
  `unanswered`. El intento iniciado queda `completed`, aunque la puntuación sea cero.
- **Finalización:** termina cuando no quedan letras pendientes o al agotarse el tiempo total. Las
  letras pasadas se pueden volver a visitar mientras la partida siga activa.
- **Estado global:** `inProgress` durante las vueltas; `completed` al finalizar por resolución de
  letras o por tiempo. `correct`, `incorrect`, `passed` y `unanswered` son estados internos de cada
  letra.
- **Recuperación y abandono:** el deadline global sigue avanzando durante la interrupción. Si vence,
  las letras sin respuesta final pasan a `unanswered` y el intento se completa. Si aún no vence, la
  letra visible se cierra como un pase causado por recuperación y se avanza a la siguiente; este pase
  se audita con un motivo distinto del pase voluntario, sin crear `AttemptAnswer`. Se conservan las
  letras y vueltas ya registradas. Abandonar explícitamente sigue marcando `abandoned`.
- **Checkpoint recomendado:** fase, vuelta, índice actual, estado y respuesta de cada letra,
  `playedCount`, tiempo transcurrido, deadline total y `lastCorrectAt`. El reloj autoritativo no
  debe depender de `performance.now()` del cliente.
- **Resultado y ranking:** conceder puntos por cada acierto y aplicar el comparador común de ranking
  por desafío. `lastCorrectAt` y `completedAt` se conservan para revisión e historial, no para
  desempatar.
- **Revisión:** mostrar cada letra, la respuesta enviada y la solución después de una finalización
  o abandono iniciado. No revelar soluciones durante la partida.
- **Replay:** permitido en el preview independiente; oculto para el intento competitivo.

### Observación de implementación

El reducer ya distingue vueltas, letras pasadas, aciertos, errores y respuestas no contestadas, y
calcula `lastCorrectAt`. El componente independiente conserva replay; el shell competitivo debe
seguir aplicando la política de `roomContext`.

## 3. Supervivencia (`survival`)

### Contrato recomendado

- **Inicio:** la cuenta atrás termina y empieza la primera pregunta. En ese momento se crea o
  recupera el intento competitivo.
- **Duración:** un `timeLimit` por pregunta. Las vidas pertenecen al modo y no son un saldo de
  temporada ni una segunda recompensa.
- **Agotamiento del tiempo:** genera `unanswered` y aplica la pérdida de vida definida por el modo.
  Si quedan vidas, se continúa; si llega a cero, termina la partida. El timeout no es abandono.
- **Finalización:** termina al agotar todas las vidas o al resolver la última pregunta. `eliminated`
  y `survived` son feedback interno; ambos producen un intento global `completed` si el flujo llegó
  a su final reglamentario.
- **Estado global:** `inProgress` mientras se puede responder; `completed` al ser eliminado por la
  mecánica o al llegar al final.
- **Recuperación y abandono:** una pregunta temporizada activa sin recepción se registra
  `unanswered` y aplica la pérdida normal de vida. Si se agotan las vidas, el intento se completa
  con el feedback interno de eliminación; si no, avanza. Abandonar explícitamente es la única salida
  que marca `abandoned`.
- **Checkpoint recomendado:** índice de pregunta, resultados, vidas restantes, errores, estado de
  eliminación, intentos de código, borrador, pistas reveladas, deadline actual y transición
  pendiente. La vida no debe recalcularse solo desde datos enviados por el cliente.
- **Resultado y revisión:** mostrar Flash Points, preguntas alcanzadas, vidas restantes y desglose.
  Tras un intento iniciado se permiten las respuestas propias y correctas; durante la partida solo
  se muestra el feedback necesario para continuar.
- **Ranking:** aplica el comparador común de ranking por desafío.
- **Replay:** permitido en preview; oculto en competición después de `completed` o `abandoned`.

### Observación de implementación

`useSurvivalSession` ya representa vidas, errores, eliminación, supervivencia, timeout y snapshot.
La regla de descuento por tipo de resultado está centralizada en `survivalRules.ts`. La detección
automática de abandono y la validación autoritativa siguen pendientes.

## 4. Narrativa (`narrative`)

### Contrato recomendado

- **Inicio:** iniciar la experiencia crea el intento y comienza la secuencia narrativa. Las escenas
  introductorias forman parte del flujo, pero no son preguntas.
- **Duración:** cada pregunta tiene su propio `timeLimit`; las escenas no consumen ese timer. No se
  recomienda inventar un límite total para la historia si el contenido no lo define.
- **Agotamiento del tiempo:** registra `unanswered`, muestra la reacción temporal correspondiente y
  continúa a la siguiente escena o pregunta. No transforma automáticamente el intento en abandono.
- **Finalización:** después del último paso de la secuencia, incluido el epílogo cuando exista, el
  flujo pasa a resultados. El intento queda `completed` aunque no haya aciertos.
- **Estado global:** `inProgress` durante escenas, preguntas y transiciones; `completed` al terminar
  la secuencia; `abandoned` solo por abandono explícito.
  Reacciones como `correct`, `incorrect` o `timeout` son feedback narrativo interno.
- **Recuperación y abandono:** una pregunta temporizada activa sin recepción se registra
  `unanswered`, muestra la reacción de timeout si la narrativa la define y continúa al siguiente
  paso. Una escena no temporizada, transición confirmada o epílogo se reanuda desde el último paso
  aceptado. Abandonar explícitamente termina la experiencia como `abandoned`.
- **Checkpoint recomendado:** índice del paso, fase, resultados, respuesta en curso, pistas o
  intentos específicos del formato, deadline de la pregunta y transición pendiente. El checkpoint
  debe permitir volver a la misma escena o pregunta sin repetir respuestas ya registradas.
- **Resultado y revisión:** mostrar puntuación, precisión, tiempos y resumen de respuestas. Después de
  una finalización o abandono iniciado, permitir consultar las respuestas propias y las soluciones.
  Las soluciones no se muestran mientras la historia sigue activa.
- **Ranking:** aplica el comparador común de ranking por desafío.
- **Replay:** permitido en preview; oculto en competición con `roomContext`.

### Observación de implementación

`useNarrativeSession` ya conserva la secuencia, escenas, respuestas, timeout y fases de resultado y
revisión. El snapshot actual no conserva todos los borradores y referencias temporales del formato;
la siguiente implementación de checkpoints debe completarlo antes de prometer recuperación completa
con la sesión original.

## 5. La Pirámide (`pyramid`)

### Contrato recomendado

- **Inicio:** iniciar el ascenso crea o recupera el intento. Cada nivel tiene un briefing y después
  una pregunta; cambiar de briefing no consume otro intento.
- **Duración:** un `timeLimit` por nivel, limitado por la ventana o deadline aplicable al desafío.
  El cierre de la publicación sin intento sigue siendo `expired`; no debe confundirse con el
  timeout de un nivel ya iniciado.
- **Agotamiento del tiempo:** registra el nivel como no superado y finaliza La Pirámide según su
  regla actual. El resultado temporal es `unanswered`, pero el intento global es `completed` porque
  el modo llegó a su final reglamentario.
- **Finalización:** hay dos resultados internos: `summit` cuando se completan correctamente los
  siete niveles y `failed` cuando se falla un nivel que termina el modo. Ambos producen
  `completed`; `failed` nunca se proyecta como `notCompleted`.
- **Estado global:** `inProgress` mientras el jugador está en briefing o resolviendo un nivel;
  `completed` después de cima o fallo de nivel; `abandoned` solo por abandono explícito.
- **Recuperación y abandono:** un briefing previo al inicio del temporizador se reanuda. Si el nivel
  temporizado ya se preparó y no existe recepción, se registra como `unanswered`, no se supera y La
  Pirámide termina con resultado interno `failed` y estado global `completed`; no hay vuelta a ese
  nivel. Abandonar explícitamente marca `abandoned`.
- **Checkpoint recomendado:** reutilizar `PyramidAttemptRecord`: nivel actual, resultados,
  borrador, códigos enviados, intentos incorrectos, pistas reveladas, `levelStartedAt`, deadline,
  fase y versión del contenido. Al finalizar, el snapshot deja de ser reanudable.
- **Resultado y feedback:** mostrar Flash Points y niveles alcanzados. “Cima conquistada” se reserva
  para `summit`; “Ascenso terminado” describe `failed` sin convertirlo en un fallo global. Tras un
  intento terminal iniciado, mostrar respuestas propias y soluciones.
- **Ranking:** aplica el comparador común de ranking por desafío; `levelsCleared` y `outcome` son
  métricas del modo, no criterios adicionales de desempate.
- **Replay:** el preview independiente conserva replay; con `roomContext` el resultado y la revisión
  solo ofrecen navegación y consulta.

### Observación de implementación

`completePyramidAttempt` y `parsePyramidAttempt` ya conservan `status: "completed"`, la puntuación,
los niveles alcanzados y `outcome`. La proyección social también trata ambos resultados internos como
`completed`. El abandono automático todavía no se implementa.

## Matriz de estados y consulta

| Situación                       | Estado global                | ¿Se reanuda?              | ¿Se repite?       | ¿Hay resultado/revisión?        |
| ------------------------------- | ---------------------------- | ------------------------- | ----------------- | ------------------------------- |
| Publicación cerrada sin iniciar | `expired` en la publicación  | No aplica                 | No                | No hay resultado propio         |
| Intento activo                  | `inProgress`                 | Sí, tras resolver la interacción abierta por modo | No crea otro | No se muestran soluciones |
| Final reglamentario del modo    | `completed`                  | No                        | No en competición | Sí, si se inició                |
| Abandono tras iniciar           | `abandoned` / `notCompleted` | No                        | No                | Sí, con respuestas disponibles  |
| Intento invalidado              | `invalidated`                | No                        | No                | Acceso administrativo pendiente |
| Preview sin sala                | Estado local del preview     | Sí mientras exista sesión | Sí                | Sí, como exploración            |

## Pendientes que no debe resolver este documento

- Definir el intervalo de heartbeat, lease y periodo de gracia para abandono automático.
- Implementar persistencia y validación autoritativa de checkpoints, deadlines, respuestas y puntos,
  incluida la resolución transaccional de recuperación aquí definida.
- Resolver la política de consulta para intentos `invalidated`.
- Convertir cada recomendación en pruebas de contrato por modo antes de cambiar la UI o el backend.
