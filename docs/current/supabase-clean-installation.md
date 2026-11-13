# Preparación de entornos Supabase

> Estado: vigente. Entornos admitidos: local y staging. El historial consolidado conserva la medición automática por temporada; su aplicación en staging y la comprobación de cron siguen pendientes.

Esta es la guía principal para elegir y preparar un entorno. El historial activo parte de un baseline
generado desde `supabase/schemas/`. Actualmente contiene una única migración inicial; los cambios posteriores serán incrementales. Un reinicio
completo elimina datos de aplicación, usuarios de Auth y archivos de Storage; debe hacerse
únicamente cuando esos datos sean prescindibles.

## Qué necesito preparar

| Tarea                                                      | Recorrido                                                                               | Efecto sobre los datos                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Crear contenido desde un administrador local, sin ejemplos | [Local mínimo](#local): reset completo y `supabase:local:bootstrap`                     | Elimina PostgreSQL, Auth y Storage locales; deja un administrador, diccionarios y buckets vacíos. |
| Probar el escenario conjunto jugable                       | [Tabarnia y BetaVIP](#escenario-local-con-tabarnia-y-betavip): `supabase:betavip:setup` | Reinicia la base local y carga ambas salas.                                                       |
| Probar solo la alpha de Tabarnia                           | [Tabarnia](#alpha-local-de-tabarnia): `supabase:tabarnia:setup`                         | Reinicia la base local y carga la alpha.                                                          |
| Probar permisos y pantallas, con historial opcional        | [Navegador](#dataset-para-probar-el-navegador): `supabase:browser:setup`                | Reinicia la base local; `--with-history` añade partidas anteriores.                               |
| Preparar un caso específico de integración o E2E           | [Fixtures](#fixtures-de-escenarios): `supabase:fixture -- --scenario <scenario>`        | Crea cuentas y contenido; `--clean` puede reiniciar toda la base local.                           |
| Reconstruir staging desde cero                             | [Reset solamente](#reset-solamente)                                                     | Elimina PostgreSQL, Auth y Storage del proyecto confirmado; no crea escenarios.                   |
| Preparar BetaVIP o Tabarnia en staging                     | [Bootstrap de escenarios](#bootstrap-de-escenarios)                                     | Prepara solo el escenario elegido y sus requisitos.                                               |

Los recorridos locales requieren Docker y Supabase local activos. Copiar `.env.example` a
`.env.local`, iniciar el stack con `npm run supabase:start` y obtener las claves locales con
`npm run supabase:status`. Detener la aplicación y los watchers antes de un reinicio. Los setups
de navegador, Tabarnia y BetaVIP ya reinician la base; no necesitan un reset previo separado.

`NODE_ENV=production` y `next build`/`next start` describen el build optimizado de Next.js que
también utiliza staging. Los archivos `production-*` y el perfil de calendario `production`
conservan sus nombres técnicos; ninguno añade un destino operativo.

La revisión esperada se consulta en [estado actual](status.md) y en `.env.example`;
`npm run schema:revision:check` comprueba su coherencia con la última migración. El refactor y la reconciliación se describen en [los validadores por formato](sql-question-validation-refactor.md) y [los comandos competitivos](competitive-command-reconciliation.md). La [extracción del handler](sql-attempt-command-handlers-refactor.md) conserva estos contratos con siete operaciones privadas. La [biblioteca de preguntas](sql-question-library-refactor.md) incluye autorización y paginación en la inicial vigente.

Calendario y expiración independiente usan las RPC `run_calendar_tick` y `expire_stale_attempts`,
exclusivas de `service_role`, con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en
servidor y sin cookies. Aplicar la migración antes de desplegar la app; su notificación recarga
la caché de PostgREST. La expiración conserva un límite SQL de cinco segundos; el tick usa
`statement_timeout = 0` y `lock_timeout = 0`, sujeto a los límites HTTP del proveedor. `SUPABASE_DB_URL` sigue siendo
necesaria para comandos de juego y otros adaptadores. El workflow de [base de datos](../../supabase/README.md)
describe validación y reversión.

## Herramientas y garantías

- `supabase:environment:reset` exige `--target local|staging`. Cualquier otro destino se rechaza antes de cargar el archivo de entorno o ejecutar operaciones, incluso con `--dry-run`. Elimina archivos y buckets por la API de Storage, elimina usuarios por Auth Admin y reconstruye PostgreSQL con la migración activa, sin seed. No borra archivos mediante SQL.
- El destino local comprueba URL, puerto y contenedor frente a `supabase/config.toml`. El remoto comprueba la referencia, URL de API, conexión administrativa y proyecto enlazado en la CLI antes de borrar nada. La CLI recibe también la referencia explícita.
- Un reinicio remoto requiere `SUPABASE_RESET_CONFIRM=<entorno>:<project-ref>` y `FLASH_WRITES_PAUSED=true`, después de detener acceso y calendario. Estas variables documentan la intervención del operador; el script no bloquea Vercel ni desactiva su cron automáticamente.
- El `--dry-run` del reset valida confirmación, pausa de escrituras y proyecto enlazado. No crea clientes de API, escribe manifiestos ni ejecuta migraciones.
- El reset comprueba el historial completo aplicado, el inventario de permisos y la ausencia de datos. Los sondeos de mutación del inventario siguen limitados a las bases desechables de pruebas.
- `supabase:local:bootstrap` exige `--target local` y prepara superadmin, diccionarios y buckets. Rechaza otros destinos, entornos con contenido, cuentas ajenas al bootstrap o credenciales de otro stack. La asignación de superadmin tiene un evento de auditoría y no se duplica al repetir el comando.
- `supabase:dictionary:load` conserva local como destino predeterminado y admite `--target staging` explícito. Ambos destinos pueden comprobarse con `--dry-run`.
- Los bootstraps `supabase:staging:bootstrap:betavip` y `supabase:staging:bootstrap:tabarnia` preparan escenarios independientes, comparten Xesmona, Ches y el archivo de credenciales, y aseguran diccionarios y buckets. Sus `--dry-run` validan configuración sin crear clientes, cuentas, assets ni manifiestos. Los setups de ejemplos y fixtures actúan únicamente en local.

Se requiere Node.js 20.12 o posterior. Los comandos operativos admiten `--env-file <ruta>` y
cargan `.env.local` cuando el destino es local. Las variables presentes en el proceso tienen
precedencia. Los comandos de staging requieren el archivo operativo explícito; no cargan
`.env.local` automáticamente.

Los comandos npm de reset, bootstrap local y diccionarios delimitan los argumentos de Node con
`node --`: `--env-file` pertenece al script y se procesa después de validar el destino. Si se
invocan directamente, usar también `node -- scripts/<script>.mjs ...`.

## Local

Con Docker y Supabase local iniciados, detener la aplicación y cualquier watcher del calendario antes del reinicio:

```bash
npm run supabase:environment:reset -- --target local --dry-run
npm run supabase:environment:reset -- --target local
npm run supabase:local:bootstrap -- --target local --dry-run
npm run supabase:local:bootstrap -- --target local
```

El administrador local predeterminado es `superadmin@the-flash.local`. Puede cambiarse con `BOOTSTRAP_ADMIN_EMAIL`. La contraseña es aleatoria y se guarda únicamente en `output/local/bootstrap-credentials.json`, con permisos `0600`. El manifiesto sin contraseña queda en `output/local/bootstrap-manifest.json`.

Si se pierde el archivo antes de completar el bootstrap, el script rechaza promover una cuenta
existente sin verificarla. Resolver la identidad mediante el procedimiento administrativo,
sin añadir un bypass ni reiniciar un entorno con partidas nuevas para recuperar credenciales.

El reset retira manifiestos de fixtures y credenciales del bootstrap anterior. Su progreso queda en `output/local/reset-manifest.json`, que registra las fases completadas y marca un fallo. Los archivos de auditoría y reversión se conservan.

El perfil mínimo deja un usuario, un jugador, una asignación de superadmin y un evento de asignación. No crea salas, temporadas, preguntas, desafíos, intentos, resultados ni puntos. Los buckets quedan vacíos. El superadmin crea después el contenido desde `/admin`.

La [reinstalación local del 2026-11-03](../archive/reports/local-reinstallation-2026-11-03.md)
verifica este perfil sobre `20261103090247_initial_schema`, con Auth, Storage, diccionarios y
acceso al portal. Staging quedó fuera de esa operación.

La CLI local recrea los buckets vacíos de `config.toml` durante el reset. La verificación acepta únicamente su configuración canónica y conserva sus límites de tamaño, que la CLI interpreta en unidades binarias. Los límites del bootstrap remoto conservan las unidades decimales de la API.

Los setups siguientes sustituyen el perfil mínimo por ejemplos. Antes de volver al perfil mínimo,
repetir este procedimiento completo.

## Escenario local con Tabarnia y BetaVIP

Con el stack local activo, preparar el escenario conjunto:

```bash
npm run supabase:betavip:setup
npm run dev
```

El setup reinicia la base local, prepara Tabarnia y añade BetaVIP con sus seis desafíos y el asset
del casete. Las cuentas y los IDs quedan en `output/fixtures/tabarnia.json` y
`output/fixtures/betavip.json`; este último incluye las credenciales locales de Manuel y Genís.
Las credenciales de ejemplo son exclusivamente locales.

### Duración de los desafíos

Ambos setups locales aceptan `--schedule <production|fast|Nm|Nh>`. Las duraciones personalizadas
usan un entero positivo seguido de `m` (minutos) o `h` (horas), en minúsculas:

```bash
npm run supabase:tabarnia:setup -- --schedule 10m
npm run supabase:betavip:setup -- --schedule 30m
npm run supabase:betavip:setup -- --schedule 1h
```

| Calendario                    | Ventana por desafío | Temporada Tabarnia (9 desafíos) | Temporada BetaVIP (6 desafíos) |
| ----------------------------- | ------------------- | ------------------------------- | ------------------------------ |
| `production` (predeterminado) | 24 horas            | 17 días                         | 6 días                         |
| `fast`                        | 5 minutos           | 45 minutos                      | 30 minutos                     |
| `10m`                         | 10 minutos          | 90 minutos                      | 60 minutos                     |
| `30m`                         | 30 minutos          | 4 h 30 min                      | 3 horas                        |
| `1h`                          | 1 hora              | 9 horas                         | 6 horas                        |

Con `fast` o una duración personalizada, las ventanas son consecutivas y la temporada termina al
cerrar el último desafío. BetaVIP transmite el mismo calendario a Tabarnia al preparar ambas salas.
Los límites individuales de preguntas y partidas, las vidas y los puntos conservan su configuración.
Para una hora y media usa `90m`; no se admiten decimales, unidades compuestas, valores cero o
negativos ni calendarios cuyo fin quede fuera del rango de fechas válido.

El manifiesto guarda la duración en `scheduleWindowMinutes` y el total en `seasonDurationMinutes`.
Los perfiles personalizados se normalizan a minutos: `1h` y `60m` se guardan como
`scheduleProfile: "60m"`. Los nombres `fast` y `production` se conservan.

La opción configura el escenario nuevo creado por el setup. Para modificar una temporada existente,
utiliza la [reprogramación segura del portal](calendar-rescheduling.md). El bootstrap específico de
staging conserva su calendario actual y no incorpora esta opción.

Por defecto, ambas temporadas empiezan al ejecutar el setup y «Circuito de parejas» queda abierto en BetaVIP.
Para programar un inicio futuro, pasar una fecha y hora ISO 8601 con zona horaria; el primer desafío
quedará programado hasta esa hora. La opción también está disponible en `supabase:tabarnia:setup`:

```bash
npm run supabase:betavip:setup -- --schedule 30m --starts-at "2030-10-20T19:00:00+02:00"
```

Elige siempre una fecha futura. La fecha y hora configuradas se guardan en UTC en el manifiesto,
conservando los segundos si se indicaron. Al omitir `--starts-at`, el inicio se alinea al minuto.
El desafío queda visible como
próximo y se podrá jugar al llegar el inicio; cada persona inicia su propia partida manualmente.

Con el perfil predeterminado `production`, «Circuito de parejas» está abierto durante las primeras 24 horas:
siete tableros de Conectar parejas de 4×4, 4×4, 5×5, 5×5, 6×6, 6×6 y 7×7, de tres a siete parejas,
un único reloj de 150 segundos y pesos de 12, 13, 13, 14, 15, 16 y 17 puntos. Borrar y rehacer caminos
no penaliza. Después se programan
«La vuelta al mundo» para el segundo día, «Cumbre lógica II» para el tercero, «Escalera de coronas»
para el cuarto, «Supervivencia: Cultura pop» para el quinto y «Ecos de la Antigüedad» para el sexto.
«Escalera de coronas» ofrece siete tableros Queens de 4×4 a 7×7, comenzando con un 4×4 fácil, 100 puntos con pesos
12, 13, 13, 14, 15, 16 y 17, 150 segundos globales y finalización por la tercera validación incorrecta
de un tablero.
La temporada dura 144 horas. El perfil rápido usa seis ventanas consecutivas de cinco minutos
(30 minutos en total). El manifiesto lista las publicaciones en ese orden; `data.publicationId`
y `data.connectPairsPublicationId` apuntan a «Circuito de parejas». Los campos
`data.alphabetPublicationId`, `data.pyramidPublicationId`, `data.timeTrialPublicationId`,
`data.survivalPublicationId` y `data.antiquityPublicationId` siguen identificando los cinco
originales; `data.timeTrialPublicationId` corresponde al Contrarreloj Queens.
`data.questionAssets` contiene el recurso del casete. Los
[perfiles y comandos de calendario](../../README.md#comandos-disponibles) explican
cómo recorrer las ventanas localmente.

Para verificar el escenario, ejecutar `npm run test:integration:supabase -- --scenario betavip`.
Volver a ejecutar el setup antes de `npm run test:e2e -- e2e/betavip.spec.ts` para que el navegador
empiece sin la partida creada por la integración. Repetir el setup al terminar: el E2E avanza por
los desafíos y crea partidas.

## Alpha local de Tabarnia

Este seed es un escenario técnico de nueve desafíos y quince jugadores en la sala. Sirve para
verificar recorridos y la medición común. La cohorte y las publicaciones del
[estudio Lean de Tabarnia](../product/strategy/lean-startup/cycles/CYCLE-001.md) se preparan por separado.

Con el stack local activo:

```bash
npm run supabase:tabarnia:setup
npm run dev
```

El setup reinicia la base local y crea 16 cuentas: Xesmona como superadmin fuera de la sala, Ches
como propietario y jugador, y otros catorce miembros jugadores. Programa Steel Ball Run (16 retos,
100 puntos), Reino de animales en Alphabet (16 letras, 150 segundos, 100 puntos), Queens
(siete tableros de 4×4 a 7×7, 100 puntos y 150 segundos globales), España (20 preguntas,
3 vidas, 100 puntos), Cumbre lógica (7 niveles, 100 puntos), Multiverso friki en
Alphabet (16 letras, 150 segundos, 100 puntos), Flow Free (nueve tableros de
4×4 a 7×7, 100 puntos y 150 segundos globales), «La Biblia» en Pirámide
(7 niveles, 100 puntos) y Tabarniaverso en Flash (16 preguntas, tiempos de 12 a 30 segundos y
100 puntos), en ese orden y en ventanas consecutivas de 24 horas. La novena ventana ocupa
las horas 192 a 216 desde el inicio. La temporada dura 17 días con el perfil predeterminado.

Las instalaciones nuevas programan Cumbre lógica v2 con parciales en Ordenación, Conexiones y Queens;
La Biblia v2 con parciales en Emparejamiento, Ordenación, Sopa de letras y Clasificación, y
Flow Free v2 con nueve tableros y parcial al agotar el reloj en el tablero en curso. Estos
controles coinciden con los de sus demos locales. Las publicaciones existentes conservan su versión
asignada. Para usar una versión nueva, selecciónala desde el calendario mientras la publicación
permita cambiar de versión.

En una instalación existente, las migraciones habilitan los controles de parciales sin crear ni
publicar versiones del contenido. Desde el portal superadmin, usa «Crear corrección» sobre cada v1
para preparar Cumbre lógica v2 y La Biblia v2, activa los controles correspondientes y publica ambas.
Haz lo mismo con Flow Free: su v2 añade dos tableros y
activa `connectPairsTimeoutPartialCredit`. Después selecciónalas en publicaciones editables del calendario. Este flujo conserva los intentos,
los resultados y las versiones asignadas a las publicaciones ya abiertas o cerradas.
Si una base ya tiene una v2 publicada, se conserva: editar una migración ya aplicada no la revierte
ni libera ese número de versión.

Carga los diccionarios de Mini-Wordle y los recursos privados de imagen; el mapa SVG de Canarias
se rasteriza a PNG durante la preparación. No crea intentos ni resultados históricos. Las cuentas,
credenciales fijas locales y metadatos quedan en `output/fixtures/tabarnia.json`; el comando imprime
las credenciales y la ruta del desafío abierto. El [perfil rápido](../../README.md#comandos-disponibles)
permite recorrer las ventanas sin esperar un día.

## Dataset para probar el navegador

Con el stack local activo, preparar cuentas con distintos permisos, salas persistidas y desafíos:

```bash
npm run supabase:browser:setup
npm run dev
```

Para incluir resultados históricos, usar `npm run supabase:browser:setup -- --with-history` en lugar
del setup anterior. Ambas variantes reinician la base local y escriben cuentas, credenciales fijas e
IDs en `output/fixtures/browser.json`. Las credenciales también se imprimen en la terminal.

## Fixtures de escenarios

Los fixtures crean cuentas Auth y contenido temporal para un caso concreto. Con el stack local
activo y una base destinada a pruebas:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario <scenario>
```

`supabase:db:reset` reconstruye PostgreSQL local con las migraciones; el seed está desactivado en
`supabase/config.toml`. Este comando no sustituye a la limpieza completa de Auth, objetos de
Storage y manifiestos que coordina `supabase:environment:reset`.

Los manifiestos con cuentas, credenciales e IDs se guardan en `output/fixtures/<scenario>.json`,
ignorado por Git. Si ya existe el manifiesto, limpiar ese escenario antes de recrearlo:

```bash
npm run supabase:fixture -- --scenario <scenario> --clean
```

La limpieza puede reiniciar toda la base local, no solo las filas del escenario. No ejecutar sobre
datos que se quieran conservar. El fixture sin `--clean` no ejecuta un reset automático.
Consultar los escenarios y sus pruebas concretas en `scripts/fixtures/scenarios/`,
`scripts/integration/scenarios/` y la [operación del piloto](s22-operacion.md).

Los registros de instalación anteriores se conservan en el
[archivo histórico](../archive/reports/installations-2026-10-11.md); sus revisiones no configuran un entorno actual.

## Verificación local

Con Docker y el stack local disponibles, comprobar el esquema en una base desechable:

```bash
npm run supabase:schema:test
```

La prueba carga el esquema declarativo y comprueba inventario de seguridad, ACL/RLS, integridad,
comandos, idempotencia, rollback y concurrencia. No reinicia la base habitual del proyecto.

Para la verificación completa del piloto, usar un entorno local con datos prescindibles:

```bash
npm run verify:pilot
```

El piloto reinicia la base local entre escenarios, prepara fixtures, carga diccionarios y ejecuta
integración, E2E y backup/restore, además de las comprobaciones estáticas y unitarias. No usarlo
sobre partidas que se quieran conservar. La [operación del piloto](s22-operacion.md) documenta
los escenarios y sus límites; [QA](qa.md) mantiene la matriz de comandos y las comprobaciones
apropiadas para cada cambio. Estos resultados locales no acreditan staging.

## Staging — ejecución posterior

Preparar `.env.staging.operations`, excluido de Git, con `STAGING_PROJECT_REF`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ADMIN_DB_URL`, `STAGING_XESMONA_EMAIL`, `STAGING_CHES_EMAIL` y
`STAGING_BOOTSTRAP_CONFIRM=the-flash-game-staging`, según `.env.example`.
Los emails deben ser distintos después de normalizar mayúsculas. La conexión administrativa debe
ser Direct connection con usuario `postgres` o Session pooler en puerto `5432` con usuario
`postgres.<project-ref>`; la conexión Transaction pooler no sirve para provisionamiento. Mantener
las credenciales administrativas fuera de Vercel Runtime.

Hay tres operaciones distintas: reset, bootstrap BetaVIP y bootstrap Tabarnia. Cada bootstrap
asegura por sí mismo los diccionarios y buckets que necesita. Se pueden ejecutar en cualquier
orden y repetir; ejecútalos uno por uno. El reset no prepara escenarios.

### Reset solamente

Solo usarlo cuando se puedan eliminar todos los datos de staging. Añadir al archivo operativo:

```dotenv
SUPABASE_RESET_CONFIRM=staging:<project-ref>
FLASH_WRITES_PAUSED=true
```

En la ventana acordada, cerrar el acceso al despliegue y detener las invocaciones del calendario.
Enlazar la CLI al proyecto correcto. El `--dry-run` verifica la confirmación, la pausa y la
referencia enlazada, pero no borra datos ni escribe archivos:

```bash
npx supabase link --project-ref <staging-project-ref>
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations --dry-run
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations
```

El reset vacía Storage, elimina usuarios de Auth y reconstruye PostgreSQL con las migraciones,
sin seed, diccionarios, usuarios ni salas. También elimina las credenciales compartidas y los dos
manifiestos de escenario antiguos; conserva `output/staging/reset-manifest.json` como evidencia.
No ejecuta después ningún bootstrap.

Durante la limpieza, la consola indica cada operación de Storage. El manifiesto se actualiza
progresivamente con la operación actual, el bucket, el progreso de cada bucket y el error
(código, estado HTTP y mensaje saneado). Si falla Storage, puede haber buckets ya vaciados o
eliminados: consulta `storage` en el manifiesto y verifica el estado actual en Supabase antes de
reintentar el reset.

`emptyBucket` inicia el borrado asíncrono. El reset comprueba de forma read-only que ya no queden
filas de ese bucket en `storage.objects` antes de pedir su eliminación; espera hasta dos minutos.
Si el borrado no termina dentro de ese límite, se detiene en `waitForEmpty` y no continúa a Auth ni
a PostgreSQL.

### Bootstrap de escenarios

Tras el reset, o sobre una base migrada, ejecuta uno o ambos escenarios. Primero comprueba cada uno
con `--dry-run`; después quita esa opción para aprovisionarlo:

```bash
npm run supabase:staging:bootstrap:betavip -- --env-file .env.staging.operations --dry-run
npm run supabase:staging:bootstrap:betavip -- --env-file .env.staging.operations

npm run supabase:staging:bootstrap:tabarnia -- --env-file .env.staging.operations --dry-run
npm run supabase:staging:bootstrap:tabarnia -- --env-file .env.staging.operations
```

BetaVIP crea su sala y cinco desafíos. Tabarnia crea su sala, nueve desafíos, quince miembros y
catorce cuentas de prueba propias; no reutiliza los emails ni las contraseñas del seed local.
Ambos reutilizan las mismas cuentas de Xesmona y Ches. Xesmona mantiene el rol superadmin y Ches
es propietario en cada sala. El registro seguro compartido está en
`output/staging/bootstrap-credentials.json` (permisos `0600`); los manifiestos separados son
`output/staging/bootstrap-manifest.json` para BetaVIP y
`output/staging/tabarnia-bootstrap-manifest.json` para Tabarnia. Conserva las credenciales durante
una recuperación y guárdalas también en el gestor seguro del equipo.

Cada comando se puede repetir. Las cuentas ya registradas se reutilizan y los datos de escenario
usan IDs estables; si un ID existente tiene contenido incompatible, el comando falla en vez de
reemplazarlo. No lances ambos bootstraps simultáneamente: los archivos de credenciales son
compartidos.

La incorporación de Tabarniaverso a una temporada de staging ya aprovisionada con ocho
publicaciones requiere una operación de calendario separada. El bootstrap incluye la novena
publicación al crear una temporada nueva.

Para fijar el inicio de una temporada nueva, Tabarnia acepta `--starts-at` con ISO 8601 y zona
horaria. Pasa la misma fecha al `--dry-run` y a la ejecución real:

```bash
npm run supabase:staging:bootstrap:tabarnia -- --env-file .env.staging.operations --dry-run --starts-at "2026-11-10T19:00:00+01:00"
npm run supabase:staging:bootstrap:tabarnia -- --env-file .env.staging.operations --starts-at "2026-11-10T19:00:00+01:00"
```

BetaVIP también admite `--starts-at`. Las dos temporadas conservan el calendario técnico de
ventanas de 24 horas. Si la temporada ya existe con otra fecha, el bootstrap se detiene; para
cambiarla hay que hacer la reinstalación completa.

Desplegar el commit validado y comprobar con intentos nuevos:

| Escenario                                  | Resultado esperado                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Transferencia entre dos navegadores        | Un único controlador; el anterior recibe `session_transferred`         |
| Dos transferencias simultáneas             | Un ganador; el otro recibe `stale_version`                             |
| Recuperación tras perder la respuesta HTTP | Resultado aceptado sin otra transición ni otros puntos                 |
| Abandono e inactividad                     | Intento abandonado, sesiones con motivo `terminal`, sin acreditación   |
| Retirada de membresía                      | Sesiones con `permission_revoked`; acciones y replay rechazados        |
| Repetición de un cierre                    | Sin duplicar auditoría ni incremento de versión                        |
| Diccionario e imágenes                     | Palabras disponibles; imágenes privadas solo en recorridos autorizados |

La inactividad conserva la regla de 15 minutos tras cierre/deadline. No modificar reglas ni acortar
los tiempos competitivos para acelerar la prueba. Se conserva la integración de Vercel Cron con
GET, `CRON_SECRET` y la programación diaria `5 14 * * *` de `vercel.json`; el POST y el CLI usan
`CALENDAR_TICK_SECRET`. Vercel interpreta el cron en UTC: se ejecuta a las 14:05 UTC, que son las
15:05 en Madrid durante el horario de invierno (CET) y las 16:05 durante el horario de verano
(CEST). Por tanto, mantiene fija la hora UTC, no las 15:05 locales durante todo el año.

La etiqueta Production de Vercel es un tipo de despliegue de la plataforma, no otro entorno de
aplicación. Vercel solo programa crons para despliegues Production, no para previews; la ejecución
automática de staging no está verificada. Antes de abrir staging, confirmar en Settings → Cron Jobs
que la ruta está activa en el proyecto y despliegue previstos; durante el reset, desactivarla allí
y reactivarla tras las comprobaciones.

Configurar el despliegue de staging con conexiones y claves de su proyecto, `FLASH_RUNTIME_SCOPE=pilot`,
`APP_ORIGIN`, secretos de health y calendario y
`EXPECTED_SCHEMA_REVISION` con el valor de `.env.example`, contrastado con el
[estado actual](status.md). El runtime mantiene
su Transaction pooler. Las URLs de retorno de Auth deben corresponder al despliegue; el reset no
modifica esa configuración.

## Comprobaciones, apertura y recuperación

Antes de abrir cada entorno:

1. Confirmar que el manifiesto del reset está completo y que cada manifiesto de escenario corresponde al mismo proyecto y revisión.
2. Solicitar `GET /api/internal/health` con el secreto del entorno: `200`, con `auth`, `database` y `schema` en `true`. Comprobar también `supabase migration list`: health valida atributos y marcadores, no sustituye al historial aplicado.
3. Iniciar sesión con el superadmin y comprobar `/admin`. Una cuenta sin ese rol no debe obtener acceso al portal.
4. En local, comprobar el perfil mínimo con una identidad y jugador, buckets vacíos y diccionarios completos. En staging, comprobar Xesmona como superadmin, Ches como owner de cada sala preparada, los desafíos de cada manifiesto, los assets y los diccionarios.
5. Abrir acceso y reactivar calendario. Registrar commit, revisión, bootstrap y health en un informe sin credenciales.

Las puertas locales/CI incluyen esquema declarativo, migraciones, reconciliación, contratos, permisos y concurrencia; tipos públicos, arquitectura, documentación, lint, unitarias, build y E2E. Las pruebas de actualización histórica permanecen en Git; sus garantías vigentes se verifican como contratos y equivalencia de catálogos.

Si una fase de reset falla, mantener cerrado el entorno y revisar `reset-manifest.json`. Repetir solo dentro de la ventana de reinicio: vuelve a verificar el destino y elimina lo que quede. Cada bootstrap puede repetirse tras un fallo parcial si conserva `bootstrap-credentials.json`; las cuentas compartidas mantienen sus contraseñas y no se duplican.

Antes de abrir puede repetirse la instalación desde cero. Después de abrir, detener escrituras y aplicar la [reversión de comandos documentada](competitive-command-reconciliation.md#reversión-de-la-migración-incremental-original) mediante una migración posterior, con el build compatible y sus marcadores. No reiniciar una base que ya haya recibido partidas nuevas como rollback automático. El antiguo SQL de reversión se recupera desde Git; los verificadores actuales no generan ese artefacto.

Tras abrir staging, revisar errores, sesiones, auditoría y puntos durante las primeras partidas y
el primer tick. Una incidencia requiere revisión antes de seguir probando; no se cambia el commit
validado durante la comprobación.

## Adoptar el historial consolidado

La consolidación del repositorio se verificó en un stack desechable. La
[reinstalación local posterior](../archive/reports/local-reinstallation-2026-11-03.md) adoptó la
inicial en la base habitual; staging sigue pendiente. Una base con las 26 migraciones anteriores no puede recibir la
nueva inicial mediante `migration up` o `db push`: sus tablas ya existen y el ledger difiere.

Para un entorno cuyos datos sean prescindibles, usar el reset completo correspondiente de esta
guía y después cargar diccionarios y ejecutar su bootstrap. El reset reconstruye el esquema y el
ledger; Auth, objetos de Storage y buckets se coordinan por separado con sus APIs y configuración.
Los diccionarios y los usuarios no forman parte de la migración. Verificar revisión, historial,
health y cuentas antes de reabrir el acceso o reactivar calendario.

Para conservar datos, guardar y comprobar un respaldo de PostgreSQL, Auth y archivos, congelar
escrituras y comparar el esquema instalado con la inicial en un stack desechable. Solo después de
verificar equivalencia y restauración puede diseñarse una reconciliación del ledger. `migration repair`
modifica el historial registrado; no transforma tablas ni constituye una migración de datos.
Ese procedimiento debe prepararse para el estado real del entorno y no se ejecuta en esta entrega.

Después de adoptar la inicial, entregar cambios mediante nuevas migraciones incrementales. El
rollback también se realiza con una migración posterior compatible y el build correspondiente.
