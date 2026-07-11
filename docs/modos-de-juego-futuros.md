# Modos de juego futuros

## Propósito

The Flash nace como un sprint de preguntas individual, pero puede evolucionar hacia una plataforma de retos rápidos y desafíos especiales, también en multijugador online. La variedad no debe diluir la identidad del producto: cada prueba debe conservar tensión, reglas comprensibles y una forma clara de comparar la ejecución entre jugadores.

Este documento recoge mecánicas candidatas para futuras etapas, eventos y modos competitivos. No amplía el alcance de la PoC actual ni define todavía su implementación técnica.

## Principios de diseño

- **Rapidez con sentido:** la velocidad debe importar, pero nunca sustituir una respuesta correcta.
- **Comparabilidad:** cada prueba debe ofrecer una métrica competitiva comprensible: acierto, tiempo, precisión, intentos o una combinación explícita de ellas.
- **Variedad útil:** alternar conocimiento, lógica, memoria, lenguaje y percepción evita que The Flash se perciba como un cuestionario convencional.
- **Móvil primero:** las interacciones táctiles deben ser cómodas, con pocos elementos arrastrables y objetivos amplios.
- **Ritmo por capas:** las pruebas rápidas duran segundos; los desafíos especiales pueden durar entre uno y cinco minutos y aparecer de forma ocasional.
- **Dificultad justa:** los formatos visuales o táctiles necesitan validación tolerante y diseño adaptado a distintos tamaños de pantalla.

## Catálogo de mecánicas

### 1. Ordenar elementos

El jugador coloca varios elementos en el orden correcto: acontecimientos históricos, películas por fecha, países por población, pasos de un proceso, una frase o magnitudes.

- **Interacción:** arrastrar tarjetas o pulsarlas en el orden correcto.
- **Encaje:** intuitiva, competitiva y precisa para medir resultado y tiempo; sirve para cultura, lógica y lenguaje.
- **Límite recomendado:** entre cuatro y siete elementos para evitar fricción en móvil.

### 2. Encontrar el intruso

Se muestran varios elementos y el jugador identifica cuál rompe una relación: una palabra de otra categoría, un número que no sigue la regla, una imagen distinta, un personaje ajeno a una saga o una bandera de otro continente.

- **Encaje:** reglas inmediatas, rondas de segundos y dificultad escalable.
- **Ventaja:** coste de producción e implementación bajo; contenido muy reutilizable.

### 3. Emparejar conceptos

El jugador une elementos relacionados, como países y capitales, autores y obras, inventos e inventores, conceptos y definiciones o imágenes y nombres.

- **Interacción:** elegir una tarjeta de cada columna o arrastrar conexiones.
- **Encaje:** convierte conocimiento en una acción activa; los errores pueden penalizar tiempo, puntos o ambos.

### 4. Secuencias y patrones

El jugador descubre el siguiente elemento de una serie numérica, de símbolos, colores, letras, palabras o movimientos espaciales.

- **Encaje:** introduce lógica pura y equilibra los formatos memorísticos.
- **Formato:** elección múltiple rápida o desafío de construcción de respuesta.

### 5. Clasificación rápida

Varias tarjetas deben repartirse entre categorías: mamífero, ave o reptil; país europeo, asiático o africano; real o ficticio; hecho o mito; sustantivo, adjetivo o verbo.

- **Formato recomendado:** entre seis y doce elementos.
- **Encaje:** encadena decisiones rápidas y compara muy bien la velocidad de varios jugadores.

### 6. Memoria relámpago

Una composición se muestra durante unos segundos y después se oculta. El jugador debe recordar elementos, posiciones, un orden, relaciones entre nombres e imágenes o detalles de una escena.

- **Encaje:** hace que el cronómetro forme parte real de la mecánica, tanto al memorizar como al responder.
- **Valor:** permite dificultad alta con reglas simples.

### 7. Diferencias visuales

El jugador encuentra una o varias diferencias entre dos imágenes: una única diferencia, todas las diferencias, el elemento añadido o eliminado, o una zona concreta pulsable.

- **Encaje:** formato reconocido, visual y accesible.
- **Riesgo:** las imágenes y zonas pulsables deben prepararse y escalarse cuidadosamente para cada pantalla.

### 8. Pregunta de estimación

El jugador responde un valor aproximado; una respuesta más cercana obtiene mejor puntuación. Puede estimar una distancia, año, altura, cantidad de personas o porcentaje.

- **Interacción:** campo numérico, rueda, control deslizante o botones de incremento.
- **Encaje:** evita el acierto binario y produce comparativas interesantes aun cuando nadie acierte exactamente.

### 9. Imagen progresivamente revelada

Una imagen comienza borrosa, pixelada, ampliada o cubierta y se revela con el tiempo. El jugador debe identificar personajes, lugares, banderas, películas, animales, obras de arte o logotipos cuanto antes.

- **Encaje:** premia directamente la rapidez, pero mantiene un riesgo al responder antes.
- **Identidad:** es una de las mecánicas que mejor representa el nombre y el espíritu de The Flash.

### 10. Anagramas y palabras desordenadas

El jugador reordena letras, sílabas o fragmentos para formar una palabra o frase; también puede resolver una palabra a partir de una pista o crear el mayor número posible de palabras.

- **Interacción:** entrada escrita o fichas directas.
- **Encaje:** sencillo de entender, barato de producir y eficaz bajo presión.

### 11. Objetos ocultos

El jugador encuentra uno o varios elementos dentro de una escena: un objeto concreto, todos los símbolos de un tipo, un personaje, una cantidad de elementos o el único objeto que cumple una condición.

- **Encaje:** atractivo visual y apropiado como desafío especial de uno o varios minutos.
- **Riesgo:** exige ilustraciones o imágenes diseñadas para el reto.

### 12. Código o combinación lógica

El jugador deduce un código a partir de pistas. Por ejemplo, las combinaciones `682`, `614` y `206` indican cifras correctas y su posición. El mismo formato puede usar colores, símbolos, palabras, interruptores, posiciones u operaciones.

- **Encaje:** prueba estrella con tensión, estrategia y recorrido más largo.
- **Uso recomendado:** final de etapa o evento especial.

### 13. Mini-Wordle

El jugador descubre una palabra en pocos intentos. La adaptación puede usar palabras de cuatro o cinco letras, menos intentos, tiempo total limitado, pistas temáticas, puntos por eficiencia y penalización por letras incorrectas.

- **Encaje:** conocido y fácil de entender.
- **Uso recomendado:** desafío especial, por su duración mayor que una pregunta normal.

### 14. Simon o repetición de secuencias

Se reproduce una secuencia de colores, sonidos, símbolos, posiciones o ritmos y el jugador la repite. Puede crecer en longitud, exigir repetición inversa o pedir que se detecte un elemento incorrecto.

- **Encaje:** combina memoria, reflejos y precisión.
- **Consideración competitiva:** el jugador debe esperar la reproducción, por lo que ese tiempo debe normalizarse o excluirse al comparar resultados.

### 15. Matrices lógicas

Una cuadrícula de símbolos o imágenes contiene una casilla vacía; el jugador elige la opción que completa el patrón.

- **Encaje:** aporta razonamiento abstracto y escala de niveles sencillos a exigentes.
- **Uso recomendado:** etapas de lógica o preguntas especiales.

### 16. Mini-nonograma

El jugador completa una cuadrícula a partir de pistas numéricas.

- **Formato recomendado:** cuadrículas de 5 × 5 o 7 × 7, diseños simples, uno a tres minutos y penalización por casillas incorrectas.
- **Encaje:** diferenciador y más profundo que una pregunta convencional.
- **Riesgo:** necesita interfaz, tutorial y generación de puzles cuidadosa.

### 17. Laberinto contrarreloj

El jugador guía un elemento desde la entrada a la salida mediante arrastre, botones direccionales, cruces sucesivos o elección de caminos. Una variante accesible pregunta qué laberinto tiene salida.

- **Encaje:** mide con claridad tiempo y precisión.
- **Riesgo:** un control táctil impreciso mediría frustración, no habilidad.

### 18. Mini-sudoku

Adaptación del sudoku tradicional: cuadrícula 4 × 4, completar casillas críticas, detectar un número erróneo, elegir la cuadrícula válida o resolver una región.

- **Encaje:** conocido, objetivo y competitivo.
- **Uso recomendado:** desafío especial o etapa temática de lógica, no formato frecuente.

### 19. Rompecabezas deslizante

Una imagen, números, letras o un mapa se divide en piezas que el jugador reconstruye desplazando fichas.

- **Encaje:** visual y fácilmente medible por tiempo.
- **Riesgo:** la interacción táctil, animaciones, validación y generación requieren más trabajo que una pregunta tradicional.

### 20. Tangram o construcción de figura

El jugador forma una silueta con piezas geométricas: tangram clásico, bloques, piezas encajables o copia de una composición mostrada antes.

- **Encaje:** desafío especial memorable y muy diferenciador.
- **Riesgo:** exige arrastre, rotación, colisiones, ajuste de piezas y validación tolerante; es una de las mecánicas más complejas de implementar correctamente.

## Priorización por objetivo

| Objetivo                                   | Mecánicas prioritarias                                                                                     | Motivo                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Equilibrio entre diversión y coste técnico | Encontrar el intruso, ordenar elementos, secuencias, anagramas, estimación                                 | Amplían el juego con riesgo técnico contenido.                                  |
| Diferenciar The Flash de una trivia        | Memoria relámpago, imagen progresiva, código lógico, objetos ocultos, mini-nonogramas                      | Introducen habilidades e interacciones que van más allá de responder preguntas. |
| Pruebas especiales                         | Código lógico, mini-Wordle, mini-nonograma, laberinto, mini-sudoku, rompecabezas, tangram                  | Admiten retos ocasionales de uno a cinco minutos.                               |
| Competición por tiempo                     | Ordenar, clasificación rápida, emparejar, diferencias visuales, imagen progresiva, laberinto, rompecabezas | Una ejecución correcta terminada antes representa una mejora clara.             |

## Implicaciones para el futuro multijugador

Para que los resultados sean comparables en una partida online, cada formato deberá definir antes de construirse:

- la condición de éxito y los errores recuperables o definitivos;
- cómo se mide el tiempo, incluidos tiempos forzados de reproducción o animación;
- el modelo de puntuación: acierto, proximidad, penalizaciones e intento(s);
- el nivel o semilla compartida, para garantizar el mismo reto a todos los participantes;
- la protección frente a latencia y diferencias de dispositivo;
- la estrategia de contenido: datos estructurados, activos visuales y validación de calidad.

Como siguiente paso de producto, las cinco mecánicas de mejor equilibrio permiten validar variedad sin introducir interfaces complejas. Las pruebas especiales deberían llegar después, acompañadas de prototipos específicos de interacción móvil y reglas de puntuación explícitas.
