# 04. Blueprints de pantallas

## Arquitectura objetivo

```text
Lobby
├── Reto de hoy
│   ├── Introducción ligera
│   ├── Preguntas
│   ├── Feedback entre preguntas
│   └── Resultado
├── Actividad de la sala
├── Clasificación de temporada
├── Próximos retos
└── Perfil y progreso
```

El vertical slice implementa únicamente la rama `Reto de hoy` y una representación mínima de actividad y clasificación.

## Flujo del vertical slice

```text
Lobby / reto disponible
→ tocar “Jugar ahora”
→ preparación breve
→ pregunta
→ feedback correcto, incorrecto o timeout
→ siguientes preguntas o resultado
→ celebración + posición social
→ clasificación, revisión o regreso al lobby con estado completado
```

La lógica actual de sesión se conserva. `ChallengeIntro` puede seguir existiendo como fase técnica, pero su presentación se integra visualmente con el reto hero y evita repetir una pantalla llena de reglas.

## Contrato del intento oficial

- Cada reto ofrece un único intento por jugador.
- El intento comienza cuando se presenta la primera pregunta.
- Salir y regresar continúa el mismo estado; nunca reinicia tiempo, respuestas o puntuación.
- Completar fija score, posición y rayos de temporada.
- No existe repetición ni modo práctica.
- Un reto expirado sin resultado se muestra como `No completado`.
- Desarrollo y QA pueden disponer de un reset fuera de la interfaz de producción.

## Pantalla 1: lobby

### Objetivo

Conseguir que una persona entienda qué jugar y sienta la presencia de su sala en menos de cinco segundos.

### Wireframe móvil

```text
┌─────────────────────────────────┐
│ [Avatar] Hola, Javi     Nv.4  🔔│
│ Tabarnia · Día 7                │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ NUEVO         quedan 2 h 14 │ │
│ │                             │ │
│ │   [ilustración Pirámide]    │ │
│ │                             │ │
│ │ La Pirámide                 │ │
│ │ ¿Hasta dónde puedes subir?  │ │
│ │ [A][B][C] +3 ya jugaron     │ │
│ │ Hasta +120 ⚡                │ │
│ │ [      Jugar ahora       ]  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Temporada                 Ver   │
│ 4.º · 1.240 pts    █████░       │
│                                 │
│ Actividad de tu grupo           │
│ [avatar] Ana subió al 1.º puesto│
│                                 │
│ Próximos retos                  │
│ [mini card] [mini card]         │
└─────────────────────────────────┘
```

### Jerarquía

1. Reto disponible y CTA.
2. Personas que ya han jugado.
3. Progreso de temporada.
4. Actividad y próximos retos.

### Contenido inicial demo

- Sala: Tabarnia.
- Temporada: Primera temporada.
- Reto destacado: La Pirámide: Cumbre lógica.
- Mensaje: `¿Hasta dónde puedes subir?`.
- Progreso simulado: nivel 4, `680 / 900 ⚡`.
- Máximo de temporada anunciado: `Hasta +120 ⚡`.
- Participantes simulados: tres avatares y `+3`.
- Posición simulada: `4.º de 8`.

Estos valores deben centralizarse en datos mock y no quedar incrustados en el JSX.

### Comportamiento

- `Jugar ahora` abre una preparación breve.
- Al regresar tras completar, la tarjeta muestra score, posición y `Ver resultado`.
- Los módulos no funcionales del slice no aparentan ser interactivos.
- Los retos cerrados dejan de ocupar el feed principal; se agrupan en historial.

### Criterios de aceptación

- CTA visible sin scroll en 390 × 844 px.
- Solo existe un CTA primario en el primer viewport.
- Se entiende que Tabarnia contiene personas, aunque los datos sean demo.
- El estado del reto se reconoce sin leer la descripción.
- Ningún texto esencial usa `Ink muted` sobre un color que incumpla AA.

## Preparación breve

No se diseña como una cuarta pantalla protagonista. Es un panel o transición de una sola decisión.

Contenido:

- Nombre de modalidad.
- Regla diferencial en una frase.
- Tiempo aproximado.
- Máximo de rayos de temporada.
- Aviso `Tienes un único intento`.
- CTA `Empezar intento`.

Para Pirámide:

```text
Sube todo lo que puedas.
Un fallo termina el ascenso.
7 niveles · ≈ 2 min · Hasta +120 ⚡
Tienes un único intento.
```

Las reglas secundarias se abren desde `Cómo se juega`.

## Pantalla 2: pregunta

### Objetivo

Concentrar la atención, comunicar el tiempo disponible y hacer que responder resulte físico y satisfactorio.

### Wireframe móvil

```text
┌─────────────────────────────────┐
│ ←  La Pirámide         [00:11]  │
│ Nivel 1 de 7       ━━━●━━━━     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [personaje/objeto pequeño]  │ │
│ │                             │ │
│ │ ¿Qué número rompe           │ │
│ │ el patrón?                  │ │
│ │                             │ │
│ │ [      9     ] [    16    ] │ │
│ │ [     25     ] [    27    ] │ │
│ │ [           36            ] │ │
│ └─────────────────────────────┘ │
│                         [?]     │
└─────────────────────────────────┘
```

### Decisiones

- La lista completa de niveles no se muestra encima de la pregunta.
- El progreso se resume en un rail compacto.
- La pregunta vive en una superficie clara diferenciada del canvas.
- Cinco respuestas usan la última opción a ancho completo.
- El timer es una cápsula legible, no un aro decorativo aislado.
- La ilustración es pequeña durante la pregunta para no competir con el contenido.

### Estados

#### Esperando respuesta

- Tiles elevados.
- Timer normal.
- Ayuda visible solo si el formato la admite.

#### Respuesta seleccionada

- El tile desciende y marca selección.
- La entrada se bloquea mientras se calcula el resultado.

#### Correcta

- Tile Aqua con check.
- Texto `¡Bien visto!`.
- Puntos obtenidos vuelan hacia el contador.
- Duración objetivo: 900–1200 ms antes de continuar.

#### Incorrecta

- Selección Coral con cruz.
- Respuesta correcta Aqua.
- Copy específico: `Casi. 27 no es un cuadrado perfecto.`
- Duración objetivo: 1400–1800 ms para poder comprender la solución.

#### Timeout

- Timer Coral.
- Respuesta correcta revelada.
- Copy `¡Se escapó por poco!`.
- No se usa un mensaje culpabilizador.

### Criterios de aceptación

- Pregunta, timer y todas las respuestas cortas caben en 390 × 844 px.
- El jugador puede identificar el resultado sin color ni sonido.
- No hay layout shift al marcar una respuesta.
- El feedback permanece el tiempo suficiente para leer la explicación.
- El formato sigue siendo operable con teclado.

## Feedback entre preguntas

La pantalla de transición actual se sustituye en el slice por feedback contextual dentro de la pregunta. Solo se usa transición a pantalla completa cuando:

- Se completa un hito.
- Se pierde la última vida.
- Se desbloquea una recompensa.
- Termina el desafío.

Esto evita que cada respuesta rompa la continuidad del tablero.

## Pantalla 3: resultado

### Objetivo

Celebrar, contextualizar el resultado socialmente y ofrecer una siguiente acción clara.

### Wireframe móvil

```text
┌─────────────────────────────────┐
│ Reto completado                 │
│                                 │
│       [confeti + corona]        │
│             84                  │
│           puntos               │
│                                 │
│      ¡Has quedado 2.º!          │
│      ↑ Superaste a Marta        │
│                                 │
│ [A 91] [TÚ 84] [M 76]          │
│                                 │
│ +96 ⚡ de temporada · Nivel 4   │
│                                 │
│ [      Ver clasificación     ]  │
│ [      Revisar respuestas    ]  │
│                                 │
│ Precisión · Tiempo · Detalle ↓  │
└─────────────────────────────────┘
```

### Jerarquía

1. Celebración y puntuación.
2. Posición relativa.
3. Rayos y progreso de temporada.
4. Próxima acción.
5. Estadísticas detalladas.

### Estados de mensaje

| Situación           | Título                  | Apoyo                            |
| ------------------- | ----------------------- | -------------------------------- |
| Top 1               | ¡Te has puesto primero! | Aventajas a Ana por 12 puntos    |
| Hito de temporada   | ¡Nivel de temporada!    | Has desbloqueado un nuevo marco  |
| Buen resultado      | ¡Sprint completado!     | Has quedado 4.º de 8             |
| Resultado bajo      | Reto completado         | Mañana tendrás una nueva ocasión |
| Pirámide incompleta | Llegaste al nivel 5     | Estuviste a dos pasos de la cima |

### Acciones

- Primaria: `Ver clasificación`.
- Secundaria: `Revisar respuestas`.
- Terciaria o navegación: `Volver al lobby`.
- No aparece ninguna acción de repetición o práctica.

### Criterios de aceptación

- Posición, score y rayos de temporada visibles sin scroll.
- Existe una comparación humana concreta, no solo porcentaje.
- La celebración se completa en menos de 2.5 s y no bloquea las acciones.
- Con reducción de movimiento, el resultado aparece sin pérdida de información.
- Las estadísticas actuales siguen disponibles bajo la zona hero.
- Regresar al reto completado abre su resultado, no una nueva partida.

## Escritorio

- Lobby: hero en dos columnas, módulos secundarios en grid.
- Pregunta: tablero de máximo 760 px centrado; arte decorativo lateral opcional.
- Resultado: celebración a la izquierda, ranking y detalle a la derecha.
- El primer viewport conserva la misma jerarquía que móvil.

## Datos necesarios

El slice añade un adaptador de presentación con datos simulados:

```ts
type LobbyPlayer = {
  id: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  color: string;
};

type LobbyChallengeSocialState = {
  participantIds: string[];
  playerScore?: number;
  playerRank?: number;
  totalPlayers: number;
  seasonXp: { current: number; nextLevelAt: number; maxEarnable: number };
  attemptStatus: "available" | "inProgress" | "completed" | "notCompleted";
};
```

No se modifican todavía los tipos canónicos de desafío si esta información solo pertenece a la demo. El adaptador debe poder sustituirse por datos reales posteriormente.

## Métricas de validación cualitativa

Durante la prueba se registrará:

- Tiempo hasta identificar el CTA.
- Primera descripción espontánea del producto.
- Comprensión de la presencia social.
- Comprensión de estados de respuesta.
- Elemento recordado del resultado.
- Intención declarada de comparar, compartir o volver al siguiente reto.

Estas métricas solo validan comprensión y percepción inicial. El deseo de retorno, la confianza en la clasificación y el valor emocional de competir se miden posteriormente con grupos y resultados reales.
