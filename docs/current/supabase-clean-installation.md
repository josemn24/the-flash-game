# Preparación de entornos Supabase

> Estado: vigente. Entornos admitidos: local y staging. La instalación registrada es local; la ejecución y validación de staging quedan pendientes de una ventana posterior.

Esta es la guía principal para elegir y preparar un entorno. El historial activo parte de un baseline
generado desde `supabase/schemas/` y continúa con migraciones incrementales. Un reinicio
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
| Preparar staging sin una reinstalación                     | [Base migrada](#bootstrap-sobre-una-base-migrada): diccionarios y bootstrap de staging  | Aprovisiona cuentas y contenido; no ejecuta un reset.                                             |
| Reconstruir staging desde cero                             | [Reinstalación completa](#reinstalación-completa): reset, diccionarios y bootstrap      | Elimina PostgreSQL, Auth y Storage del proyecto confirmado.                                       |

Los recorridos locales requieren Docker y Supabase local activos. Copiar `.env.example` a
`.env.local`, iniciar el stack con `npm run supabase:start` y obtener las claves locales con
`npm run supabase:status`. Detener la aplicación y los watchers antes de un reinicio. Los setups
de navegador, Tabarnia y BetaVIP ya reinician la base; no necesitan un reset previo separado.

`NODE_ENV=production` y `next build`/`next start` describen el build optimizado de Next.js que
también utiliza staging. Los archivos `production-*` y el perfil de calendario `production`
conservan sus nombres técnicos; ninguno añade un destino operativo.

La revisión esperada es `20261011180045_initial_schema`. El refactor y la reconciliación se describen en [los validadores por formato](sql-question-validation-refactor.md) y [los comandos competitivos](competitive-command-reconciliation.md).

## Herramientas y garantías

- `supabase:environment:reset` exige `--target local|staging`. Cualquier otro destino se rechaza antes de cargar el archivo de entorno o ejecutar operaciones, incluso con `--dry-run`. Elimina archivos y buckets por la API de Storage, elimina usuarios por Auth Admin y reconstruye PostgreSQL con la migración activa, sin seed. No borra archivos mediante SQL.
- El destino local comprueba URL, puerto y contenedor frente a `supabase/config.toml`. El remoto comprueba la referencia, URL de API, conexión administrativa y proyecto enlazado en la CLI antes de borrar nada. La CLI recibe también la referencia explícita.
- Un reinicio remoto requiere `SUPABASE_RESET_CONFIRM=<entorno>:<project-ref>` y `FLASH_WRITES_PAUSED=true`, después de detener acceso y calendario. Estas variables documentan la intervención del operador; el script no bloquea Vercel ni desactiva su cron automáticamente.
- `--dry-run` muestra destino y operaciones. No crea clientes de API, escribe manifiestos ni ejecuta migraciones. Puede consultar el estado de la CLI local si faltan sus parámetros en el entorno.
- El reset comprueba el historial completo aplicado, el inventario de permisos y la ausencia de datos. Los sondeos de mutación del inventario siguen limitados a las bases desechables de pruebas.
- `supabase:local:bootstrap` exige `--target local` y prepara superadmin, diccionarios y buckets. Rechaza otros destinos, entornos con contenido, cuentas ajenas al bootstrap o credenciales de otro stack. La asignación de superadmin tiene un evento de auditoría y no se duplica al repetir el comando.
- `supabase:dictionary:load` conserva local como destino predeterminado y admite `--target staging` explícito. Ambos destinos pueden comprobarse con `--dry-run`.
- El bootstrap local es mínimo y el de staging prepara BetaVIP. Los setups de ejemplos y fixtures también pueden incluir BetaVIP, pero actúan únicamente en local y no deben usarse para preparar una base remota.

Se requiere Node.js 20.12 o posterior. Los comandos operativos de reset, bootstrap local y
diccionarios admiten `--env-file <ruta>` y cargan `.env.local` cuando el destino es local.
Las variables presentes en el proceso tienen precedencia. El bootstrap de staging solo admite
`--dry-run`: requiere las variables exportadas o un archivo cargado mediante la opción de Node
`--env-file=<ruta>`. Ningún comando remoto carga `.env.local` automáticamente.

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

La CLI local recrea los buckets vacíos de `config.toml` durante el reset. La verificación acepta únicamente su configuración canónica y conserva sus límites de tamaño, que la CLI interpreta en unidades binarias. Los límites del bootstrap remoto conservan las unidades decimales de la API.

Los setups siguientes sustituyen el perfil mínimo por ejemplos. Antes de volver al perfil mínimo,
repetir este procedimiento completo.

## Escenario local con Tabarnia y BetaVIP

Con el stack local activo, preparar el escenario conjunto:

```bash
npm run supabase:betavip:setup
npm run dev
```

El setup reinicia la base local, prepara Tabarnia y añade BetaVIP con sus cinco desafíos y el asset
del casete. Las cuentas y los IDs quedan en `output/fixtures/tabarnia.json` y
`output/fixtures/betavip.json`; este último incluye las credenciales locales de Manuel y Genís.
Las credenciales de ejemplo son exclusivamente locales.

Por defecto, ambas temporadas empiezan al ejecutar el setup. Para programarlas más tarde, pasar una
fecha y hora ISO 8601 con zona horaria; la opción también está disponible en `supabase:tabarnia:setup`:

```bash
npm run supabase:betavip:setup -- --starts-at "2026-10-20T19:00:00+02:00"
```

La fecha y hora configuradas se guardan en UTC en el manifiesto. El desafío queda visible como
próximo y se podrá jugar al llegar el inicio; cada persona inicia su propia partida manualmente.

Desde el inicio de temporada, «La vuelta al mundo» está abierto durante las primeras 24 horas,
«Cumbre lógica II» queda programado para el segundo día, «Escalera de coronas» para el tercero,
«Supervivencia: Cultura pop» para el cuarto y «Ecos de la Antigüedad» para el quinto. «Escalera de
coronas» es un Contrarreloj Queens de seis tableros, de 4×4 a 7×7, con 100 puntos y un único reloj
de tres minutos. La tercera validación incorrecta de un tablero termina la partida. La temporada
dura 120 horas. El perfil rápido conserva cinco ventanas consecutivas de cinco minutos (25 minutos
en total); el calendario normal usa cinco ventanas de 24 horas. El manifiesto lista las publicaciones
en ese orden; `data.publicationId` apunta a La vuelta al mundo y los campos
`data.alphabetPublicationId`, `data.pyramidPublicationId`, `data.timeTrialPublicationId`,
`data.survivalPublicationId` y `data.antiquityPublicationId` identifican cada publicación.
`data.questionAssets` contiene el recurso del casete. Los
[perfiles y comandos de calendario](../../README.md#comandos-disponibles) explican
cómo recorrer las ventanas localmente.

Para verificar el escenario, ejecutar `npm run test:integration:supabase -- --scenario betavip`.
Volver a ejecutar el setup antes de `npm run test:e2e -- e2e/betavip.spec.ts` para que el navegador
empiece sin la partida creada por la integración. Repetir el setup al terminar: el E2E avanza por
los desafíos y crea partidas.

## Alpha local de Tabarnia

Con el stack local activo:

```bash
npm run supabase:tabarnia:setup
npm run dev
```

El setup reinicia la base local y crea 13 cuentas: Xesmona como superadmin fuera de la sala, Ches
como propietario y jugador, y otros once miembros jugadores. Programa «Reino de animales» en
Alphabet (18 letras, 135 segundos, 100 puntos), «Biblia y religiones abrahámicas» en Pirámide
(7 niveles, 100 puntos), Steel Ball Run (16 retos, 100 puntos) y Supervivencia: España
(20 preguntas, 3 vidas, 100 puntos), en ese orden y en ventanas consecutivas de 24 horas.

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

## Registro de instalaciones locales

### Instalación anterior con bootstrap — 2026-10-10 (histórica)

Antes de consolidar el historial se reiniciaron PostgreSQL, Auth y Storage del stack `the-flash-game` y se aplicaron las 33 migraciones. El estado verificado contiene un superadmin y su jugador, un único evento de asignación, 2.433 palabras de cuatro letras y 8.774 de cinco letras, y dos buckets vacíos. No hay salas, temporadas, preguntas, desafíos, intentos ni puntos.

Repetir el bootstrap conserva la cuenta, la contraseña y el evento de asignación. Se comprobó el acceso a `/admin` desde el navegador y health en un build de producción con alcance `pilot`: `401` sin secreto y `200` con `auth`, `database` y `schema` en `true`. Las credenciales tienen permisos `0600`. La evidencia sin contraseñas queda en `output/local/installation-verification.json`.

Los 12 E2E existentes de Flash, recuperación, Pirámide y contratos por formato pasan usando un stack local aislado y el arranque `next build`/`next start`. Se mantienen los specs, las aserciones y los tiempos de espera. Pasan las 2.007 pruebas unitarias y las 55 suites SQL, inventario y concurrencia tanto desde el esquema declarativo como desde las migraciones; la auditoría de reconciliación y las pruebas de reversión también pasan. Tipos, tipos públicos generados, arquitectura, lint, build, formato y enlaces documentales pasan. La validación remota quedó pendiente.

### Baseline inicial limpio — 2026-10-11

`npm run verify:pilot` terminó correctamente contra Supabase local: pasó la reconciliación, las 55 suites SQL por `schemas/` y por migraciones, las 158 comprobaciones SQL compartidas, las 904 observaciones de validación, los contratos concurrentes, las pruebas unitarias, typecheck, arquitectura, lint, documentación, build, integración, E2E, diccionario y backup/restore. También pasó `npm run supabase:types:check`.

Al terminar el piloto se simuló y ejecutó `npm run supabase:environment:reset -- --target local`. El ledger local contiene únicamente `20261010214230_initial_schema`. Auth tiene cero usuarios; las tablas de `public` y `private` suman cero filas; Storage tiene cero objetos. La CLI local recreó solo los buckets configurados y vacíos `avatars` y `question-assets`. No se ejecutaron bootstrap ni carga de diccionarios después del reset. No se ejecutaron comandos ni validaciones contra staging.

### Baseline regenerado — 2026-10-11

El historial activo se consolidó en `20261011180045_initial_schema`, generado desde los 82 schemas declarativos. Las tres migraciones activas anteriores se conservaron en Git; no contenían DML ni backfills necesarios tras el reset. Pasan las 55 suites SQL desde schemas y desde el baseline, la reconciliación, los tipos, la documentación y los gates estáticos. `verify:pilot` se detuvo en una aserción del test del seed BetaVIP; por ello, sus etapas de integración y E2E no se ejecutaron.

El reset final local dejó únicamente la revisión `20261011180045` en el ledger, cero usuarios de Auth, cero filas en las tablas de `public` y `private`, cero objetos de Storage y dos buckets locales vacíos: `avatars` y `question-assets`. No se ejecutaron bootstrap, carga de diccionarios ni operaciones contra staging.

## Staging — ejecución posterior

Preparar `.env.staging.operations`, excluido de Git, con `STAGING_PROJECT_REF`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ADMIN_DB_URL`, `STAGING_XESMONA_EMAIL`, `STAGING_CHES_EMAIL` y
`STAGING_BOOTSTRAP_CONFIRM=the-flash-game-staging`, según `.env.example`.
Los emails deben ser distintos después de quitar espacios y normalizar mayúsculas.

La conexión administrativa debe ser Direct connection con usuario `postgres` o Session pooler en puerto `5432` con usuario `postgres.<project-ref>`. La conexión Transaction pooler del runtime no sirve para provisionamiento. Mantener las credenciales administrativas fuera de Vercel Runtime.

### Bootstrap sobre una base migrada

Con el proyecto enlazado y sus migraciones aplicadas, cargar diccionarios y comprobar el bootstrap
antes de aprovisionar. Si faltan migraciones, aplicarlas con `npx supabase db push` antes
de continuar; este recorrido no limpia datos existentes.

```bash
npx supabase link --project-ref <staging-project-ref>
npm run supabase:dictionary:load -- --target staging --env-file .env.staging.operations
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs --dry-run
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs
```

Con esas variables ya exportadas, los dos últimos comandos equivalen a
`npm run supabase:staging:bootstrap -- --dry-run` y `npm run supabase:staging:bootstrap`.
El bootstrap crea Xesmona, Ches, BetaVIP y su asset sin cambiar la configuración global de Auth.
Las contraseñas aleatorias quedan en `output/staging/bootstrap-credentials.json`, con permisos
`0600`, y el estado sin contraseñas en `output/staging/bootstrap-manifest.json`. Guardar las
contraseñas en un gestor seguro y retirar el archivo después de completar la preparación y
verificación; conservarlo durante una recuperación parcial del bootstrap.

Para programar el inicio de una temporada BetaVIP nueva, pasar `--starts-at` al dry-run y al
bootstrap real. Usa una fecha y hora ISO 8601 con zona horaria; por ejemplo, las 19:00 en Madrid:

```bash
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs --dry-run --starts-at "2026-10-20T19:00:00+02:00"
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs --starts-at "2026-10-20T19:00:00+02:00"
```

El manifiesto registra la fecha convertida a UTC. El bootstrap no cambia temporadas ya creadas: si
se indica una fecha distinta de la existente, falla con una instrucción para usar el procedimiento
de reinstalación completa.

### Reinstalación completa

Cuando se haya decidido eliminar los datos del proyecto, añadir al archivo operativo:

```dotenv
SUPABASE_RESET_CONFIRM=staging:<project-ref>
FLASH_WRITES_PAUSED=true
```

En la ventana acordada, cerrar el acceso al despliegue y detener las invocaciones del calendario. Enlazar la CLI al proyecto de staging y comprobar el destino:

```bash
npx supabase link --project-ref <staging-project-ref>
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations --dry-run
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations
npm run supabase:dictionary:load -- --target staging --env-file .env.staging.operations
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs --dry-run
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs
```

El reset ya aplica todas las migraciones; no hace falta volver a ejecutarlas con `db push`.
Su progreso queda en `output/staging/reset-manifest.json`. El bootstrap utiliza la misma validación
de proyecto, API y conexión administrativa que el reset; las credenciales y el manifiesto se
regeneran en `output/staging/`.

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
GET, `CRON_SECRET` y la programación diaria `0 13 * * *` de `vercel.json`; el POST y el CLI usan
`CALENDAR_TICK_SECRET`. Vercel interpreta el cron en UTC: se ejecuta a las 13:00 UTC, que son las
15:00 en Madrid durante el horario de verano (CEST) y las 14:00 durante el horario de invierno
(CET). Por tanto, mantiene fija la hora UTC, no las 15:00 locales durante todo el año.

La etiqueta Production de Vercel es un tipo de despliegue de la plataforma, no otro entorno de
aplicación. Vercel solo programa crons para despliegues Production, no para previews; la ejecución
automática de staging no está verificada. Antes de abrir staging, confirmar en Settings → Cron Jobs
que la ruta está activa en el proyecto y despliegue previstos; durante el reset, desactivarla allí
y reactivarla tras las comprobaciones.

Configurar el despliegue de staging con conexiones y claves de su proyecto, `FLASH_RUNTIME_SCOPE=pilot`,
`APP_ORIGIN`, secretos de health y calendario y
`EXPECTED_SCHEMA_REVISION=20261011180045_initial_schema`. El runtime mantiene
su Transaction pooler. Las URLs de retorno de Auth deben corresponder al despliegue; el reset no
modifica esa configuración.

## Comprobaciones, apertura y recuperación

Antes de abrir cada entorno:

1. Confirmar que el manifiesto del reset está completo y que el bootstrap corresponde al mismo proyecto y revisión.
2. Solicitar `GET /api/internal/health` con el secreto del entorno: `200`, con `auth`, `database` y `schema` en `true`. Comprobar también `supabase migration list`: health valida atributos y marcadores, no sustituye al historial aplicado.
3. Iniciar sesión con el superadmin y comprobar `/admin`. Una cuenta sin ese rol no debe obtener acceso al portal.
4. En local, comprobar el perfil mínimo con una identidad y jugador, buckets vacíos y diccionarios completos. En staging, comprobar Xesmona como superadmin, Ches como owner de BetaVIP, sus cinco desafíos, el asset y los diccionarios.
5. Abrir acceso y reactivar calendario. Registrar commit, revisión, bootstrap y health en un informe sin credenciales.

Las puertas locales/CI incluyen esquema declarativo, migraciones, reconciliación, contratos, permisos y concurrencia; tipos públicos, arquitectura, documentación, lint, unitarias, build y E2E. Las pruebas de actualización histórica se conservan, pero este despliegue no requiere migrar partidas anteriores.

Si una fase de reset falla, mantener cerrado el entorno y revisar `reset-manifest.json`. Repetir solo dentro de la ventana de reinicio: vuelve a verificar el destino y elimina lo que quede. El bootstrap puede repetirse tras un fallo parcial si conserva sus credenciales; no cambia la contraseña ni duplica la asignación.

Antes de abrir puede repetirse la instalación desde cero. Después de abrir, detener escrituras y aplicar la [reversión de comandos documentada](competitive-command-reconciliation.md#reversión) mediante una migración posterior, con el build compatible y sus marcadores. No reiniciar una base que ya haya recibido partidas nuevas como rollback automático. Las pruebas de actualización generan y verifican el SQL de reversión en `output/audits/competitive-command-reconciliation-rollback.sql`.

Tras abrir staging, revisar errores, sesiones, auditoría y puntos durante las primeras partidas y
el primer tick. Una incidencia requiere revisión antes de seguir probando; no se cambia el commit
validado durante la comprobación.
