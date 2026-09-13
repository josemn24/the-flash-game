# Requisitos funcionales de dominio

## Estado y criterio de lectura

Este documento sintetiza el comportamiento funcional que puede inferirse del repositorio y las
decisiones de dominio ya aprobadas. Es la fuente de verdad funcional para las fases posteriores,
junto con [`domain/decisions.md`](domain/decisions.md). Cuando una regla aún no está cerrada se
marca como cuestión abierta; no se deduce una solución técnica a partir de ella.

Última actualización: 2026-09-13.

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

La implementación actual representa principalmente un jugador fijo y datos simulados; la
autenticación y la gestión real de actores todavía no están implementadas.

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
  propiedad definidas para la sala. (**Previsto**; la UI actual muestra acciones deshabilitadas.)
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
- **FR-20 —** Una interrupción o reapertura debe reanudar el mismo intento en progreso; no debe crear
  otro.
- **FR-21 —** El desafío debe aplicar el tiempo total, los tiempos por pregunta y las reglas de
  finalización propias del modo. El sistema debe manejar respuestas, errores, respuestas parciales
  y expiración cuando el formato lo permita. (**Implementado/mock**, con contratos por modo aún
  incompletos.)
- **FR-22 —** Tras un intento competitivo terminal (`completed`, `expired`, `abandoned` o
  `invalidated`) el jugador puede consultar el resultado, el ranking y la revisión de respuestas
  cuando existan, pero no repetir ni practicar ese mismo desafío competitivo.
- **FR-23 —** Los resets de intento solo están previstos para herramientas internas de desarrollo y
  QA, nunca para la interfaz de producción.

### 5.6 Resultados y Flash Points

- **FR-24 —** El resultado debe mostrar, cuando aplique, puntuación, precisión, tiempo y desglose de
  respuestas correctas, parciales, incorrectas y no contestadas. (**Implementado/mock**)
- **FR-25 —** La evaluación debe producir una puntuación entera no negativa entre 0 y 100 para el
  desafío.
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
  para esa publicación; los intentos fantasma, de prueba, invalidados y las publicaciones canceladas
  quedan fuera.
- **FR-31 —** El ranking por temporada ordena por el total de Flash Points acreditados en esa
  temporada de la sala.
- **FR-32 —** Los empates comparten posición según el comparador y desempate que defina el modo.
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

## 6. Reglas de negocio conocidas

- Las salas son privadas y la competición está delimitada por sala y temporada.
- Solo `owner`, `admin` y `member` compiten. `spectator` consulta, pero no juega en competitivo.
- Una publicación tiene apertura inclusiva y cierre exclusivo.
- No jugar no crea un intento ni concede Flash Points.
- Para producción inicial hay un único intento competitivo por jugador y desafío programado.
- El intento en progreso se reanuda; repetir el desafío no crea una segunda oportunidad competitiva.
- Un intento terminal consume el único intento aunque no se complete con éxito; sus estados visibles
  son `completed` o `notCompleted`.
- El resultado de un desafío es un entero de 0 a 100 y nunca negativo.
- El crédito parcial, las penalizaciones, el éxito y los desempates dependen del modo y deben estar
  definidos antes de cerrar cada modo.
- Los Flash Points obtenidos al jugar se suman al total de la temporada activa de esa sala; `⚡`
  puede representar ese valor en la interfaz.
- La temporada no tiene niveles, hitos, metas, desbloqueos ni recompensas funcionales; el total
  es un número acumulado sin truncamiento ni denominador.
- Solo existen los rankings por desafío y por temporada.
- Los empates comparten posición; el comparador concreto depende del modo.
- El contenido publicado y el contexto histórico deben permanecer estables para quienes ya jugaron.
- Los resultados válidos permanecen aunque el jugador abandone la sala; un intento fraudulento debe
  invalidarse explícitamente.
- Las pruebas de superadministrador son no competitivas.

## 7. Estados y ciclos de vida observados

### Intento y experiencia de juego

- Estado de dominio del intento: `in_progress`, `completed`, `abandoned`, `expired` o
  `invalidated`.
- Resultado del intento: `passed`, `failed` o todavía no establecido.
- Estados visibles en el juego: introducción, cuenta atrás, jugando, transición, resultado y
  revisión. Algunos modos añaden briefing, escenas, feedback o epílogo.
- Estado visible del desafío en sala: disponible, en progreso, completado o no completado.
- Estado de respuesta observado: correcta, parcial, incorrecta, no contestada o timeout.

### Publicación, temporada y membresía

- Publicación: `scheduled`, `open`, `closed` o `cancelled`.
- Temporada: `draft`, `scheduled`, `active`, `finished` o `cancelled`.
- Membresía: `active`, `left`, `removed` o `banned`.
- Contenido: `draft`, `published` o `archived`.

La implementación local usa en algunos puntos un booleano `completed` y un indicador separado de
timeout; el ciclo de vida funcional de referencia es el anterior.

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
- `⚡` y “Flash Points” son equivalentes en la interfaz. El texto completo se conserva en títulos
  explicativos y etiquetas accesibles; la presentación compacta puede mostrar `N ⚡`.
- Solo hay dos rankings funcionales: uno por desafío y otro por temporada.
- No existen niveles ni hitos de temporada. Los niveles de La Pirámide y las vidas de
  Supervivencia son reglas internas de esos desafíos, no saldos ni progresión social.
- `roomContext` delimita la competición: sus desafíos no ofrecen replay tras un intento terminal;
  los previews sin sala sí pueden conservar replay.
- Las decisiones generales de `docs/domain/decisions.md` siguen vigentes cuando no contradicen lo
  anterior: competición asíncrona, salas privadas, temporadas por sala, perfiles globales,
  contenido versionado y evaluación autoritativa.
- Los ejemplos de formatos y los datos simulados no demuestran por sí solos que una regla esté lista
  para producción.

## 10. Cuestiones todavía abiertas

Estas cuestiones no cambian las decisiones confirmadas anteriores:

- Duración exacta, finalización, éxito, fracaso, checkpoints, feedback y exposición de soluciones de
  cada modo.
- Si algún modo futuro podrá permitir más de un intento oficial y cómo se acreditaría; el valor
  inicial confirmado sigue siendo uno.
- Comparador y desempate concretos de cada modo dentro del ranking por desafío.
- Duración, usos y flujo operativo de las invitaciones.
- Políticas de recuperación o eliminación de salas, retención de eventos, moderación y anonimización.
- Flujo de correcciones administrativas, toma de control de sesión y límites de frecuencia.
- Alcance exacto de la actividad social, notificaciones y formatos/challenges que entrarán en la
  primera validación con usuarios.

## 11. Inconsistencias entre implementación, documentación y objetivo

- **Resuelta (2026-09-13):** la UI competitiva usa el estado del intento para mostrar `Jugar`,
  `Continuar` o `Ver resultado`, bloquea la entrada a desafíos terminales y oculta replay en el
  resultado y la revisión. Los previews sin `roomContext` conservan replay.
- **Resuelta (2026-09-13, sesión de prototipo):** el proveedor conserva snapshots de los modos
  competitivos mientras el intento está en progreso y los rehidrata al volver al desafío. Esta
  recuperación no sustituye la persistencia ni la validación de servidor futuras.
- **Resuelta (2026-09-13, prototipo):** la finalización competitiva es first-completion-wins para
  `(roomId, challengeId)` y la aplicación local de resultados es idempotente. La misma regla deberá
  validarse en servidor cuando exista backend.
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
  con un estado distinto y `lastTimedOut`; debe unificarse antes de cerrar el contrato de modo.
- El catálogo canónico del código contiene 31 formatos y los mocks contienen siete desafíos definidos
  y seis programados, mientras que documentos antiguos describen 25 formatos o solo dos desafíos.
  Esos documentos antiguos deben tratarse como históricos.
- `docs/qa-fase-4.md` declara `format:check` correcto, pero la comprobación actual detecta avisos en
  varios archivos; es una discrepancia de estado documental, no una regla funcional.

## Fuera de alcance de esta fase

Este documento no define base de datos, tablas, APIs, endpoints, backend, ORM, autenticación
técnica, almacenamiento ni arquitectura detallada. Esas decisiones solo deben abordarse en la fase
correspondiente y respetando los requisitos anteriores.

## Evidencias principales

- `app/`, `components/`, `features/`, `types/` y `data/mock/`: pantallas, navegación, interacciones,
  tipos y fixtures actuales.
- [`domain/decisions.md`](domain/decisions.md), [`domain/open-questions.md`](domain/open-questions.md),
  [`domain/type-model.md`](domain/type-model.md), [`domain/mock-data.md`](domain/mock-data.md) y
  [`domain/data-access.md`](domain/data-access.md): decisiones y modelo funcional aprobados.
- [`redesign/README.md`](redesign/README.md), [`redesign/01-product-vision.md`](redesign/01-product-vision.md)
  y [`redesign/03-design-system.md`](redesign/03-design-system.md): intención de producto y estados
  visuales, con la terminología de rayos/XP y la progresión de temporada reconciliadas en esta
  fase.
- [`formatos-de-juego.md`](formatos-de-juego.md) y [`the-flash-poc.md`](the-flash-poc.md): contexto
  anterior; cuando contradicen el modelo canónico se consideran históricos.
