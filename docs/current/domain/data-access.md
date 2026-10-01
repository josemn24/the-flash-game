# Capa de acceso y consultas

## Estado y alcance

La fase 4 está cerrada para las slices verificadas. S01–S15, S17a, S18b parcial, D08a/D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19,
E01–E06/E10 y el portal privado consolidan la integración real de Supabase y completan el
recorrido `Auth → home → mis salas → detalle → introducción autorizada → Flash/Supervivencia/Pirámide competitivo →
recuperación/abandono → rankings → historial/revisión`: la home, el detalle de una sala, su
introducción, el gameplay Flash/Supervivencia/Pirámide, los rankings, el historial común cerrado y la revisión completa consultan o
mutan mediante fronteras autorizadas. `/admin` ya proporciona el contexto server-side de
superadministración y las salas activas. S08 añade la primera mutación administrativa: creación
transaccional de sala, owner y grupo inicial desde el portal. Alphabet ya usa una proyección
server-only y los comandos competitivos existentes; los ajustes de sala ya tienen gestión parcial de
membresías (conceder/quitar admin y eliminación lógica por el owner), mientras que transferencia,
bloqueo/desbloqueo e invitaciones completas siguen pendientes. Supervivencia aporta vidas autoritativas;
S15 integra Pirámide con niveles, evaluación, finalización y revisión server-side, verificada en el
stack local. Narrativa sigue mock hasta su vertical slice.

La dirección vigente es:

```text
Server Components
→ server/production-home-data-access.ts
→ server/composition/production.ts
→ application/use-cases/room-reads.ts
→ application/queries (capacidades de lobby)
→ infrastructure/supabase/identity + rooms
→ Supabase Auth/RPC/RLS
→ PostgreSQL

Las lecturas de S02, S03, E01, S06 y S07 siguen una frontera específica:

Server Components
→ server/production-room-data-access.ts
→ server/composition/production.ts
→ application/use-cases/room-reads.ts
→ capacidades de sala (lobby, ranking, settings, history y member detail)
→ infrastructure/supabase/rooms/*
→ infraestructura Supabase compartida
→ RPCs públicas de lectura estrecha
→ PostgreSQL privado/RLS

Portal privado `/admin`
→ server/production-admin-data-access.ts
→ server/admin.ts
→ infrastructure/supabase/admin/superadminQueries.ts
→ public.get_superadmin_portal_context() con temporadas y zona horaria
→ asignación privada de plataforma y salas activas

Dashboard del portal `/admin`
→ server/production-admin-data-access.ts
→ server/admin.ts
→ infrastructure/supabase/admin/superadminDashboardQueries.ts
→ public.get_superadmin_dashboard_context()
→ métricas, resúmenes de salas, próximos desafíos y alertas derivadas
→ `components/admin/AdminDashboard` sin formularios ni contexto editorial completo

Áreas operativas del portal `/admin/rooms`, `/admin/rooms/[roomId]`, `/admin/challenges` y
`/admin/questions`
→ shell y navegación comunes de `components/admin`
→ cada página mantiene su propia autorización, loader especializado y mutaciones existentes

Mutaciones del portal `/admin`
→ app/admin/actions.ts
→ server/admin.ts + server/admin-room.ts
→ infrastructure/supabase/admin/superadminQueries.ts
→ public.lookup_superadmin_players() / public.create_superadmin_room()
→ comando privado transaccional + private.audit_log

Mutaciones de temporadas del portal `/admin`
→ app/admin/season-actions.ts
→ server/admin.ts + server/admin-season.ts
→ infrastructure/supabase/admin/superadminSeasonQueries.ts
→ public.create_superadmin_season() / public.update_superadmin_season() /
  public.activate_superadmin_season()
→ comando privado transaccional, idempotencia y private.audit_log

Calendario temporal del detalle de sala `/admin/rooms/[roomId]?tab=calendar`
→ `app/admin/calendar-actions.ts`
→ `server/admin-calendar.ts`
→ `infrastructure/supabase/admin/superadminCalendarQueries.ts`
→ `public.create_superadmin_scheduled_challenge()` / `public.update_superadmin_scheduled_challenge()`
→ publicación `scheduled` con ventana UTC, locks, conflictos optimistas, idempotencia y auditoría

Calendar tick protegido
→ Vercel Cron: `GET /api/internal/calendar/tick` a las 00:05 UTC en producción con `CRON_SECRET`
→ operación local: `POST /api/internal/calendar/tick` o `npm run calendar:tick` con `CALENDAR_TICK_SECRET`
→ conexión PostgreSQL server-only con `SET LOCAL ROLE service_role`
→ `private.run_calendar_tick_command()`
→ estados efectivos, expiración global de intentos inactivos, auditoría de sistema y finalización de temporadas sin DML de cliente

Reconciliación bajo demanda de intentos
→ `infrastructure/supabase/attempts/attemptExpiration.ts` (server-only)
→ `private.expire_stale_attempts(jsonb)` con `service_role`
→ antes de `get_room_history`, limitada al `roomSlug`
→ antes de un comando de intento, limitada al `attemptId`
→ 15 minutos de inactividad + publicación cerrada/deadline vencido
→ `abandoned` sin puntos; una acción que encuentra el cierre recibe `attempt_inactivity_expired`

Lectura editorial protegida del portal `/admin`
→ server/production-admin-data-access.ts
→ server/admin-editorial.ts
→ infrastructure/supabase/admin/superadminEditorialQueries.ts
→ public.get_superadmin_editorial_context()
→ borradores completos solo para superadmin; publicados/archivados como metadatos

Mutaciones editoriales del portal `/admin`
→ app/admin/editorial-actions.ts
→ server/admin-editorial.ts
→ infrastructure/supabase/admin/superadminEditorialQueries.ts
→ public.create_superadmin_flash_draft() / public.update_superadmin_flash_draft() /
  public.publish_superadmin_flash() / public.create_superadmin_challenge_revision() /
  public.archive_superadmin_challenge_version()
→ grafo versionado, idempotencia, concurrencia optimista, auditoría y publicación atómica

Comparación editorial del historial
→ `/admin/challenges/[challengeDefinitionId]?compareFrom=<id>&compareTo=<id>`
→ `get_superadmin_challenge_version_comparison()`
→ snapshot seguro de metadatos, referencias, orden, puntos y payload público; nunca `solutionPayload`

Las correcciones de una pregunta no mutan una versión publicada del desafío: el editor representa
las preguntas publicadas clonadas como referencias de biblioteca y remite a `/admin/questions` para
crear/publicar una nueva `question_version` antes de seleccionarla. Las lecturas de salas, calendario,
intentos e historial admiten `archived` cuando la publicación ya existente referencia esa versión;
la creación o reprogramación de una publicación vuelve a exigir `published`.

Eventos Mini-Wordle del Flash competitivo
→ `features/game/useServerFlashSession.ts`
→ `POST /api/competitive/attempts/[attemptId]/mini-wordle/guess`
→ `server/competitive/attempt-api.ts`
→ `infrastructure/supabase/attempts/attemptCommands.ts`
→ `private.submit_mini_wordle_guess(jsonb)`
→ `private.mini_wordle_guess_events` + `private.answer_receipts`
→ evaluador confiable desde la respuesta final construida por PostgreSQL

Eventos Logic-code del Flash competitivo
→ `features/game/useServerFlashSession.ts`
→ `POST /api/competitive/attempts/[attemptId]/logic-code/attempt`
→ `server/competitive/attempt-api.ts`
→ `infrastructure/supabase/attempts/attemptCommands.ts`
→ `private.submit_logic_code_attempt(jsonb)`
→ `private.logic_code_attempt_events` + `private.answer_receipts`
→ evaluador confiable desde `submittedCodes` e `incorrectAttempts` reconstruidos por PostgreSQL

Eventos Progressive-clues del Flash competitivo
→ `features/game/useServerFlashSession.ts`
→ `POST /api/competitive/attempts/[attemptId]/progressive-clues/reveal`
→ `server/competitive/attempt-api.ts`
→ `infrastructure/supabase/attempts/attemptCommands.ts`
→ `private.reveal_progressive_clue(jsonb)`
→ `private.progressive_clue_reveal_events` + `private.answer_receipts`
→ evaluador confiable desde `progressiveCluesRevealed` reconstruido por PostgreSQL

Las demos explícitas de Flash Pop conservan este flujo:

Server Components
→ server/demo-data-access.ts
→ application/queries
→ infrastructure/mock
→ mockDomainStore
→ DTOs y view models
→ Client Components
```

Las dos composiciones son explícitas y request-safe: `server/composition/production.ts` conecta
lecturas Supabase y `server/composition/demo.ts` conecta las lecturas mock. Las fachadas conservan
`server-only`, `cache()` y la traducción de ausencia a la navegación de Next.js, pero no importan
adaptadores concretos. Una composición no captura cookies ni perfiles en un singleton; el
`CurrentViewerReader` resuelve el actor por petición y el caso de uso crea un único `QueryContext`
con ese perfil y el reloj de consulta.

La composición mock no se selecciona por `roomKey` ni por `FLASH_RUNTIME_SCOPE`. Solo las rutas
explícitas de Flash Pop importan `server/demo-data-access.ts`; `/salas/*` importan
`server/production-room-data-access.ts`, `/desafios/*` combinan las fachadas de desafíos y salas,
`/admin/*` importa `server/production-admin-data-access.ts` y la home importa
`server/production-home-data-access.ts`. Un fallo de la fuente persistida se propaga
como error recuperable y nunca activa un fallback mock. `RoomSessionProvider` puede seguir montado
para las demos, pero un modelo `server` nunca se sobrescribe con `localResults`.

E01 entrega a la UI únicamente el payload público y `progress` seguro (`guesses`, `feedback`,
`attemptsUsed`, `maxAttempts`). La solución, `additionalGuesses` y `dictionaryId` quedan en el
servidor. Una palabra se acepta si está en el diccionario versionado de
`private.mini_wordle_dictionary_words` o en `additionalGuesses` de esa pregunta; la solución se
acepta implícitamente aunque sea temática. El diccionario general se carga desde los JSON de
`public/dictionaries`, pero las palabras específicas no se añaden al diccionario global. Un error
de Auth/DB/PostgREST no cambia la selección a un adaptador mock.

E03 entrega solo `question`, metadatos de conteo/penalización y el prefijo de pistas concedidas.
`private.progressive_clue_reveal_events` registra la primera pista gratuita y cada revelación
posterior; el comando resuelve la siguiente pista desde la versión congelada, aplica la penalización
como porcentaje de una base editorial de 100 puntos, redondea al entero más cercano y mantiene una
penalización mínima de un punto cuando el porcentaje es positivo. El descuento escala con
`challenge_items.points`; por ejemplo, una penalización de 20 en un nivel de 12 puntos resta 2.
El comando incrementa `lock_version` y devuelve únicamente la pista y el máximo actualizado. La
evaluación ignora cualquier contador del navegador, reconstruye `progressiveCluesRevealed` y usa el
máximo del último evento persistido, de modo que puntuación y revisión coinciden y los intentos
abiertos conservan el máximo que ya se les había mostrado.

E04 entrega únicamente las dos columnas públicas. La interacción construye el mapa completo en el
navegador y una sola recepción genérica valida todas las asociaciones contra la versión congelada;
una respuesta completa con cualquier error es incorrecta y no existe puntuación parcial ni penalización
por pareja. `correctMatchId` y la solución completa aparecen únicamente en la revisión autorizada.

E05 entrega el tablero `N×N` (entre 4×4 y 8×8), las regiones, las coronas precolocadas y un progreso seguro. El navegador
edita las coronas localmente y guarda checkpoints mediante `private.save_queens_draft(jsonb)` sin
crear resultados ni penalizaciones. Al alcanzar `N` coronas, el tablero completo pasa por
`private.submit_queens_answer(jsonb)`, que bloquea el intento, reconstruye las métricas, registra una
validación completa y solo crea una recepción terminal si la solución es correcta. Cada validación
incorrecta aplica un 5% de penalización; las marcas X siguen siendo estado local y se descartan al
recuperar. La solución solo se reconstruye en el contexto privado de evaluación y revisión autorizada.

S05 entrega `public.get_my_alphabet_challenge` con letras y payloads públicos `short-text`, y
`public.get_my_alphabet_result` solo tras un intento completado. El cliente conserva únicamente el
estado visual de la sesión; `prepare_interaction`, `pass_interaction`, `receive_answer` y la
evaluación server-side son la autoridad del reloj, los pases, las respuestas y el resultado.

La matriz operativa completa, los límites HTTP y el procedimiento reproducible de Supabase están en
[`s22-operacion.md`](../s22-operacion.md).

Las rutas de sala y desafío son dinámicas. La galería editorial `/formatos` y sus fichas siguen
siendo públicas y estáticas. La beta no añade rutas públicas para crear salas, gestionar
invitaciones o preparar temporadas: esas operaciones pertenecerán a una frontera privada de
superadmin. El alta directa de un miembro será un comando de provisioning, no una aceptación de
invitación.

## Contratos de aplicación

`application/queries` define `CurrentViewerProvider`, las capacidades `RoomLobbyQueries`,
`RoomRankingQueries`, `RoomSettingsQueries`, `RoomHistoryQueries`, `RoomMemberDetailQueries`,
`DemoChallengeQueries` y `CompetitiveChallengeQueries`, además de los contratos de
superadministración. `application/ports` añade
`CurrentViewerReader`, `PrivateQuestionAssetResolver`, `SuperadminRoomCommands`,
`SuperadminEditorialCommands`, `SuperadminCalendarCommands` y `SuperadminCalendarQueries` para
separar las dependencias de lectura de sala y las mutaciones administrativas de las consultas. Esta
capa solo conoce tipos de dominio y view models; no depende de Next.js, React, fixtures ni
adaptadores.

Todas las consultas reciben un `QueryContext` con el perfil autenticado ya resuelto y el instante de
la petición. El contexto se construye exclusivamente en los casos de uso server-side: no acepta
`viewerId`, `authUserId`, tokens ni clientes Supabase desde una ruta. Las entradas usan aliases de
ruta legibles. Los UUID canónicos se resuelven y quedan encapsulados en infraestructura.

Los DTOs de sala no devuelven identidades de autenticación, roles globales, filas canónicas ni
payloads privados. Los rankings y el historial se calculan desde membresías, publicaciones,
intentos y respuestas normalizados.

## Composición de servidor

Las fachadas `server/production-*-data-access.ts` llevan el marcador `server-only` y memoizan con
`cache` de React y delegan en `productionReadServices`. `server/profile.ts` conserva su frontera
independiente para el perfil y queda fuera de esta migración de lecturas de home, salas y desafíos.
Esa frontera valida la sesión con `auth.getUser()`, llama al RPC estrecho `public.provision_player`
y devuelve un DTO mínimo. El nombre se actualiza mediante la política RLS del propio jugador; no
existe DML de aplicación con `service_role`.

La home, el detalle S02, los rankings S06 y el historial/revisión S07 delegan en
`ApplicationRoomReads`. El caso de uso resuelve una vez el perfil actual, construye el
`QueryContext` y delega cada operación en una capacidad de sala. Los adaptadores concretos son
`SupabaseRoomLobbyQueries`, `SupabaseRoomRankingQueries`, `SupabaseRoomSettingsQueries`,
`SupabaseRoomHistoryQueries` y `SupabaseRoomMemberDetailQueries`; ninguno agrupa el contrato de
otra capacidad. Para una sala real el adaptador correspondiente resuelve la temporada desde
`get_room_detail`, consulta `get_season_ranking` y, cuando corresponde,
`get_challenge_ranking`. S07 usa `get_room_history` para agrupar publicaciones cerradas y
`get_room_member_review` para reconstruir la revisión desde la versión histórica enlazada. Antes de
esas lecturas ejecuta la reconciliación acotada a la sala para que los intentos que ya cumplen la
política no oculten indefinidamente la publicación. Carga
en paralelo los rankings necesarios para el detalle de miembro. Las filas JSON se validan antes de
convertirse a view models; los UUID de jugador son el `memberId` canónico y un error RPC o una fila
inválida se propaga. Las consultas mock no participan en las rutas de sala. Las vistas reales no
aceptan aliases de fixtures ni pueden caer silenciosamente en la composición demo.

`get_my_room_cards` reutiliza el mismo `get_season_ranking` para `current_position`. Así, puntos,
empates y la posición visible en home/detalle proceden de una sola semántica SQL. El RPC de desafío
mantiene privado `started_at`: el servidor lo usa para ordenar y S06 no lo muestra; el detalle de
miembro/histórico que pueda necesitarlo se mantiene dentro de la proyección autorizada S07.

El detalle real carga además `public.get_room_calendar(target_room_slug)`. Esa proyección expone solo
metadatos de publicaciones Flash y deriva `upcoming`, `available`, `closed` o `cancelled` con el reloj
de PostgreSQL; `can_start` requiere una publicación compatible y `can_continue` conserva el enlace de
un intento propio en curso incluso después del cierre o de finalizar la temporada. El portal usa una
lectura separada de calendario y comandos de programación/reprogramación exclusivos de superadmin.

`server/composition/production.ts` es el único composition root de las lecturas públicas reales.
Conecta las cinco capacidades de sala y el adaptador competitivo con sus dependencias de
infraestructura. La implementación Supabase concentra Auth, RLS, RPCs, reconciliación y resolución
de URLs firmadas. Ningún parámetro de URL ni dato del cliente puede elegir la identidad de consulta,
y las assets privadas solo se resuelven para el miembro autorizado. `ApplicationRoomReads` y
`ApplicationCompetitiveChallengeReads` reciben un contexto ya autenticado y no conocen cookies,
redirects, `notFound()` ni Supabase. Las fachadas usan `cache` de React para compartir una misma
promesa dentro de la petición, incluida la lectura repetida por `generateMetadata` y por la página.
No hay caché persistente ni compartida entre usuarios.

Los clientes Supabase se tipan con `lib/supabase/database.types.ts`, generado desde el schema
`public` de la base local mediante `npm run supabase:types`. Estos tipos describen el contrato de
persistencia y RPC. Los adaptadores derivan de ellos los tipos de transporte y conservan aliases
locales más estrictos para los datos después de pasar por guards; no sustituyen los guards, los
mappers ni los view models de aplicación. Las respuestas `Json` siguen siendo datos no confiables
hasta su validación explícita.
El schema `private` no forma parte del contrato TypeScript compartido ni de la Data API.

El procedimiento operativo para regenerar y verificar estos tipos está documentado en el
[workflow de tipos TypeScript generados](../../../supabase/README.md#workflow-de-tipos-typescript-generados).

### Separación del portal de superadministración

`SuperadminPortalContext` conserva el contexto amplio que necesitan las operaciones actuales de
`/admin` y la entrada al listado de salas: salas con temporadas, editorial, biblioteca de preguntas
y calendario opcional. `SuperadminRoomDetailModel` es el contrato acotado del detalle: una sala
activa, todas sus temporadas, miembros activos, calendario filtrado por sala y desafíos Flash
publicado necesario para programar. `SuperadminDashboardModel` es un contrato independiente y deliberadamente pequeño para
el dashboard: operador, métricas, resúmenes de salas, próximos desafíos, alertas y destinos de
navegación. No contiene documentos editoriales, soluciones, la biblioteca completa ni formularios.

La navegación canónica queda fijada así:

| Ruta                                        | Responsabilidad                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `/admin`                                    | Dashboard operativo breve, sin formularios ni documentos editoriales          |
| `/admin/rooms`                              | Área especializada de salas activas y creación de salas                       |
| `/admin/rooms/[roomId]`                     | Detalle de sala; temporadas, miembros y calendario como subáreas contextuales |
| `/admin/challenges`                         | Catálogo especializado de desafíos Flash y Survival definidos                 |
| `/admin/challenges/new`                     | Creación de un desafío Flash o Survival                                       |
| `/admin/challenges/[challengeDefinitionId]` | Detalle, borrador e historial de versiones Flash/Survival                     |
| `/admin/questions`                          | Biblioteca de preguntas existente, integrada en el shell común                |

El dashboard no carga documentos editoriales, soluciones, la biblioteca completa ni todas las
entradas del calendario. Las operaciones de temporada y calendario se ejecutan en el detalle de la
sala y, tras una operación correcta, la Server Action revalida el dashboard y la ruta de esa sala
antes de redirigir al usuario a la pestaña correspondiente con un aviso contextual. El shell visual no es una frontera de seguridad:
cada página y cada Server Action continúa usando `requireSuperadmin()`.

### Estructura de las subpáginas administrativas

Las páginas administrativas siguen la frontera `Server Page + Client Panels`. Cada `page.tsx`
autoriza, carga un page model mínimo, interpreta los avisos de URL y compone `AdminShell` con el
panel de su área. Los paneles cliente concentran únicamente estado local, `useActionState`,
transiciones y controles interactivos; no contienen una frontera de permisos alternativa.

Los paneles operativos se organizan por responsabilidad: temporadas separa sus formularios de
creación, edición, activación, fechas y tarjetas; calendario separa la programación de nuevas
publicaciones y la reprogramación de entradas; salas separa la búsqueda de propietario y la lista
de miembros; contenido separa la previsualización protegida del coordinador editorial. Los patrones
visuales repetidos viven en `components/admin` (`AdminSectionHeader`, `AdminEmptyState`,
`AdminFormError` y `AdminAuditReasonField`) sin ocultar las diferencias de validación de cada
acción.

La biblioteca de preguntas y sus editores también se montan dentro de `AdminShell`. Sus loaders
específicos devuelven el operador y el detalle mínimo necesario, sin cambiar las acciones ni los
contratos del editor:

| Ruta                                   | Loader / composición                                     |
| -------------------------------------- | -------------------------------------------------------- |
| `/admin/questions`                     | `getSuperadminQuestionLibraryPageModel` + biblioteca     |
| `/admin/questions/new`                 | `getSuperadminNewQuestionPageModel` + editor vacío       |
| `/admin/questions/[questionVersionId]` | `getSuperadminQuestionVersionPageModel` + detalle/editor |

No existen rutas de detalle para salas, temporadas o contenido. Los RPCs, comandos, payloads de
Server Actions y permisos permanecen en sus módulos originales; esta extracción solo cambia la
composición y la mantenibilidad de la UI.

### Criterios de pulido y validación

El portal debe conservar un shell navegable por teclado, con enlace para saltar al contenido,
foco visible, breadcrumbs y estados de operación anunciados de forma no intrusiva. Las áreas
operativas deben apilar sus formularios y tarjetas en pantallas pequeñas sin perder etiquetas,
acciones ni mensajes de error. La validación final cubre composición del dashboard, navegación,
editor de preguntas, estados vacíos, autorización, acciones idempotentes y los flujos E2E de
salas, temporadas, contenido y calendario.

## Autorización

- Una consulta de sala exige una membresía activa.
- Owners, admins, members y spectators pueden leer las vistas de sala.
- Los spectators no aparecen en rankings competitivos y no pueden obtener un desafío competitivo
  contextualizado en una sala.
- Los miembros antiguos pueden figurar en resultados históricos si eran competitivos cuando
  iniciaron el intento, pero ya no pueden leer la sala.
- El historial exige una membresía activa del lector, incluye publicaciones `flash`, `survival` y `pyramid` `closed` sin
  intentos `in_progress` y conserva publicaciones sin participantes. Las filas competitivas excluyen
  `test`, `invalidated` y `cancelled`; los espectadores no aparecen como jugadores.
- La revisión propia y ajena exige `owner`, `admin` o `member`; `spectator` puede consultar historial y
  ranking, pero no recibe respuestas ni soluciones, tampoco por URL directa. Solo se exponen intentos
  `completed` o `abandoned`; Survival limita las filas a preguntas alcanzadas y Pyramid mantiene sus
  siete metadatos con payload/solución nulos en niveles no alcanzados.
- Un recurso inexistente y uno inaccesible devuelven igualmente `null`.
- Las relaciones canónicas imposibles provocan un error de integridad; no se sustituyen por datos
  inventados.
- El acceso sin sala es una rama explícita de preview. No concede autorización competitiva.

Las proyecciones S02 (`public.get_my_room_cards`, `public.get_room_detail` y
`public.get_room_introduction`) son `SECURITY DEFINER`, fijan `search_path = ''`, pertenecen a
`postgres` y solo tienen `EXECUTE` para `authenticated`. Devuelven metadatos y perfiles mínimos;
no entregan `public_payload`, soluciones, preguntas completas, filas `private` ni identidades Auth.
Una sala inexistente y una sala ajena devuelven la misma ausencia observable. El rol `spectator`
puede leer la introducción, pero no recibe un CTA competitivo ni puede crear un intento.

El portal `/admin` delega las lecturas en `SupabaseSuperadminPortalQueries` y las mutaciones en
`SupabaseSuperadminRoomCommands`. Su RPC de contexto devuelve únicamente el operador y salas
`active`; los RPC de S08 resuelven emails exactos, crean la sala y escriben una auditoría agregada
en una transacción. Ninguno requiere exponer la tabla privada de asignaciones.
`requireSuperadmin()` valida primero Auth y el provisioning existente, y después exige la asignación
persistida `superadmin`. Una sesión ausente vuelve al inicio y una cuenta autenticada sin ese rol
recibe ausencia de ruta. La Server Action vuelve a invocar el guard antes de cada lookup y creación;
el guard también deberá invocarse en cada futuro Route Handler. Ocultar controles en la UI no es una
frontera de seguridad.

## Compatibilidad temporal

`PlayableChallengePageModel` conserva el `Challenge` gameplay completo para no reescribir los 31
formatos ni la evaluación local en rutas mock/práctica. El recorrido competitivo de Pirámide usa
`ServerPyramidChallenge` y una lectura por checkpoint que no envía soluciones ni niveles futuros.

`RoomSessionProvider` y el `localStorage` de Pirámide permanecen disponibles solo en recorridos
mock/práctica. Los modelos
Supabase de S06/S07 no fusionan `localResults` ni `RoomSessionProvider`: el servidor es la única
fuente de los rankings, historial y revisión históricos.

Los helpers de test viven en `test-utils/mockGameplay.ts` y `test-utils/mockRoom.ts`. Las fachadas
legacy de nivel superior en `data/` y los helpers de `test-utils/legacy` ya se han retirado; los tests
usan modelos explícitos respaldados por el store canónico. La infraestructura mock conserva solo los
adaptadores internos que todavía necesita para entregar los modelos de gameplay actuales.

## Fronteras verificadas

`npm run type-architecture` comprueba, además de las capas de tipos, que:

- `application` no depende de UI, Next.js, infraestructura, servidor ni datos;
- `app` no importa datos ni infraestructura y usa la fachada de servidor;
- componentes, features y utilidades cliente no importan servidor, infraestructura ni datos;
- solo `infrastructure/mock` y el código de test pueden leer `data/mock`;
- la infraestructura mock no consume proyecciones legacy de nivel superior;
- la fachada conserva `server-only` y la memoización de petición.

Los tests de contrato se ejecutan contra los adaptadores mock y el adaptador Supabase incluye acceso
inexistente/temporada ausente, transformación de filas, UUID del usuario actual, agrupación de
historial, payloads versionados, abandonos parciales y propagación de errores RPC. La cobertura SQL incluye acceso inexistente o
ajeno, owner, admin, spectator, antiguo miembro, alias inválido, empates, intentos invalidados,
publicaciones canceladas, historial vacío, publicaciones sin participantes y conteo de intentos
iniciados.

## Siguiente frontera

El runner reproducible de escenarios vive en `scripts/supabase-fixture.mjs` y escribe sus
credenciales en `output/fixtures/<scenario>.json`, que está ignorado por Git. S06 se crea y valida
con:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s06
npm run test:integration:supabase -- --scenario s06
npm run test:e2e -- e2e/s06-ranking.spec.ts
```

La limpieza usa `npm run supabase:fixture -- --scenario s06 --clean` y reinicia únicamente la base
local. La definición de datos de S06, basada en el fixture Flash de S03, está aislada en
`scripts/fixtures/scenarios/s06.mjs`, con aserciones en `scripts/integration/scenarios/s06.mjs` y
el recorrido de navegador en `e2e/s06-ranking.spec.ts`.

S07 se crea y valida con:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s07
npm run test:integration:supabase -- --scenario s07
npm run test:e2e -- e2e/s07-history-review.spec.ts
```

El escenario cubre publicaciones Flash cerradas, vacías, abandonadas, en curso, canceladas y con
versión archivada. La ruta histórica usa UUIDs; los aliases permanecen limitados al adaptador mock.
