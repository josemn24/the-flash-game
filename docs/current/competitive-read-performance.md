# Lecturas del camino competitivo

> Estado: vigente. Contratos implementados y verificación local del camino competitivo.

## Contratos

`AttemptCommands.readAttemptContext(attemptId, sessionToken)` devuelve únicamente
`{ challengeMode: GameMode, scheduledChallengeId: ScheduledChallengeId }`. El adaptador valida ambos
campos y rechaza campos adicionales. `private.read_attempt_context(uuid, text)` exige el propietario
identificado por Auth, intento competitivo, sesión vigente y token coincidente; excluye las
asignaciones de superadmin. El adaptador usa una transacción con claims locales y comprueba primero
la expiración, igual que `readRecovery`. La función no consulta respuestas ni calcula progreso.

`submitAnswer`, `pass`, `complete` y `abandon` usan este contexto. `recover` sigue conciliando el
intento y leyendo `read_attempt_recovery`, con respuestas y progreso completos. Las versiones e
idempotencia de entrada se conservan. El límite general se aplica antes del caso de uso y el de
Alfabeto antes de recibir la respuesta o registrar el pase. El envío genérico mantiene cuatro
transacciones y el scoring fuera de ellas.

`public.get_my_competitive_challenge(target_room_slug text, target_publication_id uuid)` devuelve
JSONB `null | { mode, rows }`. Resuelve el modo y ejecuta únicamente `get_my_<modo>_challenge`.
Las filas se agregan por `item_position`; ausencia y falta de acceso devuelven `null` sin revelar el
modo. Las proyecciones de cada modo conservan sus condiciones de publicación, membresía,
versión e intento existente. El nuevo RPC es `SECURITY DEFINER`, tiene `search_path = ''` y solo
permite ejecución a `authenticated`; la lectura privada solo a `service_role`.

`SupabaseCompetitiveChallengeQueries` valida ruta, envelope, discriminador y coherencia de modo,
sala y publicación. Ejecuta un RPC inicial y selecciona `getPlayableFromRows` del modo. Cada
constructor reutiliza sus guards y conserva las lecturas posteriores de resultado, revisión y
assets. Los antiguos `getPlayable` permanecen como wrappers. Los errores de infraestructura y
proyecciones malformadas se propagan; la ausencia autorizada conserva `null`.

## Diagnóstico opcional

`FLASH_PERFORMANCE_DIAGNOSTICS=0` es el valor documentado por defecto. Con valor `1`, cada lectura
competitiva y método de intento emite un evento JSON `competitive_performance`. Un colector por
operación, aislado mediante `AsyncLocalStorage`, registra `operationId`, `operation`, `requestId`
cuando existe, `mode` cuando se conoce, `durationMs`, `phases`, `transactions`, `sqlQueries`,
`rpcCalls` y `result` (`ok` o `error`). La aplicación recibe un observador opcional desde su puerto;
no depende de infraestructura.

Las fases separan `challenge.initial` de `challenge.enrichment` y registran contexto, recepción,
contexto privado de evaluación, assets, scoring, registro, pase, cierre y espera del pool.
`sqlQueries` cuenta llamadas del cliente PostgreSQL, incluidos BEGIN/COMMIT/ROLLBACK y claims;
no cuenta sentencias internas ejecutadas por una función SQL. `rpcCalls` incluye enriquecimiento,
por lo que un desafío completado puede tener más de un RPC total. La aceptación de un RPC se
refiere exclusivamente a la carga inicial. Las fases pueden solaparse (por ejemplo, espera del
pool dentro de contexto); no deben sumarse para reconstruir el total. Una fase anidada con el mismo
nombre se mide una sola vez.

Los logs usan una proyección explícita de metadatos: no incluyen argumentos, respuestas,
soluciones, tokens, credenciales, errores completos ni URLs firmadas. Desactivado, no se crean
colectores ni se emiten estos eventos. Los logs HTTP existentes mantienen su comportamiento.

```bash
FLASH_PERFORMANCE_DIAGNOSTICS=1 npm run dev > output/performance/run.jsonl 2>&1
npm run performance:summary -- output/performance/run.jsonl
```

El resumidor admite JSONL y los prefijos del servidor de Playwright. Calcula p50/p95 por operación,
modo, resultado y fase; los contadores se resumen por separado de los tiempos. Los percentiles usan
el rango más próximo. Los artefactos en `output/performance/` están ignorados por Git.

## Migración y reversión

El cambio sigue el flujo declarativo de [Supabase](../../supabase/schemas/README.md). El
[baseline activo](../../supabase/migrations/20261103090247_initial_schema.sql) contiene las dos funciones
y sus permisos. El inventario de seguridad, los tipos públicos
Supabase y los marcadores del health check están sincronizados.

Instalar el historial activo antes de desplegar el código y usar la revisión canónica del
[estado actual](status.md). La [guía de entornos](supabase-clean-installation.md) describe la operación;
este documento no acredita el despliegue remoto.

## Verificación local y medición

La referencia se capturó con instrumentación antes de activar los refactors. La comparación usa los
mismos fixtures y los mismos 14 E2E: Flash, recuperación, Alfabeto, Narrativa, Supervivencia y
Pirámide, ejecutados en stacks Supabase aislados con Next en desarrollo. Antes y después deben
usarse las mismas condiciones; estos pocos samples y los arranques en frío no representan un
benchmark de producción ni una garantía de porcentaje de mejora.

```bash
FLASH_PERFORMANCE_DIAGNOSTICS=1 E2E_COMPETITIVE_PROJECTIONS=1 \
  npm run test:e2e:isolated -- e2e/s03-flash.spec.ts e2e/s04-recovery.spec.ts \
  e2e/s05-alphabet.spec.ts e2e/narrative.spec.ts e2e/s14-survival.spec.ts e2e/s15-pyramid.spec.ts \
  > output/performance/after.log 2>&1
npm run performance:summary -- output/performance/after.log
```

`E2E_COMPETITIVE_PROJECTIONS=1` añade comprobaciones de paridad PostgREST con las proyecciones
originales para los usuarios de cada fixture, permisos de `anon` y ausencia por sala incorrecta.
Las pruebas SQL cubren además spectator, usuario externo, publicaciones futuras/cerradas,
versiones archivadas e intentos existentes, y la autorización del contexto privado. Las unitarias
comprueban selección de un constructor, errores, guard antes de escrituras, rollback y aislamiento
de los colectores.

Los resultados y percentiles de la ejecución del 2026-10-02 están en el
[informe histórico](../archive/reports/competitive-read-performance-2026-10-02.md).
No representan un benchmark actual ni una garantía de latencia en producción.
