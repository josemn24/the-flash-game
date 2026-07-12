# The Flash: estado actual de la PoC

## Propósito

The Flash es una prueba de concepto frontend para validar una experiencia de preguntas rápida, visual y mobile-first. El jugador elige una etapa, responde contra un temporizador, consulta su resultado y puede revisar o repetir la partida.

La pregunta de producto sigue siendo:

> ¿Jugar una etapa de The Flash resulta divertido y fluido como experiencia de aplicación?

## Alcance actual

- Un único jugador y estado de sesión en memoria.
- Dos etapas locales de diez preguntas cada una.
- Ocho formatos de pregunta con reglas y puntuación propias.
- Preguntas con texto, ilustraciones locales e imágenes locales.
- Temporizador independiente por pregunta.
- Transición automática después de responder o agotar el tiempo.
- Resultado final, puntuación, precisión, tiempo y desglose de respuestas.
- Biblioteca editorial de formatos con un ejemplo jugable por ficha.
- Interfaz responsive, accesible y completamente en español.

No existen backend, base de datos, autenticación, usuarios, salas, multijugador, rankings, panel de administración ni persistencia entre sesiones.

## Rutas y flujo

| Ruta                | Responsabilidad                                               |
| ------------------- | ------------------------------------------------------------- |
| `/`                 | Presentación, selector de etapas y acceso a la biblioteca.    |
| `/etapas/[stageId]` | Validación de la etapa y sesión jugable completa.             |
| `/formatos`         | Catálogo de los ocho formatos disponibles.                    |
| `/formatos/[slug]`  | Reglas, puntuación, autoría, accesibilidad y ejemplo jugable. |

Una etapa recorre estos estados:

```text
intro → playing → transition → playing → results ⇄ review
  ↑                                                │
  └──────────────────────── replay ────────────────┘
```

Durante la etapa no se muestran aciertos, soluciones ni puntos parciales. La respuesta queda bloqueada al enviarse y el timeout avanza automáticamente. El resultado y la explicación solo aparecen al terminar o dentro de un ejemplo jugable de la biblioteca.

## Etapas disponibles

### Etapa Demo

- Identificador: `demo-stage`.
- Diez preguntas de cultura general.
- Usa elección múltiple, verdadero o falso y respuesta corta.
- Incluye ilustraciones de banderas y astronomía.

### Conexiones rápidas

- Identificador: `connections-stage`.
- Diez preguntas de patrones, cultura, imágenes y lógica.
- Añade ordenar, estimación, código lógico y clasificación.
- Incluye una imagen local de la Torre Eiffel y una ilustración de la bandera italiana.

Ambas etapas se definen como datos TypeScript locales y se prerenderizan mediante `generateStaticParams`.
Cada una conserva diez preguntas y todavía no utiliza el formato «Encontrar el intruso».

## Formatos implementados

| Formato              | Interacción                                                         | Evaluación                                                                    |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Elección múltiple    | Tocar una opción para enviarla inmediatamente. Puede incluir media. | Acierto exacto; un fallo resta el 20 %.                                       |
| Encontrar el intruso | Tocar el elemento que rompe la relación; admite media por elemento. | Acierto exacto; un fallo resta el 20 %.                                       |
| Verdadero o falso    | Envío inmediato al pulsar una opción.                               | Acierto exacto; un fallo resta el 40 %.                                       |
| Respuesta corta      | Campo de texto y envío por botón o teclado.                         | Ignora mayúsculas, tildes y espacios; admite equivalencias.                   |
| Ordenar              | Controles para subir y bajar elementos y confirmación final.        | La secuencia completa debe coincidir; un fallo resta el 20 %.                 |
| Clasificar           | Asignar una categoría a cada elemento.                              | Crédito parcial por elemento correctamente clasificado.                       |
| Código lógico        | Introducir un código a partir de pistas, con varios intentos.       | Solo puntúa el código correcto; cada fallo reduce un 10 % de los puntos base. |
| Estimación           | Ajustar un valor dentro de un rango configurable.                   | Crédito por proximidad al valor real.                                         |

En todos los formatos la velocidad ajusta la puntuación. Para un acierto binario de valor `V`, límite `T` y tiempo usado `t`:

```text
points = V × (1 - 0.5 × (t / T))
```

Un acierto conserva entre el 50 % y el 100 % de los puntos. El total final de una etapa nunca baja de cero.

## Biblioteca de formatos

El catálogo contiene una ficha por formato con:

- descripción y casos de uso;
- situaciones en las que debe evitarse;
- reglas y política de puntuación;
- recomendaciones de autoría;
- consideraciones de accesibilidad;
- tiempo y medios compatibles;
- una pregunta de ejemplo jugable.

La ficha se renderiza en el servidor. `PlayableFormatExample.client.tsx` es una isla cliente que recibe una única pregunta serializable y abre un diálogo con tres fases:

```text
ready → playing → feedback
          ↑          │
          └── retry ─┘
```

El ejemplo reutiliza `Timer`, `QuestionInput`, `evaluateAnswer` y `QuestionReviewContent`, por lo que aplica las mismas interacciones y reglas que una etapa. La solución permanece oculta hasta responder o agotar el tiempo.

## Arquitectura y datos

- Las páginas, metadata, parámetros, navegación y contenido editorial se resuelven en Server Components.
- La portada recibe `StageSummary[]`; nunca necesita las preguntas completas.
- La ruta de etapa valida el identificador y envía una única `Stage` a `GameApp.client.tsx`.
- La sesión jugable mantiene reducer, tiempos, respuestas, resultados y transiciones en el cliente.
- Los componentes universales como `Badge`, `Logo`, `AppHeader` y `Button` pueden utilizarse desde ambos grafos.
- `MotionButton.client.tsx` contiene la mejora animada de la primitiva universal.
- Motion respeta la preferencia del sistema mediante `MotionConfig reducedMotion="user"`; las decoraciones sencillas utilizan CSS.

Los tipos principales están separados por dominio:

```text
types/question.ts   preguntas, media y respuestas
types/result.ts     resultados y detalles específicos
types/session.ts    fases de la partida
types/stage.ts      Stage y StageSummary
types/game.ts       exportaciones públicas del dominio
```

Consulta `server-client-architecture.md` para las reglas completas de límites y dependencias.

## Tecnología

- Next.js 16 con App Router y Turbopack.
- React 19 y TypeScript estricto.
- Tailwind CSS 4 y CSS Modules.
- Motion 12 para transiciones e interacción coordinada.
- Vitest para tests unitarios.

No se necesita ninguna variable de entorno ni servicio externo.

## Ejecución y calidad

```bash
npm install
npm run dev
```

Comprobaciones disponibles:

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Los tests actuales cubren la integridad del catálogo de formatos y las reglas de evaluación y puntuación. El build genera estáticamente la portada, la biblioteca, las dos etapas y las ocho fichas de formato, incluida `/formatos/encontrar-el-intruso`.

## Evolución pendiente

La siguiente evolución no forma parte del alcance actual:

- nuevos formatos y desafíos especiales;
- persistencia de partidas y perfiles;
- contenido administrable;
- backend y validación autoritativa;
- salas, sincronización multijugador y rankings;
- analítica de producto y telemetría.

Las mecánicas candidatas y su priorización se mantienen en `modos-de-juego-futuros.md`.
