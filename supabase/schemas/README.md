# Esquema declarativo y frontera de comandos

Estado: vigente. Contratos del esquema; la evidencia fechada se conserva en el archivo.

## Fuentes y operación

Este directorio declara el estado esperado de PostgreSQL. El historial aplicado está en
[`../migrations`](../migrations/), partiendo del baseline y sus migraciones incrementales.
La revisión canónica está centralizada en [estado actual](../../docs/current/status.md) y se
contrasta mediante `npm run schema:revision:check`. No acredita la revisión instalada en una base concreta.

El [workflow de Supabase](../README.md) describe cómo cambiar y comprobar SQL. La
[guía de entornos](../../docs/current/supabase-clean-installation.md) describe instalación,
actualización y recuperación. Aplicar la base antes de publicar una aplicación que dependa de ella.
Las verificaciones locales no acreditan staging.

## Organización

El inventario exacto se obtiene de los archivos SQL y de
[`security-inventory.json`](../security-inventory.json). Las familias se ordenan para declarar
primero estructuras y después validadores, lecturas, comandos y ACL:

- `00`–`45`: namespaces, identidad, salas, contenido, competición, estado autoritativo, índices y helpers.
- `50`–`54z`: autorización, documentos y validación por formato/desafío, incluidas reglas de tableros y Contrarreloj.
- `55`–`68`: lecturas autorizadas, portal editorial, temporadas, calendario, biblioteca y assets.
- `70`–`85`: RLS, permisos de Storage, rankings e historial.
- `88`–`90`: soporte, operaciones privadas de intentos y fachadas de comandos.
- `91`–`99` y `s20`: recuperación/contextos, eventos y comandos específicos, activación de Pirámide,
  ensayos e inspección administrativa.
- `s24`–`s26`: informes experimentales históricos, observación por sala y medición automática por temporada.

No mantener aquí una copia de cada función ni cifras de tablas, archivos o tests.
Los [handlers de intentos](../../docs/current/sql-attempt-command-handlers-refactor.md),
la [validación por formato](../../docs/current/sql-question-validation-refactor.md) y la
[biblioteca editorial](../../docs/current/sql-question-library-refactor.md) describen sus fronteras.

## Autoridad y protocolo de servidor

- Auth identifica al actor; `players.id` es la identidad propia del dominio. El servidor verifica
  Auth y establece claims locales dentro de cada transacción. La credencial SQL no verifica JWT.
- El navegador no envía actor, puntos, evaluación ni fechas autoritativas. Los comandos privados
  usan sesión controladora, versión y clave idempotente; confirmar el reloj antes de entregar contenido.
- Confirmar la recepción antes de evaluar. La evaluación usa contenido congelado y solución privada;
  persistirla una vez, reconciliando recepciones antes de preparar otra interacción o cerrar.
- Un resultado incierto se resuelve con replay exacto o recuperación autorizada. Cambiar de dispositivo
  requiere transferencia explícita; revoca al controlador anterior y conserva intento y plazos.
- El [ciclo de vida](../../docs/current/attempt-lifecycle.md) y la
  [recuperación](../../docs/current/competitive-command-recovery.md) especifican cierre, permisos,
  interrupción, inactividad e idempotencia. Las consecuencias y relojes de los seis modos están en
  [sus contratos](../../docs/current/domain/mode-contracts.md).
- `private` queda fuera de Data API. Los comandos privilegiados tienen propietario `postgres`,
  `SECURITY DEFINER`, `search_path = ''` y nombres cualificados. `service_role` no dispone de DML
  genérico sobre el dominio ni sustituye la autorización del actor.
- Las RPC de mantenimiento solo permiten `service_role`. El tick aplica `statement_timeout = 0`
  y `lock_timeout = 0`; la expiración independiente tiene límite de 5 s. No exponerlas al navegador.
- Publicaciones, versiones, recepciones y hechos de puntuación se preservan. Ajustar o invalidar
  exige motivo, autorización y auditoría; los ensayos en memoria no acreditan puntos oficiales.

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
la revisión ajena durante una ventana abierta exige que quien consulta y el objetivo tengan un
intento competitivo completado; una vez cerrada, conserva la revisión histórica existente y la
ausencia de intentos en progreso. `get_room_member_review`
normaliza el estado a `open`/`closed` y añade `global_time_limit_ms` y `alphabet_letter`: ambos
son nulos fuera de Alfabeto. Alfabeto devuelve todas las letras, incluso las ausentes o agotadas,
y sus soluciones de la versión original. La expiración conserva los 15 minutos de inactividad
y reconoce el cierre efectivo o un deadline vencido, con revocación de sesión y auditoría.
Las RPC históricas se exponen únicamente mediante estas proyecciones comunes.

## Inventario y comprobaciones

El [inventario de seguridad](../security-inventory.json) registra tablas, vistas y funciones del
dominio, incluidas las de acceso denegado. No se regenera automáticamente al verificar.
El [comprobador](../../scripts/supabase-security-inventory.mjs) contrasta el catálogo real con el
inventario: propietarios, privilegios efectivos —incluidos PUBLIC y herencia—, columnas,
delegación, RLS, ACL, `search_path` y atributos de funciones. Las vistas requieren
`security_invoker` y una frontera documentada. Los objetos de extensiones se excluyen del
inventario del dominio. Un objeto no registrado o un grant inesperado hacen fallar la comprobación,
aunque el objeto no conceda acceso a los roles API.

Los privilegios predeterminados de `postgres` se revocan globalmente y por schema; toda capacidad
nueva necesita una concesión explícita. Los defaults solo afectan a objetos futuros del rol
creador al que se aplican: no cambian objetos existentes ni los creados por otro propietario.
Al introducir otro rol de despliegue, aplicar también sus defaults y revisar las revocaciones y
concesiones de los objetos existentes en la misma transacción. Comprobar en el entorno destino
la exposición de schemas y los privilegios efectivos del rol creador real.

```bash
npm run schema:revision:check
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:upgrade:test
npm run supabase:schema:reconciliation:test
npm run supabase:types:check
```

Las pruebas SQL requieren Docker y un contenedor de PostgreSQL disponible. Crean una base aleatoria,
la eliminan al terminar y no aceptan una base destino existente. Los fixtures de `tests/support`
son técnicos y no constituyen un seed editorial. SQL/pgTAP no sustituye Auth, HTTP ni los E2E.
[QA](../../docs/current/qa.md) conserva la matriz de comandos y sus límites.

La [referencia anterior](../../docs/archive/reports/schema-reference-before-2026-10-24.md)
conserva un resumen del contexto y las verificaciones históricas. Los pendientes de
staging, política de resultados, invitaciones y retención están en el
[backlog](../../docs/implementation-plan.md); no se deducen de una migración antigua.

## Medición automática de temporada

Las tablas privadas `room_measurement*` conservan alcance, eventos y disfrute por temporada.
La captura es común a todas las salas y la creación de temporadas prepara su medición sin
intervención administrativa. El superadmin consulta el informe y cuatro CSV. La autorización
compartida `private.require_measurement_admin()` permanece en el esquema de medición.
Los objetivos y umbrales Lean se aplican en análisis posterior y no condicionan la competición.
La migración `20261025120000_remove_product_experiments.sql` elimina los datos y objetos
experimentales de preproducción; las migraciones anteriores se conservan como historial.

El generador de tipos admite `SUPABASE_TYPES_DB_URL` para generar y contrastar el contrato contra
una base desechable actualizada, sin aplicar migraciones a la base local habitual. Si se omite,
`npm run supabase:types` y `npm run supabase:types:check` utilizan el stack local configurado.
