# Workflow de base de datos

Este directorio contiene la definición, el historial y las herramientas locales de la base de
datos Supabase.

Los destinos operativos admitidos son `local` y `staging`. El perfil mínimo se prepara con
`npm run supabase:local:bootstrap -- --target local`; staging conserva su bootstrap BetaVIP.
La [guía de preparación](../docs/current/supabase-clean-installation.md#qué-necesito-preparar)
permite elegir el recorrido y documenta ambos procedimientos.

## Regla principal: schema first

El esquema declarativo es la fuente de verdad:

- `supabase/schemas/*.sql` define el estado deseado de la base de datos.
- `supabase/migrations/*.sql` conserva el historial versionado que permite reproducir ese estado.
- `pg-delta` ordena las declaraciones según sus dependencias; los prefijos numéricos de los
  archivos se conservan para facilitar la lectura humana y las pruebas directas del esquema.
- Los cambios declarativos se hacen primero en `schemas/`, nunca directamente en Studio, el SQL
  Editor o `psql` esperando que después se detecten automáticamente.

La configuración de Supabase usa `pg-delta` con `declarative_schema_path = "./schemas"`. El detalle
de tablas, funciones, RLS y comandos está en [`schemas/README.md`](schemas/README.md).

El historial activo contiene una única migración inicial: `20261103090247_initial_schema.sql`,
generada desde el esquema declarativo. Las 26 migraciones anteriores y sus verificadores de
actualización se conservan en Git, en el commit `f317fc44e3df1519164a68ce91f3a9cc5ecdc50a`.
La revisión canónica está centralizada en [estado actual](../docs/current/status.md) y se comprueba
con `schema:revision:check`. Los cambios posteriores vuelven a generar migraciones incrementales.
La [consolidación de noviembre](../docs/archive/reports/migration-consolidation-2026-11-03.md)
registra el procedimiento y sus resultados; no acredita la reinstalación de local ni de staging.

La inicial incluye los [handlers de intentos](../docs/current/sql-attempt-command-handlers-refactor.md),
la [biblioteca editorial](../docs/current/sql-question-library-refactor.md), la longitud de Alfabeto
y el [total autoritativo](../docs/current/attempt-lifecycle.md#total-autoritativo-al-completar).
Sus contratos se verifican directamente desde schemas y migraciones, sin reconstruir versiones retiradas.

También incluye `public.run_calendar_tick(jsonb)` y `public.expire_stale_attempts(jsonb)`,
exclusivas de `service_role`. Los adaptadores utilizan un cliente servidor sin sesión de usuario;
los comandos de juego mantienen su conexión PostgreSQL. El tick fija `statement_timeout = 0`
y `lock_timeout = 0`; la expiración independiente tiene un límite de cinco segundos, incluida
la espera por bloqueos. Los límites HTTP del proveedor siguen vigentes.

Aplicar el esquema antes de desplegar una aplicación que lo necesite. La inicial notifica la
recarga de PostgREST. `npm run test:integration:maintenance-rpc` verifica permisos, expiración,
timeouts y rollback de auditoría en una base y un proceso PostgREST desechables; su variante
`-- --migrations` utiliza la inicial. Ninguna de estas pruebas ejecuta el tick sobre la base habitual.

La [validación SQL por formato](../docs/current/sql-question-validation-refactor.md) documenta
los helpers privados, las pruebas de compatibilidad y la reversión del último refactor.

La [auditoría de las 14 funciones pendientes](../docs/archive/reports/supabase-function-drift-audit-2026-10-09.md)
clasifica las diferencias anteriores entre esquema e historial y documenta cómo reproducirlas.
La [reconciliación de comandos competitivos](../docs/current/competitive-command-reconciliation.md)
resuelve esas diferencias y documenta los cambios intencionados. Las comprobaciones vigentes cubren
los contratos desde schemas y migraciones y la equivalencia de sus catálogos; las pruebas históricas
de actualización y reversión se retiraron al consolidar el historial. La
[evidencia de consolidación](../docs/archive/reports/migration-consolidation-2026-11-03.md) resume
esa transición.

## Flujo para un cambio de esquema

1. Editar el archivo correspondiente en `supabase/schemas/`.
2. Arrancar Supabase local si es necesario:

   ```bash
   npx supabase start
   ```

3. Generar una migración incremental sin aplicarla:

   ```bash
   npm run supabase:db:schema:sync -- --name nombre_descriptivo --no-apply --strict-coverage
   ```

4. Revisar la definición y la migración resultante:

   ```bash
   git diff -- supabase/schemas supabase/migrations
   ```

5. Aplicar las migraciones pendientes al entorno local:

   ```bash
   npm run supabase:migration:up
   ```

Después de esta consolidación de preproducción, no se deben renombrar ni reescribir migraciones ya aplicadas. Una migración nueva es la unidad
reproducible que se desplegará posteriormente en un entorno remoto.

## Workflow de tipos TypeScript generados

El archivo [`infrastructure/supabase/database.types.ts`](../infrastructure/supabase/database.types.ts) se genera desde
el schema `public` de Supabase local. Es un artefacto versionado que debe cambiar junto con la
migración o definición de schema que lo justifica.

### Cuándo regenerar

Regenera los tipos después de cambios estructurales en `public`, por ejemplo:

- tablas, columnas, relaciones o vistas;
- funciones RPC, sus argumentos o sus valores de retorno;
- enums y otros tipos usados por la Data API.

No es necesario regenerarlos por cambios en datos, fixtures, seeds, componentes, código
TypeScript o políticas RLS que no cambien la forma del schema. Estos últimos cambios siguen
requiriendo sus propias pruebas de comportamiento o seguridad.

### Flujo local recomendado

Después de cambiar `supabase/schemas/` y crear o actualizar la migración:

1. Arrancar Supabase local si no está en marcha:

   ```bash
   npm run supabase:start
   ```

2. Aplicar las migraciones pendientes al proyecto local:

   ```bash
   npm run supabase:migration:up
   ```

3. Generar los tipos desde el schema local actualizado:

   ```bash
   npm run supabase:types
   ```

4. Verificar que el archivo generado coincide con la base local sin escribir cambios:

   ```bash
   npm run supabase:types:check
   ```

5. Ejecutar las comprobaciones del proyecto:

   ```bash
   npm run typecheck
   npm test
   ```

6. Versionar juntos la migración, la definición declarativa y
   `infrastructure/supabase/database.types.ts`.

Para un stack aislado, `SUPABASE_TEST_WORKDIR` selecciona su configuración local;
`SUPABASE_TYPES_DB_URL` sigue disponible para una base desechable explícita.
El script de generación usa el CLI local de Supabase, limita la salida al schema `public` y no
ejecuta `db reset` automáticamente. Si la base local está obsoleta, actualízala explícitamente
con el flujo de migraciones. En un entorno desechable, como CI, puede reconstruirse primero desde
las migraciones con `npm run supabase:db:reset` y después ejecutarse `npm run supabase:types:check`.

La generación desde un proyecto remoto puede ser útil para diagnosticar drift o reconciliar un
entorno, pero no es el flujo diario recomendado: hace depender la generación de credenciales y
del estado remoto. Si los tipos remotos difieren, primero hay que reconciliar schemas y
migraciones; no se debe sobrescribir automáticamente el artefacto versionado con la salida
remota.

## Validación mínima

Con Docker y Supabase local en marcha:

```bash
npm run supabase:schema:test
npm run docs:check
```

Para validar el recorrido completo del piloto local:

```bash
npm run verify:pilot
```

La primera carga el esquema declarativo en una base aislada y ejecuta las pruebas de integridad,
permisos, comandos e idempotencia. La segunda comprueba los enlaces de Markdown.

## Qué contiene cada archivo

```text
supabase/
├── config.toml              # Configuración del stack y de los esquemas declarativos
├── schemas/                 # Fuente de verdad del esquema
├── migrations/              # Historial versionado generado desde schemas/
├── seed.sql                 # Datos de dominio para el dataset manual del navegador
├── seed-browser-history.sql # Datos históricos opcionales del navegador
└── .gitignore               # Estado local de la CLI y credenciales locales
```

Para preparar datasets, fixtures, el perfil mínimo o staging, consulta la
[guía de preparación de entornos](../docs/current/supabase-clean-installation.md#qué-necesito-preparar).
Para los límites de seguridad y el modelo de persistencia, consulta
[`architecture.md`](architecture.md). El estado funcional y las capacidades pendientes se mantienen
en [`docs/current/status.md`](../docs/current/status.md).

## Excepciones: migraciones manuales

Usa una migración creada con `npx supabase migration new nombre_descriptivo` cuando el cambio no
pueda representarse de forma fiable mediante el sincronizador declarativo. Ejemplos:

- DML, backfills o transformaciones de datos existentes.
- Objetos que el motor instalado identifica como no gestionados mediante `--strict-coverage`.
- Configuración operativa que no es DDL, como las filas de buckets de Storage.
- Pasos que requieran un orden operativo, comprobaciones o lógica procedural específica.

Las políticas RLS, ACL, vistas y funciones gestionadas por pg-delta siguen el flujo declarativo.
Si una excepción también tiene una representación declarativa, actualiza ambas fuentes. Si no la
tiene, documenta en la migración por qué queda fuera del diff declarativo y revisa posibles pérdidas
de datos.

El comando `db diff` no sustituye a este flujo en este proyecto: para cambios declarativos se debe
usar `db schema declarative sync`, que compara `schemas/` con el historial de migraciones.

## Versionado

Se versionan `config.toml`, todos los archivos de `schemas/`, todas las migraciones, los seeds y
esta documentación. `.temp/` y `.branches/` son estado local de la CLI y no se versionan.

## Contratos por modo

Los detalles de formatos, payloads, tamaños de tablero y recuperación pertenecen a los
[contratos por modo](../docs/current/domain/mode-contracts.md) y al
[contrato de Contrarreloj](../docs/current/domain/contrarreloj.md). Este workflow mantiene
el procedimiento de migración; no duplica sus requisitos editoriales.

## Equivalencia de esquema e historial

```bash
npm run supabase:schema:equivalence:test
npm run supabase:schema:equivalence:test -- --reference-dir=/ruta/al/historial-original
```

El comparador reconstruye bases aleatorias dentro de `SUPABASE_DB_CONTAINER` y las elimina incluso
si falla. La opción de referencia compara también un directorio de migraciones originales; no
acepta una base destino existente. El informe y los hashes quedan en
`output/audits/schema-equivalence.json`. Compara estructura, funciones, triggers, índices, RLS,
políticas, propietarios, privilegios, defaults y extensiones, incluidas las políticas propias de Storage.
Normaliza OIDs y el orden físico de columnas de tablas; conserva el orden de vistas y retornos RPC.
Las concesiones redundantes de schema se comparan por permisos efectivos y capacidad de delegación.
Las pruebas negativas alteran una restricción, un índice, el permiso CREATE de un schema y una política; revierten cada cambio.

El bloque histórico de relleno de mediciones se conserva en Git. No forma parte del esquema
estructural ni de la inicial vacía: las funciones y triggers actuales preparan las temporadas nuevas.
Los diccionarios, usuarios, buckets y archivos se aprovisionan mediante sus herramientas específicas.
