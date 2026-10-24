# Instalaciones locales anteriores al esquema vigente

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [supabase-clean-installation.md](../../current/supabase-clean-installation.md).

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
