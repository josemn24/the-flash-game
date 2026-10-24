# Entrega y restauración local de la biblioteca editorial

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [sql-question-library-refactor.md](../../current/sql-question-library-refactor.md).

## Migraciones y despliegue

1. [question_library_detail_authorization](../../../supabase/migrations/20261015212128_question_library_detail_authorization.sql)
   sustituye únicamente el cuerpo del detalle privado.
2. Desplegar la aplicación que reúne todas las páginas. Funciona con el SQL anterior y con el
   corregido; actualizar también `EXPECTED_SCHEMA_REVISION` a la revisión canónica.
3. [question_library_pagination](../../../supabase/migrations/20261015212231_question_library_pagination.sql)
   sustituye únicamente el cuerpo del listado privado.

Ambas migraciones se generaron con sincronización declarativa y `--no-apply`, cada una contra
el historial precedente. Cada archivo usa una transacción y `CREATE OR REPLACE`, conserva OID,
ACL y atributos y no contiene DML. La separación posterior produjo `No schema changes found`:
no existe una tercera migración. No se modifican migraciones anteriores.

Health conserva sus comprobaciones de capacidades actuales; su revisión canónica y los defaults
de `.env.example`, `verify-pilot` y Playwright coinciden con la última migración. La nueva revisión
no añade una sonda específica de autorización de biblioteca; esa frontera se comprueba mediante
pgTAP e integración con Auth real.

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
