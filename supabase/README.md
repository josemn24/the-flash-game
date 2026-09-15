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

El proyecto incluye una [propuesta inicial de tablas, restricciones y RLS](schemas/README.md)
en `schemas/`. El baseline actual está versionado en
`migrations/20260915070137_initial_schema.sql`; las migraciones posteriores representan cambios
incrementales de los esquemas declarativos. Los seeds permanecen desactivados hasta disponer de
datos locales reproducibles diseñados explícitamente.

## Estructura

```text
supabase/
├── config.toml             # Configuración del stack local y de los esquemas declarativos
├── schemas/                # Fuente de verdad; archivos SQL declarativos
│   └── README.md
├── migrations/             # Historial versionado generado desde schemas/
├── seed.sql                # Futuro: datos locales reproducibles; actualmente desactivado
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

En S01, la aplicación usa `@supabase/ssr` con el cliente publicable de Supabase. Para probar el
flujo local, copia `.env.example` a `.env.local` y rellena la clave publicada a partir de
`npx supabase status`; nunca uses `service_role` en el navegador ni en Server Actions.

S02 añade las proyecciones de lectura `public.get_my_room_cards`, `public.get_room_detail` y
`public.get_room_introduction` en `schemas/55_room_reads.sql`. Son funciones estrechas para la
home, el detalle y la introducción autorizada; las preguntas, soluciones y payloads siguen en
`private` y no se exponen al cliente. El adaptador de servidor está en
`infrastructure/supabase/roomQueries.ts`.

Los escenarios locales no son seeds globales. Se crean con cuentas Auth reales y datos de dominio
mediante mantenimiento local. El runner es común y recibe el identificador del escenario:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s02
npm run test:integration:supabase -- --scenario s02
npm run test:e2e -- e2e/s02-rooms.spec.ts
```

Las credenciales temporales se guardan en `output/fixtures/<scenario>.json` (ignorado por Git).
Para limpiar un escenario, ejecuta `npm run supabase:fixture -- --scenario s02 --clean`, que hace
`db reset --local`. El fixture es la única fuente de datos del E2E S02; no se debe convertir en
`supabase/seed.sql`.

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
