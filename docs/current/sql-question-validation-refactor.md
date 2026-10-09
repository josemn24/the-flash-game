> Estado: vigente. Refactor de organización sin cambios de contrato.

# Validación SQL por formato

La revisión `20261009180205_question_validation_by_format` divide las reglas antes concentradas
en `54_question_validation.sql`. Conserva la aceptación, el rechazo, la compatibilidad histórica,
los errores y los permisos de la implementación del commit
`eddd90c80acf5fff7d2e8180b137826385176ab7`.

## Organización

| Ubicación                                                                                         | Responsabilidad                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/schemas/53_question_validation_<formato>.sql`                                           | Un archivo por cada uno de los 21 formatos. Los guiones del formato se convierten en guiones bajos.                                                                      |
| [54_question_validation.sql](../../supabase/schemas/54_question_validation.sql)                   | `validate_flash_question_document`: envelope y delegación. `is_supported_flash_question`: lectura de versión/solución, estado publicado, ramas históricas y excepciones. |
| [54z_challenge_validation.sql](../../supabase/schemas/54z_challenge_validation.sql)               | `validate_flash_editorial_document`: modos, referencias, puntos, cantidades y niveles, con su cuerpo original.                                                           |
| [68_competitive_question_formats.sql](../../supabase/schemas/68_competitive_question_formats.sql) | Extensión de elegibilidad que mantienen los nueve formatos que ya seguían ese camino.                                                                                    |

Todos los formatos tienen `private.validate_<formato>_question_document(document jsonb)`.
Los 12 que antes tenían comprobaciones propias de elegibilidad añaden
`private.is_supported_<formato>_question(question private.question_versions, solution jsonb)`:
Anagram, Estimation, Heat Map, Logic Code, Matching, Mini Wordle, Multiple Choice,
Progressive Clues, Progressive Image, Queens, Short Text y Word Search.

True False, Ordering, Classification, Logic Matrix, Zip, Escape, Word Hashtag, Odd One Out y
Connect Pairs conservan la extensión competitiva. Queens, Zip, Escape, assets y diccionarios
siguen utilizando sus helpers existentes. El contrato editorial y la lectura publicada se
mantienen separados; este cambio no unifica reglas duplicadas.

Se preservan casts, orden de comprobación, normalización y mensajes. Short Text mantiene su
camino especial. Estimation y Heat Map v1 siguen disponibles para lectura histórica, mientras
la publicación editorial exige v2. La elegibilidad no convierte SQL `NULL` en `false`; su
fachada sigue convirtiendo excepciones en `false`. Los assets listos, pendientes y archivados
mantienen sus reglas anteriores de publicación y uso.

## Seguridad y carga

Los 33 helpers son propiedad de `postgres`, `SECURITY INVOKER`, con `search_path = ''` y
revocación explícita de ejecución para `PUBLIC`, `anon`, `authenticated` y `service_role`.
Los editoriales son `VOLATILE`; los de elegibilidad son `STABLE`. Las tres funciones de entrada
mantienen firmas, retornos y atributos, incluida la fachada de elegibilidad `SECURITY DEFINER`.
El [inventario](../../supabase/security-inventory.json) comprueba permisos, propietario,
search path y volatilidad de estos validadores, tanto desde el esquema como desde las migraciones.

Las pruebas cargan archivos planos en orden lexicográfico: `53_*`, `54_*`, `54z_*` y los
helpers posteriores. Los archivos declaran `set local check_function_bodies = off` para resolver
las referencias diferidas después de la carga completa, siguiendo la convención existente.
La migración crea y protege los helpers antes de sustituir las dos fachadas. No elimina
funciones existentes ni modifica tablas, datos, RPCs públicas o tipos públicos generados.

## Pruebas de compatibilidad

[El corpus compartido](../../test-utils/format-contracts/corpus.json) sigue comprobando los
21 formatos en TypeScript y SQL. Además,
[test-question-validation.mjs](../../scripts/test-question-validation.mjs) compara 904
observaciones con la [referencia original](../../test-utils/format-contracts/sql-validation-baseline.json).
La referencia se capturó y se comprobó antes de extraer las reglas. Registra aceptación o
elegibilidad, SQLSTATE y mensaje; incluye 16 resultados SQL `NULL`.

Los casos cubren campos ausentes/adicionales, tipos incorrectos, versiones desconocidas,
errores simultáneos, soluciones inválidas, borradores, archivo, formatos de práctica, assets y
desafíos por modo. Cada observación revierte sus escrituras para no contaminar las siguientes.
No se regeneran expectativas para hacer pasar un movimiento de código.

```bash
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:test -- --upgrade-question-validation
npm test -- lib/question-formats/conformance.test.ts
npm run test:e2e:isolated -- e2e/format-contracts.spec.ts e2e/format-contracts-pyramid.spec.ts
npm run typecheck
npm run type-architecture
npm run style-architecture
npm run schema:revision:check
npm run docs:check
npm run supabase:types:check
```

Las dos primeras vías ejecutan contratos, pgTAP, inventario y concurrencia en bases desechables.
La prueba de actualización carga las migraciones hasta
`20261009172416_queens_pyramid_validation_limit`, comprueba la referencia original y guarda
fixtures con versiones publicadas, un intento completado, respuestas, recepciones, puntos y
otro intento activo. Aplica únicamente la migración del refactor y compara todas las filas de
las tablas del dominio. También verifica que ninguna función anterior cambie de OID, firma,
atributos o permisos, y que solo cambien los cuerpos de las dos fachadas acordadas.
Los E2E usan un stack separado. Estas comprobaciones no despliegan a staging ni producción.

Validación local del 2026-10-09: pasan las 54 suites pgTAP, el inventario y la concurrencia
por ambas vías de carga; los 158 casos SQL compartidos, las 904 observaciones originales,
los 160 tests de conformance TypeScript y los tres tests de health. La actualización conserva
las 31 tablas del dominio. Pasan tipos, arquitectura, revisión de esquema, enlaces y formato;
los tipos públicos generados permanecen iguales.

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

## Diferencias previas fuera del alcance

El workflow `supabase:db:schema:sync -- --name question_validation_by_format --no-apply`
también detectó divergencias anteriores entre el historial y el esquema declarativo en
14 funciones: activación, recuperación y abandono de intentos, dispatcher de comandos,
expiración, gestión de miembros, publicación y varios comandos de formatos. Incluía una
eliminación/recreación de `take_over_attempt`. Esas operaciones se excluyeron de la migración
generada para mantener el alcance acordado. No se han corregido como parte de este refactor;
la prueba de actualización exige que sus definiciones anteriores permanezcan intactas.

El lint global también encuentra dos avisos anteriores de variables sin uso en
[betavip.spec.ts](../../e2e/betavip.spec.ts) (`alphabet`) y
[roomQueries.test.ts](../../infrastructure/supabase/rooms/queries/roomQueries.test.ts) (`_assetId`).
Esos archivos permanecen sin cambios. El lint de los archivos modificados pasa.
