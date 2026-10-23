# Banco de preguntas de prueba

`bank/` agrupa por formato preguntas independientes. Cada entrada declara `id`, `version`, `type`,
`payloadSchemaVersion`, `modes`, `difficulty`, `referenceTimeLimitMs`, `publicPayload` y
`solutionPayload`. `alphabetLetter` es obligatorio si admite Alfabeto; `familyId` agrupa variantes
para favorecer variedad. Los recursos propios están en `public/rehearsals/`.

La partida se genera desde la estructura competitiva autorizada. No se definen partidas completas,
asociaciones, manifiestos ni perfiles manuales. Las huellas y el índice se calculan automáticamente.

Una corrección añade otra versión de pregunta conservando la anterior. La generación usa la última;
una receta puede reproducir una versión anterior mientras esté disponible y conserve su huella.
La huella incluye los metadatos: cambiar dificultad, modos admitidos o familia también requiere
otra versión una vez publicada la entrada en el banco.

Ejecuta `npm run rehearsals:check` para comprobar contratos, recursos, soluciones reales y cobertura
mínima de tres familias independientes por posición de los setups BetaVIP y Tabarnia. Las 78 preguntas originales
se conservan; el inventario histórico de prueba acredita sus identidades y contenido.

El [modelo y procedimiento](../../docs/current/rehearsals.md) explica selección, dificultad y operación.
