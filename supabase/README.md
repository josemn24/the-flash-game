# Workflow de base de datos

## Enfoque

Este repositorio usa el enfoque declarativo de Supabase.

- La fuente de verdad del esquema es `supabase/schemas/*.sql`.
- Las migraciones de `supabase/migrations/*.sql` son el historial versionado que se genera a partir
  de esa fuente de verdad mediante `supabase db schema declarative sync`.
- El orden de los archivos declarativos es lexicográfico. Cuando existan dependencias entre objetos,
  los nombres deben reflejar el orden de creación.
- No se deben hacer cambios de esquema directamente en Studio, el SQL Editor o `psql` esperando que
  `supabase db schema declarative sync` los detecte: el workflow compara los archivos declarativos
  con el baseline de migraciones, no usa el estado vivo como fuente de verdad.

El proyecto todavía no define tablas, tipos, funciones, vistas, políticas RLS ni datos seed.

## Estructura

```text
supabase/
├── config.toml             # Configuración del stack local y de los esquemas declarativos
├── schemas/                # Fuente de verdad; archivos SQL declarativos
│   └── README.md
├── migrations/             # Se crea al generar la primera migración SQL
├── seed.sql                # Futuro: datos locales reproducibles, si el proyecto los necesita
├── .gitignore              # Estado local ignorado por la CLI
└── .temp/ y .branches/     # Estado interno no versionado
```

La configuración usa `declarative_schema_path = "./schemas"`. La carpeta puede dividirse después
por responsabilidad, por ejemplo `00_extensions.sql`, `10_types.sql`, `20_tables.sql`,
`30_views-functions.sql` y `40_indexes.sql`, manteniendo siempre un orden explícito y sin duplicar
definiciones.

## Workflow diario

1. Editar los archivos de `supabase/schemas/`.
2. Arrancar el stack local si no está activo:

   ```bash
   npx supabase start
   ```

3. Generar una migración incremental contra la definición declarativa, sin aplicarla todavía:

   ```bash
   npx supabase db schema declarative sync --no-apply --name nombre_descriptivo
   ```

4. Revisar la migración generada y confirmar que contiene únicamente el cambio esperado:

   ```bash
   git diff -- supabase/schemas supabase/migrations
   ```

5. Aplicar las migraciones pendientes al entorno local:

   ```bash
   npx supabase migration up
   ```

El comando `db diff` no es el workflow declarativo de este repositorio: en la versión actual de la
CLI su baseline es el historial de migraciones y no la ruta declarativa configurada.

6. Validar la reconstrucción completa cuando sea necesario. Este comando borra y recrea la base de
     datos local, por lo que no debe ejecutarse contra un entorno con datos que se quieran conservar:

   ```bash
   npx supabase db reset --local
   ```

Los cambios deben revisarse tanto en el archivo declarativo como en la migración resultante. La
migración es la unidad que permite reproducir el historial y, en una fase posterior, desplegarlo en
un entorno remoto.

## Excepciones que requieren SQL manual

Usa una migración creada con `npx supabase migration new nombre_descriptivo` cuando el cambio no sea
una transformación de esquema que el sincronizador declarativo pueda representar de forma fiable.
Entre los casos
importantes están:

- DML y backfills: `insert`, `update`, `delete` o transformaciones de datos existentes.
- Cambios de políticas RLS, especialmente `alter policy`.
- Comentarios, privilegios de esquema y ciertos `grant`.
- Particiones, publicaciones y dominios.
- Propiedad de vistas, `security_invoker` en vistas y vistas materializadas.
- Cambios que deban ejecutarse en un orden operativo concreto o que necesiten lógica procedural,
  comprobaciones y pasos de datos.

La migración manual debe ser idempotente cuando el contexto lo requiera y revisarse por separado por
posibles pérdidas de datos. Si la excepción también tiene una representación declarativa, actualiza
ambas fuentes; si no la tiene, documenta en la migración por qué queda fuera del diff declarativo.

## Versionado

Se versionan:

- `supabase/config.toml`.
- Todos los archivos SQL de `supabase/schemas/`.
- Todos los archivos SQL de `supabase/migrations/`.
- `supabase/seed.sql` si se crea para datos de desarrollo.
- La documentación del workflow.

No se versionan `.temp/` ni `.branches/`, que son estado interno de la CLI.
