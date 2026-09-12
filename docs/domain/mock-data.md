# Almacén mock normalizado

## Estado

La fase 3 sustituye el agregado anidado anterior por `mockDomainStore`, un conjunto de tablas planas
con las entidades de `@/types/domain`. Es la fuente de verdad para identidad, salas, membresías,
temporadas, publicaciones, intentos y respuestas del prototipo.

Los IDs persistibles son UUID v5 deterministas generados solo en `data/mock`. Los slugs legibles
siguen siendo la identidad de las rutas públicas y se resuelven mediante los mapas de aliases. El
jugador de la sesión demo se declara aparte; no existe `currentUserId` en `Room`.

## Contenido

- Las 105 preguntas tienen una definición estable y una versión publicada.
- El adaptador exhaustivo de preguntas separa contenido público, solución privada y revelaciones
  para los 31 formatos.
- Los siete desafíos tienen definición y versión publicada; seis están programados y Conexiones
  rápidas permanece sin programar.
- El orden, los puntos y la configuración contextual de letra, nivel o escena viven en
  `ChallengeItem`.
- Cada versión de desafío suma exactamente 100 puntos.
- Los ejemplos de `QUESTION_FORMAT_CATALOG` continúan siendo ejemplos locales de práctica y no
  generan registros persistibles.

La lectura legacy todavía recompone preguntas y desafíos completos, incluidos los datos privados.
Es una compatibilidad temporal para el frontend local, no una frontera de seguridad. Un backend
real deberá servir únicamente contratos públicos y evaluar respuestas con acceso privado.

## Calendario y actividad

Las publicaciones 01–05 están cerradas en ventanas diarias consecutivas. La publicación 06 está
abierta entre el 6 y el 20 de septiembre de 2026. Los antiguos placeholders 07–09 no son filas del
almacén. La selección actual consulta estado y ventana explícitos; no usa hash.

Los resultados anteriores se han reconciliado en 23 intentos competitivos. Sus respuestas apuntan
a `ChallengeItem`, y rankings, totales e historial se derivan de esos intentos. Los totales de la
temporada son Dark 242, Jackobo 225, Kike 169, Rielbe 158 y Palmera 98.

El superadministrador demo es un jugador con rol global, sin membresía ni intentos competitivos.

## Compatibilidad y validación

`demoRoom`, `demoRooms`, `questionsById`, `challengeDefinitions`,
`demoSeasonScheduledChallenges`, `challenges`, `getChallengeById` y el historial antiguo se
mantienen como API obsoleta. Los agregados sociales sí se calculan desde el store; los grandes
objetos editoriales anteriores se conservan como entrada temporal del adaptador hasta retirar la UI
legacy.

La integridad se valida sin modificar archivos:

```bash
npm run mock-data:check
npm run type-architecture
npm run typecheck
```

El primer comando comprueba UUID, aliases, claves foráneas, propietarios, temporadas activas,
ventanas, puntos, intentos, respuestas, rankings, historial y separación del contenido público.
