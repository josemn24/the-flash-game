# Resumen de la referencia SQL anterior

> Estado: histórico. Resumen conservado durante la limpieza del 2026-10-24.
> Las cifras pertenecen al registro original y no describen el inventario ni las pruebas actuales.
> Referencia vigente: [esquema declarativo y frontera de comandos](../../../supabase/schemas/README.md).

## Contexto y fuentes vigentes

La referencia anterior reunía la evolución inicial desde el mock, las slices persistidas,
revisiones intermedias, inventarios SQL, permisos y procedimientos de servidor. Las capacidades
y la revisión canónica se consultan ahora en [estado actual](../../current/status.md), y los
pendientes en el [backlog](../../implementation-plan.md).

Los contratos vigentes pertenecen al [ciclo de vida](../../current/attempt-lifecycle.md),
la [recuperación](../../current/competitive-command-recovery.md),
los [contratos por modo](../../current/domain/mode-contracts.md) y al
[README del esquema](../../../supabase/schemas/README.md). Este último conserva las precisiones
sobre inventario, privilegios efectivos, vistas invoker y el rol creador de objetos.
La [guía de entornos](../../current/supabase-clean-installation.md) define preparación y operación.

Los informes de [validación por formato](question-validation-2026-10-10.md),
[reconciliación de funciones](supabase-function-drift-audit-2026-10-09.md),
[biblioteca editorial](question-library-2026-10-16.md),
[handlers de intentos](sql-attempt-handlers-2026-10-15.md) e
[instalaciones locales](installations-2026-10-11.md) conservan las entregas concretas.
Los inventarios de archivos, funciones y suites se mantienen en sus fuentes técnicas,
sin reproducir aquí otra copia que pueda confundirse con el estado actual.

## Validación documentada del 2026-09-29

El registro original de expiración de intentos inactivos indica que `check-supabase-schema`
cargó **54 archivos declarativos** y el inventario de seguridad. Pasaron las suites existentes,
S20 (**21 checks**), S21 (**14 checks**) y las carreras con conexiones PostgreSQL independientes.
También constan comprobación de tipos, ESLint, arquitectura y enlaces documentales correctos.

La referencia acumulaba **26 checks pgTAP de E01, 24 de E02, 28 de E03, 26 de E04, 24 de E05,
12 de S05 y 19 de E10**, junto con casos de S07, S10, S11, S12 y S13 y las pruebas TypeScript
registradas en aquella referencia. Se conservan las cifras reportadas; no son el total actual
ni una nueva ejecución realizada durante esta limpieza.

Los tests de defaults, DML y respuesta sin presentación fallaban con el diseño anterior.
Los fallos provocados en auditoría comprobaban rollback de operaciones parciales. La validación
SQL cubría semántica PostgreSQL con roles reales del cluster y Auth mínimo; no un login GoTrue
ni HTTP real. Las pruebas Auth/HTTP/E2E se registraban por separado en los escenarios locales
del portal, S02, S03, S04, S06, S07, S08, S10, S11, S12 y E01–E06.
Estas verificaciones locales no acreditaban staging.

## Bibliografía del registro original

Referencias consultadas el 2026-09-14:
[esquemas declarativos Supabase](https://supabase.com/docs/guides/local-development/declarative-database-schemas),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funciones](https://supabase.com/docs/guides/database/functions) y
[ALTER DEFAULT PRIVILEGES PostgreSQL 17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
