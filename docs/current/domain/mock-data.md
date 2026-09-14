# Almacén mock normalizado

## Estado

La fase 3 está cerrada. `mockDomainStore` es un conjunto de tablas planas con las entidades de
`@/types/domain` y constituye la única fuente persistible del prototipo para contenido, identidad,
salas, membresías, temporadas, publicaciones, intentos y respuestas. No existe ningún flujo
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

`data/questions/index.ts` y `data/challengeDefinitions.ts` son exclusivamente proyecciones de
compatibilidad. La conversión legacy → canónico solo existe en tests para verificar round trips;
no participa en la creación del store. La lectura legacy todavía recompone preguntas y desafíos
completos, incluidos datos privados, por lo que no es una frontera de seguridad.

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

`demoRoom`, `demoRooms`, `questionsById`, `questionGroups`, `challengeDefinitions`,
`demoSeasonScheduledChallenges`, `challenges`, `getChallengeById` y el historial antiguo se
mantienen como API obsoleta derivada para compatibilidad y tests. Ya no tienen consumidores de
producción. Los generadores legacy exclusivos de pruebas están en `test-utils/legacy`; los fixtures
canónicos y el store no pueden importarlos.

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

Las rutas de producto acceden al store mediante contratos asíncronos, adaptadores mock y la fachada
`server/data-access.ts`. Consulta [`data-access.md`](data-access.md) para la composición,
autorización y DTOs.

Todavía no hay repositorios de persistencia, Route Handlers, autenticación real, SQL ni Supabase.
Como limitación conocida de la PoC, `PlayableChallengePageModel` sigue llevando las soluciones al
cliente para puntuar localmente; el backend deberá separar contenido público y evaluación
autoritativa.
