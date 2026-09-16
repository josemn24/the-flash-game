# Requisitos funcionales de dominio

## Estado y criterio de lectura

Este documento sintetiza el comportamiento funcional que puede inferirse del repositorio y las
decisiones de dominio ya aprobadas. Es la fuente de verdad funcional para las fases posteriores,
junto con [`../../decisions/decisions.md`](../../decisions/decisions.md). Cuando una regla aún no está cerrada se
marca como cuestión abierta; no se deduce una solución técnica a partir de ella.

Última actualización: 2026-09-16.

Las etiquetas indican la relación con la implementación actual:

- **Objetivo confirmado**: regla funcional que debe regir el producto.
- **Implementado/mock**: comportamiento visible hoy, que puede ser provisional.
- **Previsto**: capacidad claramente modelada o documentada, pero no completa en la UI actual.

## 1. Propósito del producto

The Flash es un juego de desafíos asíncronos para grupos privados. Los miembros de una sala
compiten durante una temporada activa resolviendo desafíos programados, reciben Flash Points según
su resultado y comparan su posición en el ranking del desafío y en el ranking de la temporada.

El producto combina distintos formatos de preguntas y experiencias de juego. La práctica aislada
de formatos sirve para explorar la interacción, pero no produce competición, Flash Points, historial
ni ranking.

## 2. Actores

- **Jugador autenticado**: persona con perfil global que puede pertenecer a varias salas.
- **Miembro de sala**: jugador con una membresía `owner`, `admin`, `member` o `spectator`.
- **Propietario y administrador**: miembros con responsabilidades de gestión de la sala, además de
  competir si su rol es competitivo.
- **Espectador**: miembro que puede consultar la sala y sus rankings, pero no iniciar desafíos
  competitivos.
- **Superadministrador**: actor global para inspección, edición y pruebas internas; sus pruebas no
  participan en la competición.
- **Editor o autor de contenido**: actor previsto para preparar y publicar desafíos y preguntas.
- **Sistema**: controla disponibilidad, duración, evaluación, cierre y acreditación de resultados.

S01–S11 ya implementan autenticación, provisioning de jugador, el recorrido competitivo Flash
persistido sobre Supabase local, la creación inicial de salas, la activación de temporadas y la
publicación editorial mínima desde un portal privado. La gestión posterior de miembros no está
implementada en la interfaz pública; en la beta cerrada se reservará a un portal privado de
superadministración.

### Alcance operativo de la beta cerrada

La primera versión pública no ofrecerá crear salas privadas, crear/aceptar/revocar invitaciones ni
preparar o activar temporadas. La gestión que se habilite se realizará desde una interfaz interna
protegida de superadmin. Para reunir al grupo, el superadmin añadirá directamente usuarios
autenticados a una sala o reactivará su membresía con un rol permitido, sin flujo de invitación ni
aceptación de enlace.

La publicación mínima de contenido, la programación de desafíos y la ejecución del calendario son
capacidades previstas para ese portal interno, si se incluyen en el alcance operativo de la beta.
No son funciones de la UI pública.

## 3. Áreas funcionales

1. Identidad y perfil global.
2. Salas privadas, membresías e invitaciones.
3. Temporadas y calendario de desafíos.
4. Catálogo, versiones y publicación de contenido.
5. Juego de desafíos y reanudación.
6. Evaluación, resultado y acreditación de Flash Points.
7. Rankings: únicamente desafío y temporada.
8. Historial de desafíos cerrados y actividad social acotada.
9. Exploración y práctica de formatos aislados.
10. Operación interna, pruebas y moderación.

## 4. Conceptos principales del dominio

- **Jugador / identidad**: la identidad de acceso y el perfil visible son conceptos separados. El
  nombre visible no tiene que ser único; el avatar y el nombre son globales.
- **Sala**: grupo privado en el que se publica la competición.
- **Membresía**: relación de un jugador con una sala, su rol y su estado. Salir, ser expulsado o
  bloquearse no borra automáticamente resultados previos.
- **Invitación**: mecanismo previsto para incorporar jugadores a una sala privada; puede revocarse
  y expirar.
- **Temporada**: periodo competitivo propio de una sala. Tiene un ranking y comienza con cero
  Flash Points.
- **Desafío**: experiencia jugable compuesta por una definición, una versión y sus elementos en un
  orden determinado.
- **Publicación o desafío programado**: una versión de desafío disponible dentro de una sala y una
  temporada, con una ventana de apertura y cierre.
- **Pregunta y formato**: una pregunta versionada con una interacción concreta. El catálogo actual
  contiene 31 formatos de pregunta y cinco modos de juego (`flash`, `alphabet`, `survival`,
  `narrative` y `pyramid`).
- **Intento**: ejecución de un jugador sobre un desafío programado. Un intento competitivo conserva
  su ciclo de vida, respuestas, resultado y puntuación.
- **Ciclo de vida del intento**: mientras un desafío está disponible puede no existir intento; al
  iniciarse pasa a `inProgress`; si el jugador llega al final pasa a `completed`, incluso con cero
  Flash Points; si se abandona antes de terminar pasa a `notCompleted` con causa `abandoned`. Si la
  publicación se cierra antes de que el jugador lo inicie, la publicación se proyecta como
  `expired`, sin crear un intento.
- **Respuesta**: respuesta final de un elemento del desafío, con su evaluación, tiempo y detalles.
- **Flash Points**: puntos que obtiene el jugador al jugar un desafío. El resultado del desafío se
  acredita una vez y se suma al total de Flash Points de la temporada activa de esa sala. No son una
  segunda moneda ni XP separada. El icono `⚡` es su representación visual equivalente y no
  identifica otro saldo.
- **Ranking de desafío**: clasificación de los jugadores que completaron ese desafío competitivo.
- **Ranking de temporada**: clasificación de la sala por el total de Flash Points acreditados en la
  temporada.
- **Historial**: consulta de publicaciones cerradas y sus resultados; conserva el contexto de la
  versión publicada.
- **Práctica o preview**: exploración sin intento competitivo, puntos, historial ni ranking.

## 5. Requisitos funcionales

### 5.1 Identidad y perfil

- **FR-01 —** El producto debe requerir una cuenta para participar en competición; no hay invitados
  competitivos inicialmente. (**Objetivo confirmado**)
- **FR-02 —** El jugador debe disponer de un nombre visible y avatar globales, editables y visibles
  donde corresponda. (**Objetivo confirmado**)
- **FR-03 —** El jugador debe poder consultar sus salas activas y entrar en cada sala a la que
  pertenece. (**Previsto**; hoy se alimenta con mocks.)

### 5.2 Salas y membresías

- **FR-04 —** Las salas son privadas y un jugador puede pertenecer a varias.
  (**Objetivo confirmado**)
- **FR-05 —** La sala debe mostrar su temporada activa, el desafío disponible o su ausencia, el
  total de Flash Points y la posición del jugador cuando exista. (**Implementado/mock**)
- **FR-06 —** `owner`, `admin` y `member` pueden competir; `spectator` solo puede consultar.
  (**Objetivo confirmado**)
- **FR-07 —** Los responsables deben poder gestionar invitaciones, membresías y las reglas de
  propiedad definidas para la sala. (**Previsto**; en la beta estas operaciones se ejecutarán desde
  el portal privado de superadmin y no desde la UI pública.)
- **FR-08 —** Reunirse de nuevo en una sala debe conservar el historial previo del jugador.
  (**Objetivo confirmado**)

### 5.3 Temporadas y publicaciones

- **FR-09 —** Cada sala organiza sus desafíos dentro de temporadas con inicio y fin definidos.
- **FR-10 —** Una temporada activa puede ofrecer publicaciones futuras y debe tener como máximo una
  temporada activa a la vez.
- **FR-11 —** Cada publicación debe indicar cuándo se abre y cuándo se cierra. Solo puede jugarse
  competitivamente dentro de esa ventana, con la excepción de un intento ya iniciado que aún esté
  dentro de su plazo individual.
- **FR-12 —** Los desafíos cerrados deben quedar disponibles en el historial, incluidos los que no
  haya jugado nadie. Las publicaciones canceladas no contribuyen al ranking ordinario.
- **FR-13 —** La interfaz debe distinguir, como mínimo, disponible, en progreso, completado y no
  completado. (**Implementado/mock**)

### 5.4 Contenido y formatos

- **FR-14 —** Un desafío debe poder componerse de preguntas ordenadas y con puntuación configurada.
  El máximo normalizado del desafío es 100 puntos.
- **FR-15 —** El contenido publicado debe conservar la versión con la que se jugó; una versión
  publicada no se modifica silenciosamente.
- **FR-16 —** El jugador debe recibir la interacción específica de cada formato: selección, texto,
  ordenación, memoria, recorrido, lógica u otra mecánica del catálogo. (**Implementado/mock**)
- **FR-17 —** Los ejemplos de formatos pueden repetirse libremente como exploración, sin crear
  intentos competitivos. (**Objetivo confirmado**)

### 5.5 Juego e intentos

- **FR-18 —** Un jugador competitivo puede iniciar el desafío de su sala solo si tiene una
  membresía competitiva activa y la publicación está disponible.
- **FR-19 —** El inicio oficial consume el único intento competitivo del jugador para ese desafío.
  (**Objetivo confirmado para la primera producción**)
- **FR-20 —** Mientras el intento conserve el estado `inProgress`, una reapertura con la sesión
  controladora autorizada debe reanudar el mismo intento y no crear otro. El servidor debe resolver
  antes cualquier interacción temporal abierta según el modo; cerrar una pestaña o perder conexión
  no marca por sí solo `abandoned`. Una segunda sesión se bloquea y un abandono explícito sí es
  terminal.
- **FR-21 —** El desafío debe aplicar el tiempo total, los tiempos por pregunta y las reglas de
  finalización propias del modo. El agotamiento del tiempo de una pregunta o ronda se registra como
  una respuesta no contestada o como el estado equivalente definido por el modo; no implica por sí
  mismo que el intento completo haya sido superado o fallado. (**Implementado/mock**; el detalle por
  modo está consolidado en [`mode-contracts.md`](mode-contracts.md), con persistencia
  autoritativa aún pendiente.)
- **FR-22 —** Tras un intento competitivo terminal (`completed`, `abandoned` o `invalidated`) el
  jugador puede consultar el resultado, el ranking y la revisión de respuestas cuando existan. Si
  el intento se inició, la revisión puede mostrar las respuestas enviadas y las respuestas correctas.
  Si la publicación expiró antes de iniciarse, no existe resultado ni revisión propios. No puede
  repetir ni practicar ese mismo desafío competitivo.
- **FR-23 —** Los resets de intento solo están previstos para herramientas internas de desarrollo y
  QA, nunca para la interfaz de producción.

### 5.6 Resultados y Flash Points

- **FR-24 —** El resultado debe mostrar, cuando aplique, puntuación, precisión, tiempo y desglose de
  respuestas correctas, parciales, incorrectas y no contestadas. (**Implementado/mock**)
- **FR-25 —** La evaluación debe producir una puntuación entera no negativa entre 0 y 100 para el
  desafío.
- **FR-25a —** Completar un desafío con cero Flash Points es un resultado válido y no se considera
  un intento no completado.
- **FR-26 —** La puntuación acreditada del desafío se denomina **Flash Points**. Se suma una sola vez
  al total de la temporada activa de la sala después de jugar el desafío.
- **FR-27 —** No existe un valor funcional separado de XP, rayos acumulados, energía, vidas como
  saldo, monedas, niveles, hitos, metas de temporada ni otra recompensa que compita con Flash
  Points. Una temporada no tiene barra, denominador ni progreso funcional independiente.
- **FR-28 —** Una corrección administrativa no debe borrar la respuesta original ni cambiar de forma
  silenciosa los puntos ya acreditados.

### 5.7 Rankings

- **FR-29 —** El producto tiene exactamente dos tipos de ranking: **ranking por desafío** y **ranking
  por temporada**. No hay ranking global, ranking acumulado de sala ni otros rankings funcionales.
- **FR-30 —** El ranking por desafío incluye a los jugadores con un intento competitivo completado
  para esa publicación, incluidos los resultados con cero Flash Points; los intentos fantasma, de
  prueba, invalidados y las publicaciones canceladas quedan fuera.
- **FR-31 —** El ranking por temporada ordena por el total de Flash Points acreditados en esa
  temporada de la sala.
- **FR-32 —** En el ranking por desafío, los cinco modos actuales ordenan por más Flash Points,
  menor duración efectiva del intento —suma de `AttemptAnswer.timeUsedMs`, incluidas respuestas
  temporizadas y no contestadas— y `startedAt` más antiguo. La cuenta atrás, las esperas externas y
  la diferencia entre `completedAt` y `startedAt` no forman parte de esa duración. Si los tres
  criterios coinciden, se comparte posición con ranking de competición (`1, 1, 3`). Un modo futuro
  podrá sustituir este comparador mediante una decisión específica. El ranking de temporada solo
  ordena por Flash Points acumulados.
- **FR-33 —** Los miembros y espectadores pueden consultar los rankings de su sala; solo los roles
  competitivos pueden generar resultados nuevos.

### 5.8 Historial y experiencia social

- **FR-34 —** El historial debe permitir consultar desafíos cerrados, participantes y ranking
  histórico con el contenido de la versión publicada. (**Implementado/mock**)
- **FR-35 —** El conteo de participantes representa jugadores competitivos distintos que iniciaron el
  desafío; los jugadores fantasma quedan excluidos.
- **FR-36 —** La sala puede mostrar actividad social resumida, pero un feed completo y notificaciones
  no forman parte del alcance inicial. (**Previsto / aplazado**)

### 5.9 Operación interna

- **FR-37 —** El superadministrador puede inspeccionar, editar o probar contenido y estados sin
  aparecer como miembro competitivo de una sala.
- **FR-38 —** Los intentos de prueba o fantasma no consumen el intento oficial ni conceden Flash
  Points, historial o posiciones en rankings.
- **FR-39 —** Durante la beta cerrada, el superadmin puede crear salas, provisionar o reactivar
  membresías directamente y preparar la operación de temporadas, publicaciones y calendario desde
  un portal privado. Estas acciones deben autorizarse en servidor y auditarse cuando afecten a una
  sala; la UI pública no ofrece el flujo equivalente.

## 6. Reglas de negocio conocidas

- Las salas son privadas y la competición está delimitada por sala y temporada.
- Solo `owner`, `admin` y `member` compiten. `spectator` consulta, pero no juega en competitivo.
- Una publicación tiene apertura inclusiva y cierre exclusivo.
- Mientras la publicación está disponible, no jugar no crea un intento ni concede Flash Points. Si
  la publicación termina antes de iniciar el desafío, el desafío se proyecta como `expired`: el
  jugador no ha jugado, no consume un intento y no genera resultado.
- Para producción inicial hay un único intento competitivo por jugador y desafío programado.
- Un intento que sigue `inProgress` puede reanudarse con la sesión controladora; repetir el desafío
  no crea una segunda oportunidad competitiva. Antes de reanudar, el servidor consume la
  interacción abierta según las reglas del modo, sin volver a entregar contenido ya preparado.
- Cerrar la pestaña o perder la conexión no es abandono fiable. Abandonar explícitamente un intento
  lo termina como `abandoned`, se proyecta como `notCompleted` y consume el intento único.
- Llegar al final del flujo convierte el intento en `completed` aunque el resultado sea de cero
  Flash Points. No existe un estado funcional global de desafío “superado” o “fallido”.
- La Pirámide finaliza reglamentariamente cuando el jugador completa sus siete niveles o cuando
  falla un nivel que termina el modo. En ambos casos el intento se registra como `completed`,
  aunque el resultado tenga cero Flash Points o no se hayan jugado los siete niveles. La interfaz
  puede mostrar un mensaje de desafío superado únicamente cuando se resuelven correctamente los
  siete niveles; ese mensaje es feedback específico del modo, no una propiedad funcional global ni
  un criterio adicional de ranking.
- El resultado de un desafío es un entero de 0 a 100 y nunca negativo. Cada modo puede definir
  penalizaciones por errores, intentos o tiempo: estas reducen la puntuación disponible de la
  pregunta o prueba, pero su resultado final se limita a un mínimo de cero. La puntuación acumulada
  del desafío tampoco puede ser negativa.
- El crédito parcial y las reglas de tiempo dependen del modo. Los cinco modos actuales comparten
  provisionalmente el comparador del ranking por desafío: más Flash Points, menor duración efectiva
  y `startedAt` más antiguo, con posiciones compartidas.
- Los Flash Points obtenidos al jugar se suman al total de la temporada activa de esa sala; `⚡`
  puede representar ese valor en la interfaz.
- La temporada no tiene niveles, hitos, metas, desbloqueos ni recompensas funcionales; el total
  es un número acumulado sin truncamiento ni denominador.
- Solo existen los rankings por desafío y por temporada.
- Los empates del ranking por desafío comparten posición tras aplicar el comparador común. La hora
  absoluta de finalización y las métricas específicas del modo se conservan para revisión, historial
  y métricas, pero no alteran el ranking.
- El contenido publicado y el contexto histórico deben permanecer estables para quienes ya jugaron.
- Los resultados válidos permanecen aunque el jugador abandone la sala; un intento fraudulento debe
  invalidarse explícitamente. `invalidated` no se usa para resolver una interrupción o recuperación.
- Las pruebas de superadministrador son no competitivas.

## 7. Estados y ciclos de vida observados

### Intento y experiencia de juego

- Estado de dominio del intento iniciado: `in_progress`, `completed`, `abandoned` o `invalidated`.
- No existe un resultado global de intento `passed`/`failed` en el producto. Un modo puede mostrar
  feedback propio, como la cima de La Pirámide tras completar sus siete niveles, pero el ciclo de
  vida competitivo solo distingue si el intento sigue en progreso o cómo terminó.
- Estados visibles en el juego: introducción, cuenta atrás, jugando, transición, resultado y
  revisión. Algunos modos añaden briefing, escenas, feedback o epílogo.
- Estado visible del desafío en sala: disponible, en progreso, completado, no completado o expirado.
- `expired` es un estado visible de la publicación para ese jugador: la publicación terminó antes
  de que iniciara su intento. No es un estado de un intento creado, no es abandono y no produce
  respuestas ni puntos.
- `abandoned` significa que el jugador inició el intento, pero lo dejó sin llegar al final. Se
  conserva la información que haya enviado y puede revisarla junto con la respuesta correcta. Solo
  una operación explícita lo establece en esta fase; una interrupción técnica mantiene el intento
  recuperable y se resuelve por modo.
- Estado de respuesta observado: correcta, parcial, incorrecta, no contestada o timeout.

### Publicación, temporada y membresía

- Publicación: `scheduled`, `open`, `closed` o `cancelled`.
- Temporada: `draft`, `scheduled`, `active`, `finished` o `cancelled`.
- Membresía: `active`, `left`, `removed` o `banned`.
- Contenido: `draft`, `published` o `archived`.

La implementación local usa en algunos puntos un booleano `completed` y un indicador separado de
timeout; el ciclo de vida funcional de referencia es el anterior. Los nombres `passed`/`failed` que
aún aparecen en tipos y lógica de algunos modos son internos y no representan estados funcionales
del producto. La disponibilidad de la publicación (`available`, `locked`, `expired`) se mantiene
separada del ciclo de vida del intento (`in_progress`, `completed`, `abandoned`, `invalidated`).

### Comportamiento recomendado pendiente de implementación

- Al iniciar un desafío competitivo se debe crear o recuperar un único intento autoritativo en
  `in_progress`.
- El cliente debe enviar checkpoints de progreso y señales periódicas de actividad mientras el
  intento siga abierto.
- El abandono voluntario debe disponer de una operación explícita e idempotente que cambie el
  intento a `abandoned`, conserve las respuestas ya enviadas y elimine el snapshot recuperable.
- `pagehide`, `visibilitychange` u `offline` pueden enviar un aviso inmediato, pero son señales
  auxiliares y no garantizan que el navegador o la red permitan completar la notificación.
- Al recuperar, el servidor debe reconciliar una recepción ya persistida y, si no existe, cerrar
  atómicamente la interacción preparada como consumida con la consecuencia definida por el modo.
  Nunca debe volver a entregar esa unidad ni concederle un nuevo reloj.
- Una política posterior podrá cerrar por inactividad tras el límite acordado; hasta entonces la
  falta de actividad no cambia por sí sola el intento a `abandoned`.
- La duración del heartbeat, el lease y el posible periodo de gracia aún deben concretarse antes de
  implementar este comportamiento.

## 8. Permisos y restricciones conocidas

- Una persona sin cuenta puede explorar ejemplos o previews, pero no participar en competición.
- Solo una membresía activa permite leer una sala. Una membresía competitiva activa permite iniciar
  un desafío; la membresía de espectador no.
- `owner`, `admin` y `member` pueden iniciar y completar desafíos competitivos disponibles.
- `spectator` puede leer metadatos, historial y ambos rankings, pero no debe recibir el contenido
  jugable de un desafío competitivo.
- El superadministrador actúa fuera de la competición normal y sus resultados se excluyen.
- El contenido publicado, los resultados y las correcciones requieren controles de autorización
  acordes al rol; la UI actual todavía no implementa esos flujos de escritura.

## 9. Supuestos confirmados

- La aclaración del producto sustituye la terminología anterior de “rayos/XP”: **Flash Points** es
  la puntuación que se obtiene al jugar un desafío y el total de la temporada activa de la sala.
- Completar el flujo de un desafío determina el estado `completed` aunque la puntuación sea cero;
  la puntuación no determina si el intento está completado.
- Abandonar explícitamente un intento iniciado equivale a `abandoned` y se muestra como
  `notCompleted`; cerrar la pestaña o perder conexión activa la recuperación autoritativa por modo.
- `expired` se reserva para una publicación que termina antes de que el jugador inicie su intento;
  no equivale a `abandoned`.
- Los modos pueden definir penalizaciones por errores, intentos o tiempo. Estas reducen la puntuación
  disponible de la pregunta o prueba, pero el resultado final de esa unidad se limita a cero; ni la
  puntuación de una pregunta ni el total del desafío pueden ser negativos.
- En Alfabeto cada respuesta correcta concede puntos. `lastCorrectAt` y `completedAt` se conservan
  para revisión e historial, pero no son criterios del ranking común.
- Una pregunta, nivel o letra preparada por el servidor se considera consumida aunque se pierda su
  respuesta HTTP. Si no hay recepción aceptada, la recuperación la resuelve por modo; en Alfabeto,
  el pase por interrupción se conserva como motivo auditable distinto del pase voluntario.
- El feedback de “desafío superado” de La Pirámide al completar sus siete niveles es específico de
  la interfaz del modo y no crea un estado global `passed`.
- `⚡` y “Flash Points” son equivalentes en la interfaz. El texto completo se conserva en títulos
  explicativos y etiquetas accesibles; la presentación compacta puede mostrar `N ⚡`.
- Solo hay dos rankings funcionales: uno por desafío y otro por temporada.
- No existen niveles ni hitos de temporada. Los niveles de La Pirámide y las vidas de
  Supervivencia son reglas internas de esos desafíos, no saldos ni progresión social.
- `roomContext` delimita la competición: sus desafíos no ofrecen replay tras un intento terminal;
  los previews sin sala sí pueden conservar replay.
- Las decisiones generales de `docs/decisions/decisions.md` siguen vigentes cuando no contradicen lo
  anterior: competición asíncrona, salas privadas, temporadas por sala, perfiles globales,
  contenido versionado y evaluación autoritativa.
- Los ejemplos de formatos y los datos simulados no demuestran por sí solos que una regla esté lista
  para producción.

## 10. Cuestiones todavía abiertas

Estas cuestiones no cambian las decisiones confirmadas anteriores:

- Duración exacta, distribución de puntos, checkpoints adicionales, feedback y exposición de
  soluciones de cada modo que no estén fijados en `mode-contracts.md`.
- Si algún modo futuro podrá permitir más de un intento oficial y cómo se acreditaría; el valor
  inicial confirmado sigue siendo uno.
- El detalle de interfaz, límites de frecuencia y notificaciones de invitaciones; las reglas de
  roles, TTL, usos, revocación, reincorporación y almacenamiento del token ya están fijadas.
- Políticas de recuperación o eliminación de salas, retención de eventos, moderación y anonimización.
- Flujo de correcciones administrativas, política posterior de toma de control de sesión y límites
  de frecuencia.
- Alcance exacto de la actividad social, notificaciones y formatos/challenges que entrarán en la
  primera validación con usuarios.

## 11. Inconsistencias entre implementación, documentación y objetivo

- **Resuelta (2026-09-13):** la UI competitiva usa el estado del intento para mostrar `Jugar`,
  `Continuar` o `Ver resultado`, bloquea la entrada a desafíos terminales y oculta replay en el
  resultado y la revisión. Los previews sin `roomContext` conservan replay.
- **Parcialmente implementada (2026-09-13, sesión de prototipo):** el proveedor conserva snapshots
  de los modos competitivos mientras el intento está en progreso y los rehidrata al volver al
  desafío. Todavía no detecta ni registra el cierre de pestaña, la pérdida de conexión o el
  abandono voluntario, y el estado en memoria se pierde al recargar o cerrar la pestaña. La
  recuperación actual no sustituye la persistencia ni la validación de servidor futuras.
- **Resuelta (2026-09-13, prototipo):** la finalización competitiva es first-completion-wins para
  `(roomId, challengeId)` y la aplicación local de resultados es idempotente. La misma regla deberá
  validarse en servidor cuando exista backend.
- **Resuelta (2026-09-13):** un resultado de cero Flash Points sigue siendo `completed` si el jugador
  llegó al final del flujo y se incluye en el ranking del desafío.
- **Resuelta (2026-09-13, precisada 2026-09-15):** `abandoned` se reserva para un intento iniciado
  que el jugador abandona explícitamente; `expired` se reserva para una publicación que termina
  antes de que el jugador empiece. Una interrupción se recupera por modo y no equivale a ninguno.
- **Resuelta (2026-09-13):** `expired` ya no forma parte de `AttemptStatus`. El mock deriva la
  expiración a partir de la ventana de la publicación cuando no existe un intento; la interfaz la
  muestra como desafío cerrado sin resultado ni revisión propios.
- **Resuelta (2026-09-13):** el motor y las pruebas de scoring conservan las penalizaciones por
  error, intentos o tiempo, pero normalizan el resultado de cada pregunta o prueba a un mínimo de
  cero antes de agregarlo al desafío. El total mantiene además una protección defensiva no negativa.
- **Resuelta (2026-09-14):** los cinco modos actuales comparten el comparador del ranking por
  desafío: más Flash Points, menor duración efectiva —suma de `AttemptAnswer.timeUsedMs`— y
  `startedAt` más antiguo, con posiciones compartidas. El ranking de temporada solo usa Flash
  Points acumulados.
- **Pendiente de implementar:** el abandono automático de intentos. El comportamiento objetivo
  requiere abandono explícito idempotente, checkpoints/heartbeat y cierre autoritativo tras perder
  actividad; los eventos del navegador solo deben actuar como avisos auxiliares. El intervalo y el
  periodo de gracia aún no están definidos.
- **Resuelta (2026-09-13):** La Pirámide conserva `summit` y `failed` como resultado interno del
  modo. Ambos se proyectan como `completed` cuando la partida llega a su final reglamentario;
  `failed` indica únicamente que terminó antes de alcanzar la cima y no equivale a `notCompleted`.
- El modelo genérico de intento aún conserva nombres legacy como `passed`/`failed` en algunas
  estructuras; no deben interpretarse como estados funcionales globales del desafío.
- Los documentos históricos de contexto pueden conservar terminología o flujos anteriores; no son requisitos vigentes.
- El detalle de sala puede mostrar el CTA `Jugar` a un espectador, aunque el acceso jugable lo
  rechaza. La presentación y la autorización deben alinearse.
- El cliente actual recibe soluciones y calcula parte del resultado localmente; el requisito de
  referencia exige preservar el contenido privado y que la evaluación sea autoritativa.
- Perfil, invitaciones, notificaciones y ajustes presentan controles visuales o locales, pero no
  tienen persistencia ni acciones completas.
- El lobby y algunos datos sociales usan valores hardcodeados de demo; no representan todavía una
  sala, temporada o ranking persistidos.
- El ranking completo muestra filas no enlazadas al detalle de miembro, aunque existe la ruta de
  detalle y el ranking diario sí expone esos enlaces.
- El modelo de respuestas contempla `timeout`, mientras que parte del juego legacy lo representa
  con un estado distinto y `lastTimedOut`; debe unificarse antes de cerrar el contrato de modo. El
  timeout de una pregunta no debe confundirse con `expired` del desafío ni con `abandoned` del intento.
- El catálogo canónico del código contiene 31 formatos y los mocks contienen siete desafíos definidos
  y seis programados, mientras que documentos antiguos describen 25 formatos o solo dos desafíos.
  Esos documentos antiguos deben tratarse como históricos.
- El informe histórico [`../../archive/redesign/qa-fase-4.md`](../../archive/redesign/qa-fase-4.md) conserva cifras
  de una migración anterior; el estado vigente de QA está en [`../qa.md`](../qa.md).

## Fuera de alcance de esta fase

Este documento no define base de datos, tablas, APIs, endpoints, backend, ORM, autenticación
técnica, almacenamiento ni arquitectura detallada. Esas decisiones solo deben abordarse en la fase
correspondiente y respetando los requisitos anteriores.

## Evidencias principales

- `app/`, `components/`, `features/`, `types/` y `data/mock/`: pantallas, navegación, interacciones,
  tipos y fixtures actuales.
- [`../../decisions/decisions.md`](../../decisions/decisions.md), [`../../decisions/open-questions.md`](../../decisions/open-questions.md),
  [`type-model.md`](type-model.md), [`mock-data.md`](mock-data.md) y
  [`data-access.md`](data-access.md): decisiones y modelo funcional aprobados.
- [`../../archive/redesign/README.md`](../../archive/redesign/README.md), [`../../archive/redesign/01-product-vision.md`](../../archive/redesign/01-product-vision.md)
  y [`../../archive/redesign/03-design-system.md`](../../archive/redesign/03-design-system.md): intención de producto y estados
  visuales, con la terminología de rayos/XP y la progresión de temporada reconciliadas en esta
  fase.
- [`../../content/formatos-de-juego.md`](../../content/formatos-de-juego.md) y
  [`../../archive/the-flash-poc.md`](../../archive/the-flash-poc.md): contenido vigente y contexto
  anterior; cuando el archivo contradice el modelo canónico se considera histórico.
