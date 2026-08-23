# Desafío 6: La Biblia y las religiones abrahámicas

## Estado del documento

Documento de diseño editorial. Las pruebas se definirán una a una antes de incorporarlas a los datos jugables.

## Concepto general

Desafío de tipo **La Pirámide** dedicado a la Biblia y a las religiones abrahámicas: judaísmo, cristianismo e islam.

La experiencia debe combinar conocimiento bíblico, personajes, lugares, textos, acontecimientos y conceptos compartidos por estas tradiciones. Cuando una figura o un relato tenga un significado diferente según la tradición, la pregunta debe indicarlo expresamente.

La Pirámide tendrá siete niveles con dificultad creciente. Un nivel solo se considera superado cuando la prueba se completa correctamente.

## Pruebas

| Nivel | Formato               | Tema                                                | Estado                    |
| ----- | --------------------- | --------------------------------------------------- | ------------------------- |
| 1     | Emparejamiento        | Personajes y asociaciones bíblicas                  | Definida provisionalmente |
| 2     | Adivinanza por pistas | Patriarca compartido por las religiones abrahámicas | Definida provisionalmente |
| 3     | Ordenación            | Los cinco libros de la Torá                         | Definida provisionalmente |
| 4     | Mini-Wordle           | Personaje bíblico: Josué                            | Definida provisionalmente |
| 5     | Sopa de letras        | Personajes bíblicos                                 | Definida provisionalmente |
| 6     | Clasificación         | El mapa de las tres tradiciones                     | Definida provisionalmente |
| 7     | Hashtag               | Personaje, lugar, texto y elemento religioso — Cima | Definida provisionalmente |

## Prueba 1 — Emparejamiento: personajes y asociaciones bíblicas

### Objetivo

Relacionar cuatro personajes bíblicos con la asociación más conocida de cada uno. La prueba debe servir como introducción sencilla al desafío y a la mecánica de Emparejamiento.

### Configuración editorial

- **Formato:** Emparejamiento.
- **Pregunta:** «Relaciona cada personaje bíblico con su asociación más conocida».
- **Parejas:** cuatro.
- **Tiempo límite propuesto:** 15 segundos.
- **Puntuación provisional:** 7 puntos como primer nivel.
- **Dificultad:** fácil.
- **Condición de éxito:** completar las cuatro parejas para superar el nivel.

| Personaje | Asociación |
| --------- | ---------- |
| Noé       | Arca       |
| Moisés    | Éxodo      |
| David     | Goliat     |
| Jesús     | Nazaret    |

### Criterio editorial

Las relaciones no tienen que ser del mismo tipo: pueden referirse a un objeto, un relato, un personaje relacionado o un lugar. La pregunta debe presentar la idea de «asociación más conocida» para que el conjunto sea coherente.

Se han elegido asociaciones muy reconocibles y se ha evitado incluir varias respuestas posibles para un mismo personaje. Por ejemplo, Moisés podría relacionarse también con Sinaí o los Diez Mandamientos, pero solo aparece `Éxodo` en esta prueba.

### Reglas dentro de la Pirámide

- Las cuatro tarjetas de personajes y las cuatro asociaciones se muestran mezcladas.
- Al seleccionar una pareja correcta, ambas tarjetas quedan bloqueadas.
- Una pareja incorrecta se libera para poder volver a intentarlo.
- El nivel solo se supera al completar las cuatro parejas.
- Un timeout o una respuesta incompleta hacen fallar el nivel y bloquean la subida al siguiente peldaño.
- La puntuación se ajusta por velocidad y conserva la penalización vigente por intentos incorrectos.

### Configuración técnica validada

```ts
{
  id: "abrahamic-matching-biblical-associations",
  type: "matching",
  category: "Biblia y religiones abrahámicas",
  question: "Relaciona cada personaje bíblico con su asociación más conocida.",
  leftItems: [
    { id: "noe", label: "Noé", correctMatchId: "arca" },
    { id: "moises", label: "Moisés", correctMatchId: "exodo" },
    { id: "david", label: "David", correctMatchId: "goliat" },
    { id: "jesus", label: "Jesús", correctMatchId: "nazaret" },
  ],
  rightItems: [
    { id: "goliat", label: "Goliat" },
    { id: "arca", label: "Arca" },
    { id: "nazaret", label: "Nazaret" },
    { id: "exodo", label: "Éxodo" },
  ],
  timeLimit: 15,
  points: 7,
}
```

## Prueba 2 — Adivinanza por pistas: Abraham

### Objetivo

Identificar a un personaje a partir de cuatro pistas que aparecen progresivamente. La respuesta principal es **Abraham**, una figura común a las tradiciones judía, cristiana e islámica.

### Configuración editorial

- **Formato:** Adivinanza por pistas.
- **Pregunta:** «¿Qué personaje bíblico soy?».
- **Respuesta principal:** `Abraham`.
- **Respuesta alternativa aceptada:** `Ibrahim`, nombre utilizado en la tradición islámica.
- **Número de pistas:** cuatro.
- **Tiempo límite propuesto:** 35 segundos.
- **Puntuación provisional:** 9 puntos como segundo nivel.
- **Penalización por pista:** 20 % de los puntos base por cada pista adicional que se revele.
- **Dificultad:** fácil-media.
- **Condición de éxito:** acertar en un único intento para superar el nivel.

### Secuencia de pistas

Las pistas deben mostrarse en este orden, desde la referencia más amplia hasta la identificación más clara:

1. «Mi historia aparece tanto en la Biblia como en el Corán.»
2. «Soy considerado un patriarca y una figura de referencia para varias tradiciones.»
3. «Dios estableció conmigo una alianza y me prometió una gran descendencia.»
4. «En la tradición islámica también se me conoce como Ibrahim.»

La cuarta pista no debe ser necesaria para un jugador con conocimientos básicos, pero permite resolver la prueba sin depender exclusivamente de la memoria del nombre bíblico.

### Criterio editorial

Abraham es una elección adecuada para una prueba temprana porque introduce el elemento común entre las tres religiones abrahámicas sin exigir conocer una cronología concreta. La forma `Ibrahim` debe aceptarse como respuesta equivalente para evitar que la prueba penalice al jugador por utilizar la denominación islámica.

La respuesta se escribirá sin necesidad de acento y se comparará con normalización de mayúsculas, espacios y variantes aceptadas.

### Reglas dentro de la Pirámide

- El jugador puede solicitar o recibir las pistas progresivamente, según la interacción actual del formato.
- Solo dispone de un intento de respuesta.
- Una respuesta incorrecta o el timeout hacen fallar el nivel.
- Resolver con menos pistas conserva más puntos.
- Al acertar, se desbloquea el tercer nivel.

### Configuración técnica orientativa

```ts
{
  id: "abrahamic-progressive-abraham",
  type: "progressive-clues",
  category: "Biblia y religiones abrahámicas",
  question: "¿Qué personaje bíblico soy?",
  clues: [
    "Mi historia aparece tanto en la Biblia como en el Corán.",
    "Soy considerado un patriarca y una figura de referencia para varias tradiciones.",
    "Dios estableció conmigo una alianza y me prometió una gran descendencia.",
    "En la tradición islámica también se me conoce como Ibrahim.",
  ],
  cluePenalty: 20,
  correctAnswer: "Abraham",
  acceptedAnswers: ["Abraham", "Ibrahim"],
  timeLimit: 35,
  points: 9,
}
```

## Prueba 3 — Ordenación: los cinco libros de la Torá

### Objetivo

Ordenar los cinco libros que forman la Torá, también llamada Pentateuco, según su orden tradicional:

1. Génesis
2. Éxodo
3. Levítico
4. Números
5. Deuteronomio

### Configuración editorial

- **Formato:** Ordenación.
- **Pregunta:** «Ordena los cinco libros de la Torá según su orden tradicional».
- **Elementos:** cinco.
- **Tiempo límite propuesto:** 30 segundos.
- **Puntuación provisional:** 11 puntos como tercer nivel.
- **Dificultad:** fácil-media.
- **Condición de éxito:** colocar correctamente los cinco libros para superar el nivel.

### Criterio editorial

Esta prueba introduce una estructura fundamental de la tradición judía y conecta directamente con la Biblia. Es adecuada para el tercer nivel porque exige recordar una secuencia, pero no depende de fechas ni de interpretaciones teológicas.

La pregunta debe utilizar la expresión «orden tradicional» para dejar claro que se pide la secuencia de los libros y no el orden en el que fueron escritos históricamente.

### Reglas dentro de la Pirámide

- Los cinco libros se muestran inicialmente desordenados.
- El jugador puede moverlos hasta construir la secuencia completa.
- La respuesta se confirma una sola vez.
- El nivel solo se supera si los cinco elementos están en el orden correcto.
- Un orden incorrecto o el timeout hacen fallar el nivel.

### Configuración técnica orientativa

```ts
{
  id: "abrahamic-order-torah-books",
  type: "ordering",
  category: "Biblia y religiones abrahámicas",
  question: "Ordena los cinco libros de la Torá según su orden tradicional.",
  items: ["Números", "Génesis", "Deuteronomio", "Éxodo", "Levítico"],
  correctOrder: ["Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio"],
  directionLabels: { start: "Primero", end: "Último" },
  timeLimit: 30,
  points: 11,
}
```

## Prueba 4 — Mini-Wordle: Josué

### Objetivo

Descubrir el nombre de un personaje bíblico de cinco letras utilizando el feedback de letras correctas, presentes y ausentes.

### Configuración editorial

- **Formato:** Mini-Wordle.
- **Respuesta:** `JOSUÉ`.
- **Respuesta normalizada:** `JOSUE`.
- **Longitud:** cinco letras.
- **Intentos máximos:** seis.
- **Tiempo límite propuesto:** 55 segundos.
- **Puntuación provisional:** 14 puntos si ocupa el cuarto nivel de la Pirámide.
- **Penalización:** 10 % de los puntos base por cada intento fallido anterior, manteniendo la política actual del formato.
- **Resultado:** si no se descubre la palabra en seis intentos o antes del tiempo límite, el nivel se considera fallido y no se desbloquea el siguiente.

### Normalización

El jugador no debe necesitar escribir la tilde. Estas entradas deben producir la misma solución:

- `JOSUE`
- `JOSUÉ`
- `josue`
- `josué`

La normalización debe conservar `Ñ` como letra distinta, eliminar tildes y comparar el resto en mayúsculas, igual que el comportamiento previsto para el Mini-Wordle en español.

### Palabras válidas para los intentos

La lista general de intentos debe aceptar cualquier palabra española válida de cinco letras. No conviene limitar los intentos a vocabulario religioso: el jugador debe poder utilizar palabras comunes para deducir las letras.

Además, se recomienda incluir una lista editorial de términos temáticos que podrían no estar en el diccionario general:

```text
ANGEL  ALTAR  AYUNO  BABEL  BELEN  CORAN  CREDO  CULTO
DAVID  ESTER  ISLAM  ISAAC  JESUS  JONAS  JUDEA  LUCAS
MARIA  MATEO  PABLO  PACTO  PEDRO  PESAJ  REZAR  SALMO
SAULO  SANTO  SINAI  TORAH
```

La solución `JOSUE` debe añadirse siempre a las palabras aceptadas, aunque el diccionario general no incluya nombres propios.

### Motivos para elegir JOSUÉ

- Tiene cinco letras exactas.
- No repite ninguna letra, por lo que el feedback es fácil de interpretar.
- Es una figura central del relato bíblico y su relación con Moisés aporta un contexto reconocible.
- Permite introducir el judaísmo y el Antiguo Testamento sin que la respuesta sea excesivamente obvia.
- La tilde ofrece una prueba útil para comprobar la normalización del vocabulario español.

### Dificultad y posición en la Pirámide

Se propone colocarlo en el cuarto nivel. Con seis intentos, cinco letras y un nombre propio, la prueba ofrece dificultad suficiente sin convertirse en una apuesta de azar.

Cuatro intentos serían demasiado exigentes para un nombre propio. Cinco podrían funcionar, pero seis proporciona una experiencia más cercana al Wordle convencional y compensa la posible ausencia de `JOSUE` en el vocabulario habitual del jugador.

### Configuración técnica orientativa

```ts
{
  id: "abrahamic-mini-wordle-josue",
  type: "mini-wordle",
  category: "Biblia y religiones abrahámicas",
  question: "Descubre un personaje bíblico de cinco letras.",
  correctAnswer: "JOSUÉ",
  additionalGuesses: [
    "ANGEL", "ALTAR", "AYUNO", "BABEL", "BELEN", "CORAN", "CREDO", "CULTO",
    "DAVID", "ESTER", "ISLAM", "ISAAC", "JESUS", "JONAS", "JUDEA", "LUCAS",
    "MARIA", "MATEO", "PABLO", "PACTO", "PEDRO", "PESAJ", "REZAR", "SALMO",
    "SAULO", "SANTO", "SINAI", "TORAH",
  ],
  timeLimit: 55,
  points: 14,
}
```

Los valores de `points` y la posición del nivel quedan sujetos al orden definitivo de las siete pruebas.

### Pendientes de implementación

- Adaptar el Mini-Wordle actual de cuatro a cinco letras.
- Generar o incorporar el diccionario español de cinco letras.
- Cambiar el número máximo de intentos de cuatro a seis, o hacer ambos valores configurables por pregunta.
- Añadir pruebas de validación para tildes, nombres propios, palabras temáticas y letras repetidas.
- Confirmar la posición final de esta prueba y su puntuación dentro de los 100 puntos de la Pirámide.

## Prueba 5 — Sopa de letras: personajes bíblicos

### Objetivo

Encontrar seis personajes bíblicos ocultos en una cuadrícula de letras. La lista de objetivos permanece visible y el nivel solo se supera cuando se localizan las seis palabras.

### Configuración editorial

- **Formato:** Sopa de letras.
- **Pregunta:** «Encuentra los seis personajes bíblicos ocultos en la cuadrícula».
- **Personajes:** Isaac, Jacob, Ester, Jesús, Judas y Pedro.
- **Palabras objetivo normalizadas:** `ISAAC`, `JACOB`, `ESTER`, `JESUS`, `JUDAS`, `PEDRO`.
- **Cuadrícula propuesta:** 8 × 8.
- **Direcciones:** horizontal, vertical y diagonal, incluyendo algunas palabras invertidas.
- **Tiempo límite propuesto:** 45 segundos.
- **Puntuación provisional:** 16 puntos como quinto nivel.
- **Dificultad:** media-alta.
- **Condición de éxito:** encontrar las seis palabras.

### Lista visible para el jugador

```text
ISAAC   JACOB   ESTER
JESUS   JUDAS   PEDRO
```

### Criterio editorial

La selección evita repetir los personajes utilizados en las pruebas anteriores: Noé, Moisés, David, Jesús, Abraham y Josué. También combina personajes del Antiguo y del Nuevo Testamento:

- **Antiguo Testamento:** Isaac, Jacob y Ester.
- **Nuevo Testamento:** Jesús, Judas y Pedro.

La prueba busca los nombres, no distinguir entre las diferentes figuras bíblicas llamadas Judas. La palabra `JUDAS` se considera un objetivo único dentro de la cuadrícula.

### Reglas dentro de la Pirámide

- La lista de seis objetivos permanece visible durante toda la prueba.
- Las palabras pueden aparecer en horizontal, vertical o diagonal.
- Algunas palabras pueden estar escritas en sentido inverso.
- Una palabra encontrada queda resaltada y marcada como completada.
- Las selecciones incorrectas no restan puntos, pero consumen tiempo.
- Encontrar solo parte de las palabras no permite superar el nivel.
- Un timeout o una lista incompleta hacen fallar la prueba y bloquean la subida al siguiente nivel.

### Configuración técnica orientativa

```ts
{
  id: "abrahamic-word-search-biblical-characters",
  type: "word-search",
  category: "Biblia y religiones abrahámicas",
  question: "Encuentra los seis personajes bíblicos ocultos en la cuadrícula.",
  grid: { rows: 8, columns: 8 },
  letters: [
    "F", "W", "N", "E", "C", "E", "C", "I",
    "H", "C", "J", "P", "S", "M", "V", "G",
    "Y", "A", "Q", "A", "E", "T", "O", "G",
    "H", "A", "V", "C", "C", "D", "E", "U",
    "R", "S", "E", "J", "Y", "O", "R", "R",
    "J", "I", "I", "U", "E", "D", "B", "O",
    "G", "K", "J", "U", "D", "A", "S", "V",
    "F", "H", "L", "S", "U", "S", "E", "J",
  ],
  targets: [
    { id: "isaac", word: "ISAAC", startCell: 41, endCell: 9 },
    { id: "jacob", word: "JACOB", startCell: 10, endCell: 46 },
    { id: "ester", word: "ESTER", startCell: 3, endCell: 39 },
    { id: "jesus", word: "JESUS", startCell: 63, endCell: 59 },
    { id: "judas", word: "JUDAS", startCell: 50, endCell: 54 },
    { id: "pedro", word: "PEDRO", startCell: 11, endCell: 47 },
  ],
  timeLimit: 45,
  points: 16,
}
```

La cuadrícula se valida en el catálogo: contiene las seis palabras una única vez, con rutas horizontales, verticales y diagonales, y combina sentidos directo e inverso.

## Prueba 6 — Clasificación: el mapa de las tres tradiciones

### Objetivo

Clasificar nueve elementos según la tradición religiosa con la que se relacionan principalmente: judaísmo, cristianismo o islam.

La prueba funciona como nivel avanzado porque exige distinguir textos, celebraciones, símbolos y lugares de culto sin apoyarse únicamente en personajes compartidos por varias tradiciones.

### Configuración editorial

- **Formato:** Clasificación.
- **Pregunta:** «Clasifica los elementos por tradición».
- **Categorías:** Judaísmo, Cristianismo e Islam.
- **Elementos:** nueve, tres por categoría.
- **Tiempo límite propuesto:** 50 segundos.
- **Puntuación provisional:** 19 puntos como sexto nivel.
- **Dificultad:** alta.
- **Condición de éxito:** clasificar correctamente los nueve elementos.

| Judaísmo | Cristianismo | Islam   |
| -------- | ------------ | ------- |
| Torá     | Evangelios   | Corán   |
| Pésaj    | Cruz         | Ramadán |
| Menorá   | Navidad      | Kaaba   |

### Criterio editorial

Los elementos se han elegido por su asociación principal y suficientemente reconocible. No se deben utilizar figuras como Abraham, Moisés, Jesús o María porque tienen presencia relevante en más de una tradición. La categoría indica la asociación principal esperada en esta prueba, no exclusividad histórica.

### Reglas dentro de la Pirámide

- Las nueve tarjetas aparecen mezcladas y se pueden corregir antes de confirmar.
- Solo nueve aciertos desbloquean el séptimo nivel; un resultado parcial queda disponible para revisión, pero termina el ascenso.
- Un error en la confirmación o el timeout hacen fallar el desafío completo.

### Configuración técnica orientativa

```ts
{
  id: "abrahamic-classification-three-traditions",
  type: "classification",
  category: "Biblia y religiones abrahámicas",
  question: "Clasifica los elementos por tradición.",
  categories: ["Judaísmo", "Cristianismo", "Islam"],
  items: [
    { label: "Torá", correctCategory: "Judaísmo" },
    { label: "Evangelios", correctCategory: "Cristianismo" },
    { label: "Pésaj", correctCategory: "Judaísmo" },
    { label: "Corán", correctCategory: "Islam" },
    { label: "Cruz", correctCategory: "Cristianismo" },
    { label: "Ramadán", correctCategory: "Islam" },
    { label: "Menorá", correctCategory: "Judaísmo" },
    { label: "Navidad", correctCategory: "Cristianismo" },
    { label: "Kaaba", correctCategory: "Islam" },
  ],
  timeLimit: 50,
  points: 19,
}
```

## Prueba 7 — Hashtag: cuatro referencias cruzadas — Cima

### Objetivo

Completar cuatro palabras de cinco letras intercambiando fichas en una cuadrícula con forma de `#`. Las palabras pertenecen a familias distintas, pero todas están relacionadas con la Biblia y las religiones abrahámicas:

- un personaje;
- un lugar;
- un texto;
- un elemento del culto.

La mezcla de categorías aumenta el número de combinaciones posibles y evita que el desafío dependa de encontrar cuatro palabras del mismo tipo.

### Configuración editorial

- **Formato:** Hashtag de palabras.
- **Pregunta:** «Completa cuatro palabras bíblicas de cinco letras».
- **Personaje:** `PABLO`.
- **Lugar:** `TABOR`.
- **Texto:** `TORAH`.
- **Elemento del culto:** `ALTAR`.
- **Tiempo límite propuesto:** 45 segundos.
- **Puntuación provisional:** 24 puntos como Cima.
- **Dificultad:** muy alta.
- **Movimientos:** estado inicial con seis movimientos óptimos y siete movimientos máximos permitidos.

### Solución visual

La cuadrícula resuelta debe ser:

```text
· T · A ·
P A B L O
· B · T ·
T O R A H
· R · R ·
```

Las palabras se leen de la siguiente manera:

- horizontal superior: `PABLO`;
- horizontal inferior: `TORAH`;
- vertical izquierda: `TABOR`;
- vertical derecha: `ALTAR`.

Las intersecciones son las que hacen que una misma ficha pertenezca simultáneamente a una palabra horizontal y a una vertical.

### Por qué es una prueba difícil

- No se buscan cuatro palabras de una única categoría; el jugador debe cambiar de marco mental.
- Los términos pueden ser nombres propios o vocabulario religioso menos frecuente.
- Cada intercambio afecta potencialmente a dos palabras.
- Las letras correctas quedan bloqueadas, por lo que un movimiento prematuro puede limitar las opciones restantes.
- El nivel solo se supera al completar las cuatro palabras; encontrar parcialmente una o dos no permite avanzar.

La dificultad debe proceder de la planificación y de las intersecciones, no de utilizar palabras oscuras. La pregunta debe anunciar las cuatro familias para que el jugador tenga una pista temática suficiente.

### Reglas de la prueba

- La cuadrícula es de 5 × 5 con forma de `#`.
- Solo se pueden intercambiar fichas activas.
- Cada intercambio válido consume un movimiento.
- Las letras colocadas correctamente se bloquean.
- El tablero debe conservar exactamente las dieciséis letras de la solución.
- Resolver con más movimientos que el mínimo reduce la puntuación, manteniendo la política actual de Hashtag.
- Agotar los movimientos o el tiempo implica fallar el nivel de la Pirámide.

### Configuración técnica validada

```ts
{
  id: "abrahamic-word-hashtag-references",
  type: "word-hashtag",
  category: "Biblia y religiones abrahámicas",
  question: "Completa cuatro palabras bíblicas de cinco letras.",
  grid: { rows: 5, columns: 5 },
  words: {
    top: "PABLO",
    bottom: "TORAH",
    left: "TABOR",
    right: "ALTAR",
  },
  initialLetters: [
    null, "T", null, "A", null,
    "H", "A", "P", "B", "L",
    null, "R", null, "O", null,
    "T", "O", "B", "A", "T",
    null, "R", null, "R", null,
  ],
  maxMoves: 7,
  timeLimit: 45,
  points: 24,
}
```

El estado inicial usa exactamente las dieciséis letras de la solución. El solver lo resuelve en seis intercambios y el máximo de siete conserva un movimiento de margen. `TORAH` se muestra sin tilde, igual que en la configuración del tablero.
