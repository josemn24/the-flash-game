# Autorización, paginación y organización de la biblioteca de preguntas

Estado: implementado y validado en bases desechables. Revisión canónica:
`20261015212231_question_library_pagination`. Las migraciones se validaron en bases desechables
y se aplicaron en local el 2026-10-16 mediante reset y restauración de los datos existentes.
No se han aplicado en remoto.

## Correcciones y contratos conservados

`private.question_version_detail(uuid)` comprueba el jugador activo, vinculado a Auth y no
anónimo, y su asignación de plataforma `superadmin` antes de consultar la versión. Un usuario
autenticado sin autorización recibe `not_authorized` (`42501`) tanto para identificadores
existentes como inexistentes o nulos. Para un superadmin, el contenido ausente sigue devolviendo
`content_not_found` (`P0002`). Los roles SQL y las ACL existentes no cambian. El modelo de jugador
tiene estados `active` y `anonymized`; el bloqueo de una membresía no concede acceso editorial.

El listado selecciona y ordena las filas de cada página antes de `jsonb_agg`. `total` cuenta todos
los candidatos elegibles. Se conservan `updated_at DESC, id ASC`, los filtros y comodines, la
página predeterminada 1, el tamaño 25, los máximos de 10.000 páginas y 100 filas, las conversiones
y su precedencia. En `published`, se devuelve la última versión publicada **que cumple los
filtros**; los demás estados mantienen todas las versiones coincidentes. Las páginas sin
resultados contienen `entries: []`.

La biblioteca del portal y los selectores de creación/edición de desafíos siguen recibiendo la
colección completa. La capa de aplicación recorre páginas consecutivas de 25 entradas, conserva
el orden y los metadatos iniciales y admite la primera respuesta completa del SQL anterior.
Una página vacía prematura, repetida o el límite de páginas con entradas pendientes produce un
error; no se devuelve una colección parcial. Los errores de autorización y de infraestructura
se propagan. Cada RPC conserva la consistencia habitual de OFFSET: no hay una instantánea
compartida entre peticiones concurrentes. El adaptador de lectura paginada no agrega páginas.

No cambian las firmas RPC, tipos públicos generados, tablas, datos, índices, reglas de juego,
documentos, comandos editoriales, bloqueos, idempotencia ni auditoría.

## Organización declarativa

| Archivo                                                                                           | Responsabilidad                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [40_indexes.sql](../../supabase/schemas/40_indexes.sql)                                           | Los dos índices existentes de biblioteca, sin cambios de definición.      |
| [52_question_documents.sql](../../supabase/schemas/52_question_documents.sql)                     | Documento privado compartido, anterior a los validadores que lo utilizan. |
| [61_question_library_01_reads.sql](../../supabase/schemas/61_question_library_01_reads.sql)       | Detalle, listado y sus fachadas.                                          |
| [61_question_library_02_commands.sql](../../supabase/schemas/61_question_library_02_commands.sql) | Los cuatro comandos y sus fachadas.                                       |

Propietario, atributos y ACL acompañan a cada función. `question_version_document` conserva
`SECURITY INVOKER` y no incorpora una comprobación editorial, porque también lo utilizan las
validaciones competitivas. Las otras funciones conservan `SECURITY DEFINER`. Todas siguen
siendo propiedad de `postgres`, con `search_path = ''`; el inventario comprueba también su
volatilidad. No se añaden funciones SQL ni tipos persistentes. Se mantienen 232 funciones y
31 tablas de dominio; el esquema se distribuye en 95 archivos planos.

## Migraciones y despliegue

1. [question_library_detail_authorization](../../supabase/migrations/20261015212128_question_library_detail_authorization.sql)
   sustituye únicamente el cuerpo del detalle privado.
2. Desplegar la aplicación que reúne todas las páginas. Funciona con el SQL anterior y con el
   corregido; actualizar también `EXPECTED_SCHEMA_REVISION` a la revisión canónica.
3. [question_library_pagination](../../supabase/migrations/20261015212231_question_library_pagination.sql)
   sustituye únicamente el cuerpo del listado privado.

Ambas migraciones se generaron con sincronización declarativa y `--no-apply`, cada una contra
el historial precedente. Cada archivo usa una transacción y `CREATE OR REPLACE`, conserva OID,
ACL y atributos y no contiene DML. La separación posterior produjo `No schema changes found`:
no existe una tercera migración. No se modifican migraciones anteriores.

Health conserva sus comprobaciones de capacidades actuales; su revisión canónica y los defaults
de `.env.example`, `verify-pilot` y Playwright coinciden con la última migración. La nueva revisión
no añade una sonda específica de autorización de biblioteca; esa frontera se comprueba mediante
pgTAP e integración con Auth real.

## Validación reproducible

La caracterización fija 60 comprobaciones antes de las correcciones; pasa en el historial
anterior y en el nuevo. Las regresiones reproducen once fallos de autorización y ocho de
paginación en el anterior. Las expectativas corregidas verifican 37 fronteras de autorización
y 22 comprobaciones de paginación. La auditoría fallida revierte exactamente las filas y tiempos
de creación, edición, publicación y archivo, incluidas soluciones e idempotencia.

```sh
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:reconciliation:test
npm run supabase:schema:upgrade:test
npm run test:e2e:isolated -- e2e/s11-editorial.spec.ts e2e/s17-editorial-versioning.spec.ts
npm run typecheck
npm run lint
npm run format:check
npm run schema:revision:check
npm run docs:check
```

La verificación habitual de actualización mantiene la prueba de intentos y añade la de
biblioteca. Esta instala el historial anterior, conserva preguntas en todos los estados,
referencias, resultados idempotentes y partidas activas/terminadas, y aplica las dos migraciones
por separado. Comprueba datos exactos, OID, ACL, atributos, índices, health y replays, y después
continúa una partida y crea otra versión editorial.

El escenario S17 usa 125 preguntas posteriores a una versión objetivo. Comprueba la denegación
RPC a un miembro, la sexta página, la búsqueda de esa versión, su reutilización y el selector
al editar el desafío guardado. El E2E comprueba también el endpoint real de health. La carga
completa tiene pruebas de orden, filtros, compatibilidad con el SQL antiguo, errores sin
resultados parciales y límite de páginas.

## Resultado de la validación del 2026-10-15

Pasan las 66 suites pgTAP (1.876 comprobaciones) desde schemas y desde migraciones, los 158
casos compartidos de formatos, las 904 observaciones de validación y la concurrencia. El
inventario y la reconciliación de 232 funciones pasan sin diferencias de definiciones ni de
comportamiento. Pasan ambas pruebas de actualización, los 2.395 tests unitarios y los cinco
E2E aislados de S11/S17; health devuelve HTTP 200 con sus tres comprobaciones positivas.

Typecheck, lint, formato, arquitectura de tipos, enlaces y revisión canónica pasan. Los tipos
públicos generados desde el stack desechable coinciden byte a byte con los existentes. La suite
unitaria también actualiza una referencia al antiguo archivo de calendario para comprobar la
misma frontera en su ubicación actual. El stack E2E se cerró y las bases temporales se eliminaron.
Durante esa validación no se reseteó ni migró la base de la aplicación.

## Aplicación local del 2026-10-16

Se ejecutó `supabase db reset --local --no-seed`, aplicando el historial completo hasta
`20261015212231_question_library_pagination`, y después se restauraron los datos existentes.
Antes del reset se guardaron copias en frío de PostgreSQL y Storage, un backup lógico completo
y dumps separados de esquema y datos. La restauración de los datos reales se ensayó primero
con las dos correcciones en una base temporal: las 85 tablas capturadas coincidieron exactamente.

La restauración local conserva todas las filas y sus huellas SHA-256 en las 31 tablas de dominio,
27 tablas de Auth y diez de Storage. Siguen las dos partidas terminadas, 23 respuestas,
23 recepciones, dos sesiones de intento y dos asientos de puntos; también los 15 usuarios,
14 sesiones de Auth y 12 objetos de Storage. Las posiciones de las secuencias y los 662 archivos
del volumen de Storage se conservan. Al arrancar, Realtime actualiza tres tablas internas de
configuración (`_realtime.extensions`, `_realtime.feature_flags`, `_realtime.tenants`) y elimina
dos particiones antiguas vacías; estas tareas de servicio no modifican los datos del dominio,
Auth ni Storage.

Pasan el inventario, la sonda SQL de health con `service_role` y las pruebas de solo lectura
sobre la biblioteca real de 115 versiones: detalle autorizado, denegación al usuario sin rol y
paginación por filas. El endpoint `/api/internal/health` devuelve HTTP 200 con `auth`, `database`
y `schema` en `true`. Se cerró el servidor Next temporal del puerto 3301; Supabase queda iniciado.
Las copias y el informe están en `output/local/backups/question-library-reset-2026-10-16T11-15-45+0200/`,
con permisos privados y fuera de Git. No se ejecutaron operaciones remotas.
