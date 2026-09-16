# Esquema declarativo y frontera de comandos

Estado: implementado y probado sobre PostgreSQL 17 local, 2026-09-16. **22 tablas**, una vista
interna, funciones públicas de lectura/ranking, contexto del portal privado y comandos privados de servidor. S01–S08 conectan
Auth, la interfaz y adaptadores PostgreSQL reales para perfil, salas y el vertical Flash competitivo.
S06 consulta los rankings de temporada y publicación abierta y reutiliza esa posición en las tarjetas.
S07 consulta el historial Flash cerrado y la revisión autorizada desde versiones y resultados
persistidos, sin materializar tablas adicionales. El portal consulta el contexto global de
superadmin y salas activas mediante `get_superadmin_portal_context()` y crea salas mediante un
comando transaccional específico de S08, sin DML directo ni proyecto remoto vinculado.
Las capacidades restantes siguen usando mocks o están pendientes. Las migraciones están versionadas;
no hay seed global ni proyecto remoto vinculado desde este entorno (`linked_project: null`).

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
- No hay heartbeat, abandono automático ni una caducidad adicional de sesión. `expires_at` es nulo
  o coincide con el deadline global. Tras ese deadline solo se permite resolver timeout, evaluar,
  finalizar o abandonar; no se entrega nuevo contenido jugable. El takeover entre dispositivos está
  deshabilitado durante el MVP.
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
pública. Las capacidades editoriales y de publicación global, así como la preparación de temporadas
y la operación del calendario, se implementarán como comandos del portal privado cuando entren en su
alcance.

Se conserva la visibilidad de perfiles históricos mínimos en rankings, la exclusión de resultados
invalidados de la lectura directa y la necesidad de membresía vigente para consultar resultados
propios. Retención, borrado de payloads/medios, inspección administrativa y cambios editoriales
requieren decisiones posteriores. El evaluador confiable decide finalización temprana y puntuación
normalizada de Supervivencia/Pirámide; SQL no duplica esas reglas ni los 31 evaluadores de formato.

## Archivos SQL

El orden lexicográfico expresa dependencias. Son declaraciones de estado deseado para una base
vacía; no son scripts repetibles sobre una base poblada.

| Archivo                                                  | Propósito                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [00_namespaces.sql](00_namespaces.sql)                   | Schemas, extensión y revocaciones predeterminadas globales y por schema para objetos futuros de `postgres`.                         |
| [10_identity_rooms.sql](10_identity_rooms.sql)           | Identidad, salas, membresías, invitaciones, temporadas y superadmin.                                                                |
| [20_content.sql](20_content.sql)                         | Catálogo congelado, soluciones, items y límites temporales publicados.                                                              |
| [30_competition.sql](30_competition.sql)                 | Publicaciones, intentos, sesiones, respuestas, libro de puntos y auditoría. Deadline global y expiración anulables.                 |
| [35_authoritative_state.sql](35_authoritative_state.sql) | Unidades temporales, intervalos de visita, recepciones inmutables e idempotencia. FK obligatoria desde respuesta final a recepción. |
| [40_indexes.sql](40_indexes.sql)                         | Índices de autorización, calendario, unicidad y consultas competitivas.                                                             |
| [50_access_helpers.sql](50_access_helpers.sql)           | Resolución del jugador y ayudas RLS sin recursión.                                                                                  |
| [57_superadmin_reads.sql](57_superadmin_reads.sql)       | Contexto mínimo server-side del portal de superadmin, sin acceso global RLS ni DML.                                                |
| [58_superadmin_room_commands.sql](58_superadmin_room_commands.sql) | Lookup exacto de jugadores y creación auditada/idempotente de sala, owner y grupo inicial desde el portal. |
| [60_integrity.sql](60_integrity.sql)                     | Integridad estructural, ownership, congelación e histórico. Las marcas de respuesta se derivan de su recepción.                     |
| [70_rls.sql](70_rls.sql)                                 | Revocaciones existentes, lecturas limitadas y actualización propia; servicio sin DML.                                               |
| [80_rankings.sql](80_rankings.sql)                       | Vista privada invoker y funciones públicas autorizadas por membresía.                                                               |
| [85_flash_history_reads.sql](85_flash_history_reads.sql) | Historial Flash y revisión de resultados con autorización por sala, publicación y jugador.                                        |
| [90_commands.sql](90_commands.sql)                       | Operaciones transaccionales y lectura privada del contexto del evaluador.                                                           |

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
   y no revoca la sesión anterior; el takeover entre dispositivos está aplazado para después del MVP.
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

| Operación privada                              | Autorización y garantía                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `start_attempt`                                | Miembro competitivo durante apertura para un inicio nuevo; recuperación sin nuevo intento.        |
| `take_over_attempt`                            | Reservado para una política posterior; devuelve `takeover_disabled` durante el MVP.               |
| `prepare_interaction`                          | Propietario y sesión vigente; persiste reloj antes de devolver contenido.                         |
| `recover_attempt` / `read_attempt_recovery`     | S04 Flash: cierra/evalúa atómicamente la interacción abierta antes de preparar contenido; no reentrega payload. |
| `receive_answer`, `pass_interaction`           | Sesión, item actual, versión y recepción autoritativa; pasar solo en Alfabeto antes del deadline. |
| `read_evaluation_context`, `record_evaluation` | Servidor confiable en contexto del propietario; recepción vinculada a versión congelada.          |
| `complete_attempt`, `abandon_attempt`          | Propietario y sesión vigente; cierre, sesiones, puntos y auditoría atómicos.                      |
| `accept_invitation`                            | Actor verificado; sala activa, token, caducidad, usos y estado de membresía bajo bloqueo.         |
| `invalidate_attempt`, `adjust_result`          | Superadmin activo, motivo y versión; saldo y auditoría atómicos.                                  |

El dispatcher genérico y sus helpers no tienen EXECUTE para los roles API. No hay RPC de escritura
pública. Los errores de versión/idempotencia usan SQLSTATE `40001`; autorización `42501`, input
`22023` y estado incompatible `55000`. El adaptador mapeará también errores estructurales de
constraints/triggers y reintentará transacciones completas cuando proceda, conservando la clave.

## Matriz de permisos SQL directos

`S` = SELECT; `U` = UPDATE. En todas las filas `anon` tiene denegado el acceso. El superadmin humano
usa las mismas ACL/RLS que cualquier `authenticated`: solo los comandos administrativos comprueban
su asignación en DB. `service_role` elude RLS, por lo que la restricción de escritura es la ACL.

| Tabla                                | authenticated (incluye roles de sala y superadmin humano)                      | service_role |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------ |
| `public.players`                     | S columnas sociales propias/miembros activos compartidos; U nombre propio      | S            |
| `public.rooms`                       | S sala activa con membresía activa                                             | S            |
| `public.room_memberships`            | S miembros activos de sala accesible                                           | S            |
| `public.seasons`                     | S temporadas no borrador de sala accesible                                     | S            |
| `public.scheduled_challenges`        | S publicaciones de temporada visible                                           | S            |
| `public.attempts`                    | S columnas del intento competitivo propio no invalidado, con membresía vigente | S            |
| `private.platform_role_assignments`  | —                                                                              | S            |
| `private.room_invitations`           | —                                                                              | S            |
| `private.question_definitions`       | —                                                                              | S            |
| `private.question_versions`          | —                                                                              | S            |
| `private.question_version_solutions` | —                                                                              | S            |
| `private.challenge_definitions`      | —                                                                              | S            |
| `private.challenge_versions`         | —                                                                              | S            |
| `private.challenge_items`            | —                                                                              | S            |
| `private.attempt_sessions`           | —                                                                              | S            |
| `private.attempt_answers`            | —                                                                              | S            |
| `private.flash_point_entries`        | —                                                                              | S            |
| `private.audit_log`                  | —                                                                              | S            |
| `private.command_requests`           | —                                                                              | —            |
| `private.attempt_timing_units`       | —                                                                              | —            |
| `private.interaction_intervals`      | —                                                                              | —            |
| `private.answer_receipts`            | —                                                                              | —            |

Las lecturas internas sirven al ensamblado del evaluador, las comprobaciones de contexto y las
proyecciones del servidor; no se trasladan al navegador. Las nuevas tablas solo se leen por comandos.
No hay INSERT/DELETE directos ni políticas permisivas para ellos. Las siete políticas existentes
cubren seis SELECT y UPDATE del nombre con `USING` y `WITH CHECK`. Todas las tablas tienen RLS.
`private.effective_results` es una vista invoker accesible al servicio; los rankings públicos solo
son ejecutables por `authenticated` y comprueban membresía, devolviendo datos sociales
mínimos. `anon` no puede ejecutarlos. `get_challenge_ranking` ordena por puntos, duración efectiva
y `started_at` en servidor, aunque mantiene `started_at` fuera de su retorno público; el adaptador
S06 consume el orden y los campos expuestos sin inventar esa fecha. S07 añade
`get_flash_history(text, uuid)` y `get_flash_member_review(text, uuid, uuid)`: ambos son
`SECURITY DEFINER`, fijan `search_path = ''`, no exponen tablas `private` directamente y solo tienen
`EXECUTE` para `authenticated`. El historial no contiene payloads de pregunta ni soluciones; la
revisión solo entrega soluciones al propio jugador terminal o a un `owner`, `admin` o `member` que
revise un resultado ajeno elegible.

## Denegación futura e inventario

`api.auto_expose_new_tables = false` cierra la concesión automática local. Los privilegios
predeterminados revocan grants globales y de `public`/`private` para objetos futuros creados por
`postgres`, incluido EXECUTE heredado de PUBLIC. Las revocaciones explícitas siguen protegiendo los
objetos actuales. [security-inventory.json](../security-inventory.json) registra cada tabla, vista
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

## Pruebas y riesgos pendientes

Ejecutar `npm run supabase:schema:test` con Docker y el PostgreSQL local de Supabase en marcha.
El ejecutor crea una base aleatoria separada, aplica los archivos SQL declarativos y el inventario,
ejecuta pgTAP y abre conexiones independientes para carreras. Siempre elimina esa base al terminar. Puede elegirse el
contenedor con `SUPABASE_DB_CONTAINER`; no se acepta una base destino existente. El bootstrap Auth
mínimo y los fixtures viven en `tests/support`, solo para esa base desechable; no son seeds.

| Suite                           | Evidencia                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial_schema_rls.test.sql`   | Aislamiento de salas, columnas privadas, Auth anónimo, ownership, catálogo congelado, pruebas fantasma, cero puntos, empates e histórico.                         |
| `commands.test.sql`             | Defaults futuros, ACL sin DML, idempotencia, manipulación temporal, bloqueo de segunda sesión, Alfabeto, timeout, evaluación lenta e invitación atómica.          |
| `command_boundaries.test.sql`   | Identidad/actor, acceso privado al evaluador, rollback de inicio/cierre/invalidación, reloj por nivel/pregunta, reanudación y continuidad tras cierre.            |
| `s07_flash_history.test.sql`    | Historial Flash cerrado, publicaciones vacías/en curso/canceladas, ranking histórico, versión archivada, abandonos parciales y revisión propia/ajena.           |
| `admin_portal_reads.test.sql`  | Contexto global del superadmin, salas activas, ACL del RPC, claims falsos y ausencia de acceso privado directo.                                                       |
| `s08_superadmin_room_commands.test.sql` | Creación transaccional de sala, owner y grupo inicial; validaciones, slug, colisiones, ACL, rollback, idempotencia y auditoría agregada. |
| `test-supabase-concurrency.mjs` | Dos conexiones reales: inicio simultáneo con segunda sesión bloqueada, último uso de invitación, recepción duplicada y acreditación concurrente con invalidación. |
| Contratos y evaluador TS        | Inputs sin identidad/tiempos/puntos autoritativos; conversión ms/segundos y política de timeout del evaluador existente.                                          |

Los tests de defaults, DML y respuesta sin presentación fallan con el diseño anterior. Los fallos
provocados en auditoría demuestran que no quedan operaciones parciales. La validación cubre
semántica PostgreSQL con roles reales del cluster y Auth mínimo, no un login GoTrue o HTTP real.

Validación local actual: las comprobaciones SQL existentes más **15 casos pgTAP del portal**, los
casos de S07 y **27 casos pgTAP de S08**, carreras entre conexiones independientes y **540 pruebas
TypeScript** superadas. También pasan comprobación
de tipos, arquitectura de tipos, ESLint y los enlaces de documentación. La suite SQL no sustituye
las pruebas Auth/HTTP/E2E, que se ejecutan en escenarios locales de S01–S08 y portal; S06 añade
integración PostgREST y E2E de dos rankings, S07 añade historial y revisión tras refrescar y el
portal añade acceso privado y recarga en navegador; S08 añade búsqueda exacta, creación, idempotencia,
rollback y recarga del portal.

La credencial `service_role` sigue siendo confiable: tiene lectura interna amplia, puede invocar el
evaluador privilegiado y puede establecer claims en una conexión SQL. Evitar endpoints genéricos que
acepten evaluación/claims del navegador. El adaptador debe verificar Auth, validar JSON de formato,
limitar tamaño de peticiones y no filtrar soluciones. `postgres` y los roles de mantenimiento están
fuera de esta frontera; pueden alterar ACL/triggers y no deben ser credenciales de ejecución normal.

Quedan pendientes el vínculo y despliegue controlado en un proyecto remoto, pruebas Storage/GraphQL/
Realtime si se habilitan, retención de payloads e idempotencia, gestión editorial autorizada,
validación de contenido publicado y planes EXPLAIN con volumen real. La selección de duraciones/
configuración de cada modo se valida al publicar; SQL protege límites positivos y versiones congeladas,
no todas las reglas de formato del producto.

Referencias oficiales consultadas el 2026-09-14:
[esquemas declarativos Supabase](https://supabase.com/docs/guides/local-development/declarative-database-schemas),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funciones](https://supabase.com/docs/guides/database/functions) y
[ALTER DEFAULT PRIVILEGES PostgreSQL 17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
