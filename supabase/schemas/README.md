# Esquema declarativo y frontera de comandos

Estado: el esquema declarativo vigente se compone de 58 archivos y su revisión canónica es
`20261007130000_attempt_control_transfer`. Las migraciones incrementales corresponden a esos archivos;
la rama de respaldo conserva el historial incremental anterior. La validación
local corresponde a PostgreSQL 17 de Supabase local; el inventario, las suites pgTAP y la concurrencia
pasan en esa ejecución. La CLI tiene staging vinculado, aunque esta revisión aún no se ha aplicado allí.
S14 integra Supervivencia sobre tablas existentes; S15 integra Pirámide sin tablas nuevas. S17a, S18b
parcial y D08a/D08b/S13 también están aplicadas localmente. D08a añade buckets, políticas de lectura, `media_assets` y comandos server-only de avatar;
D08b añade ciclo de vida de assets privados y resolución competitiva autorizada para E10 y `multiple-choice`.
**30 tablas**, una vista
interna, funciones públicas de lectura/ranking, contextos protegidos del portal privado y comandos
privados de servidor. S01–S15, S17a, S18b parcial, S05-Alphabet, F* y E* conectan
Auth, la interfaz y adaptadores PostgreSQL reales para perfil, salas, Flash, Supervivencia y Pirámide
competitivos; S15 está validada sobre el stack local,
además del editor Flash mínimo de S11. S17a añade biblioteca editorial y reutilización exacta de
`question_version` sin nuevas tablas.
S06 consulta los rankings de temporada y publicación abierta y reutiliza esa posición en las tarjetas.
S07 consulta el historial cerrado de Flash, Supervivencia y Pirámide, y la revisión común autorizada desde versiones y resultados
persistidos, sin materializar tablas adicionales. El portal consulta el contexto global de
superadmin y salas activas mediante `get_superadmin_portal_context()` y crea salas mediante un
comando transaccional específico de S08, sin DML directo ni proyecto remoto vinculado.
Las capacidades restantes siguen usando mocks o están pendientes. S14 amplía edición, publicación,
calendario, lecturas autorizadas, recuperación y cierre server-side a `survival`, sin nuevas tablas.
S15 añade validación editorial de siete niveles, calendario, proyecciones seguras y comandos de
recuperación/finalización para `pyramid`; pgTAP, integración Auth y E2E local pasan. Las cuatro
slices competitivas de `true-false`, `ordering`, `classification` y `logic-matrix` amplían el gate
compartido de Flash, Supervivencia y Pirámide mediante los validadores editoriales existentes.
S17 añade clonación, comparación editorial y archivado optimista de versiones de Flash, Supervivencia
y Pirámide; los borradores clonados mantienen referencias a preguntas publicadas y las publicaciones
existentes siguen resolviendo versiones archivadas.
S18b permite al owner conceder/quitar
admin y eliminar lógicamente miembros mediante `public.manage_room_member(jsonb)`; eliminar un
miembro cierra atómicamente sus intentos competitivos activos y revoca sus sesiones; transferencia,
bloqueo/desbloqueo e invitaciones completas siguen pendientes. S10 añade preparación/edición de
borradores y activación explícita de temporadas; S11 añade el editor Flash de 2 a 20 preguntas y
publicación inmutable; S12 añade calendario local y tick temporal sin participación ficticia. E01
añade Mini-Wordle competitivo con eventos intermedios, diccionario privado versionado y palabras
adicionales específicas por pregunta sin modificar el diccionario global. E02 añade Logic-code
mixto con intentos privados, duplicados rechazados sin penalización, progreso seguro y evaluación
autoritativa al acertar. E03 añade Progressive-clues con primera pista gratuita, eventos de
revelación privados, penalización por puntos reales del item y evaluación reconstruida desde eventos.
E04 añade Matching con resolución local, una recepción final del mapa completo, validación server-side
sin solución pública y evaluación binaria. E05 añade Queens con borradores locales, checkpoints,
validación server-side del tablero completo, eventos privados de validación, penalización del 5%,
recuperación del tablero y resolución terminal server-side. E06 añade Word-search
con soluciones privadas, selecciones server-side, errores persistidos, recuperación e idempotencia. S05 añade Alphabet
con referencias publicadas `short-text`, reloj global, pases y lecturas terminales autorizadas. Las migraciones están versionadas;
no hay seed global; la CLI local mantiene un enlace de staging sin que esta revisión se haya desplegado.

La revisión `20261004141603_alphabet_atomic_completion` cierra Alphabet competitivo en una
transacción al vencer el reloj de PostgreSQL. Conserva las respuestas recibidas, registra las
letras pendientes como `unanswered` y acredita los puntos una sola vez. La recuperación agotada
utiliza el mismo cierre y devuelve todas las respuestas, sin preparar letras adicionales.
El cliente muestra «Finalizando partida…» y hace hasta tres reintentos automáticos del mismo
comando: 1, 2 y 4 segundos para red/5xx, o el `Retry-After` del servidor para 429 y deadline adelantado.
Después ofrece «Reintentar partida» para iniciar otro ciclo limitado.

Para desplegar, aplicar primero la migración incremental y después la aplicación. Las firmas,
permisos y petición pública de `complete` se conservan; `answers` es un campo adicional de su
respuesta. Los clientes anteriores mantienen los comandos de responder y pasar y el cierre
anticipado cuando todas las letras están resueltas. La aplicación nueva necesita esta revisión
para cerrar letras pendientes. Esta implementación no aplica cambios remotos.

## Decisiones y supuestos

Se han aplicado el [dominio](../../docs/current/domain/domain-model.md), los
[contratos por modo](../../docs/current/domain/mode-contracts.md), los
[casos de uso](../../docs/current/use-cases.md), el [modelo de datos](../../docs/current/data-model.md)
y la [arquitectura](../../docs/current/architecture.md). Las decisiones aprobadas prevalecen sobre
el comportamiento provisional del mock.

- `players.id` es una identidad propia, distinta del UUID de Auth. La identidad del actor se resuelve
  desde claims verificados por servidor y la asignación de superadmin desde la base de datos.
  Ningún comando de jugador acepta `playerId`, evaluación ni fechas autoritativas.
- `private` permanece fuera de los schemas de Data API. Los comandos necesitan una conexión
  PostgreSQL de servidor. `service_role` tiene lecturas internas y EXECUTE explícito, **sin DML
  directo en ninguna tabla del dominio**. No se utiliza la credencial propietaria `postgres` en el
  adaptador. Los comandos se ejecutan como `SECURITY DEFINER`, propietario `postgres`, con
  `search_path = ''` y nombres cualificados.
- `anon` carece de acceso competitivo; Auth anónimo también se rechaza. `authenticated` solo
  dispone de lecturas con RLS y actualización del nombre propio. Ser owner/admin/superadmin humano
  no concede nuevos privilegios SQL al navegador.
- Un intento oficial por jugador/publicación, incluso después del abandono o invalidación.
  Los intentos de prueba siguen excluidos de rankings y puntos; no se abre un comando de creación
  de pruebas sin cerrar su autorización administrativa.
- Las versiones publicadas, respuestas, recepciones, asientos y auditoría conservan el histórico.
  Corregir no reescribe la puntuación original: inserta un ajuste al saldo efectivo. Invalidar
  revierte ese saldo en la misma transacción, incluso si es cero; sin acreditación no crea asientos.
- La clave idempotente tiene ámbito por actor, incluyendo la operación y su contenido. Mismo
  contenido devuelve el resultado anterior; contenido diferente genera conflicto. Los tokens se
  almacenan solo como SHA-256 de secretos aleatorios de al menos 32 caracteres generados por servidor.
  El hash no sustituye la necesidad de alta entropía. Un reintento debe reutilizar el mismo secreto.
- Los relojes se persisten antes de entregar contenido. `question_versions.time_limit_ms` es el
  límite por pregunta o nivel; `challenge_versions.global_time_limit_ms` solo existe en Alfabeto
  publicado. No se infiere un límite total sumando preguntas. En Pirámide cada item es un nivel.
- No hay heartbeat ni lease del navegador. La expiración server-side usa 15 minutos desde
  `last_activity_at` (o `started_at`) y solo se aplica cuando la publicación está cerrada o el
  deadline global ha vencido; marca el intento `abandoned` sin puntos. `expires_at` es nulo o coincide
  con el deadline global. Tras ese deadline solo se permite resolver timeout, evaluar, finalizar o
  abandonar; no se entrega nuevo contenido jugable. La transferencia entre dispositivos requiere
  confirmación explícita.
- Política S04 implementada para el vertical Flash: una unidad e intervalo confirmados antes de
  devolver contenido se consideran consumidos. Al recuperar, una recepción existente se evalúa; sin
  recepción del jugador se cierra atómicamente el intervalo y se crea una recepción interna de
  payload nulo para evaluar `unanswered`, sin reentregar el payload. Alfabeto necesitará un motivo de
  cierre auditable distinto de `pass` voluntario; los demás modos incorporarán esta política en sus
  propias slices.

### Decisiones provisionales y operaciones cerradas

La política de permisos de sala e invitaciones ya está fijada: `owner` gestiona la sala y transfiere propiedad; `admin` gestiona
cualquier membresía salvo `owner`, pero solo `owner` concede `admin`; `member` y `spectator` no
administran. `owner` invita a `admin`/`member`/`spectator` y `admin` a `member`/`spectator`; las
invitaciones duran 7 días por defecto, como máximo 30, tienen un uso por defecto y hasta 20 usos
explícitos, y `owner`/`admin` pueden revocarlas sin afectar membresías existentes. La aceptación de
una invitación **existente** ya está implementada; una membresía activa no consume otro uso y una
prohibida no puede reactivarse. Las operaciones directas de `superadmin` sobre salas se auditan.
Para la beta cerrada, el superadmin podrá crear o reactivar directamente membresías de usuarios
autenticados desde un portal privado, sin crear ni consumir una invitación. La emisión, aceptación y
revocación de invitaciones completas siguen siendo una capacidad futura de S09, no un flujo de la UI
pública. S11 implementa el editor Flash mínimo y su publicación global desde el portal privado;
reemplazo/archivado y el resto de formatos se implementarán en sus slices correspondientes; S12 ya
opera localmente el calendario de Flash publicado.

Se conserva la visibilidad de perfiles históricos mínimos en rankings, la exclusión de resultados
invalidados de la lectura directa y la necesidad de membresía vigente para consultar resultados
propios. Retención, borrado de payloads/medios, inspección administrativa y cambios editoriales
requieren decisiones posteriores. El evaluador confiable decide el resultado de cada pregunta y el
score normalizado; SQL deriva vidas, eliminación/supervivencia y terminalidad de evaluaciones
persistidas. S15 deriva para Pirámide `summit`/`failed`, niveles alcanzados, puntuación y cierre desde
las evaluaciones guardadas; pgTAP verifica esas invariantes.

## Archivos SQL

El orden lexicográfico expresa dependencias. Son declaraciones de estado deseado para una base
vacía; no son scripts repetibles sobre una base poblada.

| Archivo                                                                          | Propósito                                                                                                                                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [00_namespaces.sql](00_namespaces.sql)                                           | Schemas, extensión y revocaciones predeterminadas globales y por schema para objetos futuros de `postgres`.                                                     |
| [10_identity_rooms.sql](10_identity_rooms.sql)                                   | Identidad, salas, membresías, invitaciones, temporadas y superadmin.                                                                                            |
| [20_content.sql](20_content.sql)                                                 | Catálogo congelado, soluciones, items y límites temporales publicados.                                                                                          |
| [30_competition.sql](30_competition.sql)                                         | Publicaciones, intentos, sesiones, respuestas, libro de puntos y auditoría. Deadline global y expiración anulables.                                             |
| [35_authoritative_state.sql](35_authoritative_state.sql)                         | Unidades temporales, intervalos de visita, recepciones inmutables e idempotencia. FK obligatoria desde respuesta final a recepción.                             |
| [36_mini_wordle.sql](36_mini_wordle.sql)                                         | Eventos privados, diccionario versionado, normalización/feedback y progreso seguro de Mini-Wordle.                                                              |
| [57_alphabet_reads.sql](57_alphabet_reads.sql)                                   | Lecturas públicas autorizadas del desafío Alphabet y su revisión terminal; nunca expone soluciones durante el juego.                                            |
| [57_survival_reads.sql](57_survival_reads.sql)                                   | Proyección jugable de Survival sin soluciones y resultado/revisión terminal propia.                                                                             |
| [45_pyramid_helpers.sql](45_pyramid_helpers.sql)                                 | Validador interno de briefing y configuración de nivel de Pirámide.                                                                                             |
| [57_pyramid_reads.sql](57_pyramid_reads.sql)                                     | Proyección de briefings/niveles permitidos y lectura propia de resultado/revisión terminal.                                                                     |
| [40_indexes.sql](40_indexes.sql)                                                 | Índices de autorización, calendario, unicidad y consultas competitivas.                                                                                         |
| [50_access_helpers.sql](50_access_helpers.sql)                                   | Resolución del jugador y ayudas RLS sin recursión.                                                                                                              |
| [54_question_validation.sql](54_question_validation.sql)                         | Valida preguntas individuales y documentos de desafío para edición y admisión competitiva; centraliza los contratos editoriales por formato.                    |
| [55_room_reads.sql](55_room_reads.sql)                                           | Lecturas autorizadas de tarjetas, detalles e introducciones de salas; limita los datos de desafíos expuestos.                                                   |
| [56_flash_reads.sql](56_flash_reads.sql)                                         | Lectura autorizada del desafío Flash y del resultado propio al terminar; no expone soluciones durante el juego.                                                 |
| [57_superadmin_reads.sql](57_superadmin_reads.sql)                               | Contexto mínimo server-side del portal de superadmin, sin acceso global RLS ni DML.                                                                             |
| [58_superadmin_challenge_reads.sql](58_superadmin_challenge_reads.sql)           | Catálogo y detalle de desafíos para el portal de superadmin.                                                                                                    |
| [58_superadmin_room_commands.sql](58_superadmin_room_commands.sql)               | Lookup exacto de jugadores y creación auditada/idempotente de sala, owner y grupo inicial desde el portal.                                                      |
| [58_superadmin_user_commands.sql](58_superadmin_user_commands.sql)               | Provisioning auditado/idempotente de perfiles vinculados a Auth y membresías de sala para superadmins; no almacena credenciales.                                |
| [59_superadmin_editorial_commands.sql](59_superadmin_editorial_commands.sql)     | Lectura protegida y comandos auditados/idempotentes para crear, editar y publicar Flash/Supervivencia/Pirámide; delega la validación documental compartida.     |
| [64_superadmin_editorial_versioning.sql](64_superadmin_editorial_versioning.sql) | Clonación de correcciones, archivado optimista y comparación editorial segura de versiones de Flash/Supervivencia/Pirámide.                                     |
| [59_superadmin_season_commands.sql](59_superadmin_season_commands.sql)           | Creación, actualización y activación auditadas de temporadas desde el portal de superadmin.                                                                     |
| [61_question_library.sql](61_question_library.sql)                               | Biblioteca protegida de preguntas individuales, historial de versiones, publicación/archivo e índice anti-duplicados por desafío; usa el validador común.       |
| [62_media_assets.sql](62_media_assets.sql)                                       | Registro privado de objetos de Storage, estados, metadatos, ownership e índices.                                                                                |
| [59_superadmin_calendar_commands.sql](59_superadmin_calendar_commands.sql)       | Programación/reprogramación de Flash/Supervivencia/Pirámide publicados, lecturas de calendario y tick temporal con locks/auditoría.                             |
| [s20_superadmin_attempt_reads.sql](s20_superadmin_attempt_reads.sql)             | Lecturas protegidas por sala/publicación para inspección de intentos competitivos; cursor estable, score original/efectivo y detalle sin soluciones.            |
| [60_integrity.sql](60_integrity.sql)                                             | Integridad estructural, admisión de intentos según la ventana efectiva, ownership, congelación e histórico. Las marcas de respuesta se derivan de su recepción. |
| [70_rls.sql](70_rls.sql)                                                         | Revocaciones existentes, lecturas limitadas y actualización propia; servicio sin DML.                                                                           |
| [71_storage_acl.sql](71_storage_acl.sql)                                         | Lectura pública de `avatars` y ausencia de lectura de `question-assets` para roles de navegador.                                                                |
| [80_rankings.sql](80_rankings.sql)                                               | Vista privada invoker y funciones públicas autorizadas por membresía.                                                                                           |
| [85_flash_history_reads.sql](85_flash_history_reads.sql)                         | Historial común y revisión persistida de Flash/Supervivencia/Pirámide, con payloads anulables y autorización por sala, publicación y jugador.                   |
| [88_command_support.sql](88_command_support.sql)                                 | Resolución del actor, hash de secretos y bloqueo idempotente compartido.                                                                                        |
| [89z_command_handlers.sql](89z_command_handlers.sql)                             | Operaciones privadas de intentos, invitaciones y administración, llamadas dentro de la transacción común.                                                       |
| [90_commands.sql](90_commands.sql)                                               | Validación de comandos, idempotencia, despacho, auditoría y wrappers server-only.                                                                               |
| [91_attempt_recovery.sql](91_attempt_recovery.sql)                               | Contexto privado del evaluador y operaciones de recuperación/lectura de intentos.                                                                               |
| [91_room_membership_commands.sql](91_room_membership_commands.sql)               | Gestión autenticada de roles y estado de membresías por el propietario, con idempotencia y auditoría.                                                           |
| [91_calendar_tick_acl.sql](91_calendar_tick_acl.sql)                             | ACL explícita para el tick interno; `service_role` no recibe DML de tablas.                                                                                     |
| [92_mini_wordle_commands.sql](92_mini_wordle_commands.sql)                       | Comando transaccional de guess, idempotencia, secuencia, recepción terminal y evaluación posterior.                                                             |
| [93_logic_code.sql](93_logic_code.sql)                                           | Eventos privados, progreso seguro y comando transaccional de intentos Logic-code.                                                                               |
| [89_progressive_clues.sql](89_progressive_clues.sql)                             | Eventos privados, metadatos/prefijo seguro y cálculo de penalización de Progressive-clues.                                                                      |
| [94_progressive_clues.sql](94_progressive_clues.sql)                             | Comando transaccional de revelación, idempotencia y locks de Progressive-clues.                                                                                 |
| [95_matching.sql](95_matching.sql)                                               | Proyección pública segura y validación server-side del mapa completo de Matching.                                                                               |
| [96_media_asset_commands.sql](96_media_asset_commands.sql)                       | Handshake idempotente de preparación, lectura, confirmación y aborto de avatar.                                                                                 |
| [97_media_asset_acl.sql](97_media_asset_acl.sql)                                 | ACL explícita de `media_assets` y comandos server-only.                                                                                                         |
| [63_question_asset_helpers.sql](63_question_asset_helpers.sql)                   | Validación interna de assets de preguntas listos para publicación/uso.                                                                                          |
| [68_competitive_question_formats.sql](68_competitive_question_formats.sql)       | Allowlist y validadores de formatos competitivos compartidos entre Flash, Supervivencia y Pirámide.                                                             |
| [98_question_asset_commands.sql](98_question_asset_commands.sql)                 | Subida, confirmación, aborto y resolución autorizada de assets privados de preguntas.                                                                           |
| [99_queens.sql](99_queens.sql)                                                   | Eventos privados históricos de Queens, reconstrucción segura del tablero y comando transaccional legado 5×5.                                                    |
| [99_queens_dynamic_grid.sql](99_queens_dynamic_grid.sql)                         | Validación, progreso y comandos de Queens para tableros cuadrados dinámicos de 4×4 a 8×8.                                                                       |
| [99_word_search.sql](99_word_search.sql)                                         | Eventos privados de Word-search, progreso seguro y comando transaccional de selección server-side.                                                              |
| [99_escape.sql](99_escape.sql)                                                   | Validación inmutable de configuración y solución privada de Escape para publicación editorial.                                                                  |
| [99_zip.sql](99_zip.sql)                                                         | Validación inmutable del contenido de Zip usado al publicar preguntas.                                                                                          |
| [99_word_hashtag.sql](99_word_hashtag.sql)                                       | Contrato privado de Word-hashtag, progreso en `attempts.progress_payload` y comando transaccional de swap server-side.                                          |

Las PK y restricciones UNIQUE cubren búsquedas de intento/item, recepción y clave idempotente.
El índice parcial de intervalo abierto garantiza una sola interacción activa por intento; el de
intento/item/inicio permite sumar visitas sin escanear todos los intentos. Los índices de FKs de
unidades y recepciones evitan escaneos al comprobar referencias. Se conservan GiST de calendario y
los índices de membresía/ranking. No se indexa JSONB sin una consulta que lo justifique.

## Protocolo de servidor

[Los puertos de aplicación](../../application/ports/attempt-commands.ts) distinguen inputs del
navegador y comandos internos. [Los contratos](../../types/contracts/attempts.ts) no se activan en
la UI. El adaptador de comandos deberá:

1. Verificar sesión Auth, comenzar una transacción y establecer claims con `SET LOCAL` usando
   parámetros, nunca copiando claims sin verificar. Usar `service_role` y garantizar commit/rollback
   antes de devolver la conexión al pool. La credencial SQL no verifica JWT por sí sola.
2. Generar el token aleatorio en el primer inicio y conservarlo de forma segura para reintentos.
   La misma cookie permite recuperar el intento. Otro token devuelve `controlRequired`, se bloquea
   y no revoca la sesión anterior. Si devuelve `controlRequired`, el destino debe confirmar el takeover explícitamente.
3. Llamar `prepare_interaction` y **confirmar la transacción antes de devolver `publicPayload`**.
   En la evolución de recuperación, si existe un intervalo abierto no resuelto, el adaptador debe
   resolverlo primero con el comando transaccional de recuperación; no debe reentregar ese payload
   ni su deadline usando otra clave.
4. Llamar `receive_answer` y confirmar esa transacción antes de evaluar. PostgreSQL captura el
   instante al entrar, verifica sesión, versión y orden bajo bloqueo, cierra el intervalo y guarda
   el payload. `clientTimeUsedMs` es solo telemetría. Un envío tardío queda marcado `timedOut` y su
   duración se limita al deadline; no puede disfrazarse con fechas enviadas por el cliente.
5. Recuperar `read_evaluation_context(receipt_id, session_token)`: incluye recepción y contenido
   congelado **con solución privada**. Validar el formato, componer el input del evaluador y usar
   [evaluateReceipt](../../server/evaluation/evaluate-receipt.ts), que convierte milisegundos a los
   segundos de la API existente. Ese resultado nunca se serializa al cliente como contexto privado.
   `record_evaluation` persiste la evaluación asociada a la recepción; el procesamiento tardío no
   incrementa la duración competitiva. No se prepara otra interacción mientras haya una recepción
   pendiente de evaluación.
6. Completar/acreditar o abandonar con sesión y versión. El cierre, la revocación, el asiento si
   corresponde, la auditoría y el resultado idempotente son una sola transacción. Una segunda sesión
   no puede escribir ni sustituir al controlador vigente durante el MVP.

Cada visita de Alfabeto tiene su intervalo; pasar no crea una respuesta final. Volver acumula solo
los intervalos de esa letra. La recuperación cerrará la letra visible con el futuro motivo
`recovery_interrupted`, distinto del pase voluntario, antes de avanzar. El deadline global sigue avanzando durante transiciones y esperas;
las demás modalidades empiezan su reloj al preparar la siguiente pregunta/nivel. La evaluación y
transiciones fuera de intervalos no se suman a la duración del ranking. Al vencer Alfabeto, el
adaptador debe resolver las letras pendientes mediante preparar/recibir timeout/evaluar, sin nuevo
payload jugable, y completar. Las letras nunca visitadas tienen duración de interacción cero.
No hay un proceso automático de timeout o recuperación de evaluaciones en este cambio.

| Operación privada                                                                            | Autorización y garantía                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_attempt`                                                                              | Miembro competitivo durante apertura para un inicio nuevo; recuperación sin nuevo intento.                                                                |
| `take_over_attempt`                                                                          | Transfiere explícitamente el control con token candidato, versión, membresía y deadline validados; revoca la sesión anterior e incrementa `lock_version`. |
| `prepare_interaction`                                                                        | Propietario y sesión vigente; persiste reloj antes de devolver contenido.                                                                                 |
| `recover_attempt` / `read_attempt_recovery`                                                  | S04/S14/S15: evalúa como `unanswered` una interacción abierta, deriva progreso del modo y no reentrega payload.                                           |
| `receive_answer`, `pass_interaction`                                                         | Sesión, item actual, versión y recepción autoritativa; pasar solo en Alfabeto antes del deadline.                                                         |
| `read_evaluation_context`, `record_evaluation`                                               | Servidor confiable en contexto del propietario; recepción vinculada a versión congelada.                                                                  |
| `complete_attempt`, `abandon_attempt`                                                        | Propietario y sesión vigente; cierre, sesiones, puntos y auditoría atómicos.                                                                              |
| `accept_invitation`                                                                          | Actor verificado; sala activa, token, caducidad, usos y estado de membresía bajo bloqueo.                                                                 |
| `invalidate_attempt`, `adjust_result`                                                        | Superadmin activo, motivo y versión; saldo y auditoría atómicos.                                                                                          |
| `create_superadmin_flash_draft`, `update_superadmin_flash_draft`, `publish_superadmin_flash` | Solo superadmin; grafo versionado, solución privada, locks, concurrencia optimista, publicación atómica y auditoría segura.                               |

El dispatcher genérico y sus helpers no tienen EXECUTE para los roles API. No hay RPC de escritura
pública. Los errores de versión/idempotencia usan SQLSTATE `40001`; autorización `42501`, input
`22023` y estado incompatible `55000`. El adaptador mapeará también errores estructurales de
constraints/triggers y reintentará transacciones completas cuando proceda, conservando la clave.

## Matriz de permisos SQL directos

`S` = SELECT; `U` = UPDATE. En todas las filas `anon` tiene denegado el acceso. El superadmin humano
usa las mismas ACL/RLS que cualquier `authenticated`: solo los comandos administrativos comprueban
su asignación en DB. `service_role` elude RLS, por lo que la restricción de escritura es la ACL.

| Tabla                                  | authenticated (incluye roles de sala y superadmin humano)                      | service_role |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| `public.players`                       | S columnas sociales propias/miembros activos compartidos; U nombre propio      | S            |
| `public.rooms`                         | S sala activa con membresía activa                                             | S            |
| `public.room_memberships`              | S miembros activos de sala accesible                                           | S            |
| `public.seasons`                       | S temporadas no borrador de sala accesible                                     | S            |
| `public.scheduled_challenges`          | S publicaciones de temporada visible                                           | S            |
| `public.attempts`                      | S columnas del intento competitivo propio no invalidado, con membresía vigente | S            |
| `private.platform_role_assignments`    | —                                                                              | S            |
| `private.room_invitations`             | —                                                                              | S            |
| `private.question_definitions`         | —                                                                              | S            |
| `private.question_versions`            | —                                                                              | S            |
| `private.question_version_solutions`   | —                                                                              | S            |
| `private.challenge_definitions`        | —                                                                              | S            |
| `private.challenge_versions`           | —                                                                              | S            |
| `private.challenge_items`              | —                                                                              | S            |
| `private.attempt_sessions`             | —                                                                              | S            |
| `private.attempt_answers`              | —                                                                              | S            |
| `private.flash_point_entries`          | —                                                                              | S            |
| `private.audit_log`                    | —                                                                              | S            |
| `private.command_requests`             | —                                                                              | —            |
| `private.attempt_timing_units`         | —                                                                              | —            |
| `private.interaction_intervals`        | —                                                                              | —            |
| `private.answer_receipts`              | —                                                                              | —            |
| `private.mini_wordle_dictionary_words` | —                                                                              | S            |
| `private.mini_wordle_guess_events`     | —                                                                              | S            |
| `private.logic_code_attempt_events`    | —                                                                              | —            |

Las lecturas internas sirven al ensamblado del evaluador, las comprobaciones de contexto y las
proyecciones del servidor; no se trasladan al navegador. Las nuevas tablas solo se leen por comandos.
No hay INSERT/DELETE directos ni políticas permisivas para ellos. Las siete políticas existentes
cubren seis SELECT y UPDATE del nombre con `USING` y `WITH CHECK`. Todas las tablas tienen RLS.
`private.effective_results` es una vista invoker accesible al servicio; los rankings públicos solo
son ejecutables por `authenticated` y comprueban membresía, devolviendo datos sociales
mínimos. `anon` no puede ejecutarlos. `get_challenge_ranking` ordena por puntos, duración efectiva
y `started_at` en servidor, aunque mantiene `started_at` fuera de su retorno público; el adaptador
S06 consume el orden y los campos expuestos sin inventar esa fecha. S07 añade
`get_room_history(text, uuid)` y `get_room_member_review(text, uuid, uuid)` son
`SECURITY DEFINER`, fijan `search_path = ''`, no exponen tablas `private` directamente y solo tienen
`EXECUTE` para `authenticated`. El historial no contiene payloads de pregunta ni soluciones; la
proyección histórica cubre `flash`, `alphabet`, `survival`, `narrative` y `pyramid`.
La elegibilidad usa `private.publication_effective_status` y el reloj PostgreSQL: una ventana
vencida se devuelve como `closed` aunque el estado persistido siga en `open` o `scheduled`.
Se excluyen cancelaciones, temporadas borrador/futuras/canceladas e intentos en progreso.
El reto completado continúa fuera del historial mientras su ventana siga abierta. La revisión común entrega solo preguntas
alcanzadas en `survival`, mantiene los huecos de Flash y devuelve los siete niveles de Pirámide con
payload y solución nulos para los niveles no alcanzados. Solo `owner`, `admin` y `member` pueden
revisar; `spectator` conserva historial/ranking pero nunca recibe respuestas ni soluciones, tampoco
por URL directa. La revisión propia terminal está disponible durante la ventana efectiva abierta;
la ajena exige cierre efectivo y ausencia de intentos en progreso. `get_room_member_review`
normaliza el estado a `open`/`closed` y añade `global_time_limit_ms` y `alphabet_letter`: ambos
son nulos fuera de Alfabeto. Alfabeto devuelve todas las letras, incluso las ausentes o agotadas,
y sus soluciones de la versión original. La expiración conserva los 15 minutos de inactividad
y reconoce el cierre efectivo o un deadline vencido, con revocación de sesión y auditoría.
Las RPC históricas se exponen únicamente mediante estas proyecciones comunes.

## Denegación futura e inventario

La exposición de la API queda limitada a los schemas declarados en `config.toml`; la seguridad de
objetos nuevos no depende de una clave no soportada por la CLI. Los privilegios predeterminados
revocan grants globales y de `public`/`private` para objetos futuros creados por `postgres`, incluido
EXECUTE heredado de PUBLIC. Las revocaciones explícitas siguen protegiendo los objetos actuales.
[security-inventory.json](../security-inventory.json) registra cada tabla, vista
y función del proyecto, incluso las de acceso denegado. No se regenera automáticamente al verificar.

El [verificador](../../scripts/supabase-security-inventory.mjs) compara el catálogo real, privilegios
efectivos (incluidos PUBLIC/herencia), columnas, delegación, propietarios, RLS y ACL/search_path de
funciones. La vista requiere `security_invoker` y una frontera documentada. Los objetos de extensiones
se excluyen del inventario del dominio. Crear una tabla/vista/función no registrada falla aunque no
conceda acceso; grants inesperados también fallan.

Para un despliegue futuro: revisar el diff declarativo y aplicar las revocaciones predeterminadas
con el **rol creador real**, las revocaciones de objetos existentes y sus grants deliberados en una
transacción. Repetir los default privileges para cualquier otro rol de despliegue; no afectan a los
objetos preexistentes ni a lo creado por otro propietario. Verificar la configuración de exposición
y el catálogo/ACL efectivo en ese entorno. Nada de ello se ha ejecutado remotamente aquí.

La [recuperación competitiva](../../docs/current/competitive-command-recovery.md) añade autorización
antes del replay, evaluación persistida y resultado terminal propio independiente de la cookie.
No añade tablas ni altera puntos históricos.

## Pruebas y riesgos pendientes

Ejecutar `npm run supabase:schema:test` con Docker y el PostgreSQL local de Supabase en marcha.
El ejecutor crea una base aleatoria separada, aplica los archivos SQL declarativos y el inventario,
ejecuta pgTAP y abre conexiones independientes para carreras. Siempre elimina esa base al terminar. Puede elegirse el
contenedor con `SUPABASE_DB_CONTAINER`; no se acepta una base destino existente. El bootstrap Auth
mínimo y los fixtures viven en `tests/support`, solo para esa base desechable; no son seeds.

| Suite                                        | Evidencia                                                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial_schema_rls.test.sql`                | Aislamiento de salas, columnas privadas, Auth anónimo, ownership, catálogo congelado, pruebas fantasma, cero puntos, empates e histórico.                                    |
| `commands.test.sql`                          | Defaults futuros, ACL sin DML, idempotencia, manipulación temporal, bloqueo de segunda sesión, Alfabeto, timeout, evaluación lenta e invitación atómica.                     |
| `command_boundaries.test.sql`                | Identidad/actor, acceso privado al evaluador, rollback de inicio/cierre/invalidación, reloj por nivel/pregunta, reanudación y continuidad tras cierre.                       |
| `s07_flash_history.test.sql`                 | Historial común cerrado, publicaciones vacías/en curso/canceladas, ranking histórico, abandonos parciales y revisión autorizada mixta de Flash/Supervivencia/Pirámide.       |
| `room_history_effective_alphabet.test.sql`   | Cierre efectivo sin tick, límites temporales, metadatos y respuestas de Alfabeto, expiración, aislamiento y permisos de revisión.                                            |
| `admin_portal_reads.test.sql`                | Contexto global del superadmin, salas activas, ACL del RPC, claims falsos y ausencia de acceso privado directo.                                                              |
| `s08_superadmin_room_commands.test.sql`      | Creación transaccional de sala, owner y grupo inicial; validaciones, slug, colisiones, ACL, rollback, idempotencia y auditoría agregada.                                     |
| `s13_flash_variable_questions.test.sql`      | Flash de 2, 5 y 20 preguntas, puntos por item, suma de 100, publicación, crecimiento y reducción del grafo editorial.                                                        |
| `s14_superadmin_challenge_reads.test.sql`    | Catálogo protegido que incluye contenido Survival sin filtrar documentos ni soluciones.                                                                                      |
| `s14_survival_editorial.test.sql`            | Validación de vidas/formato, publicación y programación Survival, y actores no autorizados.                                                                                  |
| `s14_survival_attempts.test.sql`             | Evaluación/puntos/vidas autoritativos, eliminación, recuperación, revisión propia y spectator sin acceso.                                                                    |
| `s15_pyramid_editorial.test.sql`             | Validación de siete niveles/briefings y rechazo de formatos sin evaluador competitivo.                                                                                       |
| `s15_pyramid_authoritative.test.sql`         | Avance, salto/cierre manipulado, recibos, timeout, recuperación, cima/fallo, revisión propia y acreditación única.                                                           |
| `s17_editorial_versioning.test.sql`          | Clonación/versionado de Flash, Survival y Pyramid, referencias de preguntas, idempotencia, archivado, comparación sin soluciones privadas, calendario y lecturas históricas. |
| `s20_superadmin_attempt_inspection.test.sql` | ACL de lecturas, aislamiento por sala/publicación, exclusión de tests, detalle sin soluciones, ajustes idempotentes, invalidación, rollback y ranking efectivo.              |
| `s21_attempt_expiration.test.sql`            | Expiración tras cierre/deadline, umbral de 15 minutos, limpieza de sesiones/progreso/auditoría, ausencia de puntos, idempotencia y exclusión de intentos test.               |
| `test-supabase-concurrency.mjs`              | Dos conexiones reales: inicio simultáneo con segunda sesión bloqueada, último uso de invitación, recepción duplicada y acreditación concurrente con invalidación.            |
| Contratos y evaluador TS                     | Inputs sin identidad/tiempos/puntos autoritativos; conversión ms/segundos y política de timeout del evaluador existente.                                                     |

Los tests de defaults, DML y respuesta sin presentación fallan con el diseño anterior. Los fallos
provocados en auditoría demuestran que no quedan operaciones parciales. La validación cubre
semántica PostgreSQL con roles reales del cluster y Auth mínimo, no un login GoTrue o HTTP real.

Última validación local completa registrada (expiración de intentos inactivos, 2026-09-29): `check-supabase-schema` cargó **54 archivos declarativos**
y el inventario de seguridad; pasan las suites existentes, S20 (21 checks) y S21 (14 checks), además de las carreras
las suites anteriores y las carreras con conexiones independientes. Las suites históricas incluyen
**26 checks pgTAP de E01, 24 de E02, 28 de E03,
26 de E04, 24 de E05, 12 de S05 y 19 de E10**, los casos de S07, S10, S11, S12 y S13, carreras entre conexiones independientes
y las pruebas TypeScript registradas en esa ejecución. También pasaron comprobación de tipos, ESLint,
arquitectura y los enlaces de documentación.
La suite SQL no sustituye
las pruebas Auth/HTTP/E2E, que se ejecutan en escenarios locales del portal, S02, S03, S04, S06,
S07, S10, S11 y S12, además de E01–E06; S06 añade
integración PostgREST y E2E de dos rankings, S07 añade historial y revisión tras refrescar y el
portal añade acceso privado y recarga en navegador; S08 añade búsqueda exacta, creación, idempotencia,
rollback y recarga del portal.

La credencial `service_role` sigue siendo confiable: tiene lectura interna amplia, puede invocar el
evaluador privilegiado y puede establecer claims en una conexión SQL. Evitar endpoints genéricos que
acepten evaluación/claims del navegador. El adaptador debe verificar Auth, validar JSON de formato,
limitar tamaño de peticiones y no filtrar soluciones. `postgres` y los roles de mantenimiento están
fuera de esta frontera; pueden alterar ACL/triggers y no deben ser credenciales de ejecución normal.

Quedan pendientes el vínculo y despliegue controlado en un proyecto remoto, pruebas Storage/GraphQL/
Realtime si se habilitan, retención de payloads e idempotencia, reemplazo/archivado editorial,
validación de contenido de otros formatos y planes EXPLAIN con volumen real. La selección de duraciones/
configuración de cada modo se valida al publicar; SQL protege límites positivos y versiones congeladas,
no todas las reglas de formato del producto.

Referencias oficiales consultadas el 2026-09-14:
[esquemas declarativos Supabase](https://supabase.com/docs/guides/local-development/declarative-database-schemas),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funciones](https://supabase.com/docs/guides/database/functions) y
[ALTER DEFAULT PRIVILEGES PostgreSQL 17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
