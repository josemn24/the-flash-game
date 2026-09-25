# Workflow de base de datos

Este directorio contiene la definición, el historial y las herramientas locales de la base de
datos Supabase.

## Regla principal: schema first

El esquema declarativo es la fuente de verdad:

- `supabase/schemas/*.sql` define el estado deseado de la base de datos.
- `supabase/migrations/*.sql` conserva el historial versionado que permite reproducir ese estado.
- El orden de los archivos declarativos es lexicográfico; los nombres deben respetar las
  dependencias entre objetos.
- Los cambios declarativos se hacen primero en `schemas/`, nunca directamente en Studio, el SQL
  Editor o `psql` esperando que después se detecten automáticamente.

La configuración de Supabase usa `schema_paths = ["./schemas/*.sql"]`. El detalle de tablas,
funciones, RLS y comandos está en [`schemas/README.md`](schemas/README.md).

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

El comando `db diff` no sustituye a este flujo: su baseline es el historial de migraciones, no la
ruta declarativa configurada para este repositorio.

## Versionado

Se versionan `config.toml`, todos los archivos de `schemas/`, todas las migraciones, los seeds y
esta documentación. `.temp/` y `.branches/` son estado local de la CLI y no se versionan.
