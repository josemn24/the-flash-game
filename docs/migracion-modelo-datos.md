# Migración del modelo de datos

## Propósito

Este documento propone una migración por fases desde el modelo mock actual de la PoC hasta el modelo objetivo descrito en `salas-y-temporadas.md` y `glosario.md`.

La PoC nació como una colección local de preguntas agrupadas por etapas. El producto objetivo organiza la experiencia alrededor de salas, temporadas y desafíos periódicos asíncronos. La migración debe cambiar el lenguaje y la estructura sin romper de golpe los datos, rutas y componentes existentes.

## Estado actual

Actualmente los datos locales se organizan así:

```text
data/challenges.ts
└─ challenges: Challenge[]
   ├─ demoChallenge
   │  └─ questions[]
   └─ connectionsChallenge
      └─ questions[]
```

El tipo principal es:

```ts
type Challenge = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questions: Question[];
};
```

Esto permite validar una experiencia individual: elegir un desafío, jugar sus preguntas y revisar resultados. La primera fase de migración ya separó el concepto jugable principal de la antigua idea de etapa. Según el glosario, el concepto de producto actual es `Desafío`.

## Modelo objetivo

El modelo objetivo no debería introducirse de golpe. Conceptualmente apunta a:

```text
Sala
└─ Temporada
   └─ Desafío periódico
      ├─ Modo de juego
      └─ Pruebas / Preguntas
         └─ Formato de pregunta
```

Y, más adelante, añadirá:

- jugadores de sala;
- disponibilidad de desafíos;
- intentos de jugador;
- ranking del desafío;
- ranking de temporada;
- cierre de temporada.

## Principio de migración

La migración debería avanzar de lo más local a lo más social:

1. Renombrar el concepto jugable principal de `Stage` a `Challenge`.
2. Introducir una sala mock que contenga desafíos.
3. Introducir temporada mock cuando haya valor en mostrar acumulado o calendario.
4. Separar definición de desafío y publicación de desafío.
5. Añadir intentos y rankings cuando existan jugadores.

No conviene introducir temporadas, rankings o calendario real antes de tener un `Challenge` claro y una `Room` mock funcional.

## Fase 1: Stage pasa a Challenge

Estado: aplicada.

Objetivo: alinear el lenguaje de datos con el glosario sin cambiar todavía el comportamiento.

Modelo intermedio:

```ts
type Challenge = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questions: Question[];
};
```

Cambios aplicados:

- Crear tipos `Challenge` y `ChallengeSummary`.
- Añadir `mode` al antiguo contenido de etapa.
- Migrar `demoStage` a `demoChallenge`.
- Migrar `connectionsStage` a `connectionsChallenge`.
- Mantener `questions` como nombre técnico por compatibilidad con el modelo actual.
- Cambiar textos de UI de "etapa" a "desafío".
- Cambiar la ruta jugable de `/etapas/[stageId]` a `/desafios/[challengeId]`.

Resultado:

```text
Colección local de desafíos
└─ Challenge[]
   └─ questions[]
```

Todavía no hay sala, temporada, calendario, usuarios ni ranking.

## Fase 2: Sala mock con desafíos

Objetivo: empezar a representar la estructura social sin implementar multijugador real.

Modelo intermedio:

```ts
type Room = {
  id: string;
  title: string;
  description: string;
  challenges: Challenge[];
};
```

Ejemplo:

```ts
export const demoRoom = {
  id: "demo-room",
  title: "Sala Demo",
  description: "Sala local para probar desafíos de The Flash.",
  challenges: [demoChallenge, connectionsChallenge],
} satisfies Room;
```

Cambios esperados:

- Crear `data/demoRoom.ts`.
- Hacer que la portada lea desafíos desde una sala mock.
- Mantener experiencia de un solo jugador.
- Mantener ranking y jugadores fuera del modelo.

Resultado:

```text
Sala Demo
└─ Desafíos disponibles
   ├─ Demo
   └─ Conexiones rápidas
```

Esta fase permite decir "sala" y "desafío" sin fingir todavía temporadas o rankings.

## Fase 3: Temporada mock

Objetivo: preparar la idea de ciclo competitivo sin calcular todavía rankings reales.

Modelo intermedio:

```ts
type Season = {
  id: string;
  title: string;
  status: "active" | "finished";
  challenges: Challenge[];
};

type Room = {
  id: string;
  title: string;
  description: string;
  activeSeason: Season;
};
```

Cambios esperados:

- Una sala pasa a tener una temporada activa.
- Los desafíos se muestran como parte de la temporada.
- No se implementan todavía disponibilidad por fecha ni ranking acumulado.

Resultado:

```text
Sala Demo
└─ Temporada actual
   └─ Desafíos disponibles
```

Esta fase solo debería hacerse cuando la UI ya necesite hablar de temporada.

## Fase 4: Separar definición y publicación

Objetivo: distinguir el contenido reusable del desafío publicado en una temporada.

Modelo objetivo parcial:

```ts
type ChallengeDefinition = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questions: Question[];
};

type ScheduledChallenge = {
  id: string;
  challengeDefinitionId: string;
  seasonId: string;
  availableFrom: string;
  availableUntil: string;
};
```

Cambios esperados:

- `ChallengeDefinition` contiene el contenido jugable.
- `ScheduledChallenge` representa cuándo aparece ese desafío dentro de una temporada.
- La misma definición podría reutilizarse en distintas temporadas o salas.
- El calendario puede seguir siendo mock hasta que haya backend.

Resultado:

```text
Temporada
└─ ScheduledChallenge[]
   └─ ChallengeDefinition
      └─ questions[]
```

Esta fase prepara el modelo de desafío diario o periódico.

## Fase 5: Intentos y rankings

Objetivo: añadir participación individual y clasificación.

Modelo futuro:

```ts
type ChallengeAttempt = {
  id: string;
  playerId: string;
  scheduledChallengeId: string;
  score: number;
  accuracy: number;
  timeUsed: number;
  completedAt: string;
};

type LeaderboardEntry = {
  playerId: string;
  score: number;
};
```

Cambios esperados:

- Registrar un intento por jugador y desafío.
- Calcular ranking del desafío desde los intentos.
- Sumar puntos al ranking de temporada.
- Mantener la primera versión asíncrona.

Resultado:

```text
Desafío publicado
└─ Intentos de jugadores
   └─ Ranking del desafío

Temporada
└─ Ranking acumulado
```

Esta fase requiere jugadores, persistencia o mocks suficientemente ricos.

## Fase 6: Backend y producto real

Objetivo: sustituir mocks por datos persistidos.

Áreas a resolver:

- autenticación;
- creación de salas;
- invitaciones;
- pertenencia a sala;
- creación o inicio de temporadas;
- publicación periódica de desafíos;
- persistencia de intentos;
- cálculo autoritativo de rankings;
- cierre de temporada;
- protección contra repeticiones abusivas o ventajas por conocer el reto.

Esta fase queda fuera de la migración mock inicial.

## Recomendación inmediata

La Fase 1 ya está aplicada. La siguiente migración razonable sería:

```text
challenges -> demoRoom.challenges
mantener questions igual
```

No introducir todavía:

- `Season`;
- `ScheduledChallenge`;
- jugadores;
- leaderboard;
- disponibilidad por fecha;
- backend.

La siguiente versión debería quedar como una sala demo local con desafíos jugables por un solo jugador. Eso incorpora la estructura social mínima sin aumentar innecesariamente la complejidad de la PoC.

## Compatibilidad y nombres

El lenguaje nuevo ya usa:

- `Challenge`;
- `ChallengeSummary`;
- `challenges`;
- `challengeId`;
- "desafío" en UI;
- `/desafios/[challengeId]`.

No se mantiene ruta heredada ni adaptador temporal de `Stage`.

## Criterios de aceptación por fase

- **Fase 1:** aplicada; los datos se llaman desafío y cada desafío declara un modo.
- **Fase 2:** existe una sala mock que contiene los desafíos actuales.
- **Fase 3:** existe una temporada mock solo si la UI necesita mostrarla.
- **Fase 4:** definición y publicación de desafío están separadas.
- **Fase 5:** cada jugador puede tener intentos y rankings derivados.
- **Fase 6:** los mocks pueden reemplazarse por persistencia real.
