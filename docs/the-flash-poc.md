# The Flash: estado actual de la PoC

## Propósito

The Flash es una prueba de concepto frontend para validar una experiencia de preguntas rápida, visual y mobile-first. El jugador elige un desafío, responde contra un temporizador, consulta su resultado y puede revisar o repetir la partida.

La pregunta de producto sigue siendo:

> ¿Jugar un desafío de The Flash resulta divertido y fluido como experiencia de aplicación?

## Alcance actual

- Un único jugador y estado de sesión en memoria.
- Una sala demo local con temporada activa y dos desafíos publicados de diez preguntas cada uno.
- Veinticinco formatos de pregunta con reglas y puntuación propias.
- Preguntas con texto, ilustraciones locales e imágenes locales.
- Temporizador independiente por pregunta.
- Transición automática después de responder o agotar el tiempo.
- Resultado final, puntuación, precisión, tiempo y desglose de respuestas.
- Biblioteca editorial de formatos con uno o varios ejemplos jugables por ficha.
- Interfaz responsive, accesible y completamente en español.

No existen backend, base de datos, autenticación, usuarios, creación de salas, multijugador, rankings, panel de administración ni persistencia entre sesiones.

## Rutas y flujo

| Ruta                      | Responsabilidad                                                 |
| ------------------------- | --------------------------------------------------------------- |
| `/`                       | Presentación, selector de desafíos y acceso a la biblioteca.    |
| `/desafios/[challengeId]` | Validación del desafío y sesión jugable completa.               |
| `/formatos`               | Catálogo de los veinticinco formatos disponibles.               |
| `/formatos/[slug]`        | Reglas, puntuación, autoría, accesibilidad y ejemplos jugables. |

Un desafío recorre estos estados:

```text
intro → playing → transition → playing → results ⇄ review
  ↑                                                │
  └──────────────────────── replay ────────────────┘
```

Durante el desafío no se muestran aciertos, soluciones ni puntos parciales. La respuesta queda bloqueada al enviarse y el timeout avanza automáticamente. El resultado y la explicación solo aparecen al terminar o dentro de un ejemplo jugable de la biblioteca.

## Desafíos disponibles

### Desafío Demo

- Identificador: `demo-challenge`.
- Modo: `flash`.
- Diez preguntas de cultura general.
- Usa elección múltiple, verdadero o falso y respuesta corta.
- Incluye ilustraciones de banderas y astronomía.

### Conexiones rápidas

- Identificador: `connections-challenge`.
- Modo: `flash`.
- Diez preguntas de patrones, cultura, imágenes y lógica.
- Añade ordenar, estimación, código lógico y clasificación.
- Incluye una imagen local de la Torre Eiffel y una ilustración de la bandera italiana.

Ambos desafíos se publican desde `demoRoom.activeSeason.scheduledChallenges`, apuntan a definiciones reutilizables y resuelven sus preguntas desde `questionsById`. La ruta `/desafios/[challengeId]` usa el ID de publicación, no el ID interno de definición, y se prerenderiza mediante `generateStaticParams`.
Cada uno conserva diez preguntas. Los formatos no incluidos en ellos, como Conectar parejas, Memoria de parejas, Mini-Wordle, imagen progresivamente revelada y laberinto contrarreloj, están disponibles mediante ejemplos jugables en la biblioteca.

## Formatos implementados

| Formato                  | Interacción                                                         | Evaluación                                                                       |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Elección múltiple        | Tocar una opción para enviarla inmediatamente. Puede incluir media. | Acierto exacto; un fallo resta el 20 %.                                          |
| Encontrar el intruso     | Tocar el elemento que rompe la relación; admite media por elemento. | Acierto exacto; un fallo resta el 20 %.                                          |
| Emparejar conceptos      | Seleccionar una tarjeta de cada columna; admite media por tarjeta.  | Crédito por pareja y velocidad; cada error resta un 10 % de los puntos base.     |
| Conectar parejas         | Trazar rutas ortogonales entre símbolos iguales en una cuadrícula.  | Crédito por parejas conectadas, cobertura y velocidad; los conflictos invalidan. |
| Verdadero o falso        | Envío inmediato al pulsar una opción.                               | Acierto exacto; un fallo resta el 40 %.                                          |
| Respuesta corta          | Campo de texto y envío por botón o teclado.                         | Ignora mayúsculas, tildes y espacios; admite equivalencias.                      |
| Ordenar                  | Controles para subir y bajar elementos y confirmación final.        | La secuencia completa debe coincidir; un fallo resta el 20 %.                    |
| Clasificar               | Asignar una categoría a cada elemento.                              | Crédito parcial por elemento correctamente clasificado.                          |
| Código lógico            | Introducir un código a partir de pistas, con varios intentos.       | Solo puntúa el código correcto; cada fallo reduce un 10 % de los puntos base.    |
| Estimación               | Ajustar un valor dentro de un rango configurable.                   | Crédito por proximidad al valor real.                                            |
| Adivinanzas por pistas   | Revelar pistas de texto o enviar una única respuesta abierta.       | Cada pista reduce el máximo; el acierto se ajusta por velocidad.                 |
| Mapa de calor            | Colocar, corregir y confirmar un marcador con puntero o teclado.    | Crédito espacial por zona y distancia, ajustado por velocidad.                   |
| Etiquetar imagen         | Etiquetar todas las zonas o identificar una única zona señalada.    | Crédito parcial en múltiple; acierto binario en elección o texto.                |
| Memoria relámpago        | Memorizar y reconstruir la posición de una cuadrícula.              | Crédito por posición correcta y velocidad durante la reconstrucción.             |
| Memoria de parejas       | Revelar losetas ocultas y encontrar parejas recordando posiciones.  | Crédito por pareja encontrada; cada fallo resta el 10 % de los puntos base.      |
| Simon                    | Observar y repetir una secuencia fija de símbolos.                  | Secuencia exacta y velocidad; un fallo termina la ronda.                         |
| Matrices lógicas         | Elegir la pieza que completa una matriz 3 × 3.                      | Acierto exacto; un fallo resta el 20 %.                                          |
| Mini-sudoku              | Completar tres o cuatro casillas de una cuadrícula 4 × 4.           | Crédito por casilla correcta y velocidad.                                        |
| Mini-nonograma           | Completar una cuadrícula 5 × 5 a partir de pistas numéricas.        | Crédito neto por rellenos correctos y erróneos.                                  |
| Rompecabezas deslizante  | Desplazar fichas adyacentes hasta resolver un tablero 3 × 3.        | Resolución exacta y velocidad; los movimientos no penalizan.                     |
| Reconstrucción del error | Localizar el primer paso inválido y, opcionalmente, corregirlo.     | 60 % por localizar y 40 % por corregir, ajustado por velocidad.                  |
| Anagramas                | Ordenar fichas de letras para formar una palabra.                   | Acierto exacto y velocidad; un fallo no puntúa.                                  |
| Mini-Wordle              | Descubrir una palabra de cuatro letras en cuatro intentos.          | Velocidad y penalización del 10 % por intento fallido previo.                    |
| Imagen progresiva        | Identificar una imagen mientras desaparece su desenfoque.           | Acierto binario por velocidad; un fallo o timeout no puntúan.                    |
| Laberinto contrarreloj   | Guiar una ficha por una cuadrícula mediante cruceta o flechas.      | Resolver puntúa por velocidad; los movimientos adicionales no penalizan.         |

Cada desafío tiene un máximo estándar de 100 puntos. La definición del desafío puede declarar una puntuación entera específica para cada pregunta mediante `questionPoints`, usando el ID de cada pregunta. La suma debe ser exactamente 100 para que el máximo del desafío sea comparable entre publicaciones.

Este reparto manual permite ponderar dificultad, duración esperada, riesgo de fallo y formato. Por ejemplo, en un desafío de 10 preguntas puede haber preguntas de 9, 10 u 11 puntos siempre que el total cierre en 100.

Si una definición todavía no declara `questionPoints`, la sesión usa un reparto automático de enteros como fallback editorial:

```text
base = floor(100 / número_de_preguntas)
resto = 100 % número_de_preguntas
```

Las primeras `resto` preguntas valen `base + 1` puntos y el resto valen `base`. Por ejemplo, un desafío de 10 preguntas reparte `10 × 10`; uno de 12 reparte `4 × 9 + 8 × 8`; y uno de 16 reparte `4 × 7 + 12 × 6`. El orden de preguntas de la definición determina qué preguntas reciben el punto extra en ese fallback.

Los `points` declarados en una pregunta siguen sirviendo para ejemplos de la biblioteca y para expresar el valor editorial base del formato. En una partida de desafío, la sesión sustituye ese valor por los puntos enteros del desafío antes de evaluar la respuesta.

En todos los formatos la velocidad ajusta la puntuación. Para un acierto binario de valor `V`, límite `T` y tiempo usado `t`:

```text
points = V × (1 - 0.5 × (t / T))
```

Un acierto conserva entre el 50 % y el 100 % de los puntos de esa pregunta dentro del desafío. El total final de un desafío nunca baja de cero.

En «Adivinanzas por pistas», la primera pista es gratuita y cada revelación adicional descuenta una cantidad fija antes de aplicar el multiplicador de velocidad. Un fallo o el timeout puntúan cero.

En «Mapa de calor», las coordenadas se normalizan respecto a la fuente original. La zona central conserva toda la precisión; entre esta y la tolerancia máxima el crédito cae linealmente antes de aplicar el multiplicador de velocidad.

En el etiquetado múltiple, cada anclaje correcto aporta la misma fracción del valor base; las etiquetas son únicas y todas las zonas deben completarse antes de confirmar. En la identificación única, una elección correcta o un texto equivalente puntúan de forma binaria y por velocidad: una elección incorrecta resta el 20 %, mientras que el texto incorrecto no penaliza.

En Mini-Wordle, un vocabulario español general se genera offline desde Hunspell y se carga bajo demanda antes de iniciar el cronómetro. La comparación ignora mayúsculas y tildes, conserva la distinción entre `N` y `Ñ`, y gestiona letras repetidas mediante el recuento restante de la solución. Cada pregunta puede declarar adiciones editoriales; el timeout conserva los intentos para la revisión, pero no concede puntos.

En «Conectar parejas», el tablero 5 × 5 exige rutas ortogonales sin cruces ni casillas compartidas. La respuesta correcta conecta todas las parejas y cubre las 25 casillas; el progreso válido puede puntuar parcialmente mediante `min(parejas conectadas, cobertura)` ajustado por velocidad. Un timeout conserva las rutas enviadas para la revisión y mantiene crédito parcial si hay progreso real.

En «Memoria de parejas», cada intento revela dos losetas con símbolo, emoji o imagen y etiqueta accesible. Las parejas correctas permanecen visibles, los fallos se ocultan tras una pausa breve y el historial completo se conserva para revisión. El timeout con intentos puede puntuar parcialmente por parejas encontradas; sin intentos queda como sin respuesta.

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

El ejemplo reutiliza `Timer`, `QuestionInput`, `evaluateAnswer` y `QuestionReviewContent`, por lo que aplica las mismas interacciones y reglas que un desafío. La solución permanece oculta hasta responder o agotar el tiempo.

## Arquitectura y datos

- Las páginas, metadata, parámetros, navegación y contenido editorial se resuelven en Server Components.
- La portada lee `demoRoom`, muestra contexto mínimo de sala y temporada, y recibe `ChallengeSummary[]`; nunca necesita las preguntas completas.
- Los desafíos declaran listas ordenadas de IDs y exponen `questions: Question[]` ya resuelto para la UI.
- La ruta de desafío valida el identificador y envía un único `Challenge` a `GameApp.client.tsx`.
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
types/challenge.ts  Challenge, ChallengeSummary y GameMode
types/room.ts       Room, Season y SeasonStatus
data/questions      tabla mock questionsById y agrupaciones editoriales
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

Los tests actuales cubren la integridad del catálogo de formatos y las reglas de evaluación y puntuación. El build genera estáticamente la portada, la biblioteca, los dos desafíos y las veinticinco fichas de formato, incluidas `/formatos/conectar-parejas`, `/formatos/memoria-de-parejas`, `/formatos/mini-wordle`, `/formatos/imagen-progresiva` y `/formatos/laberinto-contrarreloj`.

## Evolución pendiente

La siguiente evolución no forma parte del alcance actual:

- nuevos formatos y desafíos especiales;
- persistencia de partidas y perfiles;
- contenido administrable;
- backend y validación autoritativa;
- salas, sincronización multijugador y rankings;
- analítica de producto y telemetría.

Las mecánicas candidatas y su priorización se mantienen en `modos-de-juego-futuros.md`.
