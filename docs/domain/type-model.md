# Capas del modelo de tipos

## Objetivo

La fase 2 separó los contratos del prototipo de los tipos que podrán respaldar una API y una base de
datos. Desde la fase 3, los mocks sociales y competitivos usan esas entidades mediante un almacén
normalizado, sin cambiar las rutas públicas.

## Capas

```text
types/domain       Entidades planas, IDs opacos, estados y valores del negocio
types/contracts    Entradas y salidas que pueden cruzar el límite cliente-servidor
types/gameplay     Estado y resultados internos de las sesiones de juego actuales
types/view-models  Datos derivados y preparados para componentes concretos
types/legacy       Agregados anidados que mantienen compatibles los mocks
```

Las importaciones deben apuntar hacia capas más fundamentales. `domain` es independiente del resto
del proyecto; `contracts` puede depender de `domain`; las capas de presentación pueden depender de
las anteriores. Ninguna de estas capas puede importar desde `data`, `lib`, `features`, `components`
o `app`. Internamente, los contratos de pregunta todavía reutilizan algunas formas estructurales
de cada formato declaradas en `types/question.ts`; los fixtures canónicos solo consumen el entrypoint
de contratos y nunca importan tipos legacy directamente.

La regla se comprueba con:

```bash
npm run type-architecture
```

## Nombres canónicos

Las entidades persistibles son `Player`, `Room`, `RoomMembership`, `RoomInvitation`, `Season`,
`ChallengeDefinition`, `ChallengeVersion`, `ChallengeItem`, `QuestionDefinition`,
`QuestionVersion`, `ScheduledChallenge`, `Attempt` y `AttemptAnswer`. Son snapshots inmutables,
usan timestamps UTC, duraciones en milisegundos e IDs de entidad incompatibles entre sí.

`superadmin` es un rol global de plataforma y no forma parte de `RoomRole`. Los rankings, los
totales, el usuario actual y las colecciones relacionadas son proyecciones o relaciones, no campos
de las entidades.

## Preguntas públicas y privadas

`QuestionContractMap` define para cada uno de los 31 formatos cuatro payloads: público, solución,
respuesta y revelación progresiva. De él se derivan `PublicQuestion`, `QuestionSolution`,
`QuestionReveal`, `AuthoringQuestion` y `AnswerValueOfType<T>`.

El cliente competitivo solo deberá recibir `PublicQuestion` y las revelaciones autorizadas. Las
respuestas correctas, tolerancias, rutas, tableros resueltos y métricas óptimas pertenecen a
`QuestionSolution`. Los puntos de una pregunta dentro de un desafío pertenecen a `ChallengeItem`.

## Compatibilidad temporal

`@/types/game` y los entrypoints históricos (`@/types/room`, `@/types/challenge`,
`@/types/question`, etc.) continúan disponibles. Sus nombres anidados se conservan mediante aliases
marcados como obsoletos:

- `Room` equivale a `LegacyRoomSnapshot`.
- `Season` equivale a `LegacySeasonSnapshot`.
- `RoomMember` equivale a `LegacyRoomMember`.
- `Question` continúa siendo la pregunta completa del prototipo.
- `Challenge` continúa siendo el desafío resuelto con preguntas completas.

El código nuevo debe importar desde `@/types/domain`, `@/types/contracts`, `@/types/gameplay` o
`@/types/view-models`. El almacén mock usa IDs opacos UUID v5 y resuelve las rutas legibles mediante
aliases. Los tipos legacy solo se importan en adaptadores de compatibilidad. Los constructores
deterministas pertenecen exclusivamente a `data/mock`; no forman parte del dominio ni anticipan los
adaptadores reales de Supabase.

## Comprobaciones

Los type tests verifican incompatibilidad de IDs, entidades sin campos derivados o relaciones
anidadas, exhaustividad de estados y formatos, separación de soluciones y respuestas ligadas a su
formato. El contrato completo se valida con `npm run typecheck`.
