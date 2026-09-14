# Modelo conceptual de dominio

## Estado y alcance

Este documento modela conceptualmente The Flash a partir de
[`domain-requirements.md`](domain-requirements.md),
[`../../decisions/decisions.md`](../../decisions/decisions.md) y los contratos funcionales por modo
de [`mode-contracts.md`](mode-contracts.md).

Es la referencia para hablar del dominio en las siguientes fases. Distingue las reglas confirmadas
de las cuestiones abiertas y no define tablas, schemas ORM, APIs, endpoints ni arquitectura de
backend.

Última actualización: 2026-09-13.

## 1. Visión general del modelo

The Flash es una competición asíncrona dentro de salas privadas. Un jugador pertenece a una o más
salas mediante una membresía. Cada sala organiza temporadas; una temporada publica versiones
inmutables de desafíos durante ventanas explícitas. Un miembro con rol competitivo inicia un único
intento, responde a los elementos del desafío y recibe Flash Points al finalizarlo. Esos puntos
alimentan el ranking del desafío y el ranking de la temporada.

El modelo separa cuatro responsabilidades conceptuales:

1. **Participación**: jugadores, salas, membresías e invitaciones.
2. **Contenido**: definiciones y versiones de desafíos y preguntas.
3. **Competición**: temporadas, publicaciones, intentos y respuestas.
4. **Consulta derivada**: rankings, historial y actividad social resumida.

Los rankings, el historial, el total de temporada y la actividad social son proyecciones derivadas;
no son fuentes de verdad independientes. La práctica de formatos es un contexto de exploración y no
crea una competición.

## 2. Glosario

| Concepto                 | Significado en el dominio                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Jugador**              | Persona con perfil global y, normalmente, una identidad autenticada.                                   |
| **Sala**                 | Grupo privado que contiene la competición asíncrona.                                                   |
| **Membresía**            | Relación de un jugador con una sala, con rol y ciclo de vida propios.                                  |
| **Temporada**            | Periodo competitivo de una sala, con total y ranking propios.                                          |
| **Desafío**              | Experiencia jugable reutilizable compuesta por preguntas, reglas y modo.                               |
| **Versión de desafío**   | Snapshot concreto e inmutable del contenido de un desafío.                                             |
| **Publicación**          | Instancia de una versión de desafío programada en una temporada y sala.                                |
| **Pregunta**             | Unidad de contenido versionada que ofrece una interacción de un formato.                               |
| **Elemento del desafío** | Inclusión ordenada de una versión de pregunta con puntos y configuración contextual.                   |
| **Modo**                 | Regla de alto nivel que organiza la sesión (`flash`, `alphabet`, `survival`, `narrative` o `pyramid`). |
| **Intento**              | Ejecución competitiva o de prueba de un jugador sobre una publicación.                                 |
| **Respuesta**            | Resultado final del jugador para un elemento concreto del desafío.                                     |
| **Flash Points**         | Puntuación competitiva obtenida en un desafío y acumulada en su temporada.                             |
| **Ranking**              | Proyección ordenada por desafío o por temporada; solo existen esos dos tipos funcionales.              |
| **Práctica / preview**   | Exploración de un formato sin intento competitivo ni efectos sociales.                                 |
| **Abandono**             | Terminación de un intento ya iniciado sin llegar a su final reglamentario.                             |
| **Expiración**           | Publicación que se cerró antes de que el jugador iniciara un intento.                                  |

## 3. Entidades y conceptos

### 3.1 Participación e identidad

#### Jugador

Es la identidad de dominio de una persona. Tiene nombre visible y avatar globales, que pueden
editarse y no tienen que ser únicos. La identidad de autenticación del proveedor es distinta del
perfil de jugador; puede quedar desvinculada al anonimizar la cuenta.

Estados conceptuales: `active` y `anonymized`.

#### Rol global de plataforma

`superadmin` es un privilegio global, no un rol de sala ni una membresía. Permite inspección,
edición y pruebas internas según las reglas de operación. Una prueba de superadministración es
fantasma/no competitiva.

#### Sala

Es el límite social y competitivo. Es privada, tiene zona horaria propia y puede contener varias
temporadas a lo largo de su vida, pero como máximo una temporada activa.

Estado conceptual: `active` o `deleted` (eliminación lógica y recuperable antes de una eventual
purga).

#### Membresía de sala

Es una relación con identidad y ciclo de vida propio entre un jugador y una sala. Expresa el rol
(`owner`, `admin`, `member` o `spectator`), el momento de entrada y, si corresponde, su finalización.
La propiedad de la sala se expresa mediante la membresía `owner`; no es un atributo conceptual
independiente de la sala.

#### Invitación

Es una autorización temporal para incorporarse a una sala privada. Pertenece a una sala, la crea
un jugador responsable y puede limitarse por caducidad, revocación y usos. La invitación no puede
conceder el rol `owner` directamente.

### 3.2 Tiempo competitivo

#### Temporada

Es un periodo competitivo perteneciente a una sala. Empieza con cero Flash Points y posee sus
propios rankings. No tiene niveles, metas, hitos, desbloqueos ni recompensas adicionales.

#### Publicación de desafío

Es la disponibilidad de una versión concreta de desafío dentro de una temporada. Tiene un número,
estado y ventana temporal. La apertura es inclusiva y el cierre exclusivo. La publicación es el
límite que convierte un contenido reutilizable en una competición concreta.

### 3.3 Contenido

#### Definición y versión de desafío

La definición identifica un desafío reutilizable. Cada versión fija su modo, texto, configuración y
contenido publicado. Una versión publicada es inmutable; una corrección o cambio posterior crea
otra versión.

#### Elemento del desafío

Es la relación ordenada entre una versión de desafío y una versión de pregunta. Contiene la posición,
los puntos asignados y la configuración contextual del elemento, como letra, nivel o escena. El
orden y los puntos pertenecen a esta inclusión, no a la pregunta global.

#### Definición y versión de pregunta

La definición identifica una pregunta reutilizable. La versión fija su formato, payload público y
solución. La solución, tolerancias, rutas, tableros resueltos y métricas privadas no forman parte
del contenido público de la partida competitiva.

#### Formato y modo

El formato define la interacción de una pregunta; el catálogo actual contiene 31 formatos. El modo
define el flujo de nivel superior y sus reglas de inicio, tiempo, finalización, puntuación,
revisión y desempate. Los cinco modos actuales son `flash`, `alphabet`, `survival`, `narrative` y
`pyramid`.

Los estados internos de un modo —por ejemplo `summit`/`failed` en La Pirámide o `survived`/
`eliminated` en Supervivencia— no son estados globales del intento.

### 3.4 Ejecución y resultado

#### Intento

Es la raíz conceptual de una ejecución sobre una publicación y pertenece a un jugador. Puede ser
`competitive` o `test`. Conserva ciclo de vida, plazo, progreso, versión de estado, respuestas y
puntuación.

El intento oficial inicial es único por jugador y publicación. Si sigue en progreso, regresar debe
continuar el mismo intento; un intento terminal no puede repetirse en competición.

#### Respuesta de intento

Es la respuesta final a un elemento concreto del desafío, no solo a una pregunta reutilizable.
Conserva el payload enviado, su evaluación, tiempo y puntos concedidos. Sus estados de resultado
son `correct`, `partial`, `incorrect`, `unanswered` y `timeout`.

#### Resultado y Flash Points

El resultado de un intento completado es una puntuación entera entre 0 y 100. Cero es un resultado
válido. La puntuación acreditada se denomina Flash Points, se acredita una sola vez y se suma al
total de la temporada de la sala.

### 3.5 Proyecciones y contextos que no son entidades de dominio

- **Ranking de desafío**: orden de resultados competitivos completados para una publicación.
- **Ranking de temporada**: orden por total de Flash Points acreditados en una temporada.
- **Historial**: consulta de publicaciones cerradas y resultados con el contexto de su versión.
- **Actividad social**: resumen derivado de eventos y resultados, no un feed de frases como fuente
  de verdad.
- **Total de temporada**: suma derivada de resultados acreditados; no es una moneda separada.
- **Preview/práctica**: contexto de ejecución sin efectos competitivos; no es un `Attempt` oficial.

## 4. Relaciones

```text
Jugador 1──< Membresía >──1 Sala 1──< Temporada 1──< Publicación >──1 Versión de desafío
Sala 1──< Invitación
Jugador 1──< Intento >──1 Publicación
Versión de desafío 1──< Elemento >──1 Versión de pregunta
Definición de desafío 1──< Versiones de desafío
Definición de pregunta 1──< Versiones de pregunta
Intento 1──< Respuestas de intento >──1 Elemento del desafío
```

Relaciones y cardinalidades conceptuales:

- Un jugador puede tener muchas membresías y una membresía pertenece a un jugador y una sala.
- Una sala tiene muchas membresías, invitaciones y temporadas; solo una temporada puede estar
  activa.
- Una temporada contiene publicaciones ordenadas y no solapadas.
- Una publicación referencia una única versión publicada de desafío.
- Una definición de desafío tiene varias versiones; una versión tiene varios elementos ordenados.
- Un elemento referencia una única versión de pregunta; una definición de pregunta puede tener
  varias versiones.
- Un jugador puede tener intentos sobre muchas publicaciones; cada intento pertenece a una sola
  publicación.
- Un intento contiene respuestas finales para elementos de su propia versión de desafío.
- El camino de una publicación hacia su sala es `publicación → temporada → sala`; no se duplica ese
  contexto en el contenido reutilizable.

## 5. Estados y transiciones

### Jugador y sala

```text
Player: active ──anonymizar cuenta──> anonymized
Room:   active ──eliminación lógica──> deleted
```

La anonimización desvincula la identidad de autenticación y conserva el identificador y los
resultados históricos. La eliminación lógica de una sala es recuperable antes de una purga.

### Membresía

```text
active ──salir──> left
active ──expulsar──> removed
active ──bloquear──> banned
left/removed ──reincorporarse──> active
```

Los resultados históricos no se borran automáticamente al salir, ser expulsado o ser bloqueado.
El desbloqueo y la reincorporación de una membresía `banned` requieren reglas operativas aún no
cerradas.

### Temporada

```text
draft ──programar──> scheduled ──comenzar──> active ──finalizar──> finished
draft/scheduled/active ──cancelar──> cancelled
```

Una temporada activa no admite nuevos intentos cuando termina, aunque los intentos iniciados
válidamente pueden acabar dentro de su plazo individual.

### Contenido

```text
draft ──publicar──> published ──archivar──> archived
```

La publicación congela la versión. Una versión usada no se elimina para preservar la reconstrucción
histórica.

### Publicación

```text
scheduled ──llega opensAt──> open ──llega closesAt──> closed
scheduled/open ──cancelación auditada──> cancelled
```

`open` requiere que la ventana y el estado permitan jugar. `expired` no es una transición persistida
de la publicación ni un estado de intento: es la proyección visible para un jugador que no inició
un intento antes del cierre.

### Intento

```text
sin intento ──iniciar──> in_progress
in_progress ──final reglamentario──> completed
in_progress ──abandono confirmado──> abandoned
completed/abandoned ──invalidación administrativa──> invalidated
```

El inicio consume el intento permitido y es idempotente. Una reapertura de `in_progress` reanuda el
mismo intento. Los estados terminales no se reanudan ni se repiten en competición. `passed` y
`failed` pueden existir como resultados internos de un modo, pero no son transiciones globales del
intento.

### Respuesta

La respuesta se presenta durante el intento y termina evaluada como `correct`, `partial`,
`incorrect`, `unanswered` o `timeout`. Un timeout de pregunta o ronda no convierte por sí solo el
intento en `abandoned`, ni convierte la publicación en `expired`.

## 6. Invariantes

1. Una sala es privada y la competición siempre está delimitada por sala y temporada.
2. Cada sala tiene exactamente un propietario expresado por una membresía `owner`.
3. Una sala no tiene más de una temporada `active`.
4. Una publicación pertenece a una temporada y referencia una versión de desafío `published`.
5. Las publicaciones competitivas de una temporada no se solapan y su número es único.
6. La ventana usa apertura inclusiva y cierre exclusivo; un intento válido puede terminar después
   del cierre de la publicación hasta su propio plazo.
7. El contenido publicado y el contexto histórico de una partida no cambian silenciosamente.
8. Una versión de desafío suma exactamente 100 puntos y su puntuación final está entre 0 y 100.
9. Una respuesta final pertenece a un intento y a un elemento de la versión jugada, no solo a una
   pregunta global.
10. Para la primera producción hay como máximo un intento oficial por jugador y publicación.
11. Un intento solo puede iniciarlo un miembro con membresía activa y rol `owner`, `admin` o
    `member`; `spectator` no compite.
12. Solo una sesión puede controlar un intento en progreso; la concurrencia obsoleta debe rechazarse
    conceptualmente.
13. Un intento iniciado termina como `completed` al alcanzar el final reglamentario, incluso con
    cero Flash Points. El abandono confirmado es terminal y se proyecta como `notCompleted`.
14. `expired` antes de iniciar no crea intento, respuesta, puntos ni resultado propio.
15. Solo los intentos competitivos completados y no invalidados participan en rankings; los
    resultados de cero puntos sí participan.
16. Los intentos `test`/fantasma, abandonados, invalidados y de publicaciones canceladas no
    conceden ni contribuyen a la competición ordinaria.
17. Los Flash Points se acreditan una sola vez; no existen como XP, energía, moneda o saldo aparte.
18. Solo existen ranking por desafío y ranking por temporada.
19. Un espectador puede consultar la sala y sus rankings, pero no recibe el contenido jugable de un
    desafío competitivo.
20. Las pruebas de superadministración no aparecen como participación competitiva.

## 7. Reglas de negocio

- La participación competitiva requiere cuenta; la práctica puede estar disponible sin cuenta.
- Los perfiles son globales a la persona y un jugador puede pertenecer a varias salas.
- Las invitaciones son revocables y caducables; su duración, usos y flujo exactos siguen abiertos.
- Los roles de sala competitivos son `owner`, `admin` y `member`; `spectator` solo consulta.
- La propiedad puede transferirse. Si el propietario abandona, la sucesión sigue el orden de
  administrador activo más antiguo y después miembro activo más antiguo; si no existe uno elegible,
  debe nombrarlo o eliminar la sala antes de salir.
- Una publicación cancelada conserva sus intentos para auditoría, pero no aparece como finalizada
  ordinaria ni suma al ranking.
- Cada modo define sus reglas de tiempo, crédito parcial, penalizaciones, finalización y desempate.
  Las penalizaciones no pueden producir puntuación negativa.
- En Alfabeto el desempate es Flash Points, menor tiempo hasta el último acierto y menor momento de
  finalización; si coinciden, se comparte posición.
- Al completar o abandonar un intento iniciado se permite revisar las respuestas y soluciones según
  la política aplicable; durante un intento en progreso no se revelan soluciones.
- El replay es válido para previews aislados, pero no para un intento competitivo terminal.
- Los resultados válidos permanecen aunque el jugador abandone la sala. Un resultado fraudulento se
  invalida explícitamente.
- Las correcciones administrativas deben conservar la respuesta original y dejar rastro auditable;
  no deben recalcular silenciosamente la historia.

## 8. Permisos y ownership

| Actor o contexto          | Puede leer sala/rankings                                | Puede competir               | Puede gestionar                                            |
| ------------------------- | ------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| Persona sin cuenta        | No tiene acceso competitivo; sí puede explorar previews | No                           | No                                                         |
| `owner`                   | Sí, con membresía activa                                | Sí                           | Sí, según las reglas de ownership e invitaciones           |
| `admin`                   | Sí, con membresía activa                                | Sí                           | Responsabilidades de sala previstas; matriz exacta abierta |
| `member`                  | Sí, con membresía activa                                | Sí                           | No se presupone gestión administrativa                     |
| `spectator`               | Sí, incluidos rankings e historial                      | No                           | No                                                         |
| Superadministrador        | Inspección global según privilegio                      | Solo en modo fantasma/prueba | Inspección, contenido y pruebas, con auditoría             |
| Editor/autor de contenido | Según el contexto autorizado                            | No por ese rol               | Preparar contenido; el alcance exacto está abierto         |

Reglas adicionales de ownership:

- La propiedad vive en la membresía `owner`, nunca en un rol global ni en una segunda relación de
  propietario.
- Un jugador solo puede actuar competitivamente en una sala mediante una membresía activa y
  competitiva.
- Una membresía terminada conserva el contexto histórico, pero no permite leer la sala como miembro
  activo ni iniciar nuevos desafíos.
- El rol global `superadmin` no sustituye a una membresía ni hace que una prueba sea competitiva.
- La matriz exacta de acciones de `owner` frente a `admin`, incluida la publicación y corrección de
  contenido, todavía no está cerrada.

## 9. Eventos relevantes del dominio

Estos eventos expresan cambios significativos para el dominio y para proyecciones como actividad o
rankings. La lista no prescribe un mecanismo de almacenamiento ni event sourcing.

### Participación

- `PlayerCreated` / `PlayerAnonymized`.
- `MembershipJoined`, `MembershipReactivated`, `MembershipLeft`, `MembershipRemoved` y
  `MembershipBanned`.
- `InvitationCreated`, `InvitationAccepted`, `InvitationRevoked` e `InvitationExpired`.

### Contenido y calendario

- `ChallengeVersionPublished` y `ChallengeVersionArchived`.
- `QuestionVersionPublished` y `QuestionVersionArchived`.
- `SeasonScheduled`, `SeasonActivated`, `SeasonFinished` y `SeasonCancelled`.
- `ScheduledChallengeOpened`, `ScheduledChallengeClosed` y `ScheduledChallengeCancelled`.

### Competición

- `AttemptStarted` y `AttemptResumed`.
- `AttemptAnswerSubmitted` y `AttemptAnswerEvaluated`.
- `AttemptCompleted`, `AttemptAbandoned` y `AttemptInvalidated`.
- `FlashPointsAccredited`.
- `AdministrativeCorrectionApplied`.
- `TestAttemptExecuted` para pruebas fantasma, siempre fuera de las proyecciones competitivas.

Los eventos del navegador (`pagehide`, `visibilitychange`, `offline`) son señales auxiliares, no
eventos de dominio suficientes para confirmar abandono. El abandono automático requiere reglas de
actividad aún abiertas.

## 10. Decisiones de modelado y justificación

1. **Separar jugador, membresía y sala.** Permite perfil global, pertenencia múltiple y estados de
   entrada/salida sin convertir el jugador actual en un atributo de la sala.
2. **Separar definición, versión y publicación.** El contenido puede reutilizarse, mientras cada
   partida conserva exactamente la versión y el contexto con los que se jugó.
3. **Tratar el elemento del desafío como concepto propio.** La posición, los puntos y la
   configuración pertenecen al uso de una pregunta dentro de un desafío, no a la pregunta global.
4. **Usar el intento como límite de la ejecución.** El ciclo de vida, la idempotencia, la sesión
   activa, el progreso y las respuestas necesitan un mismo contexto conceptual.
5. **Separar disponibilidad de intento.** `expired` describe una publicación cerrada antes de
   empezar; `abandoned` describe un intento iniciado que no llegó al final.
6. **Mantener los resultados internos de modo fuera del estado global.** `summit`, `failed`,
   `survived` o `eliminated` explican una mecánica concreta, pero no deben crear estados globales
   `passed`/`failed` ni alterar por sí solos la acreditación.
7. **Modelar rankings e historial como proyecciones.** Se derivan de publicaciones, membresías,
   intentos y respuestas; no duplican fuentes de verdad ni crean un tercer ranking.
8. **Tratar Flash Points como una sola puntuación.** Evita introducir una moneda o progresión que
   los requisitos descartan; `⚡` es solo una representación visual.
9. **Distinguir práctica de competición.** Un preview puede permitir replay y no debe contaminar
   intentos, puntos, historial ni rankings oficiales.
10. **Mantener eventos como conceptos de cambio.** Permiten describir actividad, auditoría y
    proyecciones sin decidir todavía cómo se persistirán o transportarán.

### Límites naturales

Sin convertirlos en una decisión de persistencia, los límites conceptuales más claros son:

- **Participación de sala:** sala, membresías, invitaciones y su temporada activa.
- **Contenido publicado:** definición/versiones de desafío y pregunta, con elementos ordenados e
  inmutables al publicarse.
- **Intento:** intento y respuestas de una ejecución concreta.
- **Proyecciones:** rankings, historial, total y actividad, siempre reconstruibles desde los hechos
  anteriores.

Estos límites ayudan a razonar sobre consistencia y permisos; no anticipan tablas ni servicios.

## 11. Cuestiones abiertas

El modelo no decide todavía:

- duración, usos y flujo exactos de las invitaciones;
- matriz precisa de permisos entre `owner` y `admin`;
- duración del heartbeat, lease y periodo de gracia para detectar abandono automático;
- qué checkpoints y borradores se conservan para cada modo y cómo se toma el control en otro
  dispositivo;
- política de consulta y revisión de intentos `invalidated`;
- comparadores y desempates de modos distintos de Alfabeto;
- detalles de tiempo, finalización, feedback y exposición de soluciones de cada modo que no estén
  cerrados en sus contratos;
- flujo de correcciones administrativas, moderación, auditoría y límites de frecuencia;
- alcance de actividad social, notificaciones y primera validación con usuarios;
- anonimización, retención y purga definitiva de datos de jugadores y salas;
- alcance exacto del rol de editor/autor y del contenido que puede publicar.

Si una decisión futura contradice este modelo, debe actualizar primero
[`domain-requirements.md`](domain-requirements.md) y, si cambia una regla difícil de revertir,
registrarse también en [`../../decisions/decisions.md`](../../decisions/decisions.md).
