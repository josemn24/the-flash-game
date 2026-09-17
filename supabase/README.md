# Workflow de base de datos

## Enfoque

Este repositorio usa el enfoque declarativo de Supabase.

- La fuente de verdad del esquema es `supabase/schemas/*.sql`.
- Las migraciones de `supabase/migrations/*.sql` son el historial versionado que se genera a partir
  de esa fuente de verdad mediante `supabase db schema declarative sync`.
- El orden de los archivos declarativos es lexicográfico. Cuando existan dependencias entre objetos,
  los nombres deben reflejar el orden de creación.
- No se deben hacer cambios de esquema directamente en Studio, el SQL Editor o `psql` esperando que
  `supabase db schema declarative sync` los detecte: el workflow compara los archivos declarativos
  con el baseline de migraciones, no usa el estado vivo como fuente de verdad.

El proyecto incluye una [propuesta inicial de tablas, restricciones y RLS](schemas/README.md)
en `schemas/`. El baseline actual está versionado en
`migrations/20260915070137_initial_schema.sql`; las migraciones posteriores representan cambios
incrementales de los esquemas declarativos. Los seeds permanecen desactivados hasta disponer de
datos locales reproducibles diseñados explícitamente.

## Estructura

```text
supabase/
├── config.toml             # Configuración del stack local y de los esquemas declarativos
├── schemas/                # Fuente de verdad; archivos SQL declarativos
│   └── README.md
├── migrations/             # Historial versionado generado desde schemas/
├── seed.sql                # Futuro: datos locales reproducibles; actualmente desactivado
├── .gitignore              # Estado local ignorado por la CLI
└── .temp/ y .branches/     # Estado interno no versionado
```

La configuración usa `schema_paths = ["./schemas/*.sql"]`. La carpeta puede dividirse después
por responsabilidad, por ejemplo `00_extensions.sql`, `10_types.sql`, `20_tables.sql`,
`30_views-functions.sql` y `40_indexes.sql`, manteniendo siempre un orden explícito y sin duplicar
definiciones.

## Workflow diario

1. Editar los archivos de `supabase/schemas/`.
2. Arrancar el stack local si no está activo:

   ```bash
   npx supabase start
   ```

3. Generar una migración incremental contra la definición declarativa, sin aplicarla todavía:

   ```bash
   npx supabase db schema declarative sync --no-apply --name nombre_descriptivo
   ```

4. Revisar la migración generada y confirmar que contiene únicamente el cambio esperado:

   ```bash
   git diff -- supabase/schemas supabase/migrations
   ```

5. Aplicar las migraciones pendientes al entorno local:

   ```bash
   npx supabase migration up
   ```

En S01, la aplicación usa `@supabase/ssr` con el cliente publicable de Supabase. Para probar el
flujo local, copia `.env.example` a `.env.local` y rellena la clave publicada a partir de
`npx supabase status`; nunca uses `service_role` en el navegador ni en Server Actions.

S02 añade las proyecciones de lectura `public.get_my_room_cards`, `public.get_room_detail` y
`public.get_room_introduction` en `schemas/55_room_reads.sql`. Son funciones estrechas para la
home, el detalle y la introducción autorizada; las preguntas, soluciones y payloads siguen en
`private` y no se exponen al cliente. El adaptador de servidor está en
`infrastructure/supabase/roomQueries.ts`.

S03 añade dos proyecciones más: `public.get_my_flash_challenge` entrega exclusivamente el payload
público de las dos preguntas jugables y `public.get_my_flash_result` entrega la revisión propia solo
después del cierre terminal. El gameplay real pasa por los Route Handlers
`/api/competitive/attempts/*`; el adaptador server-only está en
`infrastructure/supabase/attemptCommands.ts`. Cada comando usa `SUPABASE_DB_URL`, conecta como
`authenticator`, asume `service_role` solo dentro de la transacción y fija los claims Auth mediante
`set_config`. Nunca se usa la credencial propietaria `postgres` ni DML genérico desde Next.js.

S11 añade `schemas/59_superadmin_editorial_commands.sql`: la lectura protegida
`public.get_superadmin_editorial_context()` entrega el documento completo solo para borradores al
superadmin y metadatos para versiones publicadas/archivadas. Los comandos públicos
`create_superadmin_flash_draft`, `update_superadmin_flash_draft` y `publish_superadmin_flash` son
wrappers estrechos sobre transacciones privadas; requieren motivo, idempotencia, concurrencia
optimista y auditoría, y no crean publicaciones de calendario, intentos, puntos ni actividad.

E01 añade `schemas/36_mini_wordle.sql` y `schemas/92_mini_wordle_commands.sql`. El portal acepta
`multiple-choice` y `mini-wordle` en el mismo Flash, con dos preguntas de 50 puntos. La solución y
las palabras auxiliares viven en el payload privado; el payload público solo contiene prompt, pista,
longitud y máximo de intentos. `npm run supabase:dictionary:load` carga únicamente el diccionario
general desde `public/dictionaries`, y `private.submit_mini_wordle_guess(jsonb)` acepta la unión
del diccionario general con `additionalGuesses` de la pregunta, registra cada palabra válida,
calcula feedback con letras repetidas, rechaza duplicados sin consumir intento y crea una única
recepción final desde los eventos persistidos.

E02 añade `schemas/93_logic_code.sql` y su migración reproducible. El portal acepta
`multiple-choice` y `logic-code` en el mismo Flash; los códigos enviados se registran como eventos
privados y `private.submit_logic_code_attempt(jsonb)` valida longitud, formato, plazo, sesión,
versión e idempotencia. Los duplicados se rechazan sin penalización, el progreso solo devuelve
códigos ya enviados y contador de incorrectos, y el evaluador recibe la secuencia completa desde
`read_evaluation_context` al acertar.

E03 añade `schemas/89_progressive_clues.sql` y `schemas/94_progressive_clues.sql`, más las
migraciones `20260917102000_e03_progressive_clues.sql` y
`20260917102100_e03_progressive_clues_validation.sql`. El portal acepta
`multiple-choice` y `progressive-clues` en el mismo Flash; la primera pista se registra gratis al
preparar la interacción y las siguientes se conceden con
`private.reveal_progressive_clue(jsonb)`. El navegador solo recibe metadatos y pistas ya
reveladas. La tabla privada conserva índice, versión, penalización efectiva, puntos disponibles y
clave idempotente; la evaluación reconstruye el número real de pistas desde esos eventos.

E04 añade `schemas/95_matching.sql` y las migraciones `20260917103000_e04_matching.sql` y
`20260917103100_e04_matching_validation.sql`. El portal acepta `multiple-choice` y `matching` en
el mismo Flash; las dos columnas se entregan sin `correctMatchId`, y cada pareja se valida mediante
`private.submit_matching_pair(jsonb)`. `private.matching_pair_events` conserva aciertos, fallos,
secuencia, tiempos y claves idempotentes. La penalización es el 10% de los puntos reales del item;
la evaluación y el timeout reconstruyen el progreso exclusivamente desde esos eventos.

Para ejecutar el piloto competitivo local:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s03
npm run test:integration:supabase -- --scenario s03
npm run test:e2e -- e2e/s03-flash.spec.ts
```

La verificación completa de S22 se ejecuta con `npm run verify:pilot`. Arranca un stack local,
aplica el esquema desde una base limpia, ejecuta pgTAP y todos los escenarios locales del portal,
Flash, recuperación, histórico, editorial y calendario. No requiere ni acepta un proyecto remoto.
Los escenarios `e01`, `e02`, `e03` y `e04` cubren el portal mixto, la lectura pública sin solución,
Auth local, recarga, duplicados, ceros iniciales, pistas futuras, correspondencias y reintento idempotente.

S07 añade las lecturas Flash `public.get_flash_history(text, uuid)` y
`public.get_flash_member_review(text, uuid, uuid)` desde `schemas/85_flash_history_reads.sql`.
El historial solo incluye publicaciones `closed` sin intentos `in_progress` y excluye pruebas,
invalidaciones y cancelaciones. La revisión propia terminal también está disponible para un
spectator; la revisión ajena completa, incluidas soluciones, se limita a `owner`, `admin` y
`member`. Los abandonos conservan respuestas parciales y proyectan los items restantes como
`unanswered`. No se crean tablas materializadas ni se conecta un proyecto remoto.

### Operación de la beta cerrada

La UI pública no crea salas privadas, gestiona invitaciones ni prepara o activa temporadas. La
creación inicial ya está disponible desde `/admin`, un portal privado de superadmin con autorización
server-side, comando estrecho e idempotencia. La sala se crea activa con owner explícito y grupo
inicial opcional, y la operación queda registrada en una única auditoría agregada. Durante la beta,
el superadmin provisiona directamente a usuarios autenticados, sin crear ni consumir una invitación
y sin requerir aceptación de enlace.

La publicación mínima de contenido, la programación de desafíos y la ejecución del calendario están
implementadas localmente para S11/S12 en ese portal interno, no para PostgREST público ni para las
rutas de usuario. S12 usa `POST /api/internal/calendar/tick` o `npm run calendar:tick`, con reloj de
PostgreSQL y secreto local; no introduce scheduler remoto, cola ni worker. El flujo de invitaciones y
sus límites permanecen documentados como capacidad futura. El portal no debe resolver este alcance
mediante DML genérico con `service_role`: cada mutación debe pasar por un comando administrativo
específico y auditado. La gestión posterior de miembros, cancelación y reemplazo de versiones
publicadas siguen pendientes.

Para ejecutar el recorrido histórico local:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s07
npm run test:integration:supabase -- --scenario s07
npm run test:e2e -- e2e/s07-history-review.spec.ts
```

El token de control del intento solo vive en una cookie HttpOnly con duración limitada. No aparece
en los DTO, HTML/RSC, `localStorage`, auditoría ni `private.command_requests`; durante la partida
la solución queda en PostgreSQL y la revisión terminal se reconstruye mediante la proyección
autorizada.

Para el MVP, el token identifica una única sesión controladora por intento. La misma cookie permite
recuperar tras una recarga; un segundo navegador o dispositivo recibe un conflicto de sesión activa
y no puede transferir el control. La recuperación no vuelve a presentar una interacción ya preparada:
primero reconcilia una respuesta recibida o consume la interacción según el modo. El takeover queda
aplazado y su wrapper privado está deshabilitado. Esta última política está documentada para las
siguientes slices; aún no cambia los comandos SQL ejecutables.

Los escenarios locales no son seeds globales. Se crean con cuentas Auth reales y datos de dominio
mediante mantenimiento local. El runner es común y recibe el identificador del escenario:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s02
npm run test:integration:supabase -- --scenario s02
npm run test:e2e -- e2e/s02-rooms.spec.ts
```

Las credenciales temporales se guardan en `output/fixtures/<scenario>.json` (ignorado por Git).
Para limpiar un escenario, ejecuta `npm run supabase:fixture -- --scenario s02 --clean`, que hace
`db reset --local`. El fixture es la única fuente de datos del E2E S02; no se debe convertir en
`supabase/seed.sql`.

## Dataset para pruebas manuales en navegador

Para abrir la aplicación con cuentas Auth conocidas, una sala persistida y desafíos ya preparados:

```bash
npm run supabase:browser:setup
npm run dev
```

El comando reinicia únicamente el Supabase local, crea seis cuentas Auth y aprovisiona su `Player`
mediante `provision_player` antes de ejecutar `supabase/seed.sql`. El seed contiene solo datos de
dominio y recibe los `player_id` dinámicos mediante variables de `psql`; no inserta usuarios Auth ni
usa DML desde la aplicación. Las credenciales se imprimen al terminar y se guardan con permisos
restrictivos en `output/fixtures/browser.json`, que está ignorado por Git.

| Cuenta     | Correo                       | Contraseña local              | Rol en `browser-playground`                          |
| ---------- | ---------------------------- | ----------------------------- | ---------------------------------------------------- |
| superadmin | `superadmin@the-flash.local` | `Flash-local-Superadmin-123!` | Superadministrador global; no es miembro competitivo |
| owner      | `owner@the-flash.local`      | `Flash-local-Owner-123!`      | `owner`                                              |
| admin      | `admin@the-flash.local`      | `Flash-local-Admin-123!`      | `admin`                                              |
| member     | `member@the-flash.local`     | `Flash-local-Member-123!`     | `member`                                             |
| spectator  | `spectator@the-flash.local`  | `Flash-local-Spectator-123!`  | `spectator`                                          |
| outsider   | `outsider@the-flash.local`   | `Flash-local-Outsider-123!`   | Owner de `browser-isolated`                          |

Estas contraseñas están versionadas exclusivamente para el entorno local: no deben reutilizarse ni
configurarse contra un proyecto remoto. La sala principal tiene una publicación abierta, una futura
y una cerrada. El desafío abierto se puede visitar en
`/desafios/<publicationId>?roomId=browser-playground`.

El dataset base no contiene intentos, respuestas ni puntos, para que la primera partida sea limpia.
Para cargar además resultados históricos, rankings y revisiones:

```bash
npm run supabase:browser:setup -- --with-history
```

`supabase db reset --local` continúa sin cargar este dataset automáticamente. Esto mantiene aislados
los resets de los escenarios `s02`, `s03`, `s07`, `s08`, `s10`, `s11` y `s12`, que siguen siendo la
fuente de datos reproducible de sus pruebas de integración y E2E.

El comando `db diff` no es el workflow declarativo de este repositorio: en la versión actual de la
CLI su baseline es el historial de migraciones y no la ruta declarativa configurada.

6. Validar la reconstrucción completa cuando sea necesario. Este comando borra y recrea la base de
   datos local, por lo que no debe ejecutarse contra un entorno con datos que se quieran conservar:

   ```bash
   npx supabase db reset --local
   ```

Los cambios deben revisarse tanto en el archivo declarativo como en la migración resultante. La
migración es la unidad que permite reproducir el historial y, en una fase posterior, desplegarlo en
un entorno remoto.

## Excepciones que requieren SQL manual

Usa una migración creada con `npx supabase migration new nombre_descriptivo` cuando el cambio no sea
una transformación de esquema que el sincronizador declarativo pueda representar de forma fiable.
Entre los casos
importantes están:

- DML y backfills: `insert`, `update`, `delete` o transformaciones de datos existentes.
- Cambios de políticas RLS, especialmente `alter policy`.
- Comentarios, privilegios de esquema y ciertos `grant`.
- Particiones, publicaciones y dominios.
- Propiedad de vistas, `security_invoker` en vistas y vistas materializadas.
- Cambios que deban ejecutarse en un orden operativo concreto o que necesiten lógica procedural,
  comprobaciones y pasos de datos.

La migración manual debe ser idempotente cuando el contexto lo requiera y revisarse por separado por
posibles pérdidas de datos. Si la excepción también tiene una representación declarativa, actualiza
ambas fuentes; si no la tiene, documenta en la migración por qué queda fuera del diff declarativo.

## Versionado

Se versionan:

- `supabase/config.toml`.
- Todos los archivos SQL de `supabase/schemas/`.
- Todos los archivos SQL de `supabase/migrations/`.
- `supabase/seed.sql` si se crea para datos de desarrollo.
- La documentación del workflow.

No se versionan `.temp/` ni `.branches/`, que son estado interno de la CLI.
