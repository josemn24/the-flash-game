# Refactor y aplicación local de operaciones de intentos

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [sql-attempt-command-handlers-refactor.md](../../current/sql-attempt-command-handlers-refactor.md).

## Etapas y compatibilidad

1. Se añadieron y ejecutaron las 98 comprobaciones de caracterización contra el handler original.
2. Se movieron sin cambiar sus cuerpos los helpers de siguiente item, administración e invitaciones.
3. Se extrajeron inicio, transferencia, entrega/pase, evaluación y activación del dispatcher.
4. Se extrajeron preparación y cierre, trasladando al cierre la suma autoritativa única.

Tras cada extracción se ejecutaron caracterización, comandos, fronteras y puntuación. Se conservan
el orden de comprobaciones y bloqueos, los puntos de captura de los relojes, las diferencias entre
SQL `NULL` y JSON `null`, las respuestas idempotentes y los incrementos de versión existentes.
La primera preparación de Contrarreloj sigue incrementando dos veces la versión. Alphabet mantiene
el cierre con evaluaciones pendientes, letras sin responder y acreditación en una sola transacción.

La activación alternativa de `99_pyramid_activation.sql`, sus fachadas de compatibilidad y
la construcción del progreso de Alphabet quedan intactas. El refactor no corrige reglas ni
normaliza resultados históricos.

## Migración y health

La única migración se generó mediante `supabase db schema declarative sync --no-apply`.
La revisión manual la envuelve en una transacción, instala y protege primero los siete helpers
y reemplaza después el coordinador mediante `CREATE OR REPLACE`. Conserva OID, propietario y
ACL existentes; no cambia filas de aplicación ni reescribe el historial previo.

Health comprueba la presencia de los siete helpers y la delegación del coordinador. La
comprobación de suma de puntos apunta ahora al helper de cierre; el dispatcher sigue rechazando
`score` suministrado por el cliente. Los sondeos reales rechazan el coordinador anterior aunque
los helpers estén instalados, cada helper ausente y un cierre con agregación incompatible.

Para desplegar, aplicar primero la migración y después la app con la nueva revisión esperada.
Se requiere una entrega coordinada: el health anterior depende del cuerpo del antiguo handler.
La reversión se realiza mediante una migración posterior que restaure el coordinador anterior,
conservando sus permisos, y una revisión compatible de la app. No requiere modificar datos.

Validación local del 2026-10-15: pasan las 63 suites pgTAP (1.757 comprobaciones) desde schemas
y desde migraciones, los 158 casos compartidos, las 904 observaciones de validación y las carreras
concurrentes. La reconciliación compara 232 funciones y devuelve cero diferencias de definiciones
y cero diferencias en los 41 sondeos de comportamiento. Pasan la actualización con datos previos,
los sondeos de health con `service_role`, sus tres pruebas unitarias y los 22 E2E de los seis
escenarios indicados. Los tipos públicos generados coinciden con el archivo existente.

## Aplicación en la base local

El 2026-10-15 se arrancó el stack `the-flash-game` reutilizando su volumen persistente, tras
guardar una copia física protegida. `supabase migration up --local` aplicó las tres revisiones
pendientes: corrección de identidades de pregunta, eliminación de índices redundantes y refactor.

Se compararon recuentos y huellas SHA-256 de todas las filas de las 31 tablas del dominio antes
y después. Coinciden íntegramente: se conservan las dos partidas completadas, 23 respuestas,
23 recepciones, dos sesiones y dos asientos de puntos. Pasan el inventario de seguridad sin
sondeos de mutación y el sondeo SQL de health con `service_role`.

La aplicación arrancada temporalmente con `.env.local` devolvió HTTP 200 en
`/api/internal/health`, con `auth`, `database` y `schema` en `true`. Se detuvo ese servidor
temporal al finalizar; Supabase local permanece en ejecución. La copia y las referencias de
verificación se conservan con permisos restringidos en `output/local/backups/`.
