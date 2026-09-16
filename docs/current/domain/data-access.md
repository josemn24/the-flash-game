# Capa de acceso y consultas

## Estado y alcance

La fase 4 está cerrada. S01–S07 y el portal privado mínimo añaden la primera integración real de Supabase y completan el
recorrido `Auth → home → mis salas → detalle → introducción autorizada → Flash competitivo →
recuperación/abandono → rankings → historial/revisión`: la home, el detalle de una sala, su
introducción, el gameplay Flash, los dos rankings, el historial cerrado y la revisión consultan o
mutan mediante fronteras autorizadas. `/admin` ya proporciona el contexto server-side de
superadministración y las salas activas; las operaciones administrativas continúan pendientes de
S08 y las slices siguientes. Los demás modos siguen mock hasta sus propias vertical slices.

La dirección vigente es:

```text
Server Components
→ server/data-access.ts
→ server/profile.ts
→ Supabase Auth/RPC/RLS
→ PostgreSQL

Las lecturas de S02, S03, S06 y S07 siguen una frontera específica:

Server Components
→ server/data-access.ts
→ infrastructure/supabase/roomQueries.ts
→ RPCs públicas de lectura estrecha
→ PostgreSQL privado/RLS

Portal privado `/admin`
→ server/data-access.ts
→ server/admin.ts
→ infrastructure/supabase/superadminQueries.ts
→ public.get_superadmin_portal_context()
→ asignación privada de plataforma y salas activas

Las consultas aún no migradas conservan este flujo:

Server Components
→ server/data-access.ts
→ application/queries
→ infrastructure/mock
→ mockDomainStore
→ DTOs y view models
→ Client Components
```

Las rutas de sala y desafío son dinámicas. La galería editorial `/formatos` y sus fichas siguen
siendo públicas y estáticas. La beta no añade rutas públicas para crear salas, gestionar
invitaciones o preparar temporadas: esas operaciones pertenecerán a una frontera privada de
superadmin. El alta directa de un miembro será un comando de provisioning, no una aceptación de
invitación.

## Contratos de aplicación

`application/queries` define `CurrentViewerProvider`, `RoomQueries`, `RoomLobbyQueries`,
`RoomRankingQueries`, `RoomHistoryQueries`, `RoomMemberDetailQueries`, `SuperadminPortalQueries` y
`ChallengeQueries`. Esta capa
solo conoce tipos de dominio y view models; no depende de Next.js, React, fixtures ni adaptadores.

Todas las consultas reciben un `QueryContext` con el jugador autenticado simulado y el instante de
la petición. Las entradas usan aliases de ruta legibles. Los UUID canónicos se resuelven y quedan
encapsulados en infraestructura.

Los DTOs de sala no devuelven identidades de autenticación, roles globales, filas canónicas ni
payloads privados. Los rankings y el historial se calculan desde membresías, publicaciones,
intentos y respuestas normalizados.

## Composición de servidor

`server/data-access.ts` lleva el marcador `server-only`. Para la home, delega en
`server/profile.ts`, que valida la sesión con `auth.getUser()`, llama al RPC estrecho
`public.provision_player` y devuelve un DTO mínimo. El nombre se actualiza mediante la política RLS
del propio jugador; no existe DML de aplicación con `service_role`.

La home, el detalle S02, los rankings S06 y el historial/revisión S07 delegan en
`SupabaseRoomQueries`. El adaptador implementa `listCards`, `getDetail`, `getIntroduction`,
`getRanking`, `listHistory`, `getHistoryDetail` y `getMemberDetail`. Para una sala real resuelve la
temporada desde `get_room_detail`, consulta `get_season_ranking` y, cuando corresponde,
`get_challenge_ranking`. S07 usa `get_flash_history` para agrupar publicaciones cerradas y
`get_flash_member_review` para reconstruir el resultado desde la versión histórica enlazada; carga
en paralelo los rankings necesarios para el detalle de miembro. Las filas JSON se validan antes de
convertirse a view models; los UUID de jugador son el `memberId` canónico y un error RPC o una fila
inválida se propaga. Las consultas todavía mock se limitan a los aliases explícitos del demo, por lo
que una sala real no puede caer silenciosamente en `MockRoomQueries`.

`get_my_room_cards` reutiliza el mismo `get_season_ranking` para `current_position`. Así, puntos,
empates y la posición visible en home/detalle proceden de una sola semántica SQL. El RPC de desafío
mantiene privado `started_at`: el servidor lo usa para ordenar y S06 no lo muestra; el detalle de
miembro/histórico que pueda necesitarlo se mantiene dentro de la proyección autorizada S07.

La fachada obtiene el viewer internamente; ningún parámetro de URL ni dato del cliente puede elegir
la identidad de consulta. Sus funciones usan `cache` de React para compartir una misma promesa
dentro de la petición, incluida la lectura repetida por `generateMetadata` y por la página. No hay
caché persistente ni compartida entre usuarios.

## Autorización

- Una consulta de sala exige una membresía activa.
- Owners, admins, members y spectators pueden leer las vistas de sala.
- Los spectators no aparecen en rankings competitivos y no pueden obtener un desafío competitivo
  contextualizado en una sala.
- Los miembros antiguos pueden figurar en resultados históricos si eran competitivos cuando
  iniciaron el intento, pero ya no pueden leer la sala.
- El historial exige una membresía activa del lector, incluye publicaciones Flash `closed` sin
  intentos `in_progress` y conserva publicaciones sin participantes. Las filas competitivas excluyen
  `test`, `invalidated` y `cancelled`; los espectadores no aparecen como jugadores.
- La revisión propia terminal está disponible aunque el rol actual sea `spectator`. La revisión de
  otra persona exige `owner`, `admin` o `member`, y solo expone intentos `completed` o `abandoned`.
  Los abandonos conservan respuestas parciales y proyectan los huecos como `unanswered`.
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

El portal `/admin` delega en `SupabaseSuperadminPortalQueries`. Su RPC devuelve únicamente el
operador y salas `active`; no requiere membresía de sala y no expone la tabla privada de asignaciones.
`requireSuperadmin()` valida primero Auth y el provisioning existente, y después exige la asignación
persistida `superadmin`. Una sesión ausente vuelve al inicio y una cuenta autenticada sin ese rol
recibe ausencia de ruta. El guard se invoca de nuevo en cada futura Server Action o Route Handler;
ocultar controles en la UI no es una frontera de seguridad.

## Compatibilidad temporal

`PlayableChallengePageModel` conserva el `Challenge` gameplay completo para no reescribir los 31
formatos ni la evaluación local en esta fase. Por ello todavía envía soluciones al bundle cliente
y no constituye una frontera de seguridad.

`RoomSessionProvider` y el `localStorage` de Pirámide continúan combinando el resultado local con el
snapshot recibido del servidor mediante funciones puras en recorridos mock/práctica. Los modelos
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
