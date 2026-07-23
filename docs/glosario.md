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

| Español                     | Inglés                | Uso recomendado                                                                                                                          |
| --------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Juego / Producto            | Game / Product        | The Flash completo. Evitar usar "juego" para desafíos o partidas concretas cuando pueda generar ambigüedad.                              |
| Sala                        | Room                  | Grupo privado creado por un usuario para invitar amigos y competir juntos.                                                               |
| Temporada                   | Season                | Ciclo competitivo dentro de una sala, con inicio, fin y ranking acumulado.                                                               |
| Desafío                     | Challenge             | Evento jugable periódico publicado en una sala durante una temporada.                                                                    |
| Modo de juego               | Game Mode             | Reglas globales del desafío, como Flash, Supervivencia, Cadena, Apuesta de confianza, Predicción o Narrativo competitivo.                |
| Prueba                      | Trial / Task          | Unidad jugable individual vista por el usuario. Es más amplia que "pregunta" y cubre puzzles, memoria, laberintos, estimaciones o mapas. |
| Pregunta                    | Question              | Unidad técnica actual del modelo de datos. También puede usarse cuando la prueba es claramente textual o interrogativa.                  |
| Formato de pregunta         | Question Format       | Tipo de interacción de una prueba: elección múltiple, verdadero/falso, ordenar, estimación, mapa de calor, Mini-Wordle, laberinto, etc.  |
| Intento                     | Attempt               | Ejecución de un jugador sobre un desafío o una prueba. Útil para rankings y resultados.                                                  |
| Partida                     | Run / Playthrough     | Sesión completa de un jugador dentro de un desafío. Usar con cuidado para no confundirlo con el desafío publicado para toda la sala.     |
| Ranking / Clasificación     | Leaderboard           | Tabla de posiciones. En producto puede usarse "ranking"; en inglés usar `leaderboard`, no `ranking`.                                     |
| Ranking del desafío         | Challenge Leaderboard | Clasificación puntual de un desafío concreto.                                                                                            |
| Ranking de temporada        | Season Leaderboard    | Clasificación acumulada de una temporada.                                                                                                |
| Puntuación                  | Score                 | Puntos obtenidos por un jugador.                                                                                                         |
| Puntos                      | Points                | Unidades numéricas de puntuación.                                                                                                        |
| Racha                       | Streak                | Secuencia de aciertos consecutivos.                                                                                                      |
| Temporizador                | Timer                 | Elemento o sistema que controla el tiempo disponible.                                                                                    |
| Tiempo límite               | Time Limit            | Duración máxima para responder una prueba o completar un desafío.                                                                        |
| Precisión                   | Accuracy              | Porcentaje o proporción de respuestas correctas.                                                                                         |
| Progreso                    | Progress              | Avance dentro de una prueba, desafío, temporada o modo.                                                                                  |
| Categoría / Dominio         | Domain                | Área principal de conocimiento, como matemáticas, geografía, historia o ciencias naturales.                                              |
| Tema                        | Topic                 | Subtema relacionado con uno o varios dominios, como aritmética, capitales, astronomía o anatomía humana.                                 |
| Etiqueta                    | Tag                   | Metadato de clasificación. Puede cubrir dominios, temas, habilidades cognitivas, operaciones de formato o habilidades prácticas.         |
| Habilidad cognitiva         | Cognitive Skill       | Capacidad mental ejercitada por una prueba, como memoria, razonamiento lógico, pensamiento crítico o resolución de problemas.            |
| Habilidad práctica / social | Life Skill            | Habilidad aplicada a la vida cotidiana o social, como finanzas personales, comunicación, competencia digital o salud.                    |

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

### Desafío vs partida

No mezclar **desafío** y **partida**.

- **Desafío:** existe para toda la sala.
- **Partida / intento:** ejecución de un jugador.

Ejemplo:

```text
Desafío: Flash - Cultura general
Partida de Ana: 8 aciertos, 1.240 puntos, 58 segundos
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

| Término             | Motivo                                                                                                | Alternativa recomendada                          |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Juego               | Puede significar producto completo, desafío, partida o modo.                                          | Producto, desafío, partida o modo según contexto |
| Reto                | Es comprensible, pero puede solaparse con desafío, prueba o challenge.                                | Desafío para evento de sala; prueba para unidad  |
| Categoría           | Puede confundirse con `domain`, `topic`, categoría de clasificación o categoría visual de una prueba. | Dominio o tema cuando sea taxonomía              |
| Ranking general     | Puede referirse a toda la app o a una sala.                                                           | Ranking de temporada o ranking global            |
| Sala en tiempo real | Puede sugerir sincronización inmediata, que no es prioridad inicial.                                  | Sala asíncrona                                   |
