# Organización de formatos y revisión

Estado: vigente. Organización implementada para historial, catálogo y editor administrativo.

La interpretación de una pregunta pertenece a su formato. Las consultas adaptan filas de
persistencia; las funciones puras validan y transforman el contenido; los componentes muestran
preguntas y revisiones autorizadas.

## Historial

`infrastructure/supabase/rooms/queries/roomHistoryMappers.ts` conserva la fachada de importación.
Sus implementaciones están separadas por responsabilidad:

- `roomHistorySummaryMappers.ts`: entradas, clasificación y resúmenes.
- `roomReviewQuestionMapper.ts`: adapta las proyecciones públicas y de solución, planas o envueltas.
- `roomHistoricalChallengeMapper.ts`: compone el desafío histórico por modo.
- `roomReviewResultMappers.ts`: respuestas y resultado persistido.
- `roomMemberReviewMappers.ts`: elementos de revisión, bloqueos y participante.
- `roomReviewProgressMapper.ts`: progreso de cada modo y contrato del ciclo de vida.

La adaptación de preguntas llama a `lib/question-formats/storedReview.ts`, que reutiliza los
validadores públicos y de solución de `storedRegistry.ts`. Los lectores por formato siguen en
`lib/question-formats/<formato>/`. Los transformadores puros de revisión y su registro también
viven en `lib`; las rutas anteriores de `features/question-formats` reexportan esos transformadores.

La revisión conserva los metadatos publicados, los puntos del elemento y las soluciones originales
para presentación. La normalización que necesita la evaluación de una respuesta no modifica el
texto mostrado en Mini-Wordle. Los medios deben haber sido autorizados por infraestructura antes
de construir una pregunta de revisión. Las soluciones no se entregan a la partida activa.

El modo del desafío determina progreso, vidas, letras y niveles. El formato determina la estructura
de cada pregunta y su solución. Esta separación mantiene las reglas competitivas existentes.

## Catálogo

Cada ficha y sus ejemplos están en `features/question-formats/formats/<formato>/guide.ts` y
cumplen `QuestionFormatGuide<T>`, definido en `catalogTypes.ts`. `catalog.ts` compone el catálogo
en su orden existente y conserva `QUESTION_FORMAT_CATALOG`, `questionFormats` y la consulta por slug.
Las políticas de puntuación continúan referenciándose desde `scoringPolicies.ts`.

## Editor administrativo

`EditorialManagement.client.tsx` conserva el estado del texto JSON, el documento validado derivado,
los estados de las Server Actions y sus claves idempotentes. Los selectores de borrador y biblioteca,
la configuración del modo, la comparación y el historial de versiones están separados en
`components/admin/editorial/`. Cada sección recibe datos y callbacks; las acciones del servidor
siguen comprobando permisos, concurrencia y auditoría.

`lib/editorial/draftTransforms.ts` contiene las operaciones puras de cambio de modo, cambio de vidas
y sustitución por una versión de biblioteca. Conserva identidad, puntos y configuración del elemento
cuando corresponde. El editor permite texto JSON incompleto mientras el usuario escribe.

El cargador de assets está en `QuestionAssetUploader.client.tsx`. Los previews específicos están en
`features/question-formats/formats/<formato>/EditorialPreview.tsx` y se seleccionan mediante
`editorialPreviewRegistry.tsx`. El registro cubre todos los formatos editoriales y mantiene la vista
genérica de los que todavía no tienen un preview específico. Las referencias de biblioteca muestran
la versión seleccionada sin resolver sus soluciones en el navegador.

## Incorporar un formato

1. Definir sus capacidades, contratos, lectores y validadores en los módulos por formato existentes.
2. Implementar su transformación pura de revisión y registrarla en el registro correspondiente.
3. Añadir la ficha `guide.ts` al catálogo conservando un slug único y ejemplos válidos.
4. Registrar su preview editorial, específico o genérico, y los renderizadores que necesite.
5. Ampliar el corpus y comprobar validación, revisión, catálogo y ejecución en sus modos admitidos.

Las consultas del historial y el contenedor editorial no necesitan nuevas ramas por formato.
La habilitación competitiva de un formato mantiene además sus comprobaciones de servidor y SQL;
una ficha del catálogo no lo habilita por sí sola.

Los contratos completos se describen en [contratos de formatos competitivos](competitive-format-contracts.md)
y las fronteras de servidor y cliente en [arquitectura](architecture.md).
