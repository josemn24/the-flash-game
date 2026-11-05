> Estado: vigente. Refactor de organización sin cambios de contrato.

# Validación SQL por formato

La migración incremental original `20261009180205_question_validation_by_format` dividió las
reglas antes concentradas en `54_question_validation.sql`. El refactor está integrado en el
baseline activo `20261103090247_initial_schema`. Conserva la aceptación, el rechazo, la compatibilidad histórica,
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
El SQL del baseline crea y protege los helpers antes de sustituir las dos fachadas. No elimina
funciones existentes ni modifica tablas, RPCs públicas o tipos públicos generados. El backfill
histórico no forma parte de la instalación limpia.

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
npm test -- lib/question-formats/conformance.test.ts
npm run test:e2e:isolated -- e2e/format-contracts.spec.ts e2e/format-contracts-pyramid.spec.ts
npm run typecheck
npm run type-architecture
npm run style-architecture
npm run schema:revision:check
npm run docs:check
npm run supabase:types:check
```

Las dos vías ejecutan contratos, pgTAP, inventario y concurrencia en bases desechables. La prueba
de upgrade que dependía de una revisión incremental concreta se retiró al reemplazar el historial;
el corpus de 904 observaciones y las suites SQL comprueban las garantías vigentes desde ambos orígenes.
Los E2E usan un stack separado. Estas comprobaciones no despliegan a staging.

La aplicación, verificación y reversión de la migración original se conservan en el
[informe histórico](../archive/reports/question-validation-2026-10-10.md). La operación vigente está en la
[guía de entornos](supabase-clean-installation.md).
