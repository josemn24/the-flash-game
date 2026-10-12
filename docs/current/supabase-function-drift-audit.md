# Auditoría histórica de las 14 funciones SQL

> Estado: auditoría histórica completada. Las diferencias se reconciliaron y quedaron incluidas en el baseline actual.

Este documento conserva los resultados anteriores a la reconciliación. La
[reconciliación implementada](competitive-command-reconciliation.md) registra las decisiones y
las pruebas vigentes; su migración incremental original está disponible en Git.

Fecha: 2026-10-09. Revisión reconstruida antes de reconciliar:
`20261009180205_question_validation_by_format`.

## Resultado histórico

El historial de migraciones y el esquema declarativo construyen las mismas 217 funciones,
pero conservan 14 diferencias en sus definiciones efectivas. Tres son exclusivamente comentarios
o formato; once cambian código ejecutable. Las firmas, retornos, propietarios y permisos
coinciden. `take_over_attempt` también cambia de lenguaje: PL/pgSQL en las migraciones y SQL
en el esquema declarativo.

La reconciliación posterior corrigió el motivo de revocación y fijó las expectativas de
transferencia. El SQL incremental se consolidó después en el baseline inicial; las decisiones
y contratos vigentes se documentan en la reconciliación implementada.

Esta auditoría registró el informe previo a la reconciliación. Su herramienta reproducible sigue
comparando el baseline activo con los schemas. Todo el SQL de observación se ejecutó en bases
locales desechables, que se eliminaron al finalizar.

## Método y evidencia

La [herramienta de auditoría](../../scripts/audit-supabase-function-drift.mjs) reconstruye dos
bases desde cero: una con el baseline activo y otra con los 80 archivos declarativos.
Carga cada directorio en orden lexicográfico, comprueba el inventario de seguridad y consulta
`pg_proc` para comparar las definiciones finales, incluidas las funciones sustituidas varias
veces. Esto evita atribuir a una declaración antigua un comportamiento que otra posterior
ya reemplaza.

La comparación de código conserva literales, identificadores, mayúsculas y operadores; solo
ignora espacios y comentarios externos a los literales. También compara argumentos, retorno,
lenguaje, volatilidad, `SECURITY DEFINER`, `STRICT`, `LEAKPROOF`, paralelismo, coste, filas,
configuración, propietario y ACL.

Los [casos de comportamiento](../../scripts/audit-supabase-function-drift-cases.mjs) reutilizan
las fixtures de comandos y observan aceptación, SQLSTATE, mensaje, claves del resultado,
versión del intento, sesiones, auditoría y entradas de puntos. Se ejecutaron 41 casos en cada
base, con 20 diferencias en las observaciones combinadas de respuesta y estado. Ese número
incluye diferencias de metadatos de auditoría; no significa que 20 acciones antes aceptadas
ahora sean rechazadas.

Seis casos usan conexiones PostgreSQL independientes y una barrera de locks: recuperación,
pistas progresivas, Logic Code, Mini Wordle, Word Hashtag y Word Search se autorizan mientras
otra conexión bloquea el intento. La conexión que tiene el lock transfiere el control cuando
las seis están esperando; entonces las libera. La barrera actualiza el snapshot de estadísticas
en cada iteración para observar las conexiones nuevas.

Las pruebas de sesión alcanzan deliberadamente las comprobaciones de autorización anteriores
a las reglas de cada formato. No constituyen pruebas completas de una partida válida de esos
formatos. Los resultados omiten identificadores de sesión aleatorios y timestamps para hacer
comparable el comportamiento; se conservan las claves públicas del resultado y los hechos
relevantes de estado. No se inspeccionó una base remota ni se demuestra equivalencia para todas
las entradas posibles.

## Inventario por función

Todas las funciones de esta tabla pertenecen a `private`. La columna de migración identifica
su última declaración efectiva, no necesariamente la migración más reciente del repositorio.

| Función                        | Declaración efectiva del esquema                                                                               | Última migración que la declara                                    | Diferencia y decisión recomendada                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activate_interaction`         | [99_pyramid_activation.sql](../../supabase/schemas/99_pyramid_activation.sql), línea 65                        | `20260928193000_pyramid_level_activation.sql`, línea 76            | Añade comprobación de transferencia antes de `session_revoked`. Adoptar la versión declarativa; el cambio de mensaje se reproduce con una sesión ya transferida.                                                   |
| `authorize_attempt_replay`     | [88_command_support.sql](../../supabase/schemas/88_command_support.sql), línea 32                              | `20261007130000_attempt_control_transfer.sql`, línea 33            | Solo espacios y saltos de línea. Alinear el texto con el historial si se quiere eliminar ruido del generador.                                                                                                      |
| `close_attempt_as_abandoned`   | [35_authoritative_state.sql](../../supabase/schemas/35_authoritative_state.sql), línea 97                      | `20261007120000_permission_revoked_attempt_closure.sql`, línea 49  | Añade `permission_revoked` a todas las sesiones cerradas, incluso por abandono e inactividad. Corregir esa asignación antes de migrar.                                                                             |
| `execute_command`              | [90_commands.sql](../../supabase/schemas/90_commands.sql), línea 5                                             | `20261004141603_alphabet_atomic_completion.sql`, línea 551         | Exige `scheduledChallengeId` para takeover y usa `takeover_confirmed` en auditoría. Migrar junto con `take_over_attempt`.                                                                                          |
| `expire_stale_attempts`        | [59_superadmin_calendar_commands.sql](../../supabase/schemas/59_superadmin_calendar_commands.sql), línea 517   | `20261003222852_room_history_effective_alphabet.sql`, línea 5      | Delega el cierre al helper y cambia `request_id`. Adoptar la delegación tras corregir el helper y acordar la correlación de auditoría.                                                                             |
| `manage_room_member_command`   | [91_room_membership_commands.sql](../../supabase/schemas/91_room_membership_commands.sql), línea 5             | `20261007120000_permission_revoked_attempt_closure.sql`, línea 220 | Solo cambia la presentación de una llamada. Sin diferencia de reglas ni permisos.                                                                                                                                  |
| `publish_flash_command`        | [59_superadmin_editorial_commands.sql](../../supabase/schemas/59_superadmin_editorial_commands.sql), línea 400 | `20260926080239_initial_schema.sql`, línea 4558                    | Solo añade un comentario sobre Alfabeto. Sin diferencia ejecutable.                                                                                                                                                |
| `recover_attempt`              | [91_attempt_recovery.sql](../../supabase/schemas/91_attempt_recovery.sql), línea 79                            | `20261006110000_competitive_command_recovery.sql`, línea 87        | Añade comprobación de transferencia después del lock. Adoptar la versión declarativa; la diferencia se reproduce en concurrencia.                                                                                  |
| `reveal_progressive_clue`      | [94_progressive_clues.sql](../../supabase/schemas/94_progressive_clues.sql), línea 3                           | `20261006110000_competitive_command_recovery.sql`, línea 543       | Misma comprobación después del lock. Adoptar la versión declarativa y conservar el caso concurrente.                                                                                                               |
| `submit_logic_code_attempt`    | [93_logic_code.sql](../../supabase/schemas/93_logic_code.sql), línea 46                                        | `20261006110000_competitive_command_recovery.sql`, línea 394       | Misma comprobación después del lock. Adoptar la versión declarativa y conservar el caso concurrente.                                                                                                               |
| `submit_mini_wordle_guess`     | [92_mini_wordle_commands.sql](../../supabase/schemas/92_mini_wordle_commands.sql), línea 3                     | `20261006110000_competitive_command_recovery.sql`, línea 251       | Misma comprobación después del lock. Adoptar la versión declarativa y conservar el caso concurrente.                                                                                                               |
| `submit_word_hashtag_swap`     | [99_word_hashtag.sql](../../supabase/schemas/99_word_hashtag.sql), línea 179                                   | `20261006110000_competitive_command_recovery.sql`, línea 1071      | Misma comprobación después del lock. Adoptar la versión declarativa y conservar el caso concurrente.                                                                                                               |
| `submit_word_search_selection` | [99_word_search.sql](../../supabase/schemas/99_word_search.sql), línea 60                                      | `20261006110000_competitive_command_recovery.sql`, línea 1236      | Misma comprobación después del lock. Adoptar la versión declarativa y conservar el caso concurrente.                                                                                                               |
| `take_over_attempt`            | [90_commands.sql](../../supabase/schemas/90_commands.sql), línea 90                                            | `20261007130000_attempt_control_transfer.sql`, línea 127           | Sustituye una implementación autónoma por una fachada SQL. Cambia validación, autorización de replays y metadatos de auditoría. Reconciliar con el dispatcher mediante `CREATE OR REPLACE`, conservando OID y ACL. |

## Transferencia: siete comprobaciones pendientes

Las siete funciones de activación, recuperación y formatos añaden exactamente una llamada a
`raise_if_session_transferred` antes de devolver `session_revoked` en la comprobación de sesión
realizada con el intento bloqueado. No cambian puntos, normalización ni validación de respuestas.

En `activate_interaction`, una solicitud nueva con token revocado por takeover devuelve
`session_revoked / 42501` con las migraciones y `session_transferred / 42501` con el esquema.
En las otras seis, la autorización inicial ya detecta una transferencia terminada: ambas bases
devuelven `session_transferred` en el caso secuencial. La diferencia aparece si la transferencia
ocurre después de esa autorización y antes de adquirir el lock. La reproducción concurrente
devuelve `session_revoked` en las migraciones y `session_transferred` en el esquema en las seis.

Ambas bases rechazan el comando y mantienen un solo controlador activo. No se observó una
escritura desde la sesión revocada. Un token desconocido o revocado por motivo `terminal`
conserva `session_revoked / 42501` en las siete funciones. El helper compartido
`authorize_attempt_replay` devuelve `session_transferred / 42501` en ambas implementaciones.

Recomiendo migrar las siete llamadas: permiten comunicar la transferencia al usuario conforme
a R12 y R21 de la [matriz de resiliencia](resilience-matrix.md). Deben registrarse como cambios
intencionados de mensaje, con pruebas de concurrencia que comprueben también el SQLSTATE.

## Cierre: motivo de revocación incorrecto

El esquema declarativo asigna `revocation_reason = 'permission_revoked'` de forma incondicional
en `close_attempt_as_abandoned`. El helper admite tres motivos terminales. En los tres casos
observados, las migraciones dejan el motivo de sesión en SQL `NULL`; el esquema escribe
`permission_revoked`. El estado terminal del intento sí conserva correctamente el motivo
recibido: `abandon`, `inactivity_timeout` o `permission_revoked`.

La pérdida de permisos debe poder distinguirse de un cierre normal según el
[modelo de datos](data-model.md) y R13 de la [matriz de resiliencia](resilience-matrix.md).
Recomiendo reservar `permission_revoked` para ese motivo terminal y usar `terminal` para
abandono e inactividad. Esa política es una corrección propuesta; implica un cambio respecto
al SQL `NULL` histórico y requiere expectativas explícitas antes de implementarse.

En `expire_stale_attempts`, ambas bases cierran el intento por inactividad, devuelven
`abandonedAttempts: 1`, revocan la sesión, incrementan la versión una vez durante el cierre y
no crean entradas de puntos. La delegación del esquema incorpora el motivo de sesión
incorrecto del helper. Además cambia el `request_id` de auditoría:

| Historial | Esquema declarativo                  |
| --------- | ------------------------------------ |
| `runId`   | `runId:inactivity_timeout:attemptId` |

El segundo valor identifica el cierre concreto, pero exige ajustar cualquier correlación por
igualdad exacta con `runId`. Recomiendo conservarlo como identificador de evento y documentar
la relación con la ejecución del tick. No se comprobó un consumidor externo de auditoría.
Los casos directos del helper observan el cierre sin eventos anteriores; la preservación de
respuestas históricas necesita las fixtures y suites de regresión de la futura corrección.

## Transferencia: dispatcher y fachada deben cambiar juntos

La migración de transferencia contiene una implementación autónoma para funcionar con el
dispatcher anterior. El esquema delega al motor compartido. El handler compartido
`handle_attempt_command` coincide entre ambas reconstrucciones; las dos diferencias están
en `execute_command` y `take_over_attempt`.

En una transferencia válida, ambas bases devuelven las mismas claves públicas:
`attemptId`, `sessionId`, `lockVersion`, `deadlineAt` y `transferred`. Ambas aumentan la versión
de 1 a 2, revocan el controlador anterior por takeover y mantienen una sola sesión activa.
El payload anterior de auditoría incluye `deadlineAt` en la implementación autónoma y lo omite
en el motor compartido; la respuesta sigue incluyendo esa clave. Conviene decidir si se
conserva ese dato de auditoría antes de sustituir la implementación.

Las diferencias adicionales se reprodujeron con estos casos:

| Entrada o situación                                                      | Migraciones                                            | Esquema declarativo                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------- |
| `scheduledChallengeId: null`                                             | Transferencia aceptada                                 | `invalid_command / 22023`                   |
| `lockVersion: null`                                                      | `stale_version / 40001`                                | `invalid_command / 22023`                   |
| `newSessionToken: null`                                                  | `invalid_token / 22023`                                | `invalid_command / 22023`                   |
| `attemptId: null`                                                        | `not_authorized / 42501`                               | `invalid_command / 22023`                   |
| Replay exacto tras retirar la membresía                                  | Devuelve el resultado almacenado                       | `not_authorized / 42501`                    |
| Dispatcher interno con `scheduledChallengeId`                            | `invalid_command / 22023`                              | Transferencia aceptada                      |
| Dispatcher interno sin `scheduledChallengeId`                            | Transferencia aceptada; acción de auditoría `takeover` | `invalid_command / 22023`                   |
| Sustituir solo la fachada por la versión SQL y enviar el contrato válido | `invalid_command / 22023` con dispatcher antiguo       | Transferencia aceptada con dispatcher nuevo |

La retirada de membresía del caso de replay se realiza directamente sobre una fixture para
aislar la autorización; no simula el comando administrativo completo que además cierra el
intento. El replay histórico devuelve metadatos ya almacenados: esta prueba no demuestra una
nueva escritura no autorizada ni acceso a preguntas o soluciones.

Recomiendo exigir los campos no nulos y comprobar permisos vigentes antes de devolver un replay
de takeover. Ambas decisiones cambian el comportamiento histórico y deben constar expresamente
en la próxima migración y sus pruebas. Esa migración debe reemplazar primero `execute_command`
y después `take_over_attempt` dentro de una misma transacción. Se probó que
`CREATE OR REPLACE FUNCTION` cambia PL/pgSQL por SQL conservando el OID; no hace falta eliminar
la función para hacer este cambio. Las ACL deben verificarse de nuevo tras el reemplazo.

## Seguridad

El inventario de seguridad pasa en las dos reconstrucciones. Las 14 funciones conservan
propietario `postgres`, `SECURITY DEFINER` y `search_path = ''`. `authorize_attempt_replay`
conserva `STABLE`; las otras trece son `VOLATILE`. Los demás atributos y ACL comparados coinciden.

`service_role` puede ejecutar los nueve comandos: activación, recuperación, expiración, las
cinco acciones de formatos y takeover. Las otras cinco funciones son internas y solo tienen
ejecución para el propietario: autorización de replay, cierre, dispatcher, gestión de miembros
y publicación. Ninguna de estas 14 da ejecución a `PUBLIC`, `anon` o `authenticated`.

La coincidencia de ACL no elimina las diferencias de autorización dentro de los cuerpos,
especialmente el replay de takeover. Por eso esas reglas se probaron con identidad de una
cuenta de fixture y rol `service_role`, en lugar de ejecutar todos los comandos como propietario.

## Reproducción

Con el contenedor de Supabase local disponible, desde la raíz del repositorio:

```bash
node scripts/audit-supabase-function-drift.mjs
```

La herramienta usa `supabase_db_the-flash-game` por defecto; permite seleccionar el contenedor
con `SUPABASE_DB_CONTAINER`. Siempre crea bases nuevas con nombres aleatorios y las elimina,
incluido si falla una comprobación. No carga una URL ni credenciales de una base remota.

El resultado se guarda en `output/audits/supabase-function-drift.json`, ignorado por Git. Incluye
las dos definiciones de cada función diferente, su origen, los atributos que cambian y las
observaciones de los 41 casos. Puede elegirse otra ruta con `--output=ruta.json`.

Resultado observado en esta revisión:

```text
migrations: 1 file, 217 functions; security inventory passed.
schemas: 80 files, 217 functions; security inventory passed.
0 definition differences: 0 cosmetic.
41 behavior probes: 0 differing outcomes.
```

La herramienta es una auditoría diferencial: tener diferencias no provoca fallo de salida.
Fallan la carga, el inventario, una discrepancia en las firmas o la barrera de concurrencia.
Al reconciliar las funciones, los casos intencionadamente modificados deben convertirse en
pruebas con expectativas del contrato elegido, para que una regresión sí falle.

## Cierre

La reconciliación se completó el 2026-10-09 y se incorporó al baseline generado el 2026-10-10.
Las dos vías de carga conservan las mismas 217 funciones y el mismo inventario de seguridad;
los 41 contratos y las carreras de transferencia no muestran diferencias de comportamiento.
La validación de staging sigue pendiente.

Estos cambios pertenecen a una reconciliación del motor competitivo, separada del
[refactor de validadores por formato](sql-question-validation-refactor.md).
