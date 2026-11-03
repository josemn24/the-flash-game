# Banco de preguntas de prueba

La base inicial contiene **232 preguntas activas, todas en versión editorial 1**, agrupadas por
formato en `bank/`. Cada entrada declara `id`, `version`, `type`, `payloadSchemaVersion`, `modes`,
`difficulty`, `referenceTimeLimitMs`, `publicPayload` y `solutionPayload`. `alphabetLetter` es
obligatorio si admite Alfabeto; `familyId` agrupa variantes para favorecer variedad.

El banco actual contiene **388 preguntas activas**. Alfabeto dispone de **243 preguntas**: tres
familias independientes por cada una de las 27 letras españolas y cada dificultad. La ampliación
añade 130 ejercicios (22 fáciles, 54 medios y 54 difíciles) y conserva intacta la base inicial.
Las preguntas de respuesta corta también admiten Flash, Supervivencia y Pirámide.

Elección múltiple contiene **22 preguntas**: nueve fáciles, diez medias y tres difíciles, agrupadas
en 16 familias independientes. Su ampliación añade nueve medias y dos difíciles para cubrir las
posiciones repetidas de Flash y Supervivencia con alternativas de la dificultad solicitada.
Las once preguntas nuevas admiten también Pirámide y conservan intactas las versiones anteriores.

Conectar parejas contiene **10 tableros**: tres fáciles, cuatro medios y tres difíciles. La
ampliación añade dos tableros fáciles de 4×4 y dos medios de 5×5, con soluciones completas y únicas
y distribuciones distintas incluso al comparar rotaciones y reflejos con el banco previo y los
escenarios BetaVIP. Admiten Flash, Supervivencia, Pirámide y Contrarreloj. La estructura de referencia
de seis tableros medios sigue necesitando dos sustituciones de dificultad, frente a las cuatro anteriores.

Queens contiene **11 tableros**: tres fáciles, cinco medios y tres difíciles. Se añaden dos fáciles
de 4×4, cada uno con una corona inicial, y dos medios de 5×5, con una o ninguna corona inicial.
Todos tienen regiones conectadas y solución única aun sin las pistas iniciales. Sus distribuciones
son distintas bajo rotaciones, reflejos y cambios de etiquetas respecto del banco previo y BetaVIP.
Admiten Flash, Supervivencia, Pirámide y Contrarreloj; la referencia de seis tableros medios
necesita una sustitución de dificultad, frente a las tres anteriores.

Pistas progresivas contiene **13 preguntas**: cuatro fáciles, seis medias y tres difíciles. Se
añaden cinco medias y dos difíciles, con tres pistas de precisión creciente y explicaciones
específicas. Admiten Flash, Supervivencia y Pirámide. Las cuatro posiciones medias de la referencia
de Supervivencia pueden completarse sin sustituir dificultad, con conjuntos distintos entre semillas.
Se comprueban además el orden de revelado, la privacidad de las pistas pendientes y la penalización.

El generador consolidado usa exclusivamente recetas **v1**. Su versión, la versión editorial de
cada pregunta y `payloadSchemaVersion` son contratos diferentes. Los esquemas de payload conservan
sus valores requeridos por cada formato; no se han renumerado. Las recetas anteriores a esta base
no se admiten, aunque usaran también el número 1. El historial de desarrollo permanece en Git.

Las imágenes de la base están bajo `public/rehearsals/v1/`. La partida se genera desde la estructura
competitiva autorizada: no hay asociaciones ni perfiles manuales. La selección comprueba una
asignación completa sin ejercicios idénticos. La huella de ejercicio incluye formato, contenido
público y solución normalizados en NFC, sin explicación ni metadatos editoriales. Se permiten
variantes distintas de una familia. Las sopas de letras mantienen su relleno español con semilla.

`npm run rehearsals:check` comprueba contratos, recursos, resolución con proveedores reales,
explicaciones y cobertura: una familia por formato/modo/dificultad y tres por letra/dificultad para
las 27 letras españolas de Alfabeto. Las diez estructuras BetaVIP/Tabarnia mantienen tres familias por posición,
sumando dificultades. El informe `output/rehearsal-coverage.json` muestra calidad, combinaciones,
asignaciones y sustituciones reales de dificultad.

`test-utils/rehearsals/history-fingerprints.json` comienza con las 232 referencias de esta base.
`test-utils/rehearsals/v1-recipes.json` fija recetas y huellas de sus definiciones para detectar
regresiones del generador, incluidos los tableros de sopa de letras.

Desde esta v1, una corrección añade una versión superior conservando la anterior. La selección usa
la última por ID. `generationStatus` es opcional (`active` por defecto o `retired`); retirar exige
otra versión y no permite volver a seleccionar una anterior. Las recetas de este generador pueden
reproducir versiones editoriales anteriores que sigan presentes con su huella original.

Al incorporar versiones, ejecutar `npm run rehearsals:history:register`: añade referencias y rechaza
cambios o bajas de versiones ya registradas antes de escribir. Cambiar dificultad, modos o familia
también exige otra versión. La [rúbrica editorial](../../docs/content/guidelines/rehearsal-bank.md)
define dificultad y explicaciones por formato. El [modelo y procedimiento](../../docs/current/rehearsals.md)
detalla selección, autorización y comprobaciones.
