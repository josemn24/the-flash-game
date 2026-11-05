> Estado: vigente. Mecánicas disponibles y reglas editoriales contrastadas el 2026-10-24.

# Formatos de pregunta disponibles

The Flash combina práctica local y competición persistida. Un formato define la interacción
individual; un modo define progresión, relojes y finalización. La [matriz de modos y capacidades](../current/status.md)
y el [registro de formatos](../../lib/question-formats/definitions.ts) determinan qué combinaciones
se admiten. Que un formato esté habilitado no implica que todas las publicaciones lo utilicen.

## Familias disponibles

| Familia                 | Formatos nativos                                                          | Competición   |
| ----------------------- | ------------------------------------------------------------------------- | ------------- |
| Respuesta directa       | Elección múltiple, verdadero/falso, respuesta corta, encontrar el intruso | Sí            |
| Relaciones              | Emparejar, ordenar, clasificar                                            | Sí            |
| Pistas y reconocimiento | Pistas progresivas, imagen progresiva, mapa de calor                      | Sí            |
| Lenguaje                | Anagramas, Mini-Wordle, Hashtag, sopa de letras                           | Sí            |
| Deducción y proximidad  | Código lógico, matrices lógicas, estimación                               | Sí            |
| Puzzles de tablero      | Queens, Conectar parejas, Zip, Escape                                     | Sí            |
| Percepción y revisión   | Etiquetar imagen, reconstrucción del error                                | Solo práctica |
| Memoria                 | Memoria relámpago, memoria de parejas, Simon                              | Solo práctica |
| Otros puzzles           | Mini-sudoku, mini-nonograma, deslizante, laberinto, Tuberías              | Solo práctica |

Los 31 formatos tienen fichas y ejemplos jugables. Secuencias, cálculo u otras variantes de
contenido pueden utilizar tipos existentes; no cuentan como formatos nativos adicionales.
Las [mecánicas futuras](../product/roadmap/formatos-futuros.md) se mantienen fuera de esta referencia.

## Puntuación y contextos

La evaluación existente en [scoringCore](../../lib/scoringCore/registry.ts) es la referencia del
comportamiento implementado. Las decisiones aprobadas prevalecen al diseñar cambios; una divergencia
debe resolverse explícitamente, sin cambiar reglas para acomodar un texto antiguo.
Pirámide exige acierto completo para avanzar y Contrarreloj usa una política binaria propia.
Las descripciones generales de formato no sustituyen esos contratos de modo.

Matching se evalúa como conjunto completo: sin mapa completamente correcto no concede puntos.
Las respuestas de selección incorrectas terminan con cero puntos; los porcentajes legacy no
descuentan puntos ya ganados en otras preguntas. Las penalizaciones por intentos, pistas o
movimientos reducen el crédito disponible de los formatos que las utilizan.

La práctica puede dar feedback inmediato que la competición reserva para una comprobación final.
Los textos legacy de algunas fichas de la aplicación siguen pendientes de alineación en el
[backlog](../implementation-plan.md); no definen una política distinta del evaluador.

## Principios de diseño

- **Rapidez con sentido:** la velocidad debe importar, pero nunca sustituir una respuesta correcta.
- **Comparabilidad:** cada prueba debe ofrecer una métrica competitiva comprensible: acierto, tiempo, precisión, intentos o una combinación explícita de ellas.
- **Variedad útil:** alternar conocimiento, lógica, memoria, lenguaje y percepción evita que The Flash se perciba como un cuestionario convencional.
- **Móvil primero:** las interacciones táctiles deben ser cómodas, con pocos elementos arrastrables y objetivos amplios.
- **Ritmo por capas:** las pruebas rápidas duran segundos; los desafíos especiales pueden durar entre uno y cinco minutos y aparecer de forma ocasional.
- **Dificultad justa:** los formatos visuales o táctiles necesitan validación tolerante y diseño adaptado a distintos tamaños de pantalla.

## Catálogo de mecánicas disponibles

### Ordenar elementos — Implementada

El jugador coloca varios elementos en el orden correcto: acontecimientos históricos, películas por fecha, países por población, pasos de un proceso, una frase o magnitudes.

- **Interacción actual:** controles accesibles para subir y bajar cada elemento; el orden completo se confirma antes de enviarse.
- **Encaje:** intuitiva, competitiva y precisa para medir resultado y tiempo; sirve para cultura, lógica y lenguaje.
- **Límite recomendado:** entre cuatro y seis elementos para evitar fricción en móvil.

### Encontrar el intruso — Implementada

Se muestran varios elementos y el jugador identifica cuál rompe una relación: una palabra de otra categoría, un número que no sigue la regla, una imagen distinta, un personaje ajeno a una saga o una bandera de otro continente.

- **Encaje:** reglas inmediatas, rondas de segundos y dificultad escalable.
- **Ventaja:** coste de producción e implementación bajo; contenido muy reutilizable.
- **Interacción actual:** entre tres y seis tarjetas de texto o imagen; tocar una tarjeta envía inmediatamente la respuesta.
- **Puntuación actual:** acierto exacto ajustado por velocidad; una respuesta incorrecta puntúa cero y agotar el tiempo no puntúa.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación.

### Emparejar conceptos — Implementada

El jugador une elementos relacionados, como países y capitales, autores y obras, inventos e inventores, conceptos y definiciones o imágenes y nombres.

- **Interacción actual:** en práctica se comprueban parejas individualmente; en competición se edita el mapa y se realiza una comprobación final del conjunto.
- **Encaje:** convierte conocimiento en una acción activa y conserva reglas accesibles para ratón, teclado y pantallas táctiles.
- **Contenido compatible:** texto o imágenes; las tarjetas visuales muestran solo la imagen y conservan una etiqueta accesible.
- **Puntuación actual:** solo un mapa completamente correcto puntúa, ajustado por velocidad; una respuesta incorrecta o un timeout puntúan cero.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación.

### Secuencias y patrones — Disponible como contenido

El jugador descubre el siguiente elemento de una serie numérica, de símbolos, colores, letras, palabras o movimientos espaciales.

- **Encaje:** introduce lógica pura y equilibra los formatos memorísticos.
- **Estado actual:** puede resolverse mediante elección múltiple o respuesta corta; todavía no existe un constructor de secuencias específico.

### Clasificación rápida — Implementada

Varias tarjetas deben repartirse entre categorías: mamífero, ave o reptil; país europeo, asiático o africano; real o ficticio; hecho o mito; sustantivo, adjetivo o verbo.

- **Interacción actual:** matriz de categorías con selección explícita para cada elemento y confirmación final.
- **Formato recomendado:** entre tres y ocho elementos.
- **Encaje:** encadena decisiones rápidas y compara muy bien la velocidad de varios jugadores.

### Memoria relámpago — Implementada

Una composición se muestra durante unos segundos y después se oculta. El jugador debe recordar elementos, posiciones, un orden, relaciones entre nombres e imágenes o detalles de una escena.

- **Encaje:** convierte la breve exposición y la reconstrucción contrarreloj en una misma mecánica de memoria.
- **Valor:** permite dificultad alta con reglas simples.
- **Interacción actual:** la primera variante muestra una cuadrícula completa 2 × 2 durante tres segundos. Después, el jugador selecciona cada ficha y la coloca en la posición que recuerda; puede retirar y recolocar fichas antes de confirmar.
- **Puntuación actual:** el cronómetro comienza al iniciarse la reconstrucción, no durante la exposición. Cada posición correcta recibe crédito parcial ajustado por velocidad; no hay penalización por recolocar.

### Memoria de parejas — Implementada

El jugador descubre losetas ocultas de una cuadrícula o mosaico irregular y debe encontrar parejas iguales recordando su posición. Es una adaptación del memory clásico, pero puede usar patrones, iconos, sonidos, colores, fragmentos de imagen o pequeñas ilustraciones en lugar de cartas rectangulares tradicionales.

- **Interacción actual:** tocar una loseta para revelarla y después tocar otra. Si forman pareja, ambas quedan descubiertas; si no coinciden, se vuelven a ocultar tras una pausa breve. Completar todas las parejas envía la respuesta automáticamente.
- **Encaje:** aporta memoria visual pura con reglas universales y una tensión muy clara entre velocidad y precisión. Es más activo que memoria relámpago porque el jugador decide el orden de exploración y debe optimizar movimientos.
- **Puntuación actual:** cada pareja encontrada aporta crédito parcial ajustado por velocidad; cada intento fallido resta un 10 % de los puntos base hasta un mínimo de cero. El timeout conserva el historial de intentos y puede mantener crédito parcial si hay parejas encontradas.
- **Uso recomendado:** entre cuatro y diez parejas para rondas rápidas, con tableros compactos y patrones muy distinguibles. Encaja especialmente como desafío especial de memoria visual dentro de la biblioteca.
- **Accesibilidad:** las parejas no deben distinguirse solo por color; cada loseta necesita símbolo, emoji, patrón, icono, etiqueta accesible o sonido equivalente. La pausa antes de ocultar una pareja fallida debe ser suficiente para percibir ambas losetas.
- **Evolución posible:** deshacer, pistas limitadas, losetas bloqueadas, siluetas irregulares, parejas temáticas o varias rondas con dificultad creciente.

### Pregunta de estimación — Implementada

El jugador responde un valor aproximado; una respuesta más cercana obtiene mejor puntuación. Puede estimar una distancia, año, altura, cantidad de personas o porcentaje.

- **Interacción actual:** valor visible y botones de incremento o decremento dentro de un rango y paso configurables.
- **Encaje:** evita el acierto binario y produce comparativas interesantes aun cuando nadie acierte exactamente.
- **Puntuación actual:** proximidad al valor real ajustada por el tiempo empleado.

### Imagen progresivamente revelada — Implementada

Una imagen comienza borrosa y se revela automáticamente con el tiempo. El jugador debe identificar personajes, lugares, banderas, películas, animales, obras de arte o logotipos cuanto antes.

- **Encaje:** premia directamente la rapidez, pero mantiene un riesgo al responder antes.
- **Identidad:** es una de las mecánicas que mejor representa el nombre y el espíritu de The Flash.
- **Interacción actual:** la carga termina antes de iniciar el cronómetro; después, el desenfoque cae de 32 px a cero y se puede enviar una única respuesta de texto en cualquier momento.
- **Puntuación actual:** acierto binario ajustado por velocidad; una respuesta incorrecta o el timeout conceden cero puntos.
- **Accesibilidad:** se anuncian carga e hitos de revelado, el modo de movimiento reducido usa cuatro pasos y la revisión incorpora una descripción completa. Por su naturaleza, la prueba no ofrece una experiencia equivalente sin visión sin revelar la solución.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación.

### Anagramas y palabras desordenadas — Implementada

El jugador reordena letras, sílabas o fragmentos para formar una palabra o frase; también puede resolver una palabra a partir de una pista o crear el mayor número posible de palabras.

- **Interacción actual:** seleccionar fichas de letras para construir una palabra, retirar la última ficha o reiniciar antes de enviarla. Un fallo termina la ronda.
- **Encaje:** sencillo de entender, barato de producir y eficaz bajo presión.
- **Puntuación actual:** formar la palabra exacta recibe puntos por velocidad; un fallo o timeout no puntúan.

### Código o combinación lógica — Implementada

El jugador deduce un código a partir de pistas. Por ejemplo, las combinaciones `682`, `614` y `206` indican cifras correctas y su posición. El mismo formato puede usar colores, símbolos, palabras, interruptores, posiciones u operaciones.

- **Encaje:** prueba estrella con tensión, estrategia y recorrido más largo.
- **Interacción actual:** campos por cifra, pistas siempre visibles e intentos repetidos hasta acertar o agotar el tiempo.
- **Puntuación actual:** velocidad con una reducción del 10 % de los puntos base por intento fallido.
- **Uso actual:** una de las preguntas de cierre del desafío «Conexiones rápidas» y ejemplo jugable en su ficha.

### Mini-Wordle — Implementada

El jugador descubre una palabra de cuatro o cinco letras, con entre uno y diez intentos según la configuración publicada. Los valores locales predeterminados son cuatro letras y cuatro intentos. Cada palabra enviada indica qué letras están colocadas, desplazadas o ausentes; los recuentos evitan revelar coincidencias duplicadas que no existen en la solución.

- **Encaje:** conocido y fácil de entender.
- **Interacción actual:** campo de texto nativo con envío por botón o Enter y validación mediante un vocabulario español general generado offline. El diccionario se carga antes de iniciar el cronómetro; los intentos inválidos no consumen oportunidades.
- **Puntuación actual:** resolver recibe crédito ajustado por velocidad y cada intento fallido previo resta el 10 % de los puntos base hasta un mínimo de cero. Agotar intentos o tiempo no puntúa.
- **Uso recomendado:** desafío especial, por su duración mayor que una pregunta normal.

### Simon o repetición de secuencias — Implementada

Se reproduce una secuencia de colores, sonidos, símbolos, posiciones o ritmos y el jugador la repite. Puede crecer en longitud, exigir repetición inversa o pedir que se detecte un elemento incorrecto.

- **Encaje:** combina memoria, reflejos y precisión.
- **Interacción actual:** cuatro botones con símbolo, etiqueta y color se iluminan siguiendo una secuencia fija de cuatro a seis pasos. Al terminar, el jugador la repite; un error termina la ronda.
- **Puntuación actual:** la reproducción no cuenta para el cronómetro. Un acierto exacto recibe puntos por velocidad durante la repetición; un error o timeout no puntúan.

### Matrices lógicas — Implementada

Una cuadrícula de símbolos o imágenes contiene una casilla vacía; el jugador elige la opción que completa el patrón.

- **Encaje:** aporta razonamiento abstracto y escala de niveles sencillos a exigentes.
- **Interacción actual:** una matriz 3 × 3 presenta ocho símbolos y una casilla vacía. El jugador elige, entre cuatro opciones, la pieza que completa el patrón.
- **Puntuación actual:** un acierto exacto premia la velocidad; una respuesta incorrecta puntúa cero y el timeout no puntúa.

### Mini-nonograma — Implementada

El jugador completa una cuadrícula 5 × 5 a partir de las pistas numéricas de sus filas y columnas.

- **Interacción actual:** el jugador selecciona celdas y puede rellenarlas o marcarlas vacías antes de confirmar; también puede enviar una solución incompleta.
- **Puntuación actual:** los rellenos correctos suman crédito y los rellenos erróneos lo restan, con un mínimo de cero y ajuste por velocidad. El timeout evalúa el borrador.
- **Encaje:** diferenciador y más profundo que una pregunta convencional.

### Laberinto contrarreloj — Implementada

El jugador guía un elemento desde la entrada a la salida mediante botones direccionales o flechas del teclado.

- **Encaje:** mide con claridad tiempo y precisión.
- **Interacción actual:** cuadrícula ortogonal de 5 × 5 a 9 × 9, cruceta táctil, flechas, retroceso permitido y resolución automática al alcanzar la salida.
- **Puntuación actual:** resolución binaria ajustada por velocidad; los movimientos adicionales no penalizan y el timeout conserva el recorrido con cero puntos.
- **Accesibilidad:** la v1 evita el arrastre libre, deshabilita direcciones bloqueadas, mantiene el foco y anuncia posición, muros y movimientos.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las publicaciones actuales todavía no lo incluyen.

### Mini-sudoku — Implementada

Adaptación del sudoku tradicional en una cuadrícula 4 × 4: el jugador completa tres o cuatro casillas vacías usando números del 1 al 4.

- **Encaje:** conocido, objetivo y competitivo.
- **Interacción actual:** las pistas quedan bloqueadas; se selecciona una casilla vacía y se escribe, reemplaza o borra un número antes de confirmar la cuadrícula completa.
- **Puntuación actual:** cada casilla correcta recibe crédito parcial ajustado por velocidad. El timeout evalúa el borrador y no hay penalización por corregir valores.

### Rompecabezas deslizante — Implementada

Una cuadrícula 3 × 3 de ocho fichas numeradas y un hueco debe reconstruirse desplazando únicamente las fichas adyacentes al espacio libre.

- **Interacción actual:** tocar una ficha adyacente al hueco la desliza; las flechas ofrecen el mismo control por teclado. La ronda se envía automáticamente al completar el orden objetivo.
- **Puntuación actual:** resolver el tablero recibe puntos por velocidad. Los movimientos se registran para revisión, pero no penalizan; un timeout no puntúa.
- **Encaje:** visual y fácilmente medible por tiempo.

### Conectar parejas — Implementada

El jugador une pares de puntos iguales dentro de una cuadrícula trazando caminos ortogonales. Es la familia de juegos conocida como Flow Free o Numberlink: cada color, símbolo o número debe conectar sus dos extremos, los caminos no pueden cruzarse ni compartir casillas, y en la variante completa se intenta cubrir toda la cuadrícula.

- **Interacción actual:** seleccionar un extremo y construir el camino celda a celda hasta su pareja. Tocar una ruta existente puede recortarla, rehacerla o borrarla. No hay envío manual: completar todas las parejas y casillas envía automáticamente; en teclado, el jugador elige una pareja y extiende la ruta activa con flechas.
- **Encaje:** reglas visuales inmediatas, muy buen soporte táctil y tensión clara entre resolver rápido y evitar bloquear rutas futuras. Funciona como puzzle de cuadrícula más fluido que sudoku o nonograma.
- **Puntuación actual:** crédito parcial por parejas conectadas y porcentaje de cobertura, ajustado por velocidad. La solución perfecta exige cubrir el 100 % del tablero; el timeout conserva rutas parciales y puntúa progreso válido.
- **Uso recomendado:** tableros cuadrados de 4 × 4 a 8 × 8 con entre tres parejas y tantas como filas. Los retos deben estar curados o generados con solución única y dificultad controlada por tamaño, número de parejas, distancia entre extremos y necesidad de cobertura completa.
- **Accesibilidad actual:** no depende solo del color; cada pareja tiene símbolo, etiqueta accesible, foco visible y controles de teclado. Las rutas pueden recortarse o borrarse sin precisión milimétrica.
- **Riesgo:** el arrastre, los toques y el teclado deben producir rutas equivalentes en pantallas pequeñas. La validación resuelve solapamientos, retrocesos y caminos parciales de forma determinista.

### Adivinanzas por pistas — Implementada

El jugador intenta identificar un personaje, lugar, objeto, obra o concepto. Puede descubrir pistas sucesivas, pero cada una reduce la puntuación máxima disponible, por lo que debe decidir cuándo tiene suficiente información para responder.

Por ejemplo, para adivinar un personaje las pistas pueden revelar progresivamente su siglo, profesión, país, campo de investigación e iniciales.

- **Interacción actual:** la primera pista de texto aparece al comenzar; el jugador puede revelar las siguientes o enviar una única respuesta abierta en cualquier momento. Un fallo termina la ronda.
- **Encaje:** combina conocimiento, autoconfianza y gestión del riesgo con una regla fácil de comprender.
- **Puntuación actual:** cada pista adicional resta una cantidad fija del máximo visible hasta un mínimo de cero y la velocidad ajusta después los puntos restantes; un fallo o el timeout no puntúan.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación.
- **Riesgo:** las primeras pistas deben ser difíciles pero útiles, y su orden debe calibrarse para que cada revelación reduzca de manera apreciable el espacio de respuestas posibles.

### Mapa de calor — Implementada

Se muestra un mapa, gráfico o escena y el jugador debe señalar una ubicación. Puede localizar una ciudad, marcar el lugar de un acontecimiento o estimar el centro geográfico de un país.

- **Interacción actual:** colocar y recolocar un único marcador sobre una superficie de proporción fija antes de confirmarlo. Con teclado se inicia en el centro y se mueve con las flechas.
- **Encaje:** es visual e intuitivo y permite combinar precisión y velocidad en una misma puntuación.
- **Puntuación actual:** la zona central concede precisión completa, alrededor hay crédito lineal decreciente y la velocidad ajusta el resultado. Las coordenadas y distancias son independientes del tamaño mostrado.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación. La primera versión no ofrece zoom, polígonos ni múltiples objetivos.
- **Riesgo:** la precisión no debe depender del tamaño de la pantalla ni de la destreza motriz; hacen falta coordenadas normalizadas, objetivos razonablemente amplios y controles equivalentes por teclado.

### Etiquetar imagen — Implementada

Se muestra una imagen o diagrama. El jugador puede asociar varias etiquetas a sus anclajes o identificar una única zona que ya aparece señalada, una mecánica adecuada para anatomía, componentes de objetos y diagramas educativos.

- **Interacción actual:** en `assign-all`, seleccionar un anclaje y después una etiqueta textual, editar las asociaciones y confirmar el conjunto. En `identify-one`, responder a una única señal mediante elección inmediata o texto enviado por botón o teclado.
- **Encaje:** separa la identificación discreta de partes de la localización continua propia de Mapa de calor.
- **Puntuación actual:** el etiquetado múltiple concede crédito por asociación; la identificación única es binaria y premia velocidad. Una elección o un texto incorrectos puntúan cero; el timeout puntúa cero.
- **Uso actual:** tipo nativo con dos ejemplos jugables —múltiple y único por elección— en la biblioteca; el contrato y la interfaz también admiten texto libre. Las publicaciones actuales todavía no lo incluyen. La primera versión no ofrece arrastre, zoom, medios dentro de las etiquetas ni anclajes creados por el jugador.
- **Riesgo:** los anclajes y textos deben mantenerse legibles y sin solapamientos en móvil; la numeración, el foco y el resumen textual deben permitir completar el ejercicio sin depender solo de la posición o el color.

### Reconstrucción del error — Implementada

Se muestra una solución incorrecta y el jugador debe detectar el paso exacto en el que aparece el primer fallo, en lugar de resolver el problema desde cero. Puede aplicarse a una operación matemática, una cronología histórica, una clasificación científica, un razonamiento lógico, una traducción o un fragmento de código.

- **Interacción actual:** seleccionar el primer paso erróneo, cambiar la selección antes de confirmar y, cuando existe, elegir una corrección guiada opcional.
- **Encaje:** mide comprensión profunda, revisión crítica y conocimiento del proceso, no solo memorización del resultado.
- **Puntuación actual:** sin corrección, localizar el error recibe puntos por velocidad. Con corrección, localizarlo aporta el 60 % y corregirlo el 40 % restante; el timeout evalúa la selección ya realizada.
- **Riesgo:** todos los pasos anteriores al señalado deben ser inequívocamente válidos; un error que se propaga no debería contabilizarse como varios fallos independientes.

### Cálculo relámpago — Disponible como contenido

El jugador resuelve una operación matemática breve contra el reloj. Puede aparecer como una operación aislada, una igualdad incompleta, una cadena mental de pasos o una ronda de varias operaciones encadenadas.

Por ejemplo:

```text
17 × 6 = ?
```

O también:

```text
144 ÷ 12 + 7 = ?
```

- **Estado actual:** puede plantearse mediante elección múltiple, con cuatro opciones y envío inmediato, o mediante respuesta corta con validación del resultado exacto. Todavía no existe un formato nativo con generador, rachas o dificultad progresiva.
- **Interacción futura:** escoger rápidamente entre opciones, escribir un resultado en campo libre, completar una igualdad como `8 × ? = 56`, decidir si una operación es correcta o resolver una cadena de transformaciones del tipo `+7`, `×2`, `-5`.
- **Encaje:** es una mecánica directa, arcade y muy alineada con el ritmo de The Flash. Mide cálculo mental, atención y velocidad sin depender de conocimiento cultural.
- **Puntuación:** acierto exacto ajustado por velocidad; una versión nativa podría añadir bonus por racha, penalización por error, dificultad por número de pasos y crédito separado para operaciones encadenadas.
- **Uso recomendado:** preguntas rápidas de cinco a veinte segundos o modo racha de treinta a sesenta segundos. Las operaciones deberían usar números pequeños, divisiones exactas y expresiones sin ambigüedad de precedencia.
- **Riesgo:** un formato demasiado escolar o repetitivo puede romper la variedad. La dificultad debe calibrarse por edad, tamaño de números, número de pasos y tipo de operación; en campo libre conviene evitar respuestas decimales salvo que la tolerancia esté definida con claridad.

### Queens — Implementada

El jugador coloca `N` coronas en una cuadrícula cuadrada `N × N`, con una corona por fila, columna y región, sin que dos coronas se toquen. La primera versión admite tamaños de 4 × 4 a 8 × 8.

- **Interacción actual:** herramientas explícitas para colocar coronas o marcas X, edición reversible, control táctil y por teclado, conflictos anunciados inmediatamente y validación automática al colocar las `N` coronas. Las coronas se guardan localmente y mediante checkpoints no bloqueantes.
- **Puntuación actual:** resolución binaria ajustada por velocidad; cada validación completa incorrecta resta un 5 % de los puntos base hasta un mínimo de cero. Los conflictos intermedios y editar marcas no penalizan.
- **Pirámide competitivo:** tres validaciones completas incorrectas terminan el ascenso. Las pistas fijas cuentan dentro de las `N` coronas; el tablero se bloquea durante cada validación y muestra los intentos restantes confirmados por el servidor. Acertar en la tercera oportunidad supera el nivel. El tercer fallo aporta cero puntos para Queens y conserva los de niveles anteriores. Los demás modos y la práctica mantienen sus reglas.
- **Accesibilidad:** las regiones combinan color, patrón y bordes; cada celda comunica fila, columna, región, estado y conflictos.
- **Uso actual:** tipo nativo competitivo y ejemplo jugable curado en la biblioteca, con pistas precolocadas. No incluye generador.

### Zip / Una línea — Implementada

El jugador traza un único recorrido ortogonal que visita checkpoints numéricos en orden y usa cada celda exactamente una vez.

- **Interacción actual:** arrastre, toques discretos o flechas del teclado; retroceder recorta el camino y completar el tablero lo envía automáticamente.
- **Puntuación actual:** resolución binaria ajustada por velocidad; el timeout conserva el recorrido con cero puntos.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; admitido en competición según el registro; su uso concreto depende de la publicación.

### Escape — Implementada

El jugador libera un bloque objetivo amarillo desplazando obstáculos horizontales y verticales sobre su propio eje en un tablero 6 × 6.

- **Interacción actual:** arrastre con ajuste a celdas, selección táctil, flechas de teclado, deshacer y reiniciar; alcanzar el borde derecho completa la ronda automáticamente.
- **Puntuación actual:** resolución binaria ajustada por velocidad. Los movimientos se comparan con un óptimo editorial en la revisión, pero no penalizan; el timeout conserva el tablero con cero puntos.
- **Accesibilidad:** los bloques combinan color, patrón, símbolo y etiquetas de posición; las flechas recorren los destinos legales uno a uno con foco y anuncios accesibles.
- **Uso actual:** tipo nativo y un único ejemplo jugable en la biblioteca. Está admitido en competición; no incorpora generador ni solver de búsqueda.

### Hashtag de palabras — Implementada

El jugador intercambia fichas en una cuadrícula con forma de `#` hasta completar dos palabras horizontales y dos verticales de cinco letras. Las cuatro intersecciones hacen que una misma casilla participe en dos palabras.

- **Interacción actual:** seleccionar dos fichas amarillas mediante toque o teclado, o arrastrar una sobre otra. Las letras verdes correctas quedan bloqueadas y cada intercambio válido consume un movimiento.
- **Puntuación actual:** solo resolver concede puntos por velocidad; cada movimiento por encima del mínimo calculado resta un 10 % de los puntos base hasta un mínimo de cero. El timeout conserva el tablero para revisión con cero puntos.
- **Accesibilidad:** los estados combinan color, símbolos `✓` y `↔`, etiquetas de posición, botones nativos, navegación por flechas y alternativa por dos toques al arrastre.
- **Uso actual:** tipo nativo y ejemplo jugable fijo en la biblioteca. Está admitido en competición; no incorpora generador, diccionario en runtime ni longitudes variables.

### Sopa de letras — Implementada

El jugador encuentra una o varias palabras ocultas en una cuadrícula de letras. Las palabras pueden aparecer en horizontal, vertical o diagonal y, según la dificultad, también en sentido inverso. Una ronda puede mostrar la lista completa de objetivos, ofrecer pistas temáticas o pedir descubrir las palabras sin revelarlas de antemano.

- **Interacción actual:** seleccionar la primera y la última letra mediante arrastre o dos toques. Las flechas mueven el foco por la cuadrícula y Enter o Espacio fijan los extremos; Escape cancela una selección pendiente. Una palabra válida queda resaltada y completar la lista envía la respuesta automáticamente.
- **Encaje:** combina vocabulario, exploración visual y velocidad con una regla conocida y fácil de explicar. Funciona como pregunta rápida con una o dos palabras o como desafío especial con una lista breve y una cuadrícula mayor.
- **Puntuación actual:** crédito parcial por cada palabra encontrada y ajuste por velocidad. Las selecciones incorrectas se registran para revisión, pero no restan puntos; el timeout conserva las palabras encontradas y su crédito.
- **Autoría recomendada:** cuadrículas compactas, de 6 × 6 a 10 × 10, con entre dos y ocho palabras de una misma temática. La validación comprueba que cada objetivo aparece una sola vez en la posición declarada y rechaza palabras, segmentos o identificadores duplicados.
- **Accesibilidad:** la selección y las palabras resueltas combinan color, patrón, iconos y texto. Cada celda anuncia coordenadas, letra y estado; el foco itinerante evita recorrer toda la cuadrícula con Tab y ofrece una alternativa completa al arrastre.
- **Riesgo:** en pantallas pequeñas, una cuadrícula densa puede provocar errores de selección y fatiga visual. Las direcciones permitidas, el tratamiento de tildes y `ñ`, las palabras solapadas y la aceptación de variantes deben definirse de forma explícita para que la validación sea inequívoca.
- **Uso actual:** tipo nativo y ejemplo jugable de fauna en la biblioteca. Está admitido en competición; no incorpora un generador procedural.
