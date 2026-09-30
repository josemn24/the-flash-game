# Workflow de base de datos

Este directorio contiene la definición, el historial y las herramientas locales de la base de
datos Supabase.

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

El historial activo está consolidado en las migraciones
`20260927140000_queens_board_validation.sql`, `20260927170000_queens_dynamic_grid.sql` y
`20260927172602_cancel-scheduled-challenge.sql`, generadas desde los 53 archivos declarativos. La rama de
respaldo conserva el historial incremental anterior.

## Flujo para un cambio de esquema

1. Editar el archivo correspondiente en `supabase/schemas/`.
2. Arrancar Supabase local si es necesario:

   ```bash
   npx supabase start
   ```

3. Generar una migración incremental sin aplicarla:

   ```bash
   npm run supabase:db:schema:sync -- --name nombre_descriptivo
   ```

4. Revisar la definición y la migración resultante:

   ```bash
   git diff -- supabase/schemas supabase/migrations
   ```

5. Aplicar las migraciones pendientes al entorno local:

   ```bash
   npm run supabase:migration:up
   ```

No se deben renombrar ni reescribir migraciones ya aplicadas. Una migración nueva es la unidad
reproducible que se desplegará posteriormente en un entorno remoto.

## Workflow de tipos TypeScript generados

El archivo [`lib/supabase/database.types.ts`](../lib/supabase/database.types.ts) se genera desde
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
   `lib/supabase/database.types.ts`.

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

Para preparar cuentas y datos de navegador, consulta [`local-development.md`](local-development.md).
Para los límites de seguridad y el modelo de persistencia, consulta
[`architecture.md`](architecture.md). El estado funcional y las capacidades pendientes se mantienen
en [`docs/current/status.md`](../docs/current/status.md).

## Excepciones: migraciones manuales

Usa una migración creada con `npx supabase migration new nombre_descriptivo` cuando el cambio no
pueda representarse de forma fiable mediante el sincronizador declarativo. Ejemplos:

- DML, backfills o transformaciones de datos existentes.
- Cambios de políticas RLS, especialmente `alter policy`.
- Comentarios, privilegios, ciertos `grant`, particiones y publicaciones.
- Propiedad de vistas, `security_invoker` y vistas materializadas.
- Pasos que requieran un orden operativo, comprobaciones o lógica procedural específica.

Si la excepción también tiene una representación declarativa, actualiza ambas fuentes. Si no la
tiene, documenta en la migración por qué queda fuera del diff declarativo y revisa posibles pérdidas
de datos.

El comando `db diff` no sustituye a este flujo en este proyecto: para cambios declarativos se debe
usar `db schema declarative sync`, que compara `schemas/` con el historial de migraciones.

## Versionado

Se versionan `config.toml`, todos los archivos de `schemas/`, todas las migraciones, los seeds y
esta documentación. `.temp/` y `.branches/` son estado local de la CLI y no se versionan.
