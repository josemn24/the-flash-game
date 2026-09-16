# Almacén mock normalizado

## Estado

La fase 3 está cerrada. `mockDomainStore` es un conjunto de tablas planas con las entidades de
`@/types/domain` y sigue siendo la fuente de fixtures de práctica, previews y tests de contrato para
contenido, identidad, salas, membresías, temporadas, publicaciones, intentos y respuestas. Desde
S01, los recorridos reales no lo usan como fuente de persistencia y no existe ningún flujo
legacy → store en producción.

Los IDs persistibles son UUID v5 deterministas generados solo en `data/mock`. Los slugs legibles
siguen siendo la identidad de las rutas públicas y se resuelven mediante los mapas de aliases. El
jugador de la sesión demo se declara aparte; no existe `currentUserId` en `Room`.

## Fuente editorial de contenido

- Las 105 preguntas se editan en `data/mock/catalog/questions`, divididas por catálogo temático.
  Cada fixture declara `publicPayload`, `privatePayload` y `practicePoints`; este último solo
  reconstruye el contrato de práctica legacy y no interviene en la puntuación competitiva.
- `data/mock/questionFixtures.ts` genera directamente una definición estable y una versión
  publicada por pregunta. El adaptador exhaustivo canónico → legacy cubre los 31 formatos.
- Los siete desafíos se editan en `data/mock/catalog/challenges.ts` y generan directamente sus
  definiciones, versiones e items. Seis están programados y Conexiones rápidas permanece sin
  programar.
- El orden, los puntos y la configuración contextual de letra, nivel o escena viven en
  `ChallengeItem`.
- Cada versión de desafío suma exactamente 100 puntos.
- Los ejemplos de `QUESTION_FORMAT_CATALOG` continúan siendo ejemplos locales de práctica y no
  generan registros persistibles.

Las preguntas y los desafíos canónicos se convierten a contratos de gameplay únicamente a través de
los adaptadores internos de `data/mock` que todavía necesita la infraestructura mock. La conversión
legacy → canónico solo existe en tests para verificar round trips; no participa en la creación del
store. La lectura legacy todavía recompone preguntas y desafíos completos, incluidos datos privados,
por lo que no es una frontera de seguridad.

## Calendario y actividad

Las publicaciones 01–05 están cerradas en ventanas diarias consecutivas. La publicación 06 está
abierta entre el 6 y el 20 de septiembre de 2026. Los antiguos placeholders 07–09 no son filas del
almacén. La selección actual consulta estado y ventana explícitos; no usa hash.

Los resultados anteriores se han reconciliado en 23 intentos competitivos. Sus respuestas apuntan
a `ChallengeItem`. Los registros editoriales de intentos viven en
`data/mock/catalog/attempts.ts`; `data/mock/attemptFixtures.ts` solo resuelve sus aliases a UUID y
relaciones canónicas. Rankings, totales, historial y demos sociales se derivan de jugadores,
membresías, intentos y respuestas canónicos. El resultado local reemplaza el intento fixture del
jugador actual al formar un ranking. La publicación 06, que carece de intentos, muestra solo el
resultado local y ninguna actividad social.

Los totales de Flash Points de la temporada son Dark 242, Jackobo 225, Kike 169, Rielbe 158 y
Palmera 98. Los tonos de avatar y otras constantes decorativas permanecen como configuración de
presentación.

El mock no modela niveles, hitos, metas, barras ni denominadores de temporada. `seasonFlashPoints`
es el total numérico acumulado; los rankings e históricos exponen `flashPoints`. El icono `⚡`
solo representa visualmente Flash Points.

El superadministrador demo es un jugador con rol global, sin membresía ni intentos competitivos.

## Compatibilidad y validación

Las antiguas fachadas de `data/` para `demoRoom`, preguntas, desafíos, publicaciones e historial se
han retirado. Los tests que necesitan contratos de gameplay usan helpers exclusivos de
`test-utils/mockGameplay.ts` y `test-utils/mockRoom.ts`, respaldados por fixtures canónicos y por
los adaptadores internos necesarios para materializar la UI. No queda código de apoyo en
`test-utils/legacy`; los adaptadores de compatibilidad que aún necesita la infraestructura viven en
`data/mock`.

La integridad se valida sin modificar archivos:

```bash
npm run mock-data:check
npm run type-architecture
npm run typecheck
```

El primer comando comprueba UUID, slugs, autenticación, roles, membresías, invitaciones, versiones,
ventanas, cancelaciones, puntos, intentos, respuestas, rankings, historial, round trips y separación
del contenido público. Incluye escenarios negativos aislados de relaciones y estados temporales.

## Fase 4 cerrada y límite actual

Las rutas de práctica y preview acceden al store mediante contratos asíncronos, el adaptador mock y
la fachada `server/data-access.ts`. Las rutas reales de S01–S07 usan la misma fachada para seleccionar
Auth, RPCs y PostgreSQL mediante `infrastructure/supabase/`. Consulta
[`data-access.md`](data-access.md) para la composición, autorización y DTOs.

S01 cubre Auth, provisioning de jugador y nombre; S02 cubre home, salas, detalle e introducción;
S03 cubre el Flash competitivo de dos preguntas; S04 cubre recuperación, sesión exclusiva y
abandono; S06 consulta los rankings reales de temporada y de la publicación abierta; S07 consulta
historial Flash, ranking histórico y revisión autorizada después de volver. La administración, el
calendario, Storage y los demás modos siguen usando mock o están pendientes de sus propias slices.

Como compatibilidad de la práctica y de previews, `PlayableChallengePageModel` todavía puede llevar
las soluciones al cliente y puntuar localmente. El recorrido competitivo migrado separa contenido
público y evaluación autoritativa, por lo que esta compatibilidad no debe reutilizarse como fallback.
