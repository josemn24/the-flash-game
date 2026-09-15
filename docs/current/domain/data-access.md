# Capa de acceso y consultas

## Estado y alcance

La fase 4 está cerrada y S01 añade la primera integración real de Supabase. S02 completa el primer
recorrido de lectura `Auth → home → mis salas → detalle → introducción autorizada`: la home, el
detalle de una sala real y su introducción consultan proyecciones autorizadas. Ranking, historial,
ajustes y gameplay continúan mock hasta sus propias vertical slices.

La dirección vigente es:

```text
Server Components
→ server/data-access.ts
→ server/profile.ts
→ Supabase Auth/RPC/RLS
→ PostgreSQL

Las lecturas de S02 siguen una frontera específica:

Server Components
→ server/data-access.ts
→ infrastructure/supabase/roomQueries.ts
→ RPCs públicas de lectura estrecha
→ PostgreSQL privado/RLS

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
siendo públicas y estáticas.

## Contratos de aplicación

`application/queries` define `CurrentViewerProvider`, `RoomQueries`, `RoomLobbyQueries` y `ChallengeQueries`. Esta capa
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

La home y el detalle S02 delegan en `SupabaseRoomQueries`. Este adaptador solo implementa
`listCards`, `getDetail` y `getIntroduction`; no contiene lecturas de ranking, historial ni
gameplay. Las consultas todavía mock se limitan a los aliases explícitos del demo, por lo que una
sala real no puede caer silenciosamente en `MockRoomQueries`.

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

## Compatibilidad temporal

`PlayableChallengePageModel` conserva el `Challenge` gameplay completo para no reescribir los 31
formatos ni la evaluación local en esta fase. Por ello todavía envía soluciones al bundle cliente
y no constituye una frontera de seguridad.

`RoomSessionProvider` y el `localStorage` de Pirámide continúan combinando el resultado local con el
snapshot recibido del servidor mediante funciones puras. El resultado local reemplaza al del
jugador actual y no se duplica. El desafío 06 no inventa peers ni actividad.

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

Los tests de contrato se ejecutan contra los adaptadores mock e incluyen acceso inexistente o
ajeno, owner, admin, spectator, antiguo miembro, alias inválido, empates, intentos invalidados,
publicaciones canceladas, historial vacío, publicaciones sin participantes y conteo de intentos
iniciados.

## Siguiente frontera

El runner reproducible de escenarios vive en `scripts/supabase-fixture.mjs` y escribe sus
credenciales en `output/fixtures/<scenario>.json`, que está ignorado por Git. S02 se crea y valida
con:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s02
npm run test:integration:supabase -- --scenario s02
npm run test:e2e -- e2e/s02-rooms.spec.ts
```

La limpieza usa `npm run supabase:fixture -- --scenario s02 --clean` y reinicia únicamente la base
local. La definición de datos de S02 está aislada en `scripts/fixtures/scenarios/s02.mjs` y sus
aserciones en `scripts/integration/scenarios/s02.mjs`; una fase posterior puede añadir S03 sin
crear nuevos runners ni comandos en `package.json`.
