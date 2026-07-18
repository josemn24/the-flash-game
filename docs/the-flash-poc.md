# The Flash: estado actual de la PoC

## Propósito

The Flash es una prueba de concepto frontend para validar una experiencia de preguntas rápida, visual y mobile-first. El jugador elige una etapa, responde contra un temporizador, consulta su resultado y puede revisar o repetir la partida.

La pregunta de producto sigue siendo:

> ¿Jugar una etapa de The Flash resulta divertido y fluido como experiencia de aplicación?

## Alcance actual

- Un único jugador y estado de sesión en memoria.
- Dos etapas locales de diez preguntas cada una.
- Veintitrés formatos de pregunta con reglas y puntuación propias.
- Preguntas con texto, ilustraciones locales e imágenes locales.
- Temporizador independiente por pregunta.
- Transición automática después de responder o agotar el tiempo.
- Resultado final, puntuación, precisión, tiempo y desglose de respuestas.
- Biblioteca editorial de formatos con uno o varios ejemplos jugables por ficha.
- Interfaz responsive, accesible y completamente en español.

No existen backend, base de datos, autenticación, usuarios, salas, multijugador, rankings, panel de administración ni persistencia entre sesiones.

## Rutas y flujo

| Ruta                | Responsabilidad                                                 |
| ------------------- | --------------------------------------------------------------- |
| `/`                 | Presentación, selector de etapas y acceso a la biblioteca.      |
| `/etapas/[stageId]` | Validación de la etapa y sesión jugable completa.               |
| `/formatos`         | Catálogo de los veintitrés formatos disponibles.                |
| `/formatos/[slug]`  | Reglas, puntuación, autoría, accesibilidad y ejemplos jugables. |

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
Cada una conserva diez preguntas. Los formatos no incluidos en ellas, como Mini-Wordle, imagen progresivamente revelada y laberinto contrarreloj, están disponibles mediante ejemplos jugables en la biblioteca.

## Formatos implementados

| Formato                  | Interacción                                                         | Evaluación                                                                    |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Elección múltiple        | Tocar una opción para enviarla inmediatamente. Puede incluir media. | Acierto exacto; un fallo resta el 20 %.                                       |
| Encontrar el intruso     | Tocar el elemento que rompe la relación; admite media por elemento. | Acierto exacto; un fallo resta el 20 %.                                       |
| Emparejar conceptos      | Seleccionar una tarjeta de cada columna; admite media por tarjeta.  | Crédito por pareja y velocidad; cada error resta un 10 % de los puntos base.  |
| Verdadero o falso        | Envío inmediato al pulsar una opción.                               | Acierto exacto; un fallo resta el 40 %.                                       |
| Respuesta corta          | Campo de texto y envío por botón o teclado.                         | Ignora mayúsculas, tildes y espacios; admite equivalencias.                   |
| Ordenar                  | Controles para subir y bajar elementos y confirmación final.        | La secuencia completa debe coincidir; un fallo resta el 20 %.                 |
| Clasificar               | Asignar una categoría a cada elemento.                              | Crédito parcial por elemento correctamente clasificado.                       |
| Código lógico            | Introducir un código a partir de pistas, con varios intentos.       | Solo puntúa el código correcto; cada fallo reduce un 10 % de los puntos base. |
| Estimación               | Ajustar un valor dentro de un rango configurable.                   | Crédito por proximidad al valor real.                                         |
| Adivinanzas por pistas   | Revelar pistas de texto o enviar una única respuesta abierta.       | Cada pista reduce el máximo; el acierto se ajusta por velocidad.              |
| Mapa de calor            | Colocar, corregir y confirmar un marcador con puntero o teclado.    | Crédito espacial por zona y distancia, ajustado por velocidad.                |
| Etiquetar imagen         | Etiquetar todas las zonas o identificar una única zona señalada.    | Crédito parcial en múltiple; acierto binario en elección o texto.             |
| Memoria relámpago        | Memorizar y reconstruir la posición de una cuadrícula.              | Crédito por posición correcta y velocidad durante la reconstrucción.          |
| Simon                    | Observar y repetir una secuencia fija de símbolos.                  | Secuencia exacta y velocidad; un fallo termina la ronda.                      |
| Matrices lógicas         | Elegir la pieza que completa una matriz 3 × 3.                      | Acierto exacto; un fallo resta el 20 %.                                       |
| Mini-sudoku              | Completar tres o cuatro casillas de una cuadrícula 4 × 4.           | Crédito por casilla correcta y velocidad.                                     |
| Mini-nonograma           | Completar una cuadrícula 5 × 5 a partir de pistas numéricas.        | Crédito neto por rellenos correctos y erróneos.                               |
| Rompecabezas deslizante  | Desplazar fichas adyacentes hasta resolver un tablero 3 × 3.        | Resolución exacta y velocidad; los movimientos no penalizan.                  |
| Reconstrucción del error | Localizar el primer paso inválido y, opcionalmente, corregirlo.     | 60 % por localizar y 40 % por corregir, ajustado por velocidad.               |
| Anagramas                | Ordenar fichas de letras para formar una palabra.                   | Acierto exacto y velocidad; un fallo no puntúa.                               |
| Mini-Wordle              | Descubrir una palabra de cuatro letras en cuatro intentos.          | Velocidad y penalización del 10 % por intento fallido previo.                 |
| Imagen progresiva        | Identificar una imagen mientras desaparece su desenfoque.           | Acierto binario por velocidad; un fallo o timeout no puntúan.                 |
| Laberinto contrarreloj   | Guiar una ficha por una cuadrícula mediante cruceta o flechas.      | Resolver puntúa por velocidad; los movimientos adicionales no penalizan.      |

En todos los formatos la velocidad ajusta la puntuación. Para un acierto binario de valor `V`, límite `T` y tiempo usado `t`:

```text
points = V × (1 - 0.5 × (t / T))
```

Un acierto conserva entre el 50 % y el 100 % de los puntos. El total final de una etapa nunca baja de cero.

En «Adivinanzas por pistas», la primera pista es gratuita y cada revelación adicional descuenta una cantidad fija antes de aplicar el multiplicador de velocidad. Un fallo o el timeout puntúan cero.

En «Mapa de calor», las coordenadas se normalizan respecto a la fuente original. La zona central conserva toda la precisión; entre esta y la tolerancia máxima el crédito cae linealmente antes de aplicar el multiplicador de velocidad.

En el etiquetado múltiple, cada anclaje correcto aporta la misma fracción del valor base; las etiquetas son únicas y todas las zonas deben completarse antes de confirmar. En la identificación única, una elección correcta o un texto equivalente puntúan de forma binaria y por velocidad: una elección incorrecta resta el 20 %, mientras que el texto incorrecto no penaliza.

En Mini-Wordle, un vocabulario español general se genera offline desde Hunspell y se carga bajo demanda antes de iniciar el cronómetro. La comparación ignora mayúsculas y tildes, conserva la distinción entre `N` y `Ñ`, y gestiona letras repetidas mediante el recuento restante de la solución. Cada pregunta puede declarar adiciones editoriales; el timeout conserva los intentos para la revisión, pero no concede puntos.

En «Imagen progresivamente revelada», el activo debe cargarse antes de iniciar el cronómetro. El desenfoque disminuye automáticamente durante una parte del límite y el jugador dispone de un único intento de texto normalizado. La revisión muestra la imagen nítida, una descripción completa y el porcentaje que se había revelado al responder.

En «Laberinto contrarreloj», cada movimiento ortogonal válido se añade al recorrido y alcanzar la salida termina automáticamente la ronda. Los movimientos adicionales no reducen puntos. El timeout conserva el camino parcial con cero puntos y la revisión lo compara con una ruta mínima calculada mediante BFS.

## Biblioteca de formatos

El catálogo contiene una ficha por formato con:

- descripción y casos de uso;
- situaciones en las que debe evitarse;
- reglas y política de puntuación;
- recomendaciones de autoría;
- consideraciones de accesibilidad;
- tiempo y medios compatibles;
- una o varias preguntas de ejemplo jugables, cada una con un título editorial.

La ficha se renderiza en el servidor y crea una isla `PlayableFormatExample.client.tsx` independiente por ejemplo. Cada isla recibe una única pregunta serializable y abre un diálogo con tres fases:

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
- El número de pistas reveladas se conserva en la sesión o en el ejemplo jugable y se envía al evaluador junto con la respuesta.
- El mapa de calor solo envía una coordenada confirmada; la revisión reutiliza la superficie para superponer selección, objetivo, tolerancia y distancia.
- Etiquetar imagen discrimina entre `assign-all` e `identify-one`. La primera conserva localmente las asociaciones y solo envía el mapa completo al confirmar; la segunda envía inmediatamente la opción elegida o el texto introducido. Ambas revisiones superponen la elección y la solución y mantienen un resumen textual.
- Mini-Wordle descarga una vez el vocabulario versionado, lo reutiliza como `Set` durante la sesión y conserva únicamente los intentos válidos enviados; al resolver, consumir cuatro intentos o agotar el tiempo, el evaluador recibe el historial completo.
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

Los tests actuales cubren la integridad del catálogo de formatos y las reglas de evaluación y puntuación. El build genera estáticamente la portada, la biblioteca, las dos etapas y las veintitrés fichas de formato, incluidas `/formatos/mini-wordle`, `/formatos/imagen-progresiva` y `/formatos/laberinto-contrarreloj`.

## Evolución pendiente

La siguiente evolución no forma parte del alcance actual:

- nuevos formatos y desafíos especiales;
- persistencia de partidas y perfiles;
- contenido administrable;
- backend y validación autoritativa;
- salas, sincronización multijugador y rankings;
- analítica de producto y telemetría.

Las mecánicas candidatas y su priorización se mantienen en `modos-de-juego-futuros.md`.
