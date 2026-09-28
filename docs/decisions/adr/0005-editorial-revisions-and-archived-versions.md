# ADR-0005: Correcciones editoriales y versiones archivadas

## Estado

Aceptada. Implementada en S17 y verificada localmente el 2026-09-27.

## Decisión

Corregir un desafío no modifica una versión publicada. El portal clona una versión `published` o
`archived` en un nuevo `draft` de la misma `challenge_definition`, asigna el siguiente número
secuencial, duplica los `challenge_items` con nuevos IDs y conserva las referencias a las
`question_versions` publicadas. Las correcciones de una pregunta se realizan mediante una nueva
versión desde `/admin/questions`.

El archivado solo acepta versiones publicadas y usa `expectedUpdatedAt`. Archivar no invalida
publicaciones ya creadas, partidas, respuestas, puntos ni revisiones históricas; esas lecturas
continúan resolviendo la versión archivada. Una programación nueva solo puede elegir una versión
publicada.

## Consecuencias

- Se pueden mantener varias ramas de borrador para una definición.
- El comparador usa la posición editorial, no `challenge_item_id`, porque la clonación genera IDs
  nuevos.
- Los comparadores y lectores del portal solo exponen payload público, nunca soluciones privadas.
- No hay migración de resultados ni repunteo automático al publicar una corrección.
