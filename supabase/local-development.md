# Desarrollo local de Supabase

Esta guía describe cómo reconstruir la base local, cargar fixtures y abrir la aplicación con datos
de prueba. Todos los comandos de esta página están pensados para el entorno local.

## Arranque y estado

```bash
npm run supabase:start
npm run supabase:status
```

El stack local debe estar disponible antes de ejecutar las pruebas de esquema, integración o E2E.

## Reconstruir la base

```bash
npm run supabase:db:reset
```

Este comando borra y recrea la base local aplicando las migraciones pendientes. No debe ejecutarse
contra un entorno con datos que se quieran conservar.

El seed está desactivado en `supabase/config.toml` para que un `db reset` normal no cargue datos de
aplicación automáticamente. El setup del navegador lo carga de forma explícita y controlada.

## Fixtures de escenarios

Los escenarios crean cuentas Auth y datos de dominio temporales; no son seeds globales. El patrón
general es:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario <scenario>
npm run test:integration:supabase -- --scenario <scenario>
npm run test:e2e -- e2e/<scenario>.spec.ts
```

Para limpiar un escenario:

```bash
npm run supabase:fixture -- --scenario <scenario> --clean
```

Los manifiestos se guardan en `output/fixtures/`, una ruta ignorada por Git. Consulta los archivos
de `scripts/fixtures/scenarios/` y `scripts/integration/scenarios/` para conocer los escenarios
disponibles y sus pruebas concretas.

## Dataset para probar el navegador

Para crear una sala persistida, cuentas Auth locales y desafíos preparados:

```bash
npm run supabase:browser:setup
npm run dev
```

Para incluir también resultados históricos:

```bash
npm run supabase:browser:setup -- --with-history
```

## Alpha local de Tabarnia

Para preparar la sala realista de la alpha con sus doce jugadores, una temporada activa y el primer
desafío Steel Ball Run:

```bash
npm run supabase:tabarnia:setup
npm run dev
```

El setup crea a `xesmona` como superadmin fuera de la sala, a `Ches` como propietario y jugador, y
al resto de la cohorte como miembros jugadores. Las credenciales fijas y los IDs generados se
guardan en `output/fixtures/tabarnia.json`, una ruta ignorada por Git. El comando reinicia la base
local en cada ejecución y no crea intentos ni resultados históricos.

El setup realiza estas operaciones únicamente contra Supabase local:

1. Reinicia la base.
2. Crea seis cuentas Auth locales.
3. Aprovisiona sus `players`.
4. Ejecuta `supabase/seed.sql` con los `player_id` generados.
5. Opcionalmente ejecuta `supabase/seed-browser-history.sql`.

Las credenciales se imprimen al terminar y se guardan en
`output/fixtures/browser.json`. No se mantienen contraseñas en esta documentación ni deben
reutilizarse contra un proyecto remoto.

El dataset incluye las salas `browser-playground` y `browser-isolated`, además de publicaciones
abiertas, futuras y cerradas. El comando devuelve la ruta del desafío abierto.

## Verificación

Validación rápida del esquema:

```bash
npm run supabase:schema:test
```

Esta prueba carga todos los archivos de `supabase/schemas/` en una base aislada y comprueba el
inventario, ACL/RLS, provisioning, comandos, idempotencia, rollback y concurrencia.

Validación completa del piloto:

```bash
npm run verify:pilot
```

Comprobaciones generales de documentación y aplicación:

```bash
npm run docs:check
npm run typecheck
npm run lint
npm run build
```

## Límites del entorno

No hay un proyecto remoto vinculado desde este entorno. Las pruebas y los datasets descritos aquí
no validan producción ni staging. Para publicar cambios, primero se revisan las migraciones generadas
y después se aplican mediante el proceso de despliegue correspondiente.
