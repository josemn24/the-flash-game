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
modo. Las cinco proyecciones anteriores conservan sus condiciones de publicación, membresía,
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

El cambio sigue el flujo declarativo de [Supabase](../../supabase/schemas/README.md). La migración
aditiva [20261002131451_competitive-read-projections.sql](../../supabase/migrations/20261002131451_competitive-read-projections.sql)
crea las dos funciones y fija sus permisos. El inventario de seguridad, los tipos públicos
Supabase y los marcadores del health check están sincronizados.

Aplicar la migración antes del código y configurar
`EXPECTED_SCHEMA_REVISION=20261002131451_competitive-read-projections`. Las funciones anteriores se
conservan: se puede revertir el código sin retirar la migración. La aplicación local de la migración
está verificada; el despliegue remoto queda fuera de este cambio.

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

### Resultado del 2 de octubre de 2026

Las dos ejecuciones estables aprobaron los mismos 14 E2E. La ejecución final añadió paridad
PostgREST para los cinco modos y recuperación. Pasan también 1044 unitarias, las 29 comprobaciones
SQL nuevas y el resto de la suite SQL/concurrencia, tipos, lint, arquitectura, revisión de esquema,
tipos generados, documentación, formato y build. El stack temporal se eliminó al terminar.

Lectura del desafío (`challenge.read`, duración total en ms, incluido enriquecimiento cuando
corresponde). Las muestras indicadas corresponden a cada ejecución:

| Modo          | Muestras | RPC iniciales antes → después | p50 antes | p50 después | p95 antes | p95 después |
| ------------- | -------- | ----------------------------- | --------- | ----------- | --------- | ----------- |
| Flash         | 8        | 1 → 1                         | 15.91     | 20.28       | 53.39     | 49.42       |
| Alfabeto      | 7        | 2 → 1                         | 39.98     | 29.83       | 91.95     | 44.48       |
| Supervivencia | 3        | 3 → 1                         | 57.04     | 25.80       | 65.33     | 44.50       |
| Pirámide      | 7        | 4 → 1                         | 70.59     | 28.87       | 153.33    | 106.82      |
| Narrativa     | 4        | 5 → 1                         | 90.53     | 13.15       | 164.55    | 53.52       |

Prelectura de una respuesta genérica (`attempt.submitAnswer`, fase `attempt.context`, ms):

| Modo          | Muestras | p50 antes | p50 después | p95 antes | p95 después |
| ------------- | -------- | --------- | ----------- | --------- | ----------- |
| Flash         | 8        | 6.14      | 3.47        | 28.46     | 27.01       |
| Alfabeto      | 9        | 7.15      | 5.13        | 29.08     | 24.79       |
| Supervivencia | 1        | 5.54      | 5.96        | 5.54      | 5.96        |
| Pirámide      | 8        | 3.91      | 3.57        | 15.65     | 7.47        |
| Narrativa     | 4        | 8.20      | 6.43        | 46.48     | 22.93       |

Los contadores confirman cuatro transacciones por respuesta genérica en ambos recorridos. Las
unitarias verifican exactamente un RPC inicial y un constructor por modo; las operaciones indicadas
ya no leen el snapshot de recuperación.

La latencia total observada baja en Alfabeto, Supervivencia, Pirámide y Narrativa. En Flash el p50
sube, aunque el p95 baja; la única muestra de contexto de Supervivencia tampoco mejora. Estos
resultados describen esta ejecución local, sin atribuir causalidad ni garantizar una mejora
universal. La aceptación se basa en los cambios estructurales, sin un porcentaje mínimo.

Los logs y resúmenes completos están en `output/performance/before.log`, `before-summary.json`,
`after-stable.log` y `after-stable-summary.json`. El resumidor conserva el desglose por todas las
operaciones y fases. En la referencia, `challenge.initial` suma los tiempos RPC de los lectores
probados; en el refactor también incluye la preparación del cliente de la única lectura. La tabla
anterior usa el total por operación, cuya frontera de medición es la misma.
