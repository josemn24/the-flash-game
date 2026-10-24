# Autorización, paginación y organización de la biblioteca de preguntas

Estado: vigente. Contratos de autorización y paginación implementados. La revisión y la
verificación por entorno están centralizadas en [estado actual](status.md).

## Correcciones y contratos conservados

`private.question_version_detail(uuid)` comprueba el jugador activo, vinculado a Auth y no
anónimo, y su asignación de plataforma `superadmin` antes de consultar la versión. Un usuario
autenticado sin autorización recibe `not_authorized` (`42501`) tanto para identificadores
existentes como inexistentes o nulos. Para un superadmin, el contenido ausente sigue devolviendo
`content_not_found` (`P0002`). Los roles SQL y las ACL existentes no cambian. El modelo de jugador
tiene estados `active` y `anonymized`; el bloqueo de una membresía no concede acceso editorial.

El listado selecciona y ordena las filas de cada página antes de `jsonb_agg`. `total` cuenta todos
los candidatos elegibles. Se conservan `updated_at DESC, id ASC`, los filtros y comodines, la
página predeterminada 1, el tamaño 25, los máximos de 10.000 páginas y 100 filas, las conversiones
y su precedencia. En `published`, se devuelve la última versión publicada **que cumple los
filtros**; los demás estados mantienen todas las versiones coincidentes. Las páginas sin
resultados contienen `entries: []`.

La biblioteca del portal y los selectores de creación/edición de desafíos siguen recibiendo la
colección completa. La capa de aplicación recorre páginas consecutivas de 25 entradas, conserva
el orden y los metadatos iniciales y admite la primera respuesta completa del SQL anterior.
Una página vacía prematura, repetida o el límite de páginas con entradas pendientes produce un
error; no se devuelve una colección parcial. Los errores de autorización y de infraestructura
se propagan. Cada RPC conserva la consistencia habitual de OFFSET: no hay una instantánea
compartida entre peticiones concurrentes. El adaptador de lectura paginada no agrega páginas.

No cambian las firmas RPC, tipos públicos generados, tablas, datos, índices, reglas de juego,
documentos, comandos editoriales, bloqueos, idempotencia ni auditoría.

## Organización declarativa

| Archivo                                                                                           | Responsabilidad                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [40_indexes.sql](../../supabase/schemas/40_indexes.sql)                                           | Los dos índices existentes de biblioteca, sin cambios de definición.      |
| [52_question_documents.sql](../../supabase/schemas/52_question_documents.sql)                     | Documento privado compartido, anterior a los validadores que lo utilizan. |
| [61_question_library_01_reads.sql](../../supabase/schemas/61_question_library_01_reads.sql)       | Detalle, listado y sus fachadas.                                          |
| [61_question_library_02_commands.sql](../../supabase/schemas/61_question_library_02_commands.sql) | Los cuatro comandos y sus fachadas.                                       |

Propietario, atributos y ACL acompañan a cada función. `question_version_document` conserva
`SECURITY INVOKER` y no incorpora una comprobación editorial, porque también lo utilizan las
validaciones competitivas. Las otras funciones conservan `SECURITY DEFINER`. Todas siguen
siendo propiedad de `postgres`, con `search_path = ''`; el inventario comprueba también su
volatilidad. No se añaden funciones SQL ni tipos persistentes. El inventario completo se consulta en el esquema y en sus comprobaciones, sin duplicarlo aquí.

## Validación reproducible

La caracterización fija 60 comprobaciones antes de las correcciones; pasa en el historial
anterior y en el nuevo. Las regresiones reproducen once fallos de autorización y ocho de
paginación en el anterior. Las expectativas corregidas verifican 37 fronteras de autorización
y 22 comprobaciones de paginación. La auditoría fallida revierte exactamente las filas y tiempos
de creación, edición, publicación y archivo, incluidas soluciones e idempotencia.

```sh
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:reconciliation:test
npm run supabase:schema:upgrade:test
npm run test:e2e:isolated -- e2e/s11-editorial.spec.ts e2e/s17-editorial-versioning.spec.ts
npm run typecheck
npm run lint
npm run format:check
npm run schema:revision:check
npm run docs:check
```

La verificación habitual de actualización mantiene la prueba de intentos y añade la de
biblioteca. Esta instala el historial anterior, conserva preguntas en todos los estados,
referencias, resultados idempotentes y partidas activas/terminadas, y aplica las dos migraciones
por separado. Comprueba datos exactos, OID, ACL, atributos, índices, health y replays, y después
continúa una partida y crea otra versión editorial.

El escenario S17 usa 125 preguntas posteriores a una versión objetivo. Comprueba la denegación
RPC a un miembro, la sexta página, la búsqueda de esa versión, su reutilización y el selector
al editar el desafío guardado. El E2E comprueba también el endpoint real de health. La carga
completa tiene pruebas de orden, filtros, compatibilidad con el SQL antiguo, errores sin
resultados parciales y límite de páginas.

Las migraciones originales, la restauración y sus comprobaciones fechadas están en el
[informe histórico](../archive/reports/question-library-2026-10-16.md).
