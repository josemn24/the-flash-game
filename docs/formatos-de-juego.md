# Modos de juego: estado y evolución

## Propósito

The Flash es actualmente un sprint de preguntas individual con dos etapas locales, veintitrés formatos y una biblioteca con ejemplos jugables. Puede evolucionar hacia una plataforma de retos rápidos y desafíos especiales, también en multijugador online. La variedad no debe diluir la identidad del producto: cada prueba debe conservar tensión, reglas comprensibles y una forma clara de comparar la ejecución entre jugadores.

Este documento distingue las mecánicas ya disponibles de las candidatas para futuras etapas, eventos y modos competitivos. No compromete por sí mismo el alcance de una siguiente versión.

## Estado actual

La aplicación soporta de forma nativa:

- elección múltiple, también con imagen o ilustración;
- verdadero o falso;
- respuesta corta con normalización y respuestas equivalentes;
- ordenar elementos;
- clasificación con crédito parcial;
- código lógico con varios intentos;
- estimación con puntuación por proximidad;
- encontrar el intruso con elementos de texto o imagen;
- emparejar conceptos con validación inmediata y crédito por pareja;
- adivinanzas por pistas con respuesta abierta, máximo decreciente y un único intento;
- mapa de calor con selección espacial y crédito por proximidad;
- etiquetar imagen con asociación múltiple o identificación de una única zona;
- memoria relámpago con reconstrucción espacial de una cuadrícula tras una exposición breve;
- Simon con repetición visual de una secuencia fija de símbolos;
- matrices lógicas con una pieza faltante y opciones de respuesta;
- mini-sudoku 4 × 4 con edición previa a confirmar y crédito por casilla correcta;
- mini-nonograma 5 × 5 con pistas de filas y columnas, edición reversible y crédito neto por relleno;
- rompecabezas deslizante 3 × 3 con fichas numéricas y resolución automática;
- reconstrucción del error con detección del primer paso inválido y corrección guiada opcional;
- anagramas de una palabra mediante fichas de letras, incluidas letras repetidas;
- Mini-Wordle de cuatro letras y cuatro intentos con feedback por posición.
- imagen progresivamente revelada con desenfoque automático y un único intento.
- laberinto contrarreloj con movimiento ortogonal mediante cruceta o teclado.

Cada formato tiene una ficha editorial y un ejemplo cronometrado que reutiliza la misma entrada, evaluación y puntuación que las etapas. La segunda etapa, «Conexiones rápidas», utiliza ordenar, estimación, código lógico y clasificación; también contiene una secuencia resuelta como elección múltiple.

En el catálogo siguiente se usan estos estados:

- **Implementada:** existe como tipo de pregunta nativo y jugable.
- **Disponible como contenido:** puede plantearse con un formato actual, pero no tiene interacción propia.
- **Futura:** requiere un nuevo modelo, interfaz o reglas específicas.

## Principios de diseño

- **Rapidez con sentido:** la velocidad debe importar, pero nunca sustituir una respuesta correcta.
- **Comparabilidad:** cada prueba debe ofrecer una métrica competitiva comprensible: acierto, tiempo, precisión, intentos o una combinación explícita de ellas.
- **Variedad útil:** alternar conocimiento, lógica, memoria, lenguaje y percepción evita que The Flash se perciba como un cuestionario convencional.
- **Móvil primero:** las interacciones táctiles deben ser cómodas, con pocos elementos arrastrables y objetivos amplios.
- **Ritmo por capas:** las pruebas rápidas duran segundos; los desafíos especiales pueden durar entre uno y cinco minutos y aparecer de forma ocasional.
- **Dificultad justa:** los formatos visuales o táctiles necesitan validación tolerante y diseño adaptado a distintos tamaños de pantalla.

## Catálogo de mecánicas

### 1. Ordenar elementos — Implementada

El jugador coloca varios elementos en el orden correcto: acontecimientos históricos, películas por fecha, países por población, pasos de un proceso, una frase o magnitudes.

- **Interacción actual:** controles accesibles para subir y bajar cada elemento; el orden completo se confirma antes de enviarse.
- **Encaje:** intuitiva, competitiva y precisa para medir resultado y tiempo; sirve para cultura, lógica y lenguaje.
- **Límite recomendado:** entre cuatro y seis elementos para evitar fricción en móvil.

### 2. Encontrar el intruso — Implementada

Se muestran varios elementos y el jugador identifica cuál rompe una relación: una palabra de otra categoría, un número que no sigue la regla, una imagen distinta, un personaje ajeno a una saga o una bandera de otro continente.

- **Encaje:** reglas inmediatas, rondas de segundos y dificultad escalable.
- **Ventaja:** coste de producción e implementación bajo; contenido muy reutilizable.
- **Interacción actual:** entre tres y seis tarjetas de texto o imagen; tocar una tarjeta envía inmediatamente la respuesta.
- **Puntuación actual:** acierto exacto ajustado por velocidad; un fallo resta el 20 % y agotar el tiempo no puntúa.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen.

### 3. Emparejar conceptos — Implementada

El jugador une elementos relacionados, como países y capitales, autores y obras, inventos e inventores, conceptos y definiciones o imágenes y nombres.

- **Interacción actual:** elegir una tarjeta de cada columna; los aciertos quedan bloqueados y los errores se liberan para reintentarlos.
- **Encaje:** convierte conocimiento en una acción activa y conserva reglas accesibles para ratón, teclado y pantallas táctiles.
- **Contenido compatible:** texto o imágenes; las tarjetas visuales muestran solo la imagen y conservan una etiqueta accesible.
- **Puntuación actual:** crédito por cada pareja correcta ajustado por el tiempo total; cada intento incorrecto resta un 10 % de los puntos base, con un mínimo de cero, y el progreso se conserva al agotarse el límite.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen.

### 4. Secuencias y patrones — Disponible como contenido

El jugador descubre el siguiente elemento de una serie numérica, de símbolos, colores, letras, palabras o movimientos espaciales.

- **Encaje:** introduce lógica pura y equilibra los formatos memorísticos.
- **Estado actual:** puede resolverse mediante elección múltiple o respuesta corta; todavía no existe un constructor de secuencias específico.

### 5. Clasificación rápida — Implementada

Varias tarjetas deben repartirse entre categorías: mamífero, ave o reptil; país europeo, asiático o africano; real o ficticio; hecho o mito; sustantivo, adjetivo o verbo.

- **Interacción actual:** matriz de categorías con selección explícita para cada elemento y confirmación final.
- **Formato recomendado:** entre tres y ocho elementos.
- **Encaje:** encadena decisiones rápidas y compara muy bien la velocidad de varios jugadores.

### 6. Memoria relámpago — Implementada

Una composición se muestra durante unos segundos y después se oculta. El jugador debe recordar elementos, posiciones, un orden, relaciones entre nombres e imágenes o detalles de una escena.

- **Encaje:** convierte la breve exposición y la reconstrucción contrarreloj en una misma mecánica de memoria.
- **Valor:** permite dificultad alta con reglas simples.
- **Interacción actual:** la primera variante muestra una cuadrícula completa 2 × 2 durante tres segundos. Después, el jugador selecciona cada ficha y la coloca en la posición que recuerda; puede retirar y recolocar fichas antes de confirmar.
- **Puntuación actual:** el cronómetro comienza al iniciarse la reconstrucción, no durante la exposición. Cada posición correcta recibe crédito parcial ajustado por velocidad; no hay penalización por recolocar.

### 7. Diferencias visuales — Futura

El jugador encuentra una o varias diferencias entre dos imágenes: una única diferencia, todas las diferencias, el elemento añadido o eliminado, o una zona concreta pulsable.

- **Encaje:** formato reconocido, visual y accesible.
- **Riesgo:** las imágenes y zonas pulsables deben prepararse y escalarse cuidadosamente para cada pantalla.

### 8. Pregunta de estimación — Implementada

El jugador responde un valor aproximado; una respuesta más cercana obtiene mejor puntuación. Puede estimar una distancia, año, altura, cantidad de personas o porcentaje.

- **Interacción actual:** valor visible y botones de incremento o decremento dentro de un rango y paso configurables.
- **Encaje:** evita el acierto binario y produce comparativas interesantes aun cuando nadie acierte exactamente.
- **Puntuación actual:** proximidad al valor real ajustada por el tiempo empleado.

### 9. Imagen progresivamente revelada — Implementada

Una imagen comienza borrosa y se revela automáticamente con el tiempo. El jugador debe identificar personajes, lugares, banderas, películas, animales, obras de arte o logotipos cuanto antes.

- **Encaje:** premia directamente la rapidez, pero mantiene un riesgo al responder antes.
- **Identidad:** es una de las mecánicas que mejor representa el nombre y el espíritu de The Flash.
- **Interacción actual:** la carga termina antes de iniciar el cronómetro; después, el desenfoque cae de 32 px a cero y se puede enviar una única respuesta de texto en cualquier momento.
- **Puntuación actual:** acierto binario ajustado por velocidad; una respuesta incorrecta o el timeout conceden cero puntos.
- **Accesibilidad:** se anuncian carga e hitos de revelado, el modo de movimiento reducido usa cuatro pasos y la revisión incorpora una descripción completa. Por su naturaleza, la prueba no ofrece una experiencia equivalente sin visión sin revelar la solución.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen.

### 10. Anagramas y palabras desordenadas — Implementada

El jugador reordena letras, sílabas o fragmentos para formar una palabra o frase; también puede resolver una palabra a partir de una pista o crear el mayor número posible de palabras.

- **Interacción actual:** seleccionar fichas de letras para construir una palabra, retirar la última ficha o reiniciar antes de enviarla. Un fallo termina la ronda.
- **Encaje:** sencillo de entender, barato de producir y eficaz bajo presión.
- **Puntuación actual:** formar la palabra exacta recibe puntos por velocidad; un fallo o timeout no puntúan.

### 11. Objetos ocultos — Futura

El jugador encuentra uno o varios elementos dentro de una escena: un objeto concreto, todos los símbolos de un tipo, un personaje, una cantidad de elementos o el único objeto que cumple una condición.

- **Encaje:** atractivo visual y apropiado como desafío especial de uno o varios minutos.
- **Riesgo:** exige ilustraciones o imágenes diseñadas para el reto.

### 12. Código o combinación lógica — Implementada

El jugador deduce un código a partir de pistas. Por ejemplo, las combinaciones `682`, `614` y `206` indican cifras correctas y su posición. El mismo formato puede usar colores, símbolos, palabras, interruptores, posiciones u operaciones.

- **Encaje:** prueba estrella con tensión, estrategia y recorrido más largo.
- **Interacción actual:** campos por cifra, pistas siempre visibles e intentos repetidos hasta acertar o agotar el tiempo.
- **Puntuación actual:** velocidad con una reducción del 10 % de los puntos base por intento fallido.
- **Uso actual:** una de las preguntas de cierre de la etapa «Conexiones rápidas» y ejemplo jugable en su ficha.

### 13. Mini-Wordle — Implementada

El jugador descubre una palabra de cuatro letras en un máximo de cuatro intentos. Cada palabra enviada indica qué letras están colocadas, desplazadas o ausentes; los recuentos evitan revelar coincidencias duplicadas que no existen en la solución.

- **Encaje:** conocido y fácil de entender.
- **Interacción actual:** campo de texto nativo con envío por botón o Enter y validación mediante un vocabulario español general generado offline. El diccionario se carga antes de iniciar el cronómetro; los intentos inválidos no consumen oportunidades.
- **Puntuación actual:** resolver recibe crédito ajustado por velocidad y cada intento fallido previo resta el 10 % de los puntos base. Agotar intentos o tiempo no puntúa.
- **Uso recomendado:** desafío especial, por su duración mayor que una pregunta normal.

### 14. Simon o repetición de secuencias — Implementada

Se reproduce una secuencia de colores, sonidos, símbolos, posiciones o ritmos y el jugador la repite. Puede crecer en longitud, exigir repetición inversa o pedir que se detecte un elemento incorrecto.

- **Encaje:** combina memoria, reflejos y precisión.
- **Interacción actual:** cuatro botones con símbolo, etiqueta y color se iluminan siguiendo una secuencia fija de cuatro a seis pasos. Al terminar, el jugador la repite; un error termina la ronda.
- **Puntuación actual:** la reproducción no cuenta para el cronómetro. Un acierto exacto recibe puntos por velocidad durante la repetición; un error o timeout no puntúan.

### 15. Matrices lógicas — Implementada

Una cuadrícula de símbolos o imágenes contiene una casilla vacía; el jugador elige la opción que completa el patrón.

- **Encaje:** aporta razonamiento abstracto y escala de niveles sencillos a exigentes.
- **Interacción actual:** una matriz 3 × 3 presenta ocho símbolos y una casilla vacía. El jugador elige, entre cuatro opciones, la pieza que completa el patrón.
- **Puntuación actual:** un acierto exacto premia la velocidad; un fallo resta el 20 % y el timeout no puntúa.

### 16. Mini-nonograma — Implementada

El jugador completa una cuadrícula 5 × 5 a partir de las pistas numéricas de sus filas y columnas.

- **Interacción actual:** el jugador selecciona celdas y puede rellenarlas o marcarlas vacías antes de confirmar; también puede enviar una solución incompleta.
- **Puntuación actual:** los rellenos correctos suman crédito y los rellenos erróneos lo restan, con un mínimo de cero y ajuste por velocidad. El timeout evalúa el borrador.
- **Encaje:** diferenciador y más profundo que una pregunta convencional.

### 17. Laberinto contrarreloj — Implementada

El jugador guía un elemento desde la entrada a la salida mediante botones direccionales o flechas del teclado.

- **Encaje:** mide con claridad tiempo y precisión.
- **Interacción actual:** cuadrícula ortogonal de 5 × 5 a 9 × 9, cruceta táctil, flechas, retroceso permitido y resolución automática al alcanzar la salida.
- **Puntuación actual:** resolución binaria ajustada por velocidad; los movimientos adicionales no penalizan y el timeout conserva el recorrido con cero puntos.
- **Accesibilidad:** la v1 evita el arrastre libre, deshabilita direcciones bloqueadas, mantiene el foco y anuncia posición, muros y movimientos.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen.

### 18. Mini-sudoku — Implementada

Adaptación del sudoku tradicional en una cuadrícula 4 × 4: el jugador completa tres o cuatro casillas vacías usando números del 1 al 4.

- **Encaje:** conocido, objetivo y competitivo.
- **Interacción actual:** las pistas quedan bloqueadas; se selecciona una casilla vacía y se escribe, reemplaza o borra un número antes de confirmar la cuadrícula completa.
- **Puntuación actual:** cada casilla correcta recibe crédito parcial ajustado por velocidad. El timeout evalúa el borrador y no hay penalización por corregir valores.

### 19. Rompecabezas deslizante — Implementada

Una cuadrícula 3 × 3 de ocho fichas numeradas y un hueco debe reconstruirse desplazando únicamente las fichas adyacentes al espacio libre.

- **Interacción actual:** tocar una ficha adyacente al hueco la desliza; las flechas ofrecen el mismo control por teclado. La ronda se envía automáticamente al completar el orden objetivo.
- **Puntuación actual:** resolver el tablero recibe puntos por velocidad. Los movimientos se registran para revisión, pero no penalizan; un timeout no puntúa.
- **Encaje:** visual y fácilmente medible por tiempo.

### 20. Tangram o construcción de figura — Futura

El jugador forma una silueta con piezas geométricas: tangram clásico, bloques, piezas encajables o copia de una composición mostrada antes.

- **Encaje:** desafío especial memorable y muy diferenciador.
- **Riesgo:** exige arrastre, rotación, colisiones, ajuste de piezas y validación tolerante; es una de las mecánicas más complejas de implementar correctamente.

### 21. La regla secreta — Futura

Se muestran varios ejemplos aceptados y rechazados. El jugador debe descubrir qué regla los separa y después clasificar nuevos elementos conforme a ella.

Por ejemplo:

- **Aceptados:** Roma, Oslo y Lima.
- **Rechazados:** Madrid, Berlín y París.
- **Regla secreta:** capitales con cuatro letras.

A partir de ahí:

- **Interacción:** observar los ejemplos iniciales y asignar cada elemento nuevo a «aceptado» o «rechazado»; opcionalmente, elegir o escribir la regla al final.
- **Encaje:** combina inducción, conocimiento y deducción, ofrece una variedad enorme y permite alcanzar dificultades muy altas sin complicar la interacción.
- **Riesgo:** cada conjunto debe descartar interpretaciones alternativas razonables; los ejemplos iniciales y de validación han de demostrar la regla de forma inequívoca.

### 22. El dato contaminado — Futura

Se entrega una ficha con varios datos relacionados, pero uno de ellos es falso y altera la respuesta. El jugador debe detectar el dato manipulado, ignorarlo y resolver correctamente la pregunta con la información restante.

Por ejemplo, una ficha sobre un país puede incluir su población, continente, capital y moneda, con uno de esos datos deliberadamente alterado.

- **Interacción:** marcar primero el dato contaminado y responder después la pregunta derivada de la ficha.
- **Encaje:** mide la capacidad de verificación interna, el pensamiento crítico y la resistencia a información engañosa.
- **Puntuación:** puede separar la detección del dato falso y la resolución final para conceder crédito parcial.
- **Riesgo:** la falsedad debe poder deducirse a partir de conocimientos razonables o de contradicciones internas; no debería depender de información oscura ni de datos sujetos a cambios frecuentes.

### 23. Respuesta en cadena — Futura

Cada respuesta correcta se convierte en la pista o punto de partida de la siguiente pregunta. La cadena puede combinar historia, cine, geografía, música y lenguaje para construir un recorrido temático.

Por ejemplo:

1. Capital de Italia → Roma.
2. Personaje fundacional asociado a Roma → Rómulo.
3. Hermano de Rómulo → Remo.
4. Obra, canción o concepto relacionado con «Remo» → siguiente eslabón.

- **Interacción:** resolver una sucesión breve de preguntas; cada respuesta desbloquea el siguiente eslabón.
- **Encaje:** crea sensación de progreso y permite pruebas especiales con narrativa, giros temáticos y dificultad creciente.
- **Puntuación:** puede combinar eslabones completados, errores y tiempo total; las ayudas evitarían que un fallo inicial bloquee toda la cadena, a cambio de una penalización.
- **Riesgo:** las relaciones deben ser inequívocas y la dificultad de un eslabón no debería decidir por sí sola el resultado de toda la prueba.

### 24. Adivinanzas por pistas — Implementada

El jugador intenta identificar un personaje, lugar, objeto, obra o concepto. Puede descubrir pistas sucesivas, pero cada una reduce la puntuación máxima disponible, por lo que debe decidir cuándo tiene suficiente información para responder.

Por ejemplo, para adivinar un personaje las pistas pueden revelar progresivamente su siglo, profesión, país, campo de investigación e iniciales.

- **Interacción actual:** la primera pista de texto aparece al comenzar; el jugador puede revelar las siguientes o enviar una única respuesta abierta en cualquier momento. Un fallo termina la ronda.
- **Encaje:** combina conocimiento, autoconfianza y gestión del riesgo con una regla fácil de comprender.
- **Puntuación actual:** cada pista adicional resta una cantidad fija del máximo visible y la velocidad ajusta después los puntos restantes; un fallo o el timeout no puntúan.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen.
- **Riesgo:** las primeras pistas deben ser difíciles pero útiles, y su orden debe calibrarse para que cada revelación reduzca de manera apreciable el espacio de respuestas posibles.

### 25. Mapa de calor — Implementada

Se muestra un mapa, gráfico o escena y el jugador debe señalar una ubicación. Puede localizar una ciudad, marcar el lugar de un acontecimiento o estimar el centro geográfico de un país.

- **Interacción actual:** colocar y recolocar un único marcador sobre una superficie de proporción fija antes de confirmarlo. Con teclado se inicia en el centro y se mueve con las flechas.
- **Encaje:** es visual e intuitivo y permite combinar precisión y velocidad en una misma puntuación.
- **Puntuación actual:** la zona central concede precisión completa, alrededor hay crédito lineal decreciente y la velocidad ajusta el resultado. Las coordenadas y distancias son independientes del tamaño mostrado.
- **Uso actual:** tipo nativo y ejemplo jugable en la biblioteca; las dos etapas existentes todavía no lo incluyen. La primera versión no ofrece zoom, polígonos ni múltiples objetivos.
- **Riesgo:** la precisión no debe depender del tamaño de la pantalla ni de la destreza motriz; hacen falta coordenadas normalizadas, objetivos razonablemente amplios y controles equivalentes por teclado.

### 26. Etiquetar imagen — Implementada

Se muestra una imagen o diagrama. El jugador puede asociar varias etiquetas a sus anclajes o identificar una única zona que ya aparece señalada, una mecánica adecuada para anatomía, componentes de objetos y diagramas educativos.

- **Interacción actual:** en `assign-all`, seleccionar un anclaje y después una etiqueta textual, editar las asociaciones y confirmar el conjunto. En `identify-one`, responder a una única señal mediante elección inmediata o texto enviado por botón o teclado.
- **Encaje:** separa la identificación discreta de partes de la localización continua propia de Mapa de calor.
- **Puntuación actual:** el etiquetado múltiple concede crédito por asociación; la identificación única es binaria y premia velocidad. Una elección incorrecta resta el 20 %, un texto incorrecto no penaliza y el timeout puntúa cero.
- **Uso actual:** tipo nativo con dos ejemplos jugables —múltiple y único por elección— en la biblioteca; el contrato y la interfaz también admiten texto libre. Las dos etapas existentes todavía no lo incluyen. La primera versión no ofrece arrastre, zoom, medios dentro de las etiquetas ni anclajes creados por el jugador.
- **Riesgo:** los anclajes y textos deben mantenerse legibles y sin solapamientos en móvil; la numeración, el foco y el resumen textual deben permitir completar el ejercicio sin depender solo de la posición o el color.

### 27. La respuesta prohibida — Futura

Se formula una pregunta abierta, pero las respuestas más evidentes están expresamente prohibidas. Por ejemplo, nombrar un país de Sudamérica sin responder Brasil ni Argentina, o decir una palabra asociada al invierno sin usar «frío», «nieve» ni «Navidad».

- **Interacción:** escribir o elegir una respuesta válida mientras las opciones prohibidas permanecen visibles.
- **Encaje:** obliga a frenar respuestas automáticas y explorar conocimiento menos inmediato con muy poca complejidad de interacción.
- **Puntuación:** puede valorar acierto y velocidad; en partidas grupales, las respuestas menos repetidas podrían recibir una bonificación si todos comparten condiciones equivalentes.
- **Riesgo:** la validación de respuestas abiertas necesita un repertorio amplio de equivalencias y debe explicar con claridad por qué se rechaza una respuesta válida en apariencia.

### 28. Titular incompleto — Futura

El jugador reconstruye un titular, enunciado o ficha breve con huecos a partir de fragmentos disponibles. Puede aplicarse a historia, ciencia, cultura, deporte, geografía, tecnología o acontecimientos estables. La prueba no pregunta directamente por un dato: obliga a recomponer una frase coherente donde cada pieza ocupa una posición concreta.

Por ejemplo:

```text
En 1969, la misión ______ logró el primer ______ humano en la ______.
```

Fragmentos disponibles:

```text
Apolo 11 · alunizaje · Luna · Sputnik · vuelo · órbita
```

Solución:

```text
En 1969, la misión Apolo 11 logró el primer alunizaje humano en la Luna.
```

- **Interacción:** seleccionar un hueco y después una ficha de texto; las fichas usadas quedan bloqueadas y pueden retirarse antes de confirmar. Las rondas rápidas deberían usar entre dos y cinco huecos; los desafíos especiales podrían agrupar varios titulares o incluir más fragmentos.
- **Encaje:** convierte trivia en reconstrucción activa, combina conocimiento con contexto lingüístico y descarte, y permite revisar la solución con una explicación breve del hecho.
- **Puntuación:** crédito parcial por hueco correcto, bonus por completar todos los huecos y ajuste por velocidad. Las variantes con fragmento intruso pueden conceder un bonus adicional por dejarlo fuera; los errores podrían restar de forma suave para evitar rellenar al azar.
- **Variantes:** titular histórico, descubrimiento científico, premio cultural, marcador deportivo, ficha biográfica, falso titular con una pieza incorrecta, titular contaminado que exige corregir una palabra ya colocada o titular relámpago mostrado unos segundos antes de reconstruirse de memoria.
- **Riesgo:** el contenido debe basarse en hechos estables y formulaciones inequívocas. Las noticias recientes, datos sujetos a cambio o titulares con matices políticos pueden introducir ambigüedad editorial; los distractores deben ser plausibles sin convertir la prueba en una trampa lingüística.

### 29. Reconstrucción del error — Implementada

Se muestra una solución incorrecta y el jugador debe detectar el paso exacto en el que aparece el primer fallo, en lugar de resolver el problema desde cero. Puede aplicarse a una operación matemática, una cronología histórica, una clasificación científica, un razonamiento lógico, una traducción o un fragmento de código.

- **Interacción actual:** seleccionar el primer paso erróneo, cambiar la selección antes de confirmar y, cuando existe, elegir una corrección guiada opcional.
- **Encaje:** mide comprensión profunda, revisión crítica y conocimiento del proceso, no solo memorización del resultado.
- **Puntuación actual:** sin corrección, localizar el error recibe puntos por velocidad. Con corrección, localizarlo aporta el 60 % y corregirlo el 40 % restante; el timeout evalúa la selección ya realizada.
- **Riesgo:** todos los pasos anteriores al señalado deben ser inequívocamente válidos; un error que se propaga no debería contabilizarse como varios fallos independientes.

### 30. Pregunta con interferencias — Futura

La información se presenta de forma incompleta o imperfecta: texto parcialmente borrado, audio con ruido, una imagen fragmentada, palabras mezcladas con caracteres irrelevantes o datos visibles durante intervalos muy breves. El jugador debe reconstruir información suficiente para responder.

- **Interacción:** observar o reproducir el estímulo y responder mediante un formato existente; algunas variantes pueden permitir reducir la interferencia a cambio de puntos.
- **Encaje:** incorpora percepción, reconstrucción y tolerancia a la incertidumbre a las pruebas de conocimiento.
- **Accesibilidad:** la dificultad debe proceder de una regla controlada, no de barreras visuales, auditivas, cognitivas o motrices; cada reto necesita una variante equivalente cuando el canal utilizado no sea accesible.
- **Riesgo:** el nivel de degradación debe calibrarse y verificarse en distintos dispositivos para que siempre quede información suficiente y la respuesta no dependa del azar.

### 31. Eco — Futura

Se reproduce una secuencia visual o sonora y después aparece una segunda casi idéntica. El jugador debe determinar si ambas son exactamente iguales o identificar la diferencia, que puede afectar al orden, duración, intensidad, posición o número de elementos.

- **Interacción:** responder «igual» o «diferente» y, en variantes avanzadas, señalar el instante o elemento modificado.
- **Encaje:** combina memoria inmediata, atención y percepción con rondas breves y reglas muy claras.
- **Consideración competitiva:** el tiempo obligatorio de reproducción debe excluirse o normalizarse; solo el tiempo de decisión debería premiar la rapidez.
- **Riesgo:** las diferencias de audio, brillo, rendimiento o latencia entre dispositivos no deben alterar la dificultad ni revelar accidentalmente la respuesta.

### 32. Prueba espejo — Futura

Dos retos se presentan simultáneamente y las acciones realizadas en uno afectan al otro. Ordenar números a la izquierda puede mover letras a la derecha; corregir una secuencia visual puede alterar una operación; cada elemento descartado en un panel puede desaparecer también en el otro.

- **Interacción:** manipular dos paneles vinculados y anticipar el efecto de cada acción antes de confirmar la solución conjunta.
- **Encaje:** prueba especial de alta dificultad que combina planificación, atención dividida y razonamiento sobre sistemas relacionados.
- **Uso recomendado:** retos excepcionales de uno a cinco minutos, con tutorial interactivo y dificultad progresiva.
- **Riesgo:** la relación entre ambos paneles debe ser consistente y visible; una interfaz sobrecargada o efectos difíciles de anticipar convertirían la prueba en ensayo y error.

## Priorización de mecánicas pendientes

| Objetivo                                   | Mecánicas prioritarias                                             | Motivo                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Equilibrio entre diversión y coste técnico | Encontrar el intruso, emparejar conceptos y anagramas              | Amplían el juego con riesgo técnico contenido.                                      |
| Diferenciar The Flash de una trivia        | Objetos ocultos y pregunta con interferencias                      | Introducen habilidades e interacciones que van más allá de responder preguntas.     |
| Inducción y deducción                      | La regla secreta                                                   | Convierte la identificación de patrones en una clasificación activa.                |
| Pensamiento crítico                        | El dato contaminado                                                | Obliga a contrastar la información antes de utilizarla.                             |
| Comprensión profunda                       | Reconstrucción del error                                           | Evalúa procesos y permite localizar fallos en lugar de recordar solo resultados.    |
| Percepción y precisión                     | Mapa de calor, etiquetar imagen, pregunta con interferencias y Eco | Incorporan localización, identificación visual, reconstrucción sensorial y memoria. |
| Pruebas especiales                         | Respuesta en cadena y tangram                                      | Admiten retos ocasionales de uno a cinco minutos con mayor sensación de recorrido.  |
| Gestión del riesgo                         | La respuesta prohibida y el dato contaminado                       | Obligan a decidir entre una respuesta inmediata y una estrategia más prudente.      |
| Conocimiento menos inmediato               | La respuesta prohibida                                             | Premia alternativas válidas más allá de las asociaciones más obvias.                |
| Trivia reconstructiva                      | Titular incompleto y respuesta en cadena                           | Transforman el conocimiento en composición, descarte y progreso contextual.         |
| Competición por tiempo                     | Diferencias visuales y tangram                                     | Una ejecución correcta terminada antes representa una mejora clara.                 |

## Implicaciones para el futuro multijugador

Para que los resultados sean comparables en una partida online, cada formato deberá definir antes de construirse:

- la condición de éxito y los errores recuperables o definitivos;
- cómo se mide el tiempo, incluidos tiempos forzados de reproducción o animación;
- el modelo de puntuación: acierto, proximidad, penalizaciones e intento(s);
- el nivel o semilla compartida, para garantizar el mismo reto a todos los participantes;
- la protección frente a latencia y diferencias de dispositivo;
- la estrategia de contenido: datos estructurados, activos visuales y validación de calidad.

Como siguiente paso de producto, las diferencias visuales y los objetos ocultos ofrecen variedad con una identidad visual fuerte. Las nuevas pruebas especiales deberían llegar acompañadas de prototipos específicos de interacción móvil, contenido validado y reglas de puntuación explícitas.
