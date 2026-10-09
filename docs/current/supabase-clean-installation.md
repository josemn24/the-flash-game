# Instalación limpia de Supabase

> Estado: vigente. Alcance actual: ejecución local. Staging y producción quedan preparados para una ventana posterior; no deben reiniciarse durante este trabajo.

Se mantienen los proyectos existentes y el historial completo de migraciones. El reinicio elimina datos de aplicación, usuarios de Auth y archivos de Storage. No requiere conservar datos ni reparar sesiones antiguas.

La revisión esperada es `20261009190015_competitive_command_reconciliation`. El refactor y la reconciliación se describen en [los validadores por formato](sql-question-validation-refactor.md) y [los comandos competitivos](competitive-command-reconciliation.md).

## Herramientas y garantías

- `supabase:environment:reset` exige `--target local|staging|production`. Elimina archivos y buckets por la API de Storage, elimina usuarios por Auth Admin y reconstruye PostgreSQL con todas las migraciones, sin seed. No borra archivos mediante SQL.
- El destino local comprueba URL, puerto y contenedor frente a `supabase/config.toml`. El remoto comprueba la referencia, URL de API, conexión administrativa y proyecto enlazado en la CLI antes de borrar nada. La CLI recibe también la referencia explícita.
- Un reinicio remoto requiere `SUPABASE_RESET_CONFIRM=<entorno>:<project-ref>` y `FLASH_WRITES_PAUSED=true`, después de detener acceso y calendario. Estas variables documentan la intervención del operador; el script no bloquea Vercel ni desactiva su cron automáticamente.
- `--dry-run` muestra destino y operaciones. No crea clientes de API, escribe manifiestos ni ejecuta migraciones. Puede consultar el estado de la CLI local si faltan sus parámetros en el entorno.
- El reset comprueba el historial completo aplicado, el inventario de permisos y la ausencia de datos. Los sondeos de mutación del inventario siguen limitados a las bases desechables de pruebas.
- `supabase:production:bootstrap` admite `--target local|production` y prepara superadmin, diccionarios y buckets. Rechaza entornos con contenido, cuentas ajenas al bootstrap o credenciales de otro destino. La asignación de superadmin tiene un evento de auditoría y no se duplica al repetir el comando.
- BetaVIP sigue siendo exclusivo del bootstrap remoto de staging. Los scripts de fixtures y E2E habituales son locales y no deben usarse para preparar una base remota.

Se requiere Node.js 20.12 o posterior. `--env-file <ruta>` carga un archivo explícito; las variables presentes en el proceso tienen precedencia. Los comandos locales cargan `.env.local` cuando existe. Ningún comando remoto lo carga automáticamente.

## Local

Con Docker y Supabase local iniciados, detener la aplicación y cualquier watcher del calendario antes del reinicio:

```bash
npm run supabase:environment:reset -- --target local --dry-run
npm run supabase:environment:reset -- --target local
npm run supabase:production:bootstrap -- --target local --dry-run
npm run supabase:production:bootstrap -- --target local
```

El administrador local predeterminado es `superadmin@the-flash.local`. Puede cambiarse con `BOOTSTRAP_ADMIN_EMAIL`. La contraseña es aleatoria y se guarda únicamente en `output/local/bootstrap-credentials.json`, con permisos `0600`. El manifiesto sin contraseña queda en `output/local/bootstrap-manifest.json`.

El reset retira manifiestos de fixtures y credenciales del bootstrap anterior. Su progreso queda en `output/local/reset-manifest.json`, que registra las fases completadas y marca un fallo. Los archivos de auditoría y reversión se conservan.

El perfil mínimo deja un usuario, un jugador, una asignación de superadmin y un evento de asignación. No crea salas, temporadas, preguntas, desafíos, intentos, resultados ni puntos. Los buckets quedan vacíos. El superadmin crea después el contenido desde `/admin`.

La CLI local recrea los buckets vacíos de `config.toml` durante el reset. La verificación acepta únicamente su configuración canónica y conserva sus límites de tamaño, que la CLI interpreta en unidades binarias. Los límites del bootstrap remoto conservan las unidades decimales de la API.

Los setups habituales pueden usarse para trabajar con ejemplos como una operación separada. También pueden reiniciar la base; antes de volver al perfil mínimo, repetir el procedimiento anterior.

### Ejecución local — 2026-10-10

Se reiniciaron PostgreSQL, Auth y Storage del stack `the-flash-game` y se aplicaron las 33 migraciones. El estado verificado contiene un superadmin y su jugador, un único evento de asignación, 2.433 palabras de cuatro letras y 8.774 de cinco letras, y dos buckets vacíos. No hay salas, temporadas, preguntas, desafíos, intentos ni puntos.

Repetir el bootstrap conserva la cuenta, la contraseña y el evento de asignación. Se comprobó el acceso a `/admin` desde el navegador y health en un build de producción con alcance `pilot`: `401` sin secreto y `200` con `auth`, `database` y `schema` en `true`. Las credenciales tienen permisos `0600`. La evidencia sin contraseñas queda en `output/local/installation-verification.json`.

Los 12 E2E existentes de Flash, recuperación, Pirámide y contratos por formato pasan usando un stack local aislado y el arranque `next build`/`next start`. Se mantienen los specs, las aserciones y los tiempos de espera. Pasan las 2.007 pruebas unitarias y las 55 suites SQL, inventario y concurrencia tanto desde el esquema declarativo como desde las migraciones; la auditoría de reconciliación y las pruebas de reversión también pasan. Tipos, tipos públicos generados, arquitectura, lint, build, formato y enlaces documentales pasan. La ejecución remota queda pendiente.

## Staging — ejecución posterior

Preparar `.env.staging.operations`, excluido de Git, con todas las variables existentes del bootstrap de staging, incluido `SUPABASE_ADMIN_DB_URL`, y añadir:

```dotenv
SUPABASE_RESET_CONFIRM=staging:<project-ref>
FLASH_WRITES_PAUSED=true
```

La conexión administrativa debe ser Direct connection con usuario `postgres` o Session pooler en puerto `5432` con usuario `postgres.<project-ref>`. La conexión Transaction pooler del runtime no sirve para provisionamiento. Mantener las credenciales administrativas fuera de Vercel Runtime.

En la ventana acordada, cerrar el acceso al despliegue y detener las invocaciones del calendario. Enlazar la CLI al proyecto de staging y comprobar el destino:

```bash
npx supabase link --project-ref <staging-project-ref>
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations --dry-run
npm run supabase:environment:reset -- --target staging --env-file .env.staging.operations
npm run supabase:dictionary:load -- --target staging --env-file .env.staging.operations
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs --dry-run
node --env-file=.env.staging.operations scripts/bootstrap-staging.mjs
```

El reset ya aplica todas las migraciones; no hace falta volver a ejecutarlas con `db push`. El bootstrap comprueba también que API y SQL pertenezcan al mismo proyecto, y crea Xesmona, Ches, BetaVIP y su asset. Las credenciales y el manifiesto se regeneran en `output/staging/`.

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

La inactividad conserva la regla de 15 minutos tras cierre/deadline. No modificar reglas ni acortar tiempos de producción para acelerar la prueba. El tick puede invocarse manualmente con el secreto del entorno; Vercel no programa el cron en previews.

## Producción — ejecución posterior

Preparar un archivo distinto, excluido de Git, con claves y conexiones del proyecto de producción, además de:

```dotenv
PRODUCTION_PROJECT_REF=<production-project-ref>
BOOTSTRAP_ADMIN_EMAIL=<administrator-email>
PRODUCTION_BOOTSTRAP_CONFIRM=production:<production-project-ref>
SUPABASE_RESET_CONFIRM=production:<production-project-ref>
FLASH_WRITES_PAUSED=true
```

En la ventana acordada, cerrar acceso y desactivar calendario. Usar el mismo commit que pasó staging:

```bash
npx supabase link --project-ref <production-project-ref>
npm run supabase:environment:reset -- --target production --env-file .env.production.operations --dry-run
npm run supabase:environment:reset -- --target production --env-file .env.production.operations
npm run supabase:production:bootstrap -- --target production --env-file .env.production.operations --dry-run
npm run supabase:production:bootstrap -- --target production --env-file .env.production.operations
```

El bootstrap carga ambos diccionarios y crea los buckets. No ejecutar BetaVIP ni fixtures en producción. Guardar la contraseña del administrador en el gestor de credenciales y retirar después su archivo local. Si se pierde el archivo antes de completar el bootstrap, el script rechazará promover una cuenta existente sin verificarla: resolver la identidad mediante el procedimiento administrativo, sin añadir un bypass.

Configurar el despliegue con conexiones y claves de su proyecto, `FLASH_RUNTIME_SCOPE=pilot`, `APP_ORIGIN`, secretos de health y calendario y `EXPECTED_SCHEMA_REVISION=20261009190015_competitive_command_reconciliation`. El runtime mantiene su Transaction pooler. Las URLs de retorno de Auth deben corresponder al despliegue; el reset no modifica esa configuración.

## Comprobaciones, apertura y recuperación

Antes de abrir cada entorno:

1. Confirmar que el manifiesto del reset está completo y que el bootstrap corresponde al mismo proyecto y revisión.
2. Solicitar `GET /api/internal/health` con el secreto del entorno: `200`, con `auth`, `database` y `schema` en `true`. Comprobar también `supabase migration list`: health valida atributos y marcadores, no sustituye al historial aplicado.
3. Iniciar sesión con el superadmin y comprobar `/admin`. Una cuenta sin ese rol no debe obtener acceso al portal.
4. En producción, comprobar una identidad y jugador, buckets vacíos, diccionarios completos y ausencia de salas, publicaciones, intentos y puntos.
5. Abrir acceso y reactivar calendario. Registrar commit, revisión, bootstrap y health en un informe sin credenciales.

Las puertas locales/CI incluyen esquema declarativo, migraciones, reconciliación, contratos, permisos y concurrencia; tipos públicos, arquitectura, documentación, lint, unitarias, build y E2E. Las pruebas de actualización histórica se conservan, pero este despliegue no requiere migrar partidas anteriores.

Si una fase de reset falla, mantener cerrado el entorno y revisar `reset-manifest.json`. Repetir solo dentro de la ventana de reinicio: vuelve a verificar el destino y elimina lo que quede. El bootstrap puede repetirse tras un fallo parcial si conserva sus credenciales; no cambia la contraseña ni duplica la asignación.

Antes de abrir puede repetirse la instalación desde cero. Después de abrir, detener escrituras y aplicar la [reversión de comandos documentada](competitive-command-reconciliation.md#reversión) mediante una migración posterior, con el build compatible y sus marcadores. No reiniciar una base que ya haya recibido partidas nuevas como rollback automático. Las pruebas de actualización generan y verifican el SQL de reversión en `output/audits/competitive-command-reconciliation-rollback.sql`.

Tras abrir, revisar errores, sesiones, auditoría y puntos durante las primeras partidas y el primer tick. Una incidencia detiene la apertura del siguiente entorno; no se promociona un commit distinto del probado.
