# Capa de acceso y consultas

## Estado y alcance

La fase 4 está cerrada y S01 añade la primera integración real de Supabase. La home ya resuelve la
sesión mediante Auth, aprovisiona de forma idempotente el `Player` actual y permite guardar su
nombre; las lecturas de salas y el resto de las rutas siguen en `mockDomainStore` hasta S02 y las
vertical slices posteriores. S01 no añade todavía persistencia de salas, intentos ni avatares.

La dirección vigente es:

```text
Server Components
→ server/data-access.ts
→ server/profile.ts
→ Supabase Auth/RPC/RLS
→ PostgreSQL

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

`application/queries` define `CurrentViewerProvider`, `RoomQueries` y `ChallengeQueries`. Esta capa
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

Para las consultas todavía mock, la fachada compone los adaptadores con `mockDomainStore` y
`demoIdentity.currentPlayerId`.

La fachada obtiene el viewer internamente; ningún parámetro de URL ni dato del cliente puede elegir
la identidad de consulta. Sus funciones usan `cache` de React para compartir una misma promesa
dentro de la petición, incluida la lectura repetida por `generateMetadata` y por la página. No hay
caché persistente ni compartida entre usuarios.

## Autorización mock

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

Una fase posterior sustituirá los adaptadores mock por persistencia real y evaluación autoritativa.
Hasta entonces no debe interpretarse la DAL como protección de las respuestas correctas: su logro
es desacoplar consumidores, fijar contratos y concentrar autorización y composición en servidor.
