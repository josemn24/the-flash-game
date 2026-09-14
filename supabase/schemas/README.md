# Propuesta inicial de esquema y RLS

Estado: propuesta revisable, 2026-09-14. PostgreSQL 17 y Supabase. Contiene 18 tablas, una vista
interna y dos funciones públicas de ranking. No conecta todavía la aplicación mock a Supabase.
No se han creado migraciones, datos seed, buckets ni configuración remota.

## Fuentes y criterio de diseño

Se han contrastado [el modelo de dominio](../../docs/current/domain/domain-model.md),
[los requisitos](../../docs/current/domain/domain-requirements.md),
[los casos de uso](../../docs/current/use-cases.md),
[el modelo de persistencia](../../docs/current/data-model.md),
[la arquitectura](../../docs/current/architecture.md),
[las decisiones aprobadas](../../docs/decisions/decisions.md), los ADR 0001–0004 y
[las cuestiones abiertas](../../docs/decisions/open-questions.md). Los ADR y las decisiones
aprobadas prevalecen sobre observaciones del mock y recomendaciones pendientes por modo.

Referencias oficiales consultadas el 2026-09-14:

- [Esquemas declarativos de Supabase](https://supabase.com/docs/guides/local-development/declarative-database-schemas):
  estado deseado en SQL, orden de dependencias y limitaciones del diff. La configuración del repo
  usa `experimental.pgdelta.declarative_schema_path = './schemas'`; `db.migrations.schema_paths`
  está vacío. Se conserva el workflow existente, sin ejecutar sincronización ni generar migraciones.
- [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security):
  combinar privilegios SQL y políticas por operación, revocar grants implícitos, separar roles de
  API e identidad, proteger funciones y comprobar casos permitidos/denegados. `service_role`
  elude RLS; no equivale a un superadministrador humano.
- [Permisos por columna](https://supabase.com/docs/guides/database/postgres/column-level-security):
  una política de fila no oculta columnas. Los perfiles y los intentos tienen grants explícitos
  de columnas; no admiten `select *` desde `authenticated`.
- [Restricciones PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html) y
  [funciones](https://www.postgresql.org/docs/17/sql-createfunction.html): FKs compuestas,
  exclusiones, nulabilidad y fronteras `SECURITY DEFINER`.

## Decisiones y supuestos

1. **Identidad estable.** `players.id` es un UUID propio; `auth_user_id` es único y anulable, con FK
   a `auth.users(id) ON DELETE SET NULL`. Las consultas sociales no pueden leerlo. Un trigger
   anonimiza nombre y referencia de avatar al desvincular Auth; no borra hechos históricos.
2. **Tipos.** UUID con `gen_random_uuid()`, estados `text + CHECK`, fechas `timestamptz`, duraciones
   `bigint` en milisegundos y puntuaciones enteras. No se crean enums de formatos ni una tabla por
   minijuego. JSONB representa contenido polimórfico; SQL comprueba su estructura básica y el
   servidor deberá validar el contrato específico de formato/modo.
3. **Superficie de API mínima.** `public` contiene perfiles, salas, membresías, temporadas,
   publicaciones e intentos. `private` contiene identidades administrativas, invitaciones,
   catálogo completo, soluciones, sesiones, respuestas, libro de puntos y auditoría. Incluso los
   payloads denominados públicos se entregarán desde un comando de servidor: una lectura global
   de preguntas permitiría anticipar contenido, reutilizarlo entre salas o entregarlo a espectadores.
4. **Denegación por defecto.** `anon` no accede a tablas ni rankings competitivos. Los previews
   públicos siguen en el catálogo estático existente; no hay una política que abra el catálogo
   competitivo. También se rechaza Supabase Auth anónimo aunque use el rol SQL `authenticated`.
5. **Permisos directos.** Los miembros activos leen su sala. Solo el propio jugador puede cambiar
   `display_name` directamente, con `USING` y `WITH CHECK`; tampoco puede cambiar identidad,
   estado, avatar o marcas temporales. El avatar requiere validación de propiedad del objeto en
   servidor. No se permite `INSERT` ni `DELETE` de cliente en ninguna tabla.
6. **Escrituras por casos de uso.** Crear salas/membresías, gestionar invitaciones, publicar, jugar,
   evaluar, acreditar y administrar requieren operaciones autenticadas, autorizadas y
   transaccionales. Esta propuesta da ACLs limitadas a `service_role` para el adaptador de servidor;
   no implementa todavía esos comandos ni concede RPCs de escritura al navegador. Al usar tablas
   `private`, el adaptador necesitará conexión PostgreSQL de servidor o funciones específicas
   posteriores; un cliente PostgREST de servicio no las alcanza con la configuración actual.
7. **Contenido congelado.** Se crea como borrador. Publicar preguntas requiere solución y publicar
   desafíos exige preguntas publicadas y exactamente 100 puntos. Versiones, items y soluciones
   publicados se congelan mediante triggers; solo se permite pasar de `published` a `archived`
   sin alterar el contenido. El archivado no rompe publicaciones existentes.
8. **Integridad competitiva.** FKs compuestas vinculan publicación/versión, intento/versión,
   respuesta/elemento y asiento/intento/jugador/publicación/temporada. Hay un intento oficial por
   jugador/publicación, incluso si termina abandonado o invalidado; los tests se numeran aparte.
   No hay tablas de totales, rankings, feed ni un segundo saldo de recompensa.
9. **Calendario.** Exclusión GiST mediante `btree_gist` para ventanas `[apertura, cierre)` no
   solapadas de la misma temporada, exceptuando canceladas. Los inicios usan el reloj del servidor,
   la temporada activa y la ventana abierta. El cierre de publicación no modifica el deadline de
   un intento existente. La aplicación debe mantener las transiciones temporales de estado;
   no se crea un scheduler en este cambio.
10. **Ownership.** Un índice único garantiza como máximo un propietario activo y un trigger
    diferible exige uno al finalizar la transacción para cada sala activa. Crear sala y propietario
    es una operación atómica. Transferir exige degradar al anterior antes de promover al siguiente
    dentro de la misma transacción. La sala eliminada puede quedar sin propietario para permitir
    la salida prevista en el dominio.
11. **Libro de puntos.** Se adopta la propuesta de asientos append-only: acreditación, ajuste y
    reversión. Se impide duplicar acreditación, premiar tests o superar el intervalo efectivo
    0–100 por intento. Las correcciones requieren motivo y un actor superadmin activo. Los
    rankings excluyen intentos no completados y publicaciones canceladas, aunque todavía existan
    asientos antiguos. Respuestas originales, libro y auditoría no admiten sobrescritura ni borrado.
12. **Lectura segura de rankings.** Dos funciones devuelven únicamente perfil social, puntos,
    posición y métricas mínimas. Comprueban membresía por petición y no revelan respuestas ni
    intentos completos. La vista auxiliar es `security_invoker` y privada. Desafío: puntos DESC,
    duración ASC, inicio ASC, empates con `rank()`. Temporada: solo puntos DESC. Los agregados de
    respuestas y puntos se calculan por separado para no multiplicarlos al hacer joins.

### Decisiones provisionales que necesitan validación de producto

| Ambigüedad                               | Propuesta inicial y consecuencia                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matriz `owner`/`admin` y editor          | Ningún rol de sala obtiene DML genérico. Ambos podrán invitar mediante servidor conforme a CU-06; cambios de rol, expulsión, publicación y edición quedan pendientes de su matriz de comandos. No se inventa un rol SQL `editor`.                                                                           |
| Superadministración                      | El navegador superadmin conserva los permisos ordinarios de sus membresías. Inspección global, edición y pruebas pasan por servidor con auditoría; no existe un `OR is_superadmin()` universal en RLS. La asignación global se consulta en DB, nunca en `user_metadata`.                                    |
| Visibilidad de miembros antiguos         | La lectura directa de perfiles/membresías muestra solo miembros activos compartidos y el perfil propio. El ranking devuelve perfiles históricos cuando procede. Roles terminados y motivos de expulsión se consultarán por un DTO administrativo.                                                           |
| Cambio posterior a espectador/superadmin | Se conserva la puntuación obtenida cuando el intento era legítimamente competitivo, igual que al abandonar la sala. El rol nuevo no concede nuevos intentos. Los rankings conservan esos hechos históricos; necesita confirmación frente a una lectura literal de «no participan espectadores/superadmins». |
| Resultados invalidados                   | No hay lectura directa del intento invalidado ni de su revisión. Se reserva una consulta administrativa auditada hasta cerrar la regla. El resto de resultados propios requiere seguir siendo miembro activo de la sala.                                                                                    |
| Revisión completa                        | Respuestas y soluciones carecen de acceso directo incluso para su autor. Un futuro comando comprobará propiedad, estado terminal y política del modo. No se autoriza revisar solo por tener `auth.uid()`.                                                                                                   |
| Temporadas programadas/finalizadas       | Se congela la configuración al salir de borrador. Las correcciones administrativas futuras requieren una operación específica; no se abre UPDATE general sobre temporadas finalizadas.                                                                                                                      |
| Invitaciones                             | Hay hash, caducidad, revocación y límite opcional; no se inventan TTL, algoritmo de hash, usos predeterminados ni reglas de desbloqueo. El servidor debe generar tokens de alta entropía y consumirlos bajo bloqueo.                                                                                        |
| Heartbeat y sesión                       | Se guardan actividad, deadline, expiración, revocación y lock_version sin fijar intervalos. Una sesión expirada pero no revocada sigue ocupando el índice único: debe revocarse atómicamente al tomar el control.                                                                                           |
| Privacidad y borrado                     | Anonimización mínima del perfil; retención, depuración de JSONB/auditoría, eliminación de Storage, sucesión del propietario y purga quedan por cerrar. El trigger de Auth no resuelve por sí solo ese flujo.                                                                                                |

## Archivos SQL y propósito

El orden lexicográfico respeta las dependencias. Son declaraciones del estado deseado, no scripts
de migración ni archivos para ejecutar repetidamente sobre una base ya poblada.

| Archivo                                        | Contenido                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [00_namespaces.sql](00_namespaces.sql)         | Schema privado, extensión `btree_gist` y privilegios de schemas.                                      |
| [10_identity_rooms.sql](10_identity_rooms.sql) | Jugadores, roles globales, salas, membresías, invitaciones y temporadas.                              |
| [20_content.sql](20_content.sql)               | Definiciones y versiones de preguntas/desafíos, soluciones privadas e inclusiones ordenadas.          |
| [30_competition.sql](30_competition.sql)       | Publicaciones, intentos, sesiones, respuestas, asientos y auditoría.                                  |
| [40_indexes.sql](40_indexes.sql)               | Índices de FK, autorización, calendario, unicidad y consultas de puntos. Cada grupo justifica su uso. |
| [50_access_helpers.sql](50_access_helpers.sql) | Resolución de jugador y comprobaciones de acceso sin recursión RLS.                                   |
| [60_integrity.sql](60_integrity.sql)           | Timestamps, anonimización, ownership, congelación, ciclo de intentos y protección del histórico.      |
| [70_rls.sql](70_rls.sql)                       | RLS en las 18 tablas, revocaciones, grants por columna y políticas SELECT/UPDATE.                     |
| [80_rankings.sql](80_rankings.sql)             | Vista interna y dos funciones públicas de ranking con autorización explícita.                         |

Los índices `UNIQUE` y las PK ya cubren numerosas FKs y consultas; no se duplican. Se añaden índices
de membresía por jugador/estado y sala/estado para RLS, calendario por sala/temporada, consultas de
intentos por publicación/estado, reconstrucción por intento y totales por temporada/jugador. El
GiST impone exclusión temporal. No se añaden GIN sobre todos los JSONB ni índices para consultas
especulativas; los planes deben medirse con volumen real antes de añadir otros.

## Matriz de permisos efectivos

`S` = SELECT, `I` = INSERT, `U` = UPDATE, `D` = DELETE, `—` = denegado.
La matriz describe acceso SQL directo. Un permiso de producto mediante servidor **no** concede DML
al navegador. `authenticated` sin membresía solo ve su perfil y puede cambiar su nombre.
Todos los roles de sala son usuarios SQL `authenticated`; no se crean roles PostgreSQL por sala.

| Tabla                                | anon | authenticated / owner / admin / member / spectator                                           | superadmin humano                            | service_role, solo servidor          |
| ------------------------------------ | ---- | -------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| `public.players`                     | —    | S columnas sociales propias/de miembros activos compartidos; U solo nombre propio            | Mismas reglas directas                       | S/I/U                                |
| `public.rooms`                       | —    | S sala activa con membresía activa                                                           | Mismas reglas directas                       | S/I/U                                |
| `public.room_memberships`            | —    | S miembros activos de sala accesible                                                         | Mismas reglas directas                       | S/I/U                                |
| `public.seasons`                     | —    | S temporadas no borrador de sala accesible                                                   | Mismas reglas directas                       | S/I/U                                |
| `public.scheduled_challenges`        | —    | S publicaciones de temporada visible                                                         | Mismas reglas directas                       | S/I/U                                |
| `public.attempts`                    | —    | S columnas acotadas del intento competitivo propio, no invalidado, con acceso vigente a sala | Mismas reglas directas; pruebas vía servidor | S/I/U; contexto congelado            |
| `private.platform_role_assignments`  | —    | —                                                                                            | Servidor auditado                            | S/I/U/D; D necesario para revocar    |
| `private.room_invitations`           | —    | —; owner/admin gestionan por servidor                                                        | Servidor auditado                            | S/I/U                                |
| `private.question_definitions`       | —    | —                                                                                            | Edición por servidor                         | S/I/U/D, FKs protegen las usadas     |
| `private.question_versions`          | —    | —                                                                                            | Edición por servidor                         | S/I/U/D; solo borradores editables   |
| `private.question_version_solutions` | —    | —                                                                                            | Evaluación/edición por servidor              | S/I/U/D; se congelan al publicar     |
| `private.challenge_definitions`      | —    | —                                                                                            | Edición por servidor                         | S/I/U/D, FKs protegen las usadas     |
| `private.challenge_versions`         | —    | —                                                                                            | Edición por servidor                         | S/I/U/D; solo borradores editables   |
| `private.challenge_items`            | —    | —                                                                                            | Edición por servidor                         | S/I/U/D; padre publicado los congela |
| `private.attempt_sessions`           | —    | —                                                                                            | Pruebas por servidor                         | S/I/U                                |
| `private.attempt_answers`            | —    | —; revisión por servidor                                                                     | Inspección por servidor                      | S/I; append-only                     |
| `private.flash_point_entries`        | —    | —                                                                                            | Correcciones por servidor                    | S/I; append-only                     |
| `private.audit_log`                  | —    | —                                                                                            | Inspección por servidor                      | S/I; append-only                     |

| Función/vista                 | Lectura autorizada                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `get_challenge_ranking(uuid)` | Cualquier miembro activo, incluido spectator, de la sala de la publicación. Sin acceso: conjunto vacío.      |
| `get_season_ranking(uuid)`    | Cualquier miembro activo, incluido spectator, de la sala; temporada no borrador. Sin acceso: conjunto vacío. |
| `private.effective_results`   | Solo servidor; no se expone como vista de API.                                                               |

No se crean políticas INSERT/DELETE permisivas porque no hay casos de uso seguros de DML directo
para esas operaciones. Ausencia de política más ausencia de grant significa denegación. Las siete
políticas explícitas cubren seis lecturas y la actualización propia del nombre. No se crean
políticas `service_role`: su atributo BYPASSRLS las haría irrelevantes. Sus ACLs revocan TRUNCATE,
REFERENCES y TRIGGER, y limitan el borrado a borradores de contenido y asignaciones administrativas.

## Riesgos y garantías pendientes del servidor

- **Credenciales privilegiadas:** RLS no autoriza a un humano cuando un endpoint usa `service_role`.
  Cada operación debe resolver la sesión, comprobar rol y membresía y limitar columnas. No basta
  con ocultar controles en React. El rol de servicio es una frontera de confianza amplia; antes de
  desplegar conviene separar credenciales de juego y operación editorial si se habilitan ambas.
- **Funciones definer:** tienen propietario `postgres`, `search_path = ''`, referencias cualificadas
  y EXECUTE revocado salvo helpers concretos y rankings. `private` no debe exponerse en API.
  No se usa FORCE RLS: los helpers necesitan una lectura interna sin recursión. El propietario y
  roles BYPASSRLS siguen siendo de confianza. Cada nueva función pública requiere revisión de ACL.
- **JSONB y evaluación:** SQL no prueba que un payload público carezca de soluciones ni evalúa
  los 31 formatos. La separación física no evita que un editor copie una solución en el campo
  público. Validar contratos, tamaño, formato, orden esperado, telemetría y deadlines por pregunta
  en servidor; no aceptar puntos o tiempos calculados por el navegador.
- **Concurrencia:** el índice único no sustituye `createOrGetAttempt`. Para respuestas y checkpoints,
  comprobar la sesión y `WHERE lock_version = expected` en una transacción; el trigger exige el
  incremento pero no conoce la versión esperada por el cliente. Reintentos con la misma clave deben
  devolver el resultado previo y rechazar payloads diferentes. Las transacciones de aplicación
  deben bloquear en un orden coherente y reintentar deadlocks/conflictos.
- **Operaciones incompletas:** el esquema no implementa aceptación atómica de invitaciones, sucesión,
  finalización/acreditación atómica, revisión, takeover ni scheduler. El servidor debe revocar las
  sesiones terminales, validar elegibilidad en cada comando y calcular tiempos desde sus marcas.
  Los triggers estructurales no constituyen un motor de juego.
- **Auditoría:** la tabla y sus registros son append-only, pero este cambio no instala comandos que
  escriban automáticamente todos los eventos. Transferencias, roles, inspección global,
  cancelaciones, anonimización e invalidaciones deben insertar auditoría en la misma transacción;
  asignación/revocación de superadmin y purga requieren procedimientos operativos todavía abiertos.
- **Histórico y privacidad:** los rankings permiten a miembros actuales ver perfiles históricos
  mínimos. Las respuestas libres, metadatos y auditoría pueden contener datos personales. El trigger
  de anonimización no limpia esos payloads ni borra el avatar físico; falta la política de retención.
- **Medios y API:** no hay buckets ni políticas `storage.objects`, Realtime o GraphQL específicas.
  Deben verificarse antes de habilitar esas vías. URLs de assets o cachés compartidas no deben filtrar
  contenido privado. Los resultados personalizados no pueden almacenarse en caché pública.
- **Cambios declarativos:** al generar una migración futura habrá que inspeccionar grants por
  columna/schema, propietarios de funciones, `security_invoker`, triggers y políticas. La guía
  oficial señala limitaciones del diff; conservarlos en estos archivos no acredita su despliegue.
  Aplicar el conjunto inicial de declaraciones y ACLs de forma transaccional. No se ha ejecutado
  ese despliegue sobre la base de la aplicación.

## Casos permitidos y denegados para probar

La suite [initial_schema_rls.test.sql](../tests/initial_schema_rls.test.sql) usa pgTAP con fixtures
transaccionales y termina en ROLLBACK. Son datos de prueba desechables, no seed del producto.

| Caso            | Permitido                                                             | Denegado / resultado esperado                                                                      |
| --------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Identidad       | Resolver auth.uid a Player distinto                                   | UID ausente, usuario Auth anónimo, identidad/rol falsificado en user_metadata                      |
| Perfiles        | Leer perfil propio/compañeros activos; actualizar nombre propio       | Leer auth_user_id, SELECT *, cambiar perfil ajeno, estado, avatar o identidad                      |
| Salas           | Owner/admin/member/spectator activos leen sala propia                 | Otra sala, sala eliminada, membresías left/removed/banned                                          |
| Privilegios     | SELECT limitado por columna/fila                                      | INSERT/DELETE/TRUNCATE de cliente, autoasignar owner o superadmin                                  |
| Datos privados  | Servidor accede según ACL                                             | Leer soluciones, preguntas futuras, hashes, auditoría, respuestas o checkpoints desde el navegador |
| Inicio          | Cuenta competitiva durante ventana activa                             | Espectador, ajeno, superadmin competitivo, segundo intento, fecha de cierre exacta                 |
| Prueba fantasma | Superadmin crea test                                                  | Consumo de intento oficial, puntos, ranking o participación social por un test                     |
| Respuesta       | Item de la versión jugada, una respuesta final                        | Otra versión, duplicado, otra publicación, puntos negativos/superiores al item                     |
| Concurrencia    | Recuperar mismo intento; incrementar versión esperada                 | Dos sesiones sin revocar, checkpoint obsoleto, repetir intento abandonado/completado               |
| Publicación     | Items publicados que suman 100; ventanas adyacentes                   | Falta de solución, suma distinta, modificación de versión/item/solución congelada, solapamiento    |
| Propiedad       | Sala y owner en una transacción; transferencia atómica                | Sala activa sin propietario, dos propietarios, dos temporadas activas                              |
| Puntos          | Acreditación única, incluido cero; ajuste auditado                    | Duplicación, test, cancelada, abandonado, suma efectiva fuera de 0–100, reescritura de ledger      |
| Ranking         | Lectura por espectadores; empates compartidos; correcciones derivadas | Respuestas ajenas, cruce de sala, tests, invalidados, cancelados, doble agregación                 |
| Histórico       | Conservar resultados al desvincular Auth                              | Exponer identidad de Auth o recuperar una cuenta anonimizada mediante UPDATE ordinario             |

Además de la suite, antes de conectar producción son necesarias pruebas en dos conexiones reales:
inicios simultáneos, transferencia de owner, publicación frente a edición de items/soluciones,
último uso de invitación, toma de control, respuesta repetida y ajustes de puntos concurrentes.
Comprobar también el límite inclusivo/exclusivo con reloj controlado, continuidad después del cierre,
políticas de Storage, el contrato PostgREST/GraphQL real y planes EXPLAIN con volúmenes representativos.

### Validación realizada

Los nueve archivos SQL se aplicaron en orden a una base temporal separada dentro del PostgreSQL
17 local de Supabase. Se reprodujeron `auth.uid()` y `auth.jwt()` a partir de sus definiciones
locales y una tabla Auth mínima para probar la FK; se utilizaron los roles SQL reales del cluster
y se simularon grants públicos heredados. La suite pgTAP verifica la semántica PostgreSQL, no el
alta/login completo de GoTrue ni el transporte HTTP. Los resultados y las limitaciones de esta
validación deben conservarse separados de una certificación de producción.

Resultado: **83 comprobaciones pgTAP superadas** en una conexión, incluida la carga completa del
esquema y su ACL final. No se han ejecutado aún las pruebas de concurrencia en dos conexiones ni
las pruebas HTTP/Storage. La base temporal se elimina al terminar; la base de la aplicación no se
modifica.
