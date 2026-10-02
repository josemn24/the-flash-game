> Estado: vigente. Contratos y registros de los 21 formatos competitivos.

# Contratos de formatos competitivos

Cada formato tiene tres entradas independientes. No hay un barrel que importe a la vez
renderizadores React y composición privada. Las capacidades de los diez formatos exclusivos de
práctica siguen en el manifiesto, pero no crean entradas competitivas.

| Capa                                          | Responsabilidad                                                                      | Registro                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `lib/question-formats/<formato>`              | Metadatos, validación pura y conversión del contenido almacenado y público           | `definitions`, `storedPublicRegistry`, `storedRegistry`, `publicRegistry` |
| `features/question-formats/formats/<formato>` | Entrada competitiva y adaptación de la revisión autorizada, reutilizando componentes | `competitiveInputRegistry`, `reviewRegistry`                              |
| `server/evaluation/formats/<formato>`         | Composición del contrato público con la solución privada                             | `registry`, protegido con `server-only`                                   |

`definition.ts` contiene únicamente metadatos: versiones, capacidades por modo y política de
puntuación. Los registros enlazan funciones reales y son exhaustivos mediante tipos y pruebas.
El preflight consume los metadatos; no importa implementaciones cliente ni privadas.
La puntuación continúa delegándose al registro existente de `lib/scoringCore`.

## Representaciones y validación

`QuestionContractMap` sigue definiendo los tipos canónicos públicos, privados, de respuesta y de
revelación. `types/contracts/stored-questions.ts` describe los documentos almacenados y sus
variantes versionadas. Los tipos editoriales anteriores se reexportan como fachadas compatibles.

1. **Publicación:** `stored.ts` valida el documento editorial, delega el payload público a
   `validation.ts` y comprueba que la solución corresponde a sus opciones, referencias o geometría.
   Queens y Connect Pairs conservan su entrada desde la biblioteca de preguntas publicadas.
2. **Evaluación:** `storedRegistry` comprueba modo, versiones y configuración. Reutiliza los
   validadores públicos y privados del formato y convierte el contenido almacenado en un
   `PublicQuestion` y una `QuestionSolution`. El compositor del servidor produce la pregunta que
   consume el evaluador existente. Cuando infraestructura ya ha firmado los assets, el evaluador
   declara explícitamente la representación `authorized-runtime`: admite la URL autorizada y
   conserva las comprobaciones de opciones, referencias y solución. La publicación sigue
   requiriendo `assetId`.
3. **Entrega al jugador:** infraestructura verifica autorización y disponibilidad de assets y
   resuelve sus referencias privadas a URLs de runtime. `public.ts` interpreta ese payload y el
   progreso autorizado; nunca compone la solución privada. Pistas progresivas, por ejemplo,
   almacena todas las pistas, entrega solamente las reveladas y convierte las restantes a contratos
   privados de revelación para evaluación.
4. **Revisión:** `review.ts` combina el payload público con la proyección terminal autorizada del
   propietario. No recupera soluciones por su cuenta.

Los validadores reciben valores desconocidos y contexto explícito. Devuelven `ValidationResult`
con el valor validado o errores con código, ruta y mensaje. Las fachadas mantienen sus clases y
códigos de error anteriores en las fronteras HTTP/editoriales. Ningún validador modifica su input.
La letra, los pases y el deadline de Alfabeto pertenecen al modo, fuera del formato `short-text`.

Los adaptadores de interacción componen comandos e interpretan progreso o evaluación mediante los
contratos de `features/game/competitive/formats`. El núcleo de sesiones conserva el transporte,
la versión, la idempotencia, los reintentos, el estado y los temporizadores.

## Compatibilidad y correcciones

`multiple-choice` v1 y v2 se admiten en Flash, Supervivencia, Pirámide y Narrative. La variante v2
conserva referencias privadas de imagen y su resolución autorizada. `short-text` utiliza una
entrada de texto competitiva en Flash y Pirámide, y una base pública común con Alfabeto.

Las versiones publicadas v1 de Estimation y Heat Map tienen conversiones explícitas de lectura;
la publicación nueva continúa exigiendo v2. Anagram utiliza su evaluador existente también en el
gate SQL de admisión. Las correcciones no reescriben documentos ni recalculan resultados.
La lectura publicada separa los metadatos históricos del envelope (`id`, `prompt`, `context` y
`timeLimitMs`) antes de validar el payload específico. La publicación nueva mantiene sus campos
permitidos y no incorpora esos metadatos al contrato genérico del formato.
La creación standalone convierte explícitamente `payloadSchemaVersion` a entero, conforme a la
columna existente; el corpus comprueba el comando real de creación y publicación.
Los contratos HTTP, las fachadas de hooks y las reglas de puntuación permanecen compatibles.

## Comprobación entre capas

El corpus [compartido](../../test-utils/format-contracts/corpus.json) incluye los 21 formatos,
todas sus versiones competitivas declaradas y casos inválidos de payload, solución y versión.
[Vitest](../../lib/question-formats/conformance.test.ts) compara publicación, validación,
normalización, composición, renderizado, interacción y revisión. Comprueba también la ausencia de
mutación y de soluciones en la salida pública.

`npm run supabase:schema:test` carga el mismo JSON en una base temporal, con fixtures de assets y
diccionarios. Sus validadores SQL siguen siendo independientes: se compara aceptación y rechazo
estructural, mientras las pruebas existentes comprueban permisos y disponibilidad. Cualquier
divergencia nueva requiere un caso reproducible y una expectativa respaldada por el contrato.
Los cambios SQL se mantienen tanto en el esquema declarativo como en una migración de funciones.

`npm run test:e2e:isolated` ejecuta los escenarios competitivos en un stack local separado. Incluye
Flash y Pirámide con `short-text`, pérdida de una respuesta HTTP ya aceptada y una pregunta
`multiple-choice` v2 con imagen privada, además de formatos, recuperación, ranking, historial y
publicación editorial existentes.
