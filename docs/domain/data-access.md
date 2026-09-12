# Capa de acceso y consultas

## Estado y alcance

La fase 4 está cerrada. La aplicación dispone de una capa de consultas asíncrona, exclusiva de
servidor, entre las rutas de producto y `mockDomainStore`. Esta fase implementa solo lecturas: no
añade SQL, Supabase, autenticación real, Route Handlers, Server Actions ni persistencia de
intentos.

La dirección vigente es:

```text
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

`server/data-access.ts` lleva el marcador `server-only`. Es el único punto de acceso usado por las
rutas de producto y compone los adaptadores mock con `mockDomainStore` y
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

Los generadores basados en contratos legacy que solo necesitan las pruebas están aislados en
`test-utils/legacy`. Los exports legacy de `data` continúan disponibles para compatibilidad y tests,
pero no tienen consumidores de producción.

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
