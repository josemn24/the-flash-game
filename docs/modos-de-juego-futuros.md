# Modos de juego: estado y evolución

## Propósito

The Flash es actualmente un sprint de preguntas individual con dos etapas locales, nueve formatos y una biblioteca con ejemplos jugables. Puede evolucionar hacia una plataforma de retos rápidos y desafíos especiales, también en multijugador online. La variedad no debe diluir la identidad del producto: cada prueba debe conservar tensión, reglas comprensibles y una forma clara de comparar la ejecución entre jugadores.

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
- encontrar el intruso con elementos de texto o imagen.
- emparejar conceptos con validación inmediata y crédito por pareja.

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

### 6. Memoria relámpago — Futura

Una composición se muestra durante unos segundos y después se oculta. El jugador debe recordar elementos, posiciones, un orden, relaciones entre nombres e imágenes o detalles de una escena.

- **Encaje:** hace que el cronómetro forme parte real de la mecánica, tanto al memorizar como al responder.
- **Valor:** permite dificultad alta con reglas simples.

### 7. Diferencias visuales — Futura

El jugador encuentra una o varias diferencias entre dos imágenes: una única diferencia, todas las diferencias, el elemento añadido o eliminado, o una zona concreta pulsable.

- **Encaje:** formato reconocido, visual y accesible.
- **Riesgo:** las imágenes y zonas pulsables deben prepararse y escalarse cuidadosamente para cada pantalla.

### 8. Pregunta de estimación — Implementada

El jugador responde un valor aproximado; una respuesta más cercana obtiene mejor puntuación. Puede estimar una distancia, año, altura, cantidad de personas o porcentaje.

- **Interacción actual:** valor visible y botones de incremento o decremento dentro de un rango y paso configurables.
- **Encaje:** evita el acierto binario y produce comparativas interesantes aun cuando nadie acierte exactamente.
- **Puntuación actual:** proximidad al valor real ajustada por el tiempo empleado.

### 9. Imagen progresivamente revelada — Futura

Una imagen comienza borrosa, pixelada, ampliada o cubierta y se revela con el tiempo. El jugador debe identificar personajes, lugares, banderas, películas, animales, obras de arte o logotipos cuanto antes.

- **Encaje:** premia directamente la rapidez, pero mantiene un riesgo al responder antes.
- **Identidad:** es una de las mecánicas que mejor representa el nombre y el espíritu de The Flash.

### 10. Anagramas y palabras desordenadas — Futura

El jugador reordena letras, sílabas o fragmentos para formar una palabra o frase; también puede resolver una palabra a partir de una pista o crear el mayor número posible de palabras.

- **Interacción:** entrada escrita o fichas directas.
- **Encaje:** sencillo de entender, barato de producir y eficaz bajo presión.

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

### 13. Mini-Wordle — Futura

El jugador descubre una palabra en pocos intentos. La adaptación puede usar palabras de cuatro o cinco letras, menos intentos, tiempo total limitado, pistas temáticas, puntos por eficiencia y penalización por letras incorrectas.

- **Encaje:** conocido y fácil de entender.
- **Uso recomendado:** desafío especial, por su duración mayor que una pregunta normal.

### 14. Simon o repetición de secuencias — Futura

Se reproduce una secuencia de colores, sonidos, símbolos, posiciones o ritmos y el jugador la repite. Puede crecer en longitud, exigir repetición inversa o pedir que se detecte un elemento incorrecto.

- **Encaje:** combina memoria, reflejos y precisión.
- **Consideración competitiva:** el jugador debe esperar la reproducción, por lo que ese tiempo debe normalizarse o excluirse al comparar resultados.

### 15. Matrices lógicas — Futura

Una cuadrícula de símbolos o imágenes contiene una casilla vacía; el jugador elige la opción que completa el patrón.

- **Encaje:** aporta razonamiento abstracto y escala de niveles sencillos a exigentes.
- **Uso recomendado:** etapas de lógica o preguntas especiales.

### 16. Mini-nonograma — Futura

El jugador completa una cuadrícula a partir de pistas numéricas.

- **Formato recomendado:** cuadrículas de 5 × 5 o 7 × 7, diseños simples, uno a tres minutos y penalización por casillas incorrectas.
- **Encaje:** diferenciador y más profundo que una pregunta convencional.
- **Riesgo:** necesita interfaz, tutorial y generación de puzles cuidadosa.

### 17. Laberinto contrarreloj — Futura

El jugador guía un elemento desde la entrada a la salida mediante arrastre, botones direccionales, cruces sucesivos o elección de caminos. Una variante accesible pregunta qué laberinto tiene salida.

- **Encaje:** mide con claridad tiempo y precisión.
- **Riesgo:** un control táctil impreciso mediría frustración, no habilidad.

### 18. Mini-sudoku — Futura

Adaptación del sudoku tradicional: cuadrícula 4 × 4, completar casillas críticas, detectar un número erróneo, elegir la cuadrícula válida o resolver una región.

- **Encaje:** conocido, objetivo y competitivo.
- **Uso recomendado:** desafío especial o etapa temática de lógica, no formato frecuente.

### 19. Rompecabezas deslizante — Futura

Una imagen, números, letras o un mapa se divide en piezas que el jugador reconstruye desplazando fichas.

- **Encaje:** visual y fácilmente medible por tiempo.
- **Riesgo:** la interacción táctil, animaciones, validación y generación requieren más trabajo que una pregunta tradicional.

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

### 24. Adivinanzas por pistas — Futura

El jugador intenta identificar un personaje, lugar, objeto, obra o concepto. Puede descubrir pistas sucesivas, pero cada una reduce la puntuación máxima disponible, por lo que debe decidir cuándo tiene suficiente información para responder.

Por ejemplo, para adivinar un personaje las pistas pueden revelar progresivamente su siglo, profesión, país, imagen e iniciales.

- **Interacción:** solicitar una nueva pista o responder en cualquier momento; una respuesta incorrecta puede terminar la ronda o aplicar una penalización adicional.
- **Encaje:** combina conocimiento, autoconfianza y gestión del riesgo con una regla fácil de comprender.
- **Puntuación:** parte de un máximo visible que disminuye con cada pista revelada y, opcionalmente, con el tiempo empleado.
- **Riesgo:** las primeras pistas deben ser difíciles pero útiles, y su orden debe calibrarse para que cada revelación reduzca de manera apreciable el espacio de respuestas posibles.

### 25. Mapa de calor — Futura

Se muestra una imagen, mapa, gráfico o escena y el jugador debe pulsar en la zona correcta. Puede localizar una ciudad, señalar una parte anatómica, marcar el lugar de un acontecimiento, identificar una zona dentro de una obra de arte o estimar el centro geográfico de un país.

- **Interacción:** realizar una o varias pulsaciones sobre una superficie ampliable; el resultado puede mostrar el punto elegido, el objetivo y la distancia entre ambos.
- **Encaje:** es visual e intuitivo y permite combinar precisión y velocidad en una misma puntuación.
- **Puntuación:** proximidad al punto o zona ideal ajustada por el tiempo empleado, con tolerancias adaptadas al tamaño y la forma del objetivo.
- **Riesgo:** la precisión no debe depender del tamaño de la pantalla ni de la destreza motriz; hacen falta coordenadas normalizadas, objetivos razonablemente amplios y alternativas accesibles.

### 26. La respuesta prohibida — Futura

Se formula una pregunta abierta, pero las respuestas más evidentes están expresamente prohibidas. Por ejemplo, nombrar un país de Sudamérica sin responder Brasil ni Argentina, o decir una palabra asociada al invierno sin usar «frío», «nieve» ni «Navidad».

- **Interacción:** escribir o elegir una respuesta válida mientras las opciones prohibidas permanecen visibles.
- **Encaje:** obliga a frenar respuestas automáticas y explorar conocimiento menos inmediato con muy poca complejidad de interacción.
- **Puntuación:** puede valorar acierto y velocidad; en partidas grupales, las respuestas menos repetidas podrían recibir una bonificación si todos comparten condiciones equivalentes.
- **Riesgo:** la validación de respuestas abiertas necesita un repertorio amplio de equivalencias y debe explicar con claridad por qué se rechaza una respuesta válida en apariencia.

### 27. Reconstrucción del error — Futura

Se muestra una solución incorrecta y el jugador debe detectar el paso exacto en el que aparece el primer fallo, en lugar de resolver el problema desde cero. Puede aplicarse a una operación matemática, una cronología histórica, una clasificación científica, un razonamiento lógico, una traducción o un fragmento de código.

- **Interacción:** seleccionar el paso erróneo y, opcionalmente, elegir o escribir su corrección.
- **Encaje:** mide comprensión profunda, revisión crítica y conocimiento del proceso, no solo memorización del resultado.
- **Puntuación:** puede conceder crédito parcial por localizar el error aunque la corrección posterior no sea exacta.
- **Riesgo:** todos los pasos anteriores al señalado deben ser inequívocamente válidos; un error que se propaga no debería contabilizarse como varios fallos independientes.

### 28. Pregunta con interferencias — Futura

La información se presenta de forma incompleta o imperfecta: texto parcialmente borrado, audio con ruido, una imagen fragmentada, palabras mezcladas con caracteres irrelevantes o datos visibles durante intervalos muy breves. El jugador debe reconstruir información suficiente para responder.

- **Interacción:** observar o reproducir el estímulo y responder mediante un formato existente; algunas variantes pueden permitir reducir la interferencia a cambio de puntos.
- **Encaje:** incorpora percepción, reconstrucción y tolerancia a la incertidumbre a las pruebas de conocimiento.
- **Accesibilidad:** la dificultad debe proceder de una regla controlada, no de barreras visuales, auditivas, cognitivas o motrices; cada reto necesita una variante equivalente cuando el canal utilizado no sea accesible.
- **Riesgo:** el nivel de degradación debe calibrarse y verificarse en distintos dispositivos para que siempre quede información suficiente y la respuesta no dependa del azar.

### 29. Eco — Futura

Se reproduce una secuencia visual o sonora y después aparece una segunda casi idéntica. El jugador debe determinar si ambas son exactamente iguales o identificar la diferencia, que puede afectar al orden, duración, intensidad, posición o número de elementos.

- **Interacción:** responder «igual» o «diferente» y, en variantes avanzadas, señalar el instante o elemento modificado.
- **Encaje:** combina memoria inmediata, atención y percepción con rondas breves y reglas muy claras.
- **Consideración competitiva:** el tiempo obligatorio de reproducción debe excluirse o normalizarse; solo el tiempo de decisión debería premiar la rapidez.
- **Riesgo:** las diferencias de audio, brillo, rendimiento o latencia entre dispositivos no deben alterar la dificultad ni revelar accidentalmente la respuesta.

### 30. Prueba espejo — Futura

Dos retos se presentan simultáneamente y las acciones realizadas en uno afectan al otro. Ordenar números a la izquierda puede mover letras a la derecha; corregir una secuencia visual puede alterar una operación; cada elemento descartado en un panel puede desaparecer también en el otro.

- **Interacción:** manipular dos paneles vinculados y anticipar el efecto de cada acción antes de confirmar la solución conjunta.
- **Encaje:** prueba especial de alta dificultad que combina planificación, atención dividida y razonamiento sobre sistemas relacionados.
- **Uso recomendado:** retos excepcionales de uno a cinco minutos, con tutorial interactivo y dificultad progresiva.
- **Riesgo:** la relación entre ambos paneles debe ser consistente y visible; una interfaz sobrecargada o efectos difíciles de anticipar convertirían la prueba en ensayo y error.

## Priorización de mecánicas pendientes

| Objetivo                                   | Mecánicas prioritarias                                                                                          | Motivo                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Equilibrio entre diversión y coste técnico | Encontrar el intruso, emparejar conceptos y anagramas                                                           | Amplían el juego con riesgo técnico contenido.                                     |
| Diferenciar The Flash de una trivia        | Memoria relámpago, imagen progresiva y objetos ocultos                                                          | Introducen habilidades e interacciones que van más allá de responder preguntas.    |
| Inducción y deducción                      | La regla secreta                                                                                                | Convierte la identificación de patrones en una clasificación activa.               |
| Pensamiento crítico                        | El dato contaminado                                                                                             | Obliga a contrastar la información antes de utilizarla.                            |
| Comprensión profunda                       | Reconstrucción del error                                                                                        | Evalúa procesos y permite localizar fallos en lugar de recordar solo resultados.   |
| Percepción y precisión                     | Mapa de calor, pregunta con interferencias y Eco                                                                | Incorporan localización, reconstrucción sensorial y memoria inmediata.             |
| Pruebas especiales                         | Respuesta en cadena, prueba espejo, Mini-Wordle, mini-nonograma, laberinto, mini-sudoku, rompecabezas y tangram | Admiten retos ocasionales de uno a cinco minutos con mayor sensación de recorrido. |
| Gestión del riesgo                         | Adivinanzas por pistas e imagen progresiva                                                                      | Permiten decidir cuánta información obtener antes de responder.                    |
| Conocimiento menos inmediato               | La respuesta prohibida                                                                                          | Premia alternativas válidas más allá de las asociaciones más obvias.               |
| Competición por tiempo                     | Emparejar, diferencias visuales, imagen progresiva, laberinto y rompecabezas                                    | Una ejecución correcta terminada antes representa una mejora clara.                |

## Implicaciones para el futuro multijugador

Para que los resultados sean comparables en una partida online, cada formato deberá definir antes de construirse:

- la condición de éxito y los errores recuperables o definitivos;
- cómo se mide el tiempo, incluidos tiempos forzados de reproducción o animación;
- el modelo de puntuación: acierto, proximidad, penalizaciones e intento(s);
- el nivel o semilla compartida, para garantizar el mismo reto a todos los participantes;
- la protección frente a latencia y diferencias de dispositivo;
- la estrategia de contenido: datos estructurados, activos visuales y validación de calidad.

Como siguiente paso de producto, encontrar el intruso, emparejar conceptos y anagramas ofrecen el mejor equilibrio entre variedad y coste técnico. Las pruebas especiales deberían llegar después, acompañadas de prototipos específicos de interacción móvil, contenido validado y reglas de puntuación explícitas.
