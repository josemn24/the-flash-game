# Ideas de juegos futuros

## Propósito

Este documento recoge ideas exploratorias para futuros formatos de The Flash. No describe alcance comprometido ni sustituye al catálogo principal de formatos; funciona como una reserva creativa de mecánicas que podrían convertirse en preguntas rápidas, desafíos especiales o eventos competitivos.

El criterio de selección no es que el juego exista en papel, sino que pueda transformarse en una experiencia digital breve, clara y comparable. Las mejores candidatas comparten cuatro rasgos:

- reglas comprensibles en pocos segundos;
- interacción cómoda en móvil;
- puntuación explícita por acierto, precisión, tiempo, intentos o progreso;
- posibilidad de generar o revisar retos equivalentes para todos los jugadores.

## Candidatas de encaje alto

### Buscaminas relámpago

Versión compacta del buscaminas en una cuadrícula pequeña, por ejemplo 5 x 5 o 6 x 6. En lugar de exigir limpiar todo el tablero, el reto podría pedir marcar todas las minas deducibles a partir de números ya revelados.

- **Interacción:** tocar celdas para marcarlas como mina, vacía o dudosa antes de confirmar.
- **Puntuación:** minas correctas, penalización por falsas marcas y ajuste por velocidad.
- **Encaje:** reglas conocidas, tensión inmediata y buena lectura competitiva.
- **Riesgo:** evitar configuraciones que dependan de azar o de una primera jugada no informada.

### Mastermind visual

Adaptación explícita del código lógico con colores, símbolos o iconos. El jugador propone combinaciones y recibe feedback de piezas correctas en posición correcta y piezas correctas en posición incorrecta.

- **Interacción:** construir una combinación con fichas visuales y enviarla en varios intentos.
- **Puntuación:** acierto, tiempo e intentos fallidos.
- **Encaje:** muy reconocible, táctil y más visual que el código numérico.
- **Riesgo:** el feedback debe explicarse sin ambigüedad, especialmente con símbolos repetidos.

### Battleship lógico

Versión de hundir la flota sin azar. La cuadrícula incluye pistas de filas y columnas, o información parcial, y el jugador deduce dónde están los barcos.

- **Interacción:** marcar agua, barco o incógnita en una cuadrícula pequeña.
- **Puntuación:** crédito por casillas correctas, penalización por barcos imposibles y velocidad.
- **Encaje:** combina deducción espacial con una fantasía de juego muy familiar.
- **Riesgo:** requiere generador o curación de tableros con solución única.

### Kakuro mini

Adaptación reducida de kakuro con sumas cruzadas y números sin repetir dentro de cada segmento. Debe mantenerse en tamaños muy pequeños para conservar el ritmo de The Flash.

- **Interacción:** seleccionar una celda y elegir un número disponible.
- **Puntuación:** crédito por celdas correctas y ajuste por velocidad.
- **Encaje:** buen complemento para mini-sudoku y mini-nonograma.
- **Riesgo:** la carga mental crece rápido; conviene empezar con tres o cuatro huecos.

### Queens / Meowdoku

> **Estado:** implementada en la biblioteca de formatos como Queens, exclusivamente con coronas y tablero curado 5 × 5. El generador y los tamaños mayores continúan como evolución futura.

Puzzle lógico de colocación en cuadrícula, conocido como **Queens** y representado temáticamente por gatos en **Meowdoku**. El jugador debe colocar exactamente un elemento en cada fila, cada columna y cada región de color. Además, dos elementos no pueden tocarse entre sí, ni siquiera en diagonal. La solución se obtiene mediante deducción y descarte, no mediante azar.

- **Interacción:** tocar una celda para alternar entre vacía, descartada y reina o gato colocado. Las marcas de descarte pueden editarse antes de confirmar; una colocación correcta elimina automáticamente las celdas incompatibles si se quiere ofrecer asistencia visual.
- **Puntuación:** resolver el tablero concede puntos por velocidad. Los errores, las ayudas utilizadas y las marcas incorrectas pueden reducir la puntuación; el tiempo dedicado a leer las reglas o animaciones debe quedar fuera del cronómetro competitivo.
- **Encaje:** puzzle de deducción compacto, reconocible y muy adecuado para móvil. Amplía la línea de mini-sudoku y mini-nonograma con regiones irregulares, restricciones de filas y columnas y una regla espacial de no contacto.
- **Relación con otros formatos:** comparte la colocación y el descarte de **Mini-sudoku**, además de la edición de celdas de **Mini-nonograma**, pero no usa números, subcuadrículas ni pistas numéricas. También se acerca a **Akari o Light Up mini** por sus restricciones espaciales, aunque el objetivo y la lógica son distintos.
- **Variantes:** versión neutra con reinas, versión Meowdoku con gatos, tableros de 5 × 5 a 9 × 9, modo diario con una semilla compartida, dificultad por forma de las regiones, pistas limitadas y modo contrarreloj.
- **Riesgo:** las regiones deben estar bien diferenciadas sin depender únicamente del color; cada una necesita una textura, patrón, borde o etiqueta accesible. El generador debe garantizar una solución única y evitar tableros que solo puedan resolverse por ensayo y error.

### Patches / Regiones rectangulares

Puzzle de partición de cuadrícula, relacionado con la familia Shikaku. El jugador debe dividir todo el tablero en rectángulos sin huecos ni solapamientos. Cada región contiene exactamente una pista: el número indica la cantidad de casillas que debe ocupar y el icono puede exigir que la región sea cuadrada, más alta que ancha, más ancha que alta o de cualquier orientación válida.

- **Interacción:** seleccionar una pista y arrastrar sobre la cuadrícula para dibujar un rectángulo que la incluya. La región puede editarse, eliminarse o redimensionarse antes de confirmar; el tablero se completa cuando todas las casillas pertenecen a una única región válida.
- **Puntuación:** resolver el tablero concede puntos por velocidad. Se pueden aplicar penalizaciones suaves por borrar y rehacer regiones, pedir pistas o realizar intentos inválidos; el tiempo de lectura de las reglas y las ayudas visuales debe quedar fuera del cronómetro competitivo.
- **Encaje:** lógica espacial clara, reglas explicables en segundos y buena adaptación a móvil. Obliga a razonar sobre áreas, bordes, esquinas y espacios restantes, con una solución que se puede revisar visualmente de forma inmediata.
- **Relación con otros formatos:** comparte la lógica de regiones de **Queens / Meowdoku**, pero aquí las regiones las construye el jugador y deben ser rectángulos. Se acerca a **Mini-nonograma** por la deducción sobre la cuadrícula y a **Dominó oculto** por la cobertura completa, aunque no usa pistas de filas, columnas ni pares de números. También tiene una relación espacial con **Tangram**, pero no utiliza piezas geométricas móviles.
- **Variantes:** pistas solo numéricas, cuadrados obligatorios, rectángulos altos o anchos, pistas sin número cuyo tamaño debe deducirse, tableros de 5 × 5 a 10 × 10, modo diario con semilla compartida, dificultad progresiva y solución única verificada.
- **Riesgo:** dibujar y redimensionar regiones debe ser cómodo en pantallas pequeñas, con controles discretos alternativos al arrastre. El generador debe garantizar que cada región tenga una sola pista, que cubra exactamente su área y que el tablero pueda resolverse sin depender de ensayo y error.

### Hashtag de palabras

Puzzle de palabras con una cuadrícula que forma un símbolo `#`. El jugador debe descubrir varias palabras ocultas que se cruzan y mover o intercambiar fichas de letras hasta colocarlas correctamente. Las intersecciones hacen que una misma letra pueda aportar información a dos palabras, por lo que hay que resolverlas de forma conjunta y no como anagramas independientes.

- **Interacción:** arrastrar una ficha sobre otra o intercambiar dos letras para reorganizar el tablero. Las letras correctas pueden quedar bloqueadas; las fichas usadas en intersecciones deben actualizar simultáneamente las palabras afectadas. La ronda termina al formar todas las palabras o al agotar el límite de movimientos.
- **Puntuación:** completar las palabras concede puntos por velocidad y por movimientos restantes. Cada intercambio puede consumir un movimiento; una variante más tolerante puede permitir movimientos libres y puntuar solo el tiempo. Las palabras completas y las letras correctas pueden ofrecer crédito parcial al agotarse el tiempo.
- **Encaje:** combina vocabulario, anagramas, razonamiento cruzado y planificación. Tiene una identidad visual clara y convierte la construcción de palabras en un puzzle de tablero, con más profundidad que formar una única palabra.
- **Relación con otros formatos:** es una evolución de **Anagramas y palabras desordenadas**, porque usa fichas de letras, y comparte el feedback de **Mini-Wordle** cuando muestra letras correctas o desplazadas. También reutiliza la interacción de **Rompecabezas deslizante**, pero el objetivo es resolver palabras cruzadas y no reconstruir una secuencia numérica.
- **Variantes:** cuatro palabras en una cuadrícula `#`, palabras de distintas longitudes, pistas temáticas, modo diario con tablero compartido, límite de intercambios, letras bloqueadas, casillas de intersección con doble valor y versión en español con vocabulario validado offline.
- **Riesgo:** el diccionario debe admitir flexiones, tildes, plurales y variantes razonables sin aceptar palabras oscuras. Las intersecciones deben producir una solución inequívoca, la cuadrícula debe ser legible en móvil y el sistema debe explicar si una letra amarilla pertenece a una o a varias palabras posibles.

### Tuberías o circuito cerrado

El jugador rota piezas para conectar una entrada con una salida, cerrar un circuito o activar varios nodos.

- **Interacción:** tocar una pieza para rotarla; el envío puede ser automático al conectar el objetivo.
- **Puntuación:** resolución exacta y velocidad; opcionalmente movimientos extra como dato de revisión.
- **Encaje:** muy visual, fácil de entender y con sensación de acción.
- **Riesgo:** las piezas deben ser legibles en móvil y el objetivo debe quedar claro sin tutorial largo.

### Flechas encadenadas

El jugador debe retirar o ejecutar varias flechas dibujadas sobre una cuadrícula en el orden correcto. Cada flecha representa un recorrido recto o con giros, y solo puede extraerse cuando su trayectoria está libre; intentar retirar una flecha bloqueada o provocar una colisión supone un error. La posición, dirección y longitud de las flechas determinan las dependencias entre ellas.

- **Interacción:** tocar una flecha para retirarla, siguiendo una secuencia válida. Las flechas disponibles pueden resaltarse de forma opcional; una acción incorrecta puede deshacer el último movimiento o terminar la ronda según la dificultad.
- **Puntuación:** completar el tablero concede puntos por velocidad; los errores, intentos de retirar flechas bloqueadas y movimientos innecesarios pueden reducir la puntuación. El progreso parcial puede conservarse al agotarse el tiempo.
- **Encaje:** puzzle visual muy rápido, con reglas intuitivas y una lectura competitiva clara. Combina planificación espacial, reconocimiento de trayectorias y gestión de dependencias sin exigir conocimiento externo.
- **Relación con otros formatos:** comparte la cuadrícula y el riesgo de bloqueo de **Conectar parejas**, además del movimiento ortogonal de **Laberinto contrarreloj**, pero su objetivo específico es resolver un orden de extracción. No es una variante de **Tuberías o circuito cerrado**, porque las piezas no se rotan para crear una red.
- **Riesgo:** las trayectorias deben ser suficientemente separadas y las colisiones inequívocas en móvil. El diseño necesita definir si una flecha desaparece completa al retirarse, si puede atravesar el espacio liberado y cómo se resuelven los cruces, solapamientos y retrocesos.
- **Variantes:** flechas rectas frente a trayectorias con giros, obstáculos fijos, flechas que desbloquean otras, límite de errores, modo contrarreloj por rondas y tableros con solución única.

### Zip / Una línea

Puzzle de recorrido numérico en una cuadrícula. El jugador comienza en la casilla marcada con `1` y dibuja una única línea continua que debe pasar por los números en orden —`1 → 2 → 3 → …`— mientras visita todas las casillas exactamente una vez. La línea no puede cruzarse consigo misma, reutilizar una casilla ni atravesar paredes o bloqueos.

- **Interacción:** pulsar o arrastrar desde el `1` y extender el recorrido celda a celda mediante movimientos ortogonales. Arrastrar hacia atrás deshace pasos; también se pueden ofrecer botones de deshacer, reiniciar y una ayuda que retire el camino hasta el primer error.
- **Puntuación:** completar el recorrido concede puntos por velocidad y resolución correcta. Puede añadirse una penalización suave por deshacer, pedir pistas o cometer movimientos inválidos; el tiempo de animaciones y la lectura inicial de las reglas deben quedar fuera del cronómetro.
- **Encaje:** reglas muy breves, razonamiento espacial claro y excelente adaptación táctil. Convierte un laberinto en un problema de planificación global: cada tramo entre números debe dejar espacio suficiente para completar el resto del tablero.
- **Relación con otros formatos:** comparte el movimiento ortogonal y la llegada a un objetivo con **Laberinto contrarreloj**, pero exige cubrir toda la cuadrícula y respetar una secuencia de números. Se acerca a **Conectar parejas** por la cobertura completa, aunque solo existe una línea continua y no varias parejas independientes. También comparte orden obligatorio con **Flechas encadenadas**, sin retirar piezas ni resolver colisiones entre trayectorias.
- **Variantes:** cuadrículas de 4 × 4 a 9 × 9, números más separados para aumentar la planificación, paredes entre celdas, casillas bloqueadas, modo diario con semilla compartida, límite de tiempo, solución única y versión sin números con puntos de control mediante símbolos o colores.
- **Riesgo:** el trazado libre debe ser cómodo y preciso en móvil, con una alternativa por toques discretos o teclado. El generador debe verificar que cada tablero tenga solución única, evitar recorridos ambiguos y mantener una dificultad progresiva basada en tamaño, separación entre números y cantidad de paredes.

### Rush Hour mini

Un tablero con vehículos o bloques deslizantes donde el jugador debe liberar una pieza objetivo moviendo obstáculos.

- **Interacción:** desplazar piezas en su eje permitido mediante toques o controles discretos.
- **Puntuación:** resolver antes de tiempo; los movimientos pueden registrarse sin penalizar o con una penalización suave.
- **Encaje:** desafío especial fuerte, reconocible y medible por tiempo.
- **Riesgo:** implementar arrastre, accesibilidad por teclado y validación de estados exige más cuidado que una cuadrícula estática.

### Anillas de colores

Puzzle de clasificación y apilado inspirado en las Torres de Hanoi y los juegos de tipo Color Sort. Hay varios palos con anillas de distintos colores y el jugador debe moverlas entre ellos hasta reunir en cada palo todas las anillas del mismo color. La restricción habitual es que solo puede moverse la anilla superior de cada pila y que una anilla no puede colocarse sobre un palo lleno.

- **Interacción:** tocar o arrastrar la anilla superior de un palo y después seleccionar el palo de destino. El movimiento debe ser reversible mientras la ronda siga activa; una animación breve debe dejar claro qué anilla está seleccionada y por qué un destino es válido o está bloqueado.
- **Puntuación:** completar todas las pilas concede puntos por velocidad y por eficiencia. La métrica principal puede ser el número de movimientos frente a una solución óptima; los movimientos extra pueden restar de forma suave para no castigar la experimentación.
- **Encaje:** reglas visuales inmediatas, interacción táctil sencilla y buena sensación de progreso. Aporta planificación y gestión de bloqueos sin depender de conocimiento externo, y puede funcionar como ronda rápida o desafío especial.
- **Relación con otros formatos:** comparte planificación y movimientos con **Rompecabezas deslizante**, columnas construidas con **Apilar bloques** y decisiones secuenciales con **Rush Hour mini**, pero su objetivo específico es clasificar anillas por color. No es una variante de **Tangram**, porque no hay que formar una silueta ni encajar piezas geométricas.
- **Variantes:** tres o más palos auxiliares, capacidad variable por palo, anillas con símbolos además de color, movimientos limitados, solución óptima visible al terminar, modo contrarreloj, niveles progresivos y versión tipo Torres de Hanoi con tamaños ordenados.
- **Riesgo:** los colores no deben ser la única forma de distinguir las anillas; cada una necesita símbolo, patrón o etiqueta accesible. El generador debe garantizar que el tablero sea resoluble, evitar estados redundantes y controlar la dificultad mediante número de palos, capacidad, colores y profundidad de las pilas.

### Laser mirror

El jugador coloca o rota espejos para dirigir un rayo hacia uno o varios objetivos evitando obstáculos.

- **Interacción:** rotar espejos, activar interruptores o elegir posiciones predefinidas.
- **Puntuación:** objetivos alcanzados, errores y velocidad.
- **Encaje:** visual, digital y con una identidad más espectacular que una pregunta clásica.
- **Riesgo:** conviene limitar las acciones posibles para evitar ensayo y error excesivo.

### Akari o Light Up mini

El jugador coloca bombillas en una cuadrícula para iluminar todas las casillas sin que dos bombillas se vean entre sí. Algunas paredes pueden exigir un número concreto de bombillas adyacentes.

- **Interacción:** alternar casillas entre vacía, bombilla y marca.
- **Puntuación:** iluminación correcta, conflictos y velocidad.
- **Encaje:** lógica espacial limpia y muy compatible con tableros pequeños.
- **Riesgo:** necesita feedback visual claro para celdas iluminadas, bloqueadas y conflictivas.

## Buenas candidatas como desafíos especiales

### Puentes o Hashiwokakero mini

El jugador conecta islas numeradas con puentes hasta satisfacer el número de conexiones de cada isla.

- **Interacción:** tocar entre dos islas para añadir, duplicar o quitar un puente.
- **Puntuación:** islas satisfechas, red válida y velocidad.
- **Encaje:** elegante, diferente y muy de deducción visual.
- **Riesgo:** dibujar conexiones en móvil sin errores de toque.

### Slitherlink mini

Una cuadrícula con números indica cuántos lados de cada celda forman parte de un único bucle cerrado.

- **Interacción:** activar o descartar segmentos de línea.
- **Puntuación:** progreso correcto, errores de segmentos y velocidad.
- **Encaje:** gran profundidad lógica con reglas breves.
- **Riesgo:** la interacción de líneas pequeñas puede ser incómoda; exige tamaños contenidos.

### Nurikabe mini

El jugador separa islas numeradas mediante celdas de agua, respetando tamaños y conectividad.

- **Interacción:** marcar cada celda como tierra, agua o incógnita.
- **Puntuación:** crédito por celdas correctas y penalización por contradicciones.
- **Encaje:** más profundo que un puzzle casual, apropiado para eventos o retos diarios.
- **Riesgo:** requiere explicar varias reglas sin frenar demasiado la partida.

### Dominó oculto

Una cuadrícula de números debe cubrirse con fichas de dominó, usando cada par una sola vez.

- **Interacción:** seleccionar dos celdas adyacentes para formar o deshacer una ficha.
- **Puntuación:** fichas correctas, duplicados inválidos y velocidad.
- **Encaje:** mezcla reconocimiento visual, lógica y planificación.
- **Riesgo:** puede ser difícil de leer si el tablero crece; mejor usar versiones muy compactas.

### Tangram simplificado

El jugador reconstruye una silueta con pocas piezas geométricas. Podría empezar como una variante discreta, con posiciones y rotaciones predefinidas, antes de permitir arrastre libre.

- **Interacción:** elegir pieza, rotarla y colocarla en zonas de encaje.
- **Puntuación:** piezas colocadas correctamente, tiempo y quizá precisión.
- **Encaje:** memorable y muy diferenciador.
- **Riesgo:** arrastre, rotación y validación tolerante son caros de implementar bien.

## Ideas más experimentales

### Firewall

Una señal debe atravesar una red de nodos sin pasar por nodos bloqueados o peligrosos.

- **Interacción:** activar, desactivar o reordenar nodos para crear una ruta válida.
- **Puntuación:** llegada al destino, nodos seguros usados y velocidad.
- **Encaje:** convierte lógica de grafos en una prueba visual rápida.

### Caja fuerte de interruptores

Varios interruptores afectan a varios indicadores. El jugador debe encontrar la combinación que abre la caja fuerte.

- **Interacción:** alternar switches y observar cambios en indicadores.
- **Puntuación:** combinación correcta, intentos y velocidad.
- **Encaje:** buena versión digital de deducción causal.

### Ruta con combustible

El jugador elige una ruta por una cuadrícula con costes, llaves, puertas, recargas o penalizaciones.

- **Interacción:** mover una ficha o trazar un camino antes de confirmar.
- **Puntuación:** llegada al destino, recursos restantes y velocidad.
- **Encaje:** combina planificación y presión temporal sin depender de conocimiento externo.

### Cartografía ciega

Se muestra un mapa, plano o red durante pocos segundos y después se oculta. El jugador debe reconstruir una ruta, ubicar un punto o responder sobre conexiones.

- **Interacción:** fase breve de observación y fase de reconstrucción.
- **Puntuación:** precisión espacial y velocidad de respuesta.
- **Encaje:** extiende memoria relámpago hacia mapas y recorridos.

### Fábrica en cadena

El jugador ordena máquinas, filtros o transformadores para convertir una entrada en una salida objetivo.

- **Interacción:** ordenar módulos o seleccionar una cadena de operaciones.
- **Puntuación:** transformación correcta, pasos usados y velocidad.
- **Encaje:** permite retos de lógica, matemáticas, química, lenguaje o programación sin parecer una pregunta escolar.

### ADN o secuencia mutante

Una cadena debe corregirse o completarse siguiendo reglas de emparejamiento, mutación o traducción.

- **Interacción:** sustituir piezas, ordenar fragmentos o detectar la primera mutación inválida.
- **Puntuación:** posiciones correctas, errores y velocidad.
- **Encaje:** introduce ciencia y patrones simbólicos con una interacción compacta.

### Mercado flash

El jugador toma decisiones rápidas de compra, venta o asignación de recursos para maximizar un resultado bajo restricciones simples.

- **Interacción:** ajustar cantidades, elegir operaciones o seleccionar una cartera breve.
- **Puntuación:** valor final, restricciones cumplidas y tiempo.
- **Encaje:** añade optimización y riesgo calculado.
- **Riesgo:** debe evitar parecer una hoja de cálculo; las reglas tienen que caber en pantalla.

### Zebra puzzle mini

Versión reducida de los acertijos de deducción con personas, objetos, lugares o colores. El jugador completa una tabla pequeña a partir de pistas.

- **Interacción:** asignar relaciones en una matriz o elegir la respuesta final deducida.
- **Puntuación:** celdas correctas, contradicciones y velocidad.
- **Encaje:** profundidad lógica alta con contenido muy flexible.
- **Riesgo:** las pistas deben estar curadas para una solución única y una duración razonable.

## Juegos de reflejos, percepción y destreza

Estas ideas no dependen de conocimiento externo ni de deducción lógica. Miden coordinación, memoria sensorial, precisión motriz, ritmo, observación o ejecución bajo presión. Pueden ayudar a que The Flash se perciba menos como una colección de puzzles y más como una plataforma de retos rápidos.

### Timing perfecto

El jugador debe pulsar en el instante adecuado: cuando una barra cruza una zona, una aguja llega a una marca, dos formas se alinean o una señal entra en una ventana de acierto.

- **Interacción:** un único toque o tecla en el momento preciso; las variantes avanzadas pueden encadenar varias ventanas.
- **Puntuación:** precisión temporal respecto al centro de la ventana, rachas y velocidad de decisión cuando haya señales previas.
- **Encaje:** reglas instantáneas, mucha tensión y coste de contenido bajo.
- **Riesgo:** la puntuación debe compensar diferencias de rendimiento, refresco de pantalla y latencia táctil; conviene usar ventanas amplias en móvil.

### Movimiento anómalo

Varios elementos se mueven siguiendo el mismo patrón y uno se desvía por velocidad, trayectoria, ritmo, aceleración o dirección.

- **Interacción:** tocar el elemento anómalo antes de que termine la animación.
- **Puntuación:** acierto binario ajustado por velocidad; los fallos pueden cerrar la ronda o restar.
- **Encaje:** prueba puramente perceptiva, visual y muy rápida.
- **Riesgo:** las diferencias deben ser perceptibles sin depender de pantallas grandes, brillo o tasa de refresco; el movimiento reducido necesita una variante equivalente.

### Escena robada

Se muestra una escena durante unos segundos y después reaparece con un elemento eliminado, cambiado de posición o alterado. El jugador identifica qué ha cambiado.

- **Interacción:** fase breve de observación y elección posterior entre objetos, zonas o nombres.
- **Puntuación:** acierto, velocidad y posible crédito por señalar la zona correcta aunque el objeto no se nombre.
- **Encaje:** extiende memoria relámpago hacia escenas más expresivas y permite contenido visual memorable.
- **Riesgo:** las escenas deben estar diseñadas para que el cambio sea justo, visible y no dependa de detalles demasiado pequeños.

### Ritmo espejo

El jugador escucha o ve un patrón rítmico corto y lo reproduce tocando en el mismo orden y tempo.

- **Interacción:** repetir golpes, colores o botones tras la reproducción del patrón.
- **Puntuación:** orden correcto, desviación temporal respecto al ritmo original y velocidad de inicio.
- **Encaje:** añade una habilidad distinta a conocimiento, lógica y memoria visual; funciona bien como reto especial breve.
- **Riesgo:** el audio no puede ser el único canal; debe existir una representación visual equivalente y una tolerancia suficiente para dispositivos táctiles.

### Línea limpia

El jugador traza una línea por un canal, contorno o recorrido estrecho sin tocar bordes ni obstáculos.

- **Interacción:** arrastrar o guiar un cursor desde inicio a meta; en teclado puede usarse movimiento discreto.
- **Puntuación:** llegada, precisión del trazado, colisiones y tiempo.
- **Encaje:** destreza clara, tensión física y revisión visual del recorrido.
- **Riesgo:** el arrastre fino puede ser injusto en móvil; los canales necesitan grosor adaptable y controles accesibles alternativos.

### Apilar bloques

Piezas en movimiento deben soltarse cuando están alineadas para construir una torre, columna o forma estable.

- **Interacción:** tocar para soltar cada bloque; los bloques mal alineados reducen la superficie disponible o generan inestabilidad.
- **Puntuación:** altura alcanzada, alineación media, errores y velocidad.
- **Encaje:** muy digital, comprensible y con progreso visible en segundos.
- **Riesgo:** si se basa en física real, pequeñas diferencias de simulación pueden afectar la comparabilidad; una física discreta o determinista sería más adecuada.

### Dibujo relámpago

El jugador copia una forma simple, símbolo o contorno en pocos segundos. La validación compara el trazo con una referencia geométrica tolerante.

- **Interacción:** dibujar con dedo, ratón o lápiz; también puede limitarse a uno o pocos trazos.
- **Puntuación:** similitud de forma, cobertura, proporción, continuidad y tiempo.
- **Encaje:** aporta creatividad controlada y una revisión muy visual.
- **Riesgo:** evaluar dibujos de forma justa es difícil; conviene empezar con siluetas simples y métricas transparentes.

### Bandeja saturada

Objetos aparecen de forma continua y el jugador debe enviarlos a zonas de destino según señales visuales simples, como color, forma, tamaño o icono.

- **Interacción:** arrastrar, tocar destino o usar controles rápidos para clasificar objetos entrantes.
- **Puntuación:** objetos correctos, errores, objetos perdidos y racha.
- **Encaje:** mide atención, gestión de presión y coordinación sin requerir cultura general.
- **Riesgo:** puede saturar la interfaz en móvil; el ritmo de aparición debe adaptarse al tamaño de pantalla y a la precisión táctil.

## Microjuegos avanzados 2D y 3D

Estas ideas asumen una capa de juego más ambiciosa, probablemente con Phaser para 2D o Three.js/React Three Fiber para 3D. Encajan mejor como desafíos especiales, eventos, finales de etapa o formatos premium de la biblioteca. La regla de producto debería mantenerse: partidas breves, objetivos obvios, puntuación comparable y simulaciones deterministas cuando haya física.

### Carril de reflejos

Un personaje, nave o marcador avanza automáticamente por varios carriles. El jugador cambia de carril para recoger señales válidas y evitar obstáculos o distractores.

- **Motor sugerido:** Phaser o canvas 2D.
- **Interacción:** deslizar, tocar carriles o usar izquierda/derecha; el avance no se detiene.
- **Puntuación:** objetivos recogidos, obstáculos evitados, racha, colisiones y tiempo sobrevivido.
- **Encaje:** simple, móvil, arcade y muy legible en sesiones de diez a treinta segundos.
- **Riesgo:** la velocidad debe calibrarse para no convertir el reto en puro reflejo; los carriles necesitan objetivos grandes y estados visuales claros.

### Carga y suelta

El jugador mantiene pulsado para cargar potencia, ángulo o energía y suelta en el momento adecuado para lanzar un objeto a una diana, encajar una pieza o alcanzar una zona.

- **Motor sugerido:** Phaser, canvas 2D o física determinista sencilla.
- **Interacción:** mantener pulsado, observar la carga y soltar; puede combinarse con dirección fija o ajuste de ángulo.
- **Puntuación:** distancia al objetivo, potencia usada, tiempo y número de intentos.
- **Encaje:** precisión física inmediata, reglas comprensibles y mucha tensión en un solo gesto.
- **Riesgo:** la simulación debe ser estable entre dispositivos; conviene empezar con trayectorias predecibles y tolerancias amplias.

### Puzzle de gravedad

El jugador rota el mundo, cambia la dirección de la gravedad o activa campos para que una bola llegue a una meta.

- **Motor sugerido:** Phaser con física 2D discreta o simulación propia simplificada.
- **Interacción:** rotar el tablero en pasos de 90 grados, activar gravedad o elegir entre pocas direcciones.
- **Puntuación:** llegada a meta, movimientos usados, objetivos secundarios y velocidad.
- **Encaje:** visual, fácil de entender y suficientemente diferente de un laberinto tradicional.
- **Riesgo:** la física libre puede generar resultados difíciles de reproducir; las acciones discretas ayudan a mantener justicia competitiva.

### Objeto rotado 3D

Se muestra un objeto 3D desde una perspectiva durante unos segundos. Después, el jugador debe identificar la misma pieza entre varias siluetas, orientarla correctamente o elegir la vista equivalente.

- **Motor sugerido:** Three.js o React Three Fiber.
- **Interacción:** elegir una opción, rotar una pieza con controles limitados o confirmar una orientación.
- **Puntuación:** acierto exacto, desviación angular y velocidad.
- **Encaje:** usa el 3D con propósito real: memoria espacial, percepción y rotación mental.
- **Riesgo:** hay que evitar modelos visualmente ambiguos; iluminación, cámara y escala deben mantenerse consistentes.

### Cámara perdida

El jugador ve una escena o composición desde un encuadre concreto y después debe mover la cámara hasta recuperar esa vista.

- **Motor sugerido:** Three.js o React Three Fiber.
- **Interacción:** rotar, acercar o desplazar la cámara dentro de límites claros; confirmar cuando el encuadre coincide.
- **Puntuación:** proximidad de cámara, orientación, encuadre y tiempo.
- **Encaje:** original, memorable y muy propio de un medio digital.
- **Riesgo:** demasiada libertad de cámara puede frustrar; conviene usar controles guiados, pocas dimensiones de movimiento y tolerancias visibles.

### Túnel de reflejos

El jugador avanza por un túnel 3D y esquiva puertas, paredes u obstáculos desplazándose entre posiciones discretas.

- **Motor sugerido:** Three.js, React Three Fiber o WebGL ligero.
- **Interacción:** mover lateralmente, cambiar altura o rotar entre carriles; el avance es automático.
- **Puntuación:** distancia recorrida, obstáculos evitados, objetos recogidos y colisiones.
- **Encaje:** espectacular, rápido y controlable si se limita a pocos carriles.
- **Riesgo:** puede ser costoso en rendimiento móvil; requiere pruebas de cámara, mareo visual, movimiento reducido y lectura clara de profundidad.

### Láser 3D

El jugador orienta espejos, prismas o nodos para guiar un rayo por una escena tridimensional hasta uno o varios objetivos.

- **Motor sugerido:** Three.js o React Three Fiber.
- **Interacción:** rotar piezas en pasos discretos, cambiar prismas o activar interruptores.
- **Puntuación:** objetivos alcanzados, piezas correctas, acciones usadas y velocidad.
- **Encaje:** muy diferencial y con identidad visual fuerte; puede ser un formato estrella de desafío especial.
- **Riesgo:** más ambicioso que su versión 2D: necesita cámara comprensible, oclusiones controladas y una validación visual fácil de leer.

### Jefe final de etapa

Contenedor de microjuegos especiales que aparece al cierre de una etapa. No es una mecánica única, sino una forma de introducir retos arcade o 3D sin alterar todas las preguntas normales.

- **Motor sugerido:** depende del jefe: Phaser para 2D, Three.js/React Three Fiber para 3D o componentes React si la mecánica es discreta.
- **Interacción:** una prueba de treinta a sesenta segundos que resume una habilidad principal: reflejos, memoria, precisión, ritmo o percepción.
- **Puntuación:** puntos propios del reto, bonus de etapa o multiplicador controlado para que no eclipse las preguntas anteriores.
- **Encaje:** da cierre dramático, variedad y sensación de evento.
- **Riesgo:** si pesa demasiado en la puntuación, puede invalidar el rendimiento previo; debe ser opcional por etapa o aparecer con expectativas claras.

## Priorización sugerida

| Objetivo                                 | Ideas prioritarias                                            | Motivo                                                                           |
| ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Implementación relativamente contenida   | Mastermind visual, Buscaminas relámpago, Tuberías             | Usan cuadrículas o fichas simples y reglas conocidas.                            |
| Mayor diferenciación visual              | Laser mirror, Rush Hour mini, Tangram simplificado            | Se sienten como retos digitales, no como variantes de trivia.                    |
| Continuidad con puzzles ya implementados | Kakuro mini, Akari, Battleship lógico                         | Amplían la línea de sudoku, nonograma, laberinto y rompecabezas.                 |
| Retos especiales de más duración         | Rush Hour mini, Hashiwokakero, Slitherlink, Nurikabe          | Admiten sesiones de uno a cinco minutos con progreso visible.                    |
| Creatividad temática                     | Firewall, Fábrica en cadena, ADN, Mercado flash               | Permiten vestir la lógica con dominios variados y contenido propio.              |
| Reflejos y precisión                     | Timing perfecto, Línea limpia, Apilar bloques                 | Introducen ejecución física medible con reglas casi instantáneas.                |
| Percepción y memoria sensorial           | Movimiento anómalo, Escena robada, Ritmo espejo               | Amplían The Flash hacia observación, ritmo y memoria de corto plazo.             |
| Gestión de presión en tiempo real        | Bandeja saturada                                              | Permite retos de coordinación con dificultad escalable por ritmo.                |
| Microjuegos 2D accesibles                | Carril de reflejos, Carga y suelta, Puzzle de gravedad        | Añaden sensación arcade con reglas simples y alcance técnico razonable.          |
| Uso significativo de 3D                  | Objeto rotado 3D, Cámara perdida, Túnel de reflejos, Láser 3D | Justifican WebGL mediante profundidad, cámara, orientación o espectáculo visual. |
| Eventos de etapa                         | Jefe final de etapa                                           | Permite introducir formatos avanzados sin romper el ritmo de las preguntas base. |

## Shortlist inicial

Para una primera tanda de exploración, las candidatas más equilibradas serían:

1. **Buscaminas relámpago**, por reconocimiento, tensión y coste moderado.
2. **Mastermind visual**, por aprovechar la base conceptual de código lógico con una interfaz más táctil.
3. **Tuberías**, por ser visual, rápida y fácil de explicar.
4. **Battleship lógico**, por mezclar deducción espacial y una fantasía conocida.
5. **Kakuro mini**, por continuidad con los puzzles numéricos existentes.
6. **Laser mirror**, por identidad digital y potencial como formato memorable.
7. **Rush Hour mini**, como desafío especial de mayor ambición.
8. **Akari**, como puzzle lógico compacto con buena puntuación parcial.
9. **Timing perfecto**, por simplicidad extrema y tensión inmediata.
10. **Movimiento anómalo**, por aportar percepción pura sin conocimiento ni deducción.
11. **Escena robada**, por evolucionar memoria relámpago hacia escenas más ricas.
12. **Ritmo espejo**, por abrir una línea audiovisual accesible con versión visual.
13. **Línea limpia**, por incorporar destreza y precisión táctil.
14. **Apilar bloques**, por su progreso visible y potencial arcade.
15. **Dibujo relámpago**, por creatividad controlada y revisión visual.
16. **Bandeja saturada**, por medir atención dividida y presión en tiempo real.
17. **Carril de reflejos**, por ser el microjuego 2D más simple, móvil y arcade.
18. **Carga y suelta**, por precisión física inmediata con una sola acción.
19. **Puzzle de gravedad**, por ser visual, claro y distinto del laberinto clásico.
20. **Objeto rotado 3D**, por usar profundidad y orientación con propósito jugable.
21. **Cámara perdida**, por su originalidad y potencial memorable.
22. **Túnel de reflejos**, por ofrecer espectáculo 3D con controles discretos.
23. **Láser 3D**, por ser más ambicioso pero muy diferencial.
24. **Jefe final de etapa**, como contenedor para probar formatos avanzados sin cambiar toda la estructura.
