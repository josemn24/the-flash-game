# Fronteras y arquitectura de la aplicación

> Estado: vigente. Arquitectura de transición con S01–S14, D08a/D08b, E01–E06, F08, F16, F18, F19 y E10 implementadas sobre Supabase local; el
> resto del producto migrándose progresivamente desde el prototipo mock. Complementa la guía específica de [Server y Client Components](architecture/server-client-architecture.md)
> y no prescribe un endpoint por cada caso de uso.

## 1. Arquitectura propuesta

La aplicación debe conservar una arquitectura modular y pequeña, organizada por responsabilidades:

```text
Navegador
  ├── páginas y layouts Server Components
  └── islas Client Components para interacción y juego
          │
          ├── lecturas: Server Component → fachada server-only
          │                         → consultas de aplicación
          │                         → puerto de datos
          │                         → persistencia mock/Supabase
          │
          └── escrituras: Server Action o Route Handler
                              → autenticación y autorización
                              → caso de uso de aplicación
                              → lógica de dominio
                              → transacción/persistencia
                              → DTO y revalidación
```

La regla central es que Next.js transporta y compone la experiencia, pero no contiene las reglas
competitivas. Los casos de uso coordinan operaciones; el dominio decide qué es válido; la
persistencia conserva hechos y estados.

### Decisión de transporte

- **Server Components** para cargar páginas, metadata, consultas y proyecciones de lectura.
- **Server Actions** para mutaciones iniciadas desde la UI y estrechamente ligadas a una página:
  actualizar perfil, iniciar/abandonar un intento o, dentro del portal privado, ejecutar operaciones
  administrativas como provisionar salas y membresías. La UI pública de la beta no crea salas ni
  gestiona invitaciones o temporadas.
- **Route Handlers** para envíos de juego de alta frecuencia que necesiten JSON, códigos HTTP e
  idempotencia explícita, además de webhooks de autenticación, almacenamiento o servicios
  externos. No se crea un Route Handler por cada función interna del dominio.
- **Cliente** para estado efímero, timers, gestos, animaciones, borradores y feedback inmediato.
  El cliente nunca es la autoridad sobre identidad, plazo, corrección o puntuación.

La elección entre Server Action y Route Handler es de transporte. Ambos deben llamar a los mismos
casos de uso y no duplicar autorización ni reglas de negocio.

F19 sigue esta frontera con `POST /api/competitive/attempts/:attemptId/word-hashtag/swap`: el Route
Handler solo autentica y adapta el comando; la validación del swap, el lock optimista, la idempotencia,
la persistencia de `attempts.progress_payload` y la evaluación terminal viven en el comando privado de
Supabase. El componente cliente recibe únicamente el tablero y contadores autorizados por el servidor.

### Portal operativo de la beta cerrada

La UI pública está limitada a consultar y jugar en salas ya provisionadas. La creación de salas, el
alta o reactivación de miembros, la gestión de roles, la configuración y activación de temporadas y
las tareas necesarias para operar el calendario pertenecen a un portal privado de
superadministración. Ese portal será una superficie server-side protegida, aunque comparta la
aplicación Next.js, y no una colección de controles ocultos dentro de las páginas públicas.

En la beta, el superadmin provisiona directamente a usuarios autenticados en una sala; el alta no
simula la aceptación de una invitación y no consume un token. La emisión, aceptación y revocación de
invitaciones siguen siendo capacidades del producto para una fase posterior, sin UI pública en esta
versión. La publicación mínima de contenido, la programación de desafíos y la ejecución del
calendario ya están verificadas localmente en el mismo portal interno para Flash de S11/S12 y
Supervivencia de S14.
La ejecución temporal se realiza mediante un Route Handler protegido: Vercel Cron invoca `GET
/api/internal/calendar/tick` en producción diariamente a las 00:05 UTC con `CRON_SECRET`, mientras
que el CLI local conserva `POST /api/internal/calendar/tick` y `npm run calendar:tick` con
`CALENDAR_TICK_SECRET`. No hay cola ni worker propio; Vercel Cron no ejecuta previews ni reintenta
automáticamente una invocación fallida.

Cada operación administrativa debe comprobar el privilegio global en servidor, aplicar las
invariantes de dominio y usar un comando acotado. Las acciones que afecten directamente a una sala
se registran en auditoría; el portal no obtiene permisos escribiendo DML genérico con
`service_role`, ni convierte al superadmin en miembro competitivo.

La base transversal ya implementada vive en `/admin`: es una ruta dinámica server-side que consulta
`public.get_superadmin_portal_context()` mediante una fachada y un adaptador propios. El RPC valida
la asignación persistida de `superadmin`, muestra solo salas activas y no concede acceso RLS global
ni acceso directo a relaciones `private`. S08 añade el primer comando administrativo: una Server
Action protegida por el mismo `requireSuperadmin()` llama a los RPC estrechos de lookup y creación,
crea de forma atómica la sala activa con owner y grupo inicial, y registra una auditoría agregada.
No hay DML genérico desde la aplicación ni se convierte al superadmin en miembro competitivo. S11
añade una frontera editorial separada: `get_superadmin_editorial_context` devuelve soluciones solo
al superadmin, y los tres comandos Flash de borrador/publicación aplican validación server-side,
idempotencia, concurrencia optimista y auditoría. El contenido publicado queda inmutable; calendario,
intentos y puntos siguen siendo responsabilidades de slices posteriores.

## 2. Responsabilidades por capa

### 2.1 UI y presentación

Incluye `app/`, `components/` y la parte visual de `features/`.

Responsabilidades:

- renderizar páginas, layouts, navegación y metadata;
- recoger entradas del usuario y mostrar estados de carga, error y resultado;
- mantener estado local de interacción y sesión de juego inmediata;
- enviar únicamente entradas serializables a una frontera de servidor;
- consumir DTOs y view models, no filas de base de datos ni el store mock;
- ocultar controles según el estado recibido, sin confiar en esa ocultación como autorización.

No debe:

- importar Supabase, infraestructura, credenciales o módulos `server-only`;
- decidir si un jugador puede competir;
- calcular la puntuación oficial o aceptar como válidos tiempos enviados por el navegador;
- recibir soluciones privadas en la partida competitiva;
- mutar directamente el estado persistido.

Los componentes de juego pueden tener una frontera cliente amplia porque comparten sesión, timers y
feedback. Los componentes editoriales, de navegación y de consulta deben permanecer en servidor
si no necesitan interacción.

### Sesiones competitivas en el navegador

Las fachadas `useServerFlashSession`, `useServerNarrativeSession` y
`useServerAlphabetSession` conservan los contratos de las pantallas y se suscriben al mismo
núcleo en `features/game/competitive/`. Flash, Supervivencia, Pirámide, Narrative y Alfabeto
comparten este flujo; práctica y mock mantienen sus controladores actuales.

```text
Pantalla → fachada del modo → useCompetitiveSession
                              → CompetitiveSessionEngine
                                  ├── core/sessionReducer: snapshot único y commit(event)
                                  ├── core/commandExecutor: cola y comando pendiente original
                                  ├── core/attemptLifecycle: inicio, recuperación, preparación, activación, cierre
                                  ├── core/advance: feedback y siguiente paso
                                  ├── modes: secuencia, presentación y cursor recuperado
                                  └── formats: comando, progreso y resultado normalizado
                                          → attemptClient → Route Handler existente
```

El motor actualiza el snapshot utilizado por las operaciones asíncronas y notifica a React
mediante un único `commit(event)` y `useSyncExternalStore`. No hay una copia de `lockVersion`
en cada modo o formato. El reducer deduplica resultados por interacción y guarda intento,
interacción, deadlines recibidos, resultados, comando pendiente y error de lifecycle.

La cola resuelve la versión al enviar un comando nuevo. Desde ese momento conserva operación,
intento/interacción, payload, versión y clave idempotente; un reintento reutiliza el comando
completo. Los borradores Queens pasan por esa misma cola antes de validar o expirar. Los
adaptadores se seleccionan mediante el catálogo de capacidades por modo/formato y producen
progreso intermedio o una respuesta evaluada, sin gestionar recuperación ni cierre.

Una respuesta aceptada inicia una espera de feedback; después, la política determina escena,
briefing, preparación o cierre. Si ese paso falla, `lifecycleError` y `retryLifecycle` permiten
reintentar solamente el comando pendiente. Los reintentos existentes de cada formato siguen
funcionando. Una respuesta incierta bloquea nuevas escrituras; una versión obsoleta inicia
recuperación autorizada mediante `start` y `recover`, sin reenviar ni cambiar la versión del
comando rechazado. `429` conserva el comando y bloquea reintentos hasta `Retry-After`, sin polling.
Alfabeto conserva su única recuperación automática de timeout y ofrece recuperación manual si
esta falla. Si el cierre perdió su respuesta y la cookie ya se eliminó, se recarga la proyección
server-side del resultado, que comprueba los hechos persistidos.

Los cronómetros visuales existentes consumen deadlines del servidor. Las esperas de feedback
no modifican esos deadlines. Pirámide prepara la pregunta y la activa después de montar su
presentación; solo la activación inicia el reloj. Narrative conserva los deadlines de sus
preguntas, mientras escenas y reacciones no consumen tiempo competitivo. Alfabeto conserva
el deadline global y procesa secuencialmente las letras pendientes al expirar. Desmontar o
cambiar el desafío cancela las esperas e invalida las respuestas tardías; la repetición de
efectos de StrictMode conserva una única recuperación.

La validación incluye pruebas del reducer, coordinación con cliente simulado y reloj controlado,
y recorridos persistidos con pérdidas de respuesta. `npm run test:e2e:isolated` ejecuta los
escenarios competitivos en un Supabase temporal, con identificador propio, puertos 55320–55329 y
aplicación en 3300; limpia ese stack al terminar. El fixture S05 cubre Alfabeto y
`narrative-interactive` cubre Queens y pistas dentro de Narrative. El stack local habitual del
proyecto no se reinicia.

### 2.2 Entrada al backend

Es la capa adaptadora entre Next.js y la aplicación. Puede usar `app/actions/` para Server Actions
y `app/api/` para Route Handlers.

Responsabilidades:

- recibir `FormData` o JSON y validarlo sintácticamente;
- obtener la sesión desde cookies/headers, nunca desde un `playerId` enviado por el cliente;
- convertir errores de aplicación a respuestas de UI o HTTP consistentes;
- llamar a un caso de uso, consulta o fachada server-only;
- invalidar o actualizar la caché de las páginas afectadas tras una mutación;
- limitar tamaño, frecuencia y forma de las entradas públicas.

No debe:

- contener consultas SQL, reglas de scoring o lógica de ownership;
- confiar en que solo la UI puede invocarlo: las Server Actions y Route Handlers son superficies
  accesibles por red y deben autenticar y autorizar cada operación;
- devolver entidades persistentes completas o soluciones privadas por comodidad.

### 2.3 Capa de aplicación y casos de uso

Es la orquestación de los casos descritos en [`use-cases.md`](use-cases.md). Debe ser independiente
de React, Next.js y Supabase.

Responsabilidades:

- coordinar autenticación resuelta, autorización, dominio y persistencia;
- definir entradas y salidas de cada operación relevante;
- cargar el contexto necesario de sala, temporada, publicación, jugador e intento;
- abrir transacciones para operaciones que cambian varios hechos;
- imponer idempotencia y control de concurrencia a nivel de operación;
- devolver DTOs mínimos o errores de aplicación tipados;
- mantener las consultas como lecturas y los comandos como mutaciones, aunque compartan puertos.

La aplicación no necesita un servicio genérico para cada entidad. Debe empezar con pocos módulos
orientados al comportamiento:

```text
application/
  queries/        lecturas y contratos ya existentes
  use-cases/      comandos: attempts, rooms, invitations, content, seasons
  authorization/  políticas reutilizables cuando crezcan
  dto/            solo si los view models existentes dejan de ser suficientes
```

Una función de caso de uso puede llamar a varias operaciones de persistencia; no debe ser un simple
alias de una tabla.

Las lecturas públicas siguen la misma disciplina. `ApplicationRoomReads` crea el `QueryContext`
desde `CurrentViewerReader` y el reloj, y delega en una capacidad de lobby, ranking, settings,
historial o revisión. `ApplicationDemoChallengeReads` y `ApplicationCompetitiveChallengeReads`
separan previews mock de desafíos jugables persistidos. Estos casos de uso no conocen cookies,
`redirect()`, `notFound()`, `cache()` ni clientes Supabase; esas responsabilidades permanecen en
las fachadas `server/*-data-access.ts` y en los composition roots server-only.

### 2.4 Lógica de dominio

El dominio expresa reglas que deben ser ciertas independientemente de la UI o del proveedor de
base de datos.

Debe cubrir, entre otras:

- estados y transiciones de salas, membresías, temporadas, publicaciones e intentos;
- disponibilidad con apertura inclusiva y cierre exclusivo;
- roles competitivos frente a `spectator` y ownership;
- unicidad del intento, idempotencia y control de versión;
- evaluación por formato, puntuación no negativa y máximo de 100;
- ranking por desafío y por temporada;
- separación entre práctica, prueba fantasma y competición;
- inmutabilidad de versiones y reconstrucción histórica.

En el estado actual, esta responsabilidad está repartida de forma razonable entre:

- `types/domain/`: entidades, estados, identificadores y valores;
- `types/contracts/`: payloads públicos, soluciones, respuestas y revelaciones;
- `types/gameplay/`: estado interno de las sesiones;
- `lib/`: funciones puras de scoring, disponibilidad, ranking y validación;
- `features/`: reducers y sesiones interactivas específicas de cada modo.

No se debe crear ahora una segunda jerarquía paralela llamada `domain/`. Si las reglas crecen, se
pueden agrupar gradualmente dentro de `lib/domain/` o de módulos de dominio específicos, conservando
las APIs puras y los tests existentes.

El dominio no debe:

- leer cookies, usar `window`, importar React o conocer rutas;
- ejecutar SQL o llamar directamente a Supabase;
- decidir cómo se renderiza un error;
- depender de `mockDomainStore`.

### 2.5 Persistencia

La persistencia conserva hechos y aplica garantías atómicas; no sustituye a los casos de uso.

Se necesita un puerto pequeño por capacidad, no un repositorio abstracto para cada tabla:

```text
application/ports/
  player-store
  room-store
  content-store
  attempt-store
  media-storage             subida, confirmación, lectura firmada y limpieza
  ranking-read-model       (solo si la consulta lo necesita)
```

El puerto expone operaciones del comportamiento —por ejemplo `createOrGetAttempt` o
`submitAnswerIfCurrent`— cuando la atomicidad no puede expresarse con seguridad como una secuencia
de lecturas y escrituras desde la aplicación.

La frontera concreta está en [attempt-commands.ts](../../application/ports/attempt-commands.ts):
inicio/recuperación con sesión exclusiva, preparación, recepción, evaluación, cierre, invitaciones
y correcciones. El tipo de takeover se reserva para una política posterior, pero está deshabilitado
en el MVP. La recuperación debe ser una operación de dominio: reconcilia una recepción pendiente o
resuelve atómicamente el intervalo abierto antes de devolver otro payload; no es una rehidratación
ciega de un snapshot de cliente.
Los [comandos SQL privados](../../supabase/schemas/README.md) implementan bloqueo, idempotencia,
auditoría y puntos atómicos; `service_role` carece de DML directo. El adaptador PostgreSQL de las slices
verifica Auth y establece identidad con claims locales a cada transacción. No se expone `private` por
PostgREST ni se usa el propietario de las funciones como credencial de servidor.

Preparar confirma el reloj antes de entregar contenido; recibir confirma payload e instante antes
de evaluar. [evaluateReceipt](../../server/evaluation/evaluate-receipt.ts) adapta el tiempo persistido
al evaluador existente en una frontera `server-only`. Corrección, puntos, identidad y marcas
autoritativas no son inputs públicos. Los recorridos Flash, Alphabet, Supervivencia, Pirámide y
Narrative están conectados a estas operaciones. Narrative comparte las tablas/RPCs genéricas de
intentos: `mode_config` contiene solo escenas y configuración pública, `challenge_items` aporta el
orden y metadatos, y `prepare` entrega el payload de una pregunta. La UI conserva mocks únicamente
para práctica y demos.

La frontera de composición también es explícita: `server/composition/demo.ts` es el único composition
root local; `server/composition/production.ts` conecta las lecturas Supabase. Las rutas bajo
`app/demo/**` pueden importar la fachada demo, mientras que `/salas`, `/desafios` y `/admin` no pueden
importar `data/mock`, `infrastructure/mock`, tipos legacy ni barrels de gameplay retirados.
`npm run type-architecture` comprueba estas reglas y verifica que cada modo competitivo tenga lector
Supabase registrado.

Adaptadores previstos:

```text
infrastructure/
  mock/       adaptadores demo y de contrato sobre mockDomainStore
  supabase/   adaptadores reales sobre PostgreSQL/Supabase para las slices persistidas actuales
```

Reglas de persistencia:

- las operaciones competitivas se ejecutan dentro de transacciones cuando cambian intento,
  respuesta y acreditación;
- la unicidad de jugador/publicación, publicación/número y sesión activa debe reforzarse también
  con restricciones de base de datos;
- `lock_version`, claves idempotentes y deadlines forman parte de las escrituras competitivas;
- los payloads polimórficos pueden almacenarse como JSONB validado, pero IDs, relaciones y campos de
  consulta frecuente permanecen estructurados;
- las versiones publicadas, respuestas originales y correcciones auditadas no se sobrescriben;
- los adaptadores devuelven entidades o proyecciones tipadas, nunca clientes de base de datos hacia
  la UI.

El mock actual sigue siendo útil como primer adaptador de contratos. No debe convertirse en una
segunda fuente de verdad ni en un comportamiento especial de producción.

### 2.6 Autenticación y autorización

La autenticación responde a “quién es la persona”. La autorización responde a “qué puede hacer en
este contexto”. Son comprobaciones distintas.

Propuesta:

- `server/auth` obtiene la sesión del proveedor —previsto: Supabase Auth— y resuelve el `Player`;
- la aplicación recibe un contexto autenticado, no tokens ni `auth_user_id` desde la UI;
- las políticas de dominio comprueban membresía, rol, estado de sala, publicación e intento;
- cada Server Action, Route Handler y proceso interno vuelve a autenticar y autorizar;
- el cliente recibe solo el DTO mínimo para su pantalla;
- RLS de Supabase será una defensa adicional, no la única ubicación de las reglas de aplicación;
- las operaciones de superadministración requieren privilegio global, motivo y auditoría.

La autorización debe impedir especialmente que:

- un espectador inicie o reciba contenido jugable competitivo;
- un jugador elija el `currentPlayerId` mediante una URL o payload;
- un jugador lea soluciones, intentos o datos privados de otra persona;
- un cliente se otorgue `superadmin` o cambie su membresía;
- una publicación cancelada o una temporada incorrecta acepte nuevas respuestas.

### 2.7 Servicios externos

Los servicios externos se incorporan detrás de adaptadores solo cuando el caso de uso los necesita:

- **Auth:** proveedor de identidad y sesiones;
- **Storage:** avatares en un bucket público de lectura e imágenes de preguntas en un bucket privado;
  la aplicación persiste referencias estables y resuelve URLs firmadas únicamente en runtime;
- **correo/notificaciones:** invitaciones y avisos, si se activan;
- **observabilidad:** errores, auditoría y métricas, sin convertir logs en fuente de verdad;
- **scheduler:** Vercel Cron ejecuta el calendar tick diario en producción; el tick cierra temporadas,
  actualiza publicaciones y reconcilia intentos inactivos elegibles.

La lógica de The Flash no debe depender de la forma concreta de una respuesta externa. Cada
integración debe tener timeouts, reintentos idempotentes y un comportamiento definido si está
temporalmente indisponible. Storage se integra mediante un puerto server-only: el navegador nunca
recibe `service_role`, no elige el propietario de un objeto y no persiste URLs firmadas.

El flujo de subida es deliberadamente compensatorio porque Storage y PostgreSQL no comparten
transacción: crear referencia pendiente, subir, confirmar y validar el objeto, asociarlo al perfil o
a un borrador y limpiar el objeto anterior después del commit. Un fallo posterior deja el objeto
marcado para limpieza, no sustituye una referencia válida.

### 2.8 Procesos asíncronos

No hace falta introducir una cola o workers para el loop inicial. Las operaciones de inicio,
respuesta, finalización y acreditación deben ser síncronas y transaccionales.

Un proceso asíncrono será necesario solo para tareas que no deben bloquear la respuesta de la UI:

- reconciliar intentos inactivos después del cierre o deadline; la ejecución global es diaria y las
  lecturas de historial/comandos también pueden ejecutar una reconciliación acotada;
- enviar correos o notificaciones;
- limpiar assets o datos después de anonimización/purga;
- recalcular proyecciones materializadas si el volumen lo exige;
- procesar webhooks externos.

Para S12, Vercel Cron invoca el Route Handler protegido en producción y es suficiente. El CLI local
conserva la recuperación manual. No se debe introducir event sourcing, una cola propia ni
microservicios solo por anticipar estas tareas.

## 3. Reglas de dependencia

La dirección permitida es:

```text
app (rutas/transportes)
  → server (sesión, composición y fachadas)
  → application (consultas, casos de uso y puertos)
  → domain (tipos y reglas puras)

application (puertos)
  ↑ implementados por

infrastructure/mock o infrastructure/supabase
  → puertos y tipos de dominio
```

El dominio no depende de `application` ni de `infrastructure`; solo expresa reglas y tipos
fundamentales.

Reglas concretas:

1. `types/domain`, `types/contracts` y `types/gameplay` no importan Next.js, React, `data`,
   `features`, `components` ni `app`.
2. La lógica pura de `lib` no importa infraestructura ni secretos.
3. `application` no importa `app`, React, Next.js ni un adaptador concreto.
4. `server` puede componer infraestructura y aplicación, pero no debe contener reglas de scoring.
5. `app` usa la fachada server-only o entradas de backend; no lee `data/mock` directamente.
6. `components` y `features` cliente no importan `server`, `infrastructure` ni `data`.
7. `infrastructure` implementa puertos; no es importada desde el dominio.
   En concreto, los adaptadores Supabase de sala (sus capacidades, RPCs,
   contratos, guards y mappers) solo consumen tipos/puertos de `application`, módulos puros de
   `lib`, tipos y otros módulos de infraestructura: no importan `server/*`, `features/*` ni
   `application/presentation/*`. Las reglas puras de gameplay y la presentación compartida viven
   en `lib`.
   El contrato de persistencia generado en `lib/supabase/database.types.ts` solo puede ser
   consumido por el boundary de clientes Supabase y por `infrastructure/supabase`; no se expone a
   `application`, `server`, `features`, `components` ni `app`. En los adaptadores, el flujo es
   `Database` para transporte → guard runtime para datos externos → mapper para DTO/view model;
   los retornos `Json` no se consideran modelos de dominio sin validación explícita.
8. Un Client Component no importa un Server Component. Un Server Component puede renderizar un
   Client Component y pasarle props serializables o contenido por slots.
9. Los barrels (`index.ts`) no mezclan exports cliente y servidor de forma indiscriminada.
10. Las consultas y comandos devuelven DTOs/view models, no registros completos de persistencia.

Estas reglas continúan y amplían las comprobaciones de `npm run type-architecture`.

## 4. Organización propuesta del código

La organización futura puede crecer desde la actual sin mover todo el repositorio:

```text
app/
  (rutas públicas y autenticadas)
  actions/                 Server Actions finas
  api/                     Route Handlers para JSON, webhooks y tareas protegidas

application/
  queries/                 contratos y lecturas actuales
  use-cases/               comandos orientados a comportamiento
  ports/                   interfaces de persistencia y servicios necesarios
  authorization/           políticas compartidas cuando sean necesarias

components/               UI universal y Client Components
features/                 sesiones de juego, modos y composición de interacción

types/
  domain/                  entidades y valores del dominio
  contracts/               frontera serializable pública/privada
  gameplay/               estado local de sesión
  view-models/             proyecciones de pantalla
  legacy/                  aliases históricos solo para mocks y tests

lib/                       reglas puras y algoritmos existentes
data/mock/                  fixtures y adaptador local soportado
infrastructure/
  mock/                    implementación local para demo/práctica/tests
  supabase/                implementación productiva
server/
  composition/             composition roots demo y producción
  *-data-access.ts         fachadas server-only y semántica de Next.js
```

Las proyecciones y aliases legacy deben permanecer aislados y no reciben consumidores productivos
nuevos. Los adaptadores que todavía necesita `infrastructure/mock` son compatibilidad local explícita;
si quedan sin consumidores se eliminan junto con sus exports. La composición competitiva no puede
seleccionar el mock como fallback.

## 5. Encaje con el Next.js actual

El repositorio ya tiene una base compatible con esta propuesta:

| Área actual                                       | Responsabilidad actual                                      | Evolución prevista                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`, `app/salas/**`, `app/desafios/**` | Server Components dinámicos que cargan modelos              | Mantenerlos finos; usar consultas/casos de uso server-only                                                                                                                   |
| `app/formatos/**`                                 | Biblioteca editorial estática con ejemplos cliente          | Mantener Server Components y una isla por ejemplo                                                                                                                            |
| `server/production-home-data-access.ts`           | Fachada `server-only` de la home y memoización por petición | Mantenerla limitada a la carga de identidad y salas de la home                                                                                                               |
| `server/production-room-data-access.ts`           | Fachada `server-only` de salas, rankings e historial        | Mantenerla sin dependencias mock y limitada a consultas de sala                                                                                                              |
| `server/production-challenge-data-access.ts`      | Fachada `server-only` de desafíos jugables reales           | Mantenerla sin dependencias mock y limitada a la selección de gameplay persistido                                                                                            |
| `server/production-admin-data-access.ts`          | Fachada `server-only` del portal de administración          | Mantener autorización superadmin y consultas administrativas separadas de las rutas públicas                                                                                 |
| `server/demo-data-access.ts`                      | Fachada `server-only` exclusiva de Flash Pop mock           | Mantenerla limitada a rutas `/demo/**`; las URLs antiguas solo redirigen                                                                                                     |
| `server/composition/production.ts`                | Conecta capacidades Supabase con casos de uso de lectura    | Único composition root de las lecturas públicas reales; no capturar sesión en estado global                                                                                  |
| `server/composition/demo.ts`                      | Conecta adaptadores mock con casos de uso demo              | Único composition root de Flash Pop mock                                                                                                                                     |
| `application/queries/`                            | Contratos de lectura independientes de Next.js              | Mantener capacidades pequeñas; no reintroducir agregadores por tabla                                                                                                         |
| `infrastructure/mock/`                            | Consultas y composición sobre `mockDomainStore`             | Mantener como adaptador local de demo, práctica y tests; Supabase se organiza por capacidades en `rooms`, `attempts`, `gameplay`, `assets`, `identity`, `admin` y `platform` |
| `data/mock/`                                      | Fixtures canónicos, store normalizado y validación          | Fuente del adaptador local, nunca dependencia de UI competitiva                                                                                                              |
| `components/game/**`                              | Shell cliente, modos, resultados y revisión                 | Usar barrels explícitos `demo`, `production` y `practice`; conservar estado local en demo/práctica y comandos de servidor en competición                                     |
| `features/rooms/**`                               | Resultados y snapshots locales en memoria                   | Convertirlos en caché de UI; el intento oficial vivirá en servidor                                                                                                           |
| `lib/**`                                          | Scoring, ranking, disponibilidad y algoritmos puros         | Reutilizar en dominio/servidor y cubrir con tests de contrato                                                                                                                |
| `types/contracts/**`                              | Separación de payload público, solución y respuesta         | Usar el payload público en competición y mantener solución privada                                                                                                           |

El flujo objetivo de una partida será:

```text
Page server
  → carga publicación + estado autorizado
  → entrega PublicQuestion/configuración mínima
  → Client GameApp gestiona interacción
  → Action/Route Handler envía start, answer, checkpoint o abandon
  → caso de uso valida sesión, membresía, deadline y lock_version
  → persistencia evalúa y guarda el hecho
  → devuelve feedback/result DTO
  → al finalizar, revalida sala, ranking e historial
```

En las rutas aún mock, la situación actual difiere en tres puntos intencionados del prototipo:
`demoIdentity` sustituye la autenticación, `RoomSessionProvider` mantiene resultados y snapshots en
memoria, y el cliente todavía recibe soluciones para evaluar localmente. Las slices persistidas ya usan Auth/RPC
reales en sus recorridos; esas piezas mock son puntos de sustitución, no el contrato productivo.

## 6. Decisiones técnicas relevantes

### Lecturas y caché

- Las lecturas personalizadas por usuario permanecen dinámicas y autorizadas.
- `cache` de React sirve para deduplicar lecturas dentro de una petición; no es caché compartida
  entre usuarios.
- Después de una mutación se revalidan las rutas o tags de la sala afectada, sin invalidar todo el
  sitio.
- No se cachean soluciones ni datos privados en una respuesta reutilizable.

### Intentos y concurrencia

- `createOrGetAttempt` debe ser atómico e idempotente.
- Cada envío lleva la versión o condición necesaria para rechazar estado obsoleto.
- Solo una sesión controla un intento; durante el MVP otra sesión se bloquea y no puede revocar ni
  sustituir a la original.
- El servidor fija `startedAt`, deadlines, tiempos competitivos, estados y puntuación.
- Un timeout de pregunta es un resultado de respuesta; no es por sí mismo abandono ni expiración de
  la publicación.
- Una unidad temporal persistida antes de devolver su payload se considera consumida. Al recuperar,
  una recepción existente se evalúa y un intervalo sin recepción se cierra con la consecuencia del
  modo, sin reentregar la misma unidad ni reiniciar su reloj.

### Contenido y seguridad

- La publicación referencia versiones inmutables de desafío y pregunta.
- El editor S11/S14 conserva un documento editorial común para Flash y Supervivencia. Narrative
  reutiliza la proyección de contenido para lectura y ejecución, pero su edición avanzada queda fuera
  de esta fase. Todos persisten sus campos públicos y soluciones en las tablas versionadas existentes;
  no se crea una representación paralela del runtime.
- En competición se entrega `PublicQuestion`; solución, tolerancias, rutas y métricas permanecen en
  servidor.
- Los payloads editoriales usan referencias de asset (`assetId`, alt, dimensiones y configuración
  visual). `src` es un campo de runtime resuelto por el servidor, no una URL firmada almacenada en una
  `question_version` publicada.
- El bucket privado de preguntas se resuelve solo para un superadmin con preview o para un jugador
  que ya tenga autorización competitiva. La progresión de E10 sigue siendo presentación CSS y no se
  presenta como protección contra la copia después de la entrega.
- La validación de payloads JSON debe depender del formato declarado y de la versión técnica
  publicada (`payload_schema_version` o `config_schema_version`); una versión desconocida se rechaza
  y no se interpreta como la versión actual por defecto.
- Las correcciones administrativas son ajustes auditados, no sobrescrituras.

### Testing

- Las reglas puras siguen probándose con unit tests y type tests.
- Cada caso de uso de escritura tendrá tests de aplicación contra dobles de sus puertos.
- Los adaptadores mock y Supabase comparten un harness de contrato para roles, ausencia, historial,
  revisión y ausencia de datos sensibles; el mapeo y la validación de RPC permanecen junto a cada
  adaptador.
- Las Route Handlers y Server Actions tendrán pocas pruebas de transporte; la mayor parte de la
  cobertura estará en aplicación y dominio.
- Los componentes cliente conservarán tests de interacción, timeout, revisión y accesibilidad.

### Observabilidad

- Cada intento, respuesta, acreditación y corrección debe tener identificadores y marcas temporales.
- Los errores de autorización no deben revelar si el recurso existe para quien no tiene acceso.
- Logs y métricas ayudan a diagnosticar, pero no sustituyen hechos persistidos ni auditoría.

## 7. Alternativas descartadas

### Arquitectura hexagonal o Clean Architecture completa desde el inicio

Se descarta introducir muchos servicios, fábricas, mappers y repositorios abstractos antes de tener
persistencia real. El beneficio inmediato es menor que el coste de navegación y mantenimiento.
Se conservan solo contratos de aplicación y puertos cuando una frontera real lo justifique.

### Importar Supabase directamente desde componentes o `features`

Se descarta porque expone detalles de persistencia, dificulta los tests, mezcla autorización con UI y
podría filtrar soluciones o credenciales. Los componentes deben depender de DTOs y acciones de
servidor.

### Un endpoint REST o RPC por cada caso de uso

Se descarta como regla organizativa. Varios casos pueden compartir una operación de transporte y
una acción puede coordinar varios cambios. Se mantienen Route Handlers solo donde aportan JSON,
webhooks, integración externa o control de frecuencia.

### GraphQL, tRPC o un BFF separado

No aportan valor mientras existe una sola aplicación Next.js y un único cliente web. Se reconsideran
si aparecen clientes externos, necesidades de composición independiente o una frontera de despliegue
separada.

### Realtime, event sourcing y microservicios

No son necesarios para una competición asíncrona. La presencia en vivo, el event sourcing y los
servicios separados aumentarían coste operativo antes de validar el loop principal.

### Cola y worker propios para toda operación

Se descarta para el inicio. Las operaciones de competición deben ser síncronas y transaccionales;
solo el abandono automático, notificaciones, webhooks o limpieza justifican procesos asíncronos.

### Estado global cliente como fuente de verdad

Se descarta mantener resultados oficiales en Context, `localStorage` o una librería global. El
cliente puede conservar borradores y snapshots de UX, pero el intento, la evaluación y los puntos
deben vivir en el servidor.

## 8. Riesgos y cuestiones abiertas

- La matriz de permisos de `owner` frente a `admin` está cerrada: `admin` no gestiona `owner`,
  solo `owner` concede `admin` y `superadmin` audita sus acciones directas sobre salas. El alcance
  editorial del rol `editor` aún no está cerrado.
- La transferencia de control entre dispositivos está deshabilitada durante el MVP. La expiración por
  inactividad ya está definida: 15 minutos sin actividad, solo tras cierre o deadline, con `abandoned`
  sin puntos; no requiere heartbeat ni lease del navegador.
- Debe definirse un contrato de errores estable para distinguir no autorizado, no disponible,
  conflicto obsoleto y validación inválida sin filtrar información.
- Supabase RLS debe diseñarse junto con las políticas de aplicación; no conviene asumir que una capa
  sustituye a la otra.
- El envío de respuestas, checkpoints y señales de abandono necesita límites de frecuencia y una
  estrategia para reintentos de red.
- Finalización/acreditación atómica y lecturas de los dos rankings están implementadas y probadas en
  SQL/adapter; S06 lee rankings bajo demanda y no materializa tablas adicionales.
- S07 implementa el historial común de Flash, Supervivencia, Narrative y Pirámide de publicaciones cerradas sin intentos `in_progress`, el ranking
  histórico y la revisión propia/ajena autorizada sin tablas materializadas ni recalcular puntos.
- La revisión ajena completa se limita a `owner`, `admin` y `member`; `spectator` conserva el acceso a
  historial/rankings, pero no recibe respuestas ni soluciones ajenas.
- `results_locked_at`, el takeover y la revisión administrativa de invalidados quedan fuera de S07.
  La expiración por inactividad se implementa en la reconciliación del calendario y bajo demanda.
- Invalidación y corrección exigen superadmin, motivo y auditoría. La revisión de intentos
  `invalidated`, inspección global y moderación siguen pendientes de política administrativa.
- La anonimización debe coordinar identidad, avatar, actividad social y retención histórica.
- Los medios y avatares requieren políticas de acceso, límites de tamaño y limpieza de objetos.
- La aplicación debe conservar una experiencia útil si un servicio externo está temporalmente
  indisponible, especialmente Storage, correo o autenticación.

Estas cuestiones no bloquean la migración inicial del mock a contratos de aplicación, pero sí deben
resolverse antes de declarar competitiva la persistencia real.

## Secuencia de evolución recomendada

1. Mantener las consultas actuales y extraer casos de uso de lectura solo donde ya exista una regla
   de autorización o composición relevante.
2. Añadir casos de uso de `start`, `resume`, `submit answer`, `complete` y `abandon` con puertos
   mock y tests de aplicación.
3. Añadir Server Actions/Route Handlers finos que llamen a esos casos de uso y sustituir
   gradualmente `demoIdentity` por la sesión real.
4. Implementar el adaptador Supabase con transacciones, unicidad, RLS y control de concurrencia.
5. Separar soluciones del DTO competitivo y trasladar evaluación, tiempo y acreditación al servidor.
6. Mantener Vercel Cron y la reconciliación bajo demanda para expiración de inactividad, notificaciones
   y limpieza cuando los requisitos estén cerrados.
