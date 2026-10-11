> Estado: vigente. Fuente de terminología compartida entre producto, documentación y código.

# Glosario

## Propósito

Este documento fija los términos recomendados en español e inglés para describir The Flash de forma consistente en producto, documentación y código. La prioridad es evitar ambigüedades entre sala, temporada, desafío, modo, prueba, pregunta y formato.

## Jerarquía recomendada

```text
Juego / Producto
└─ Sala
   └─ Temporada
      └─ Desafío
         ├─ Modo de juego
         └─ Pruebas / Preguntas
            └─ Formato de pregunta
```

Una sala contiene temporadas. Una temporada publica desafíos periódicos. Cada desafío usa un modo de juego y contiene pruebas o preguntas. Cada prueba usa un formato de pregunta.

## Términos principales

| Español                        | Inglés                    | Uso recomendado                                                                                                                                                               |
| ------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Juego / Producto               | Game / Product            | The Flash completo. Evitar usar "juego" para desafíos o partidas concretas cuando pueda generar ambigüedad.                                                                   |
| Sala                           | Room                      | Grupo privado creado por un usuario para invitar amigos y competir juntos.                                                                                                    |
| Temporada                      | Season                    | Ciclo competitivo dentro de una sala, con inicio, fin y ranking acumulado.                                                                                                    |
| Desafío                        | Challenge                 | Evento jugable periódico publicado en una sala durante una temporada.                                                                                                         |
| Modo de juego                  | Game Mode                 | Reglas globales del desafío, como Flash, Supervivencia, Cadena, La Pirámide, Alfabeto, Apuesta de confianza o Respuesta rara.                                                 |
| Prueba                         | Trial / Task              | Unidad jugable individual vista por el usuario. Es más amplia que "pregunta" y cubre puzzles, memoria, laberintos, estimaciones o mapas.                                      |
| Pregunta                       | Question                  | Unidad técnica actual del modelo de datos. También puede usarse cuando la prueba es claramente textual o interrogativa.                                                       |
| Formato de pregunta            | Question Format           | Tipo de interacción de una prueba: elección múltiple, verdadero/falso, ordenar, estimación, mapa de calor, Mini-Wordle, laberinto, etc.                                       |
| Intento                        | Attempt                   | Ejecución competitiva de un jugador sobre una publicación de desafío. Las oportunidades internas de una prueba no crean otro intento competitivo.                             |
| Intento en progreso            | In-progress attempt       | Intento iniciado que todavía no ha terminado. Puede reanudarse mientras conserve ese estado.                                                                                  |
| Sesión controladora            | Controlling session       | Token HttpOnly que autoriza el progreso de un intento. En el MVP solo hay una; una segunda sesión se bloquea y no toma el control.                                            |
| Interacción preparada          | Prepared interaction      | Unidad temporal e intervalo persistidos antes de entregar su payload público. Se considera consumida aunque la respuesta HTTP se pierda.                                      |
| Recuperación                   | Recovery                  | Reanudación autoritativa que reconcilia una respuesta recibida o resuelve la interacción preparada según el modo antes de mostrar contenido nuevo.                            |
| Pase por interrupción          | Recovery-interrupted pass | Cierre auditable de la letra activa de Alfabeto al recuperar; no equivale al pase voluntario ni crea una respuesta final.                                                     |
| Abandono                       | Abandoned                 | Terminación de un intento iniciado antes de llegar al final; consume el intento único y no permite repetirlo.                                                                 |
| Expirado                       | Expired                   | Publicación que termina antes de que el jugador inicie su intento. No equivale a abandono y no produce respuestas ni puntos.                                                  |
| Partida                        | Run / Playthrough         | Sesión completa de un jugador dentro de un desafío. Usar con cuidado para no confundirlo con el desafío publicado para toda la sala.                                          |
| Ranking / Clasificación        | Leaderboard               | Tabla de posiciones. En producto puede usarse "ranking"; en inglés usar `leaderboard`, no `ranking`.                                                                          |
| Ranking del desafío            | Challenge Leaderboard     | Clasificación puntual de un desafío concreto.                                                                                                                                 |
| Ranking de temporada           | Season Leaderboard        | Clasificación acumulada de una temporada.                                                                                                                                     |
| Puntuación                     | Score                     | Puntos obtenidos por un jugador.                                                                                                                                              |
| Puntos                         | Points                    | Unidades numéricas de puntuación.                                                                                                                                             |
| Flash Points                   | Flash Points              | Puntos obtenidos al jugar un desafío y acumulados en el total de la temporada activa de la sala. Es la única puntuación competitiva del producto.                             |
| Flash                          | Flash                     | Nombre del modo actual con un límite por pregunta.                                                                                                                            |
| Contrarreloj                   | Contrarreloj              | Modo independiente pendiente de implementación: pruebas de un mismo formato, dificultad creciente y reloj global; termina por fallo definitivo, tiempo o resolución completa. |
| Oportunidad interna            | Internal opportunity      | Movimiento, intento de palabra o validación permitido dentro de una prueba. No crea otro intento competitivo ni implica necesariamente fallo definitivo.                      |
| Fallo definitivo               | Terminal trial failure    | Resultado terminal de una prueba que finaliza Contrarreloj; su definición concreta depende del formato aprobado.                                                              |
| Reloj global                   | Global timer              | Único presupuesto temporal de la partida, distinto del tiempo por pregunta y de la ventana de publicación.                                                                    |
| Tiempo hasta el último acierto | Time to last success      | Tiempo global desde el inicio hasta el último acierto aceptado; segundo criterio del ranking de Contrarreloj. Con cero aciertos no existe esta métrica.                       |

### Convención visual de Flash Points

`⚡` y “Flash Points” son equivalentes. En interfaces compactas se muestra el número junto al
icono, por ejemplo `680 ⚡`, `+84 ⚡` o `84 ⚡`; no se repite `Flash Points` junto al icono.
El nombre completo se mantiene en títulos explicativos, documentación y etiquetas accesibles.
| Racha | Streak | Secuencia de aciertos consecutivos. |
| Temporizador | Timer | Elemento o sistema que controla el tiempo disponible. |
| Tiempo límite | Time Limit | Duración máxima para responder una prueba o completar un desafío. |
| Precisión | Accuracy | Porcentaje o proporción de respuestas correctas. |
| Progreso | Progress | Avance dentro de una prueba, desafío, temporada o modo. |
| Categoría / Dominio | Domain | Área principal de conocimiento, como matemáticas, geografía, historia o ciencias naturales. |
| Tema | Topic | Subtema relacionado con uno o varios dominios, como aritmética, capitales, astronomía o anatomía humana. |
| Etiqueta | Tag | Metadato de clasificación. Puede cubrir dominios, temas, habilidades cognitivas, operaciones de formato o habilidades prácticas. |
| Habilidad cognitiva | Cognitive Skill | Capacidad mental ejercitada por una prueba, como memoria, razonamiento lógico, pensamiento crítico o resolución de problemas. |
| Habilidad práctica / social | Life Skill | Habilidad aplicada a la vida cotidiana o social, como finanzas personales, comunicación, competencia digital o salud. |

Las reglas editoriales para decidir dominios, temas y etiquetas se documentan en `reglas-etiquetado.md`.

## Convenciones de uso

### Modo vs formato

No mezclar **modo de juego** y **formato de pregunta**.

- **Modo de juego:** define las reglas globales del desafío.
- **Formato de pregunta:** define cómo se responde una prueba concreta.

Ejemplos:

```text
Modo: Cadena
Formato: elección múltiple, ordenar, estimación
```

```text
Modo: Supervivencia
Formato: verdadero/falso, respuesta corta, Mini-Wordle
```

```text
Modo: Contrarreloj (pendiente de implementación)
Formato de todas sus pruebas: Queens
```

Las [reglas de Contrarreloj](domain/contrarreloj.md) describen el nuevo modo. Flash y Contrarreloj
son nombres distintos; un formato como Laberinto contrarreloj conserva su propio nombre.

### Desafío vs partida

No mezclar **desafío** y **partida**.

- **Desafío:** existe para toda la sala.
- **Partida / intento:** ejecución de un jugador.

Ejemplo:

```text
Desafío: Flash - Cultura general
Partida de Ana: 8 aciertos, 84 Flash Points, 58 segundos
```

### Prueba vs pregunta

Usar **prueba** en producto cuando el reto no es necesariamente una pregunta textual.

Ejemplos:

- "Este desafío tiene 10 pruebas."
- "La tercera prueba es un laberinto."
- "La quinta prueba es una pregunta de elección múltiple."

En código puede seguir usándose `Question` si el modelo actual se llama así.

### Ranking vs leaderboard

En español, `ranking` es natural para producto. `Clasificación` puede usarse en documentación más formal. En inglés, usar siempre `leaderboard`.

Ejemplos:

- "Ranking del desafío."
- "Ranking de temporada."
- `challengeLeaderboard`
- `seasonLeaderboard`

El ranking de temporada acumula Flash Points de desafíos de distintos modos dentro de una sala.
El producto no tiene un ranking global entre salas ni un acumulado permanente de sala. En Contrarreloj,
un intento competitivo es toda la partida; las oportunidades internas de una prueba no son nuevas
partidas ni intentos adicionales sobre la publicación.

## Ejemplo completo

```text
Sala: Amigos de la uni
Temporada: Julio
Desafío: Apagón en la ciudad
Modo de juego: Narrativo competitivo
Pruebas: 6
Formatos: mapa de calor, código lógico, estimación, reconstrucción del error
Ranking del desafío: resultado puntual del desafío
Ranking de temporada: suma acumulada de todos los desafíos de julio
```

## Términos a evitar o usar con cuidado

| Término                  | Motivo                                                                                                | Alternativa recomendada                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Juego                    | Puede significar producto completo, desafío, partida o modo.                                          | Producto, desafío, partida o modo según contexto |
| Reto                     | Es comprensible, pero puede solaparse con desafío, prueba o challenge.                                | Desafío para evento de sala; prueba para unidad  |
| Categoría                | Puede confundirse con `domain`, `topic`, categoría de clasificación o categoría visual de una prueba. | Dominio o tema cuando sea taxonomía              |
| Ranking general / global | Puede sugerir una clasificación entre salas o permanente que el producto no ofrece.                   | Ranking de temporada de la sala                  |
| Sala en tiempo real      | Puede sugerir sincronización inmediata, que no es prioridad inicial.                                  | Sala asíncrona                                   |
