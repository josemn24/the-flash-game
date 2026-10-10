# Desarrollo local de Supabase

Esta página reúne el arranque, las comprobaciones y los límites del desarrollo local.
La [guía de preparación de entornos](../docs/current/supabase-clean-installation.md#qué-necesito-preparar)
es la referencia para elegir un dataset y ejecutar su preparación. Todos los comandos de esta
página están pensados para el entorno local.

## Arranque y estado

```bash
npm run supabase:start
npm run supabase:status
```

El stack local debe estar disponible antes de ejecutar las pruebas de esquema, integración o E2E.

## Reconstruir la base

El [recorrido local mínimo](../docs/current/supabase-clean-installation.md#local) reconstruye
PostgreSQL, Auth y Storage y prepara el administrador, diccionarios y buckets vacíos.
La [preparación de fixtures](../docs/current/supabase-clean-installation.md#fixtures-de-escenarios)
distingue el reset de PostgreSQL de esa limpieza completa. Ambos procedimientos son destructivos;
no ejecutarlos sobre datos que se quieran conservar.

## Fixtures de escenarios

Los [fixtures por escenario](../docs/current/supabase-clean-installation.md#fixtures-de-escenarios)
crean cuentas y contenido temporal, con manifiestos en `output/fixtures/`. La guía explica su
preparación y limpieza; `--clean` puede reiniciar toda la base local.
Las [instrucciones de QA del piloto](../docs/current/s22-operacion.md) conservan los comandos de
integración y E2E específicos de cada escenario.

## Dataset para probar el navegador

El [dataset del navegador](../docs/current/supabase-clean-installation.md#dataset-para-probar-el-navegador)
prepara cuentas con distintos permisos y desafíos persistidos, con historial opcional.
El setup reinicia la base y escribe sus credenciales e IDs en `output/fixtures/browser.json`.

## Alpha local de Tabarnia

La [alpha de Tabarnia](../docs/current/supabase-clean-installation.md#alpha-local-de-tabarnia)
prepara una sala con doce jugadores y cuatro desafíos, reiniciando la base local.
El [escenario conjunto con BetaVIP](../docs/current/supabase-clean-installation.md#escenario-local-con-tabarnia-y-betavip)
añade otra sala y tres desafíos. Las recetas, cuentas y recursos de ambos recorridos están en la
guía principal; las credenciales de ejemplo son exclusivamente locales.

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
no validan staging. Para publicar cambios, primero se revisan las migraciones generadas
y después se aplican mediante el proceso de despliegue correspondiente.
