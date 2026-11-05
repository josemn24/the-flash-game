# Entrega del refactor de validación por formato

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [sql-question-validation-refactor.md](../../current/sql-question-validation-refactor.md).

Validación local del 2026-10-09: pasan las 54 suites pgTAP, el inventario y la concurrencia
por ambas vías de carga; los 158 casos SQL compartidos, las 904 observaciones originales,
los 160 tests de conformance TypeScript y los tres tests de health. La actualización conserva
las 31 tablas del dominio. Pasan tipos, arquitectura, revisión de esquema, enlaces y formato;
los tipos públicos generados permanecen iguales.

El 2026-10-10 se instaló primero el historial incremental y después el baseline único en la base
local de la aplicación mediante el [procedimiento de instalación limpia](../../current/supabase-clean-installation.md).
La ejecución y validación de staging quedan pendientes.

Los E2E de Flash y Pirámide pasan usando `next build` y `next start` en stacks desechables,
con una configuración temporal fuera del repositorio que solo cambia el arranque del servidor
y su directorio de trabajo. Se conservan los specs, aserciones y tiempos de espera originales.
En desarrollo, Flash agotó dos veces la espera de cinco segundos del timer durante la cuenta
atrás; inicio y preparación devolvieron HTTP 200. Pirámide también pasa en desarrollo.
Esta limitación de la ejecución en desarrollo queda registrada sin cambios en los componentes
ni en las expectativas de los tests.

## Reversión

Para revertir tras un despliegue, crear una migración posterior; no editar el historial:

1. Recuperar el SQL original con
   `git show eddd90c80acf5fff7d2e8180b137826385176ab7:supabase/schemas/54_question_validation.sql`.
2. Restaurar en el esquema declarativo únicamente los cuerpos originales de
   `is_supported_flash_question` y `validate_flash_question_document`, manteniendo sus firmas,
   atributos, propietario y permisos. Mantener el desafío en `54z_challenge_validation.sql`
   para no declararlo dos veces.
3. Conservar los helpers nuevos y su inventario con ejecución revocada. Quedarán sin uso;
   eliminarlos requeriría un cambio posterior separado.
4. Generar con `npm run supabase:db:schema:sync -- --name restore_question_validation_facades --no-apply`.
   Revisar que solo sustituye esas fachadas y actualizar los marcadores de revisión y las
   comprobaciones de health que esperan la delegación de esas fachadas a los helpers.
5. Repetir las pruebas de contratos, errores, seguridad, migraciones y E2E antes del despliegue.
   La reversión no necesita reescribir datos.

## Diferencias fuera del alcance del refactor original

El workflow `supabase:db:schema:sync -- --name question_validation_by_format --no-apply`
también detectó divergencias anteriores entre el historial y el esquema declarativo en
14 funciones: activación, recuperación y abandono de intentos, dispatcher de comandos,
expiración, gestión de miembros, publicación y varios comandos de formatos. Incluía una
eliminación/recreación de `take_over_attempt`. Esas operaciones se excluyeron de la migración
original para mantener el alcance acordado. Se reconciliaron después y quedaron incorporadas en
el baseline activo; la auditoría enlazada documenta las decisiones y sus contratos.

La [auditoría posterior de estas 14 funciones](supabase-function-drift-audit-2026-10-09.md) registra las
diferencias históricas de formato, errores bajo concurrencia y cambios de autorización y auditoría.

El lint global también encuentra dos avisos anteriores de variables sin uso en
[betavip.spec.ts](../../../e2e/betavip.spec.ts) (`alphabet`) y
[roomQueries.test.ts](../../../infrastructure/supabase/rooms/queries/roomQueries.test.ts) (`_assetId`).
Esos archivos permanecen sin cambios. El lint de los archivos modificados pasa.
