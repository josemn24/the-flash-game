> Estado: propuesta. Mecánicas candidatas, sin implementación ni prioridad comprometida.

# Formatos futuros

Estas ideas se separaron del catálogo editorial el 2026-10-24. Un formato futuro no se habilita
por aparecer aquí: requiere contrato, interacción accesible, validación, puntuación y conformidad
en cada modo que lo admita. La [matriz vigente](../../current/status.md) describe las capacidades reales.
La estrategia y los experimentos activos determinan si merece la pena construir una candidata.

### Diferencias visuales — Futura

El jugador encuentra una o varias diferencias entre dos imágenes: una única diferencia, todas las diferencias, el elemento añadido o eliminado, o una zona concreta pulsable.

- **Encaje:** formato reconocido, visual y accesible.
- **Riesgo:** las imágenes y zonas pulsables deben prepararse y escalarse cuidadosamente para cada pantalla.

### Objetos ocultos — Futura

El jugador encuentra uno o varios elementos dentro de una escena: un objeto concreto, todos los símbolos de un tipo, un personaje, una cantidad de elementos o el único objeto que cumple una condición.

- **Encaje:** atractivo visual y apropiado como desafío especial de uno o varios minutos.
- **Riesgo:** exige ilustraciones o imágenes diseñadas para el reto.

### Tangram o construcción de figura — Futura

El jugador forma una silueta con piezas geométricas: tangram clásico, bloques, piezas encajables o copia de una composición mostrada antes.

- **Encaje:** desafío especial memorable y muy diferenciador.
- **Riesgo:** exige arrastre, rotación, colisiones, ajuste de piezas y validación tolerante; es una de las mecánicas más complejas de implementar correctamente.

### La regla secreta — Futura

Se muestran varios ejemplos aceptados y rechazados. El jugador debe descubrir qué regla los separa y después clasificar nuevos elementos conforme a ella.

Por ejemplo:

- **Aceptados:** Roma, Oslo y Lima.
- **Rechazados:** Madrid, Berlín y París.
- **Regla secreta:** capitales con cuatro letras.

A partir de ahí:

- **Interacción:** observar los ejemplos iniciales y asignar cada elemento nuevo a «aceptado» o «rechazado»; opcionalmente, elegir o escribir la regla al final.
- **Encaje:** combina inducción, conocimiento y deducción, ofrece una variedad enorme y permite alcanzar dificultades muy altas sin complicar la interacción.
- **Riesgo:** cada conjunto debe descartar interpretaciones alternativas razonables; los ejemplos iniciales y de validación han de demostrar la regla de forma inequívoca.

### El dato contaminado — Futura

Se entrega una ficha con varios datos relacionados, pero uno de ellos es falso y altera la respuesta. El jugador debe detectar el dato manipulado, ignorarlo y resolver correctamente la pregunta con la información restante.

Por ejemplo, una ficha sobre un país puede incluir su población, continente, capital y moneda, con uno de esos datos deliberadamente alterado.

- **Interacción:** marcar primero el dato contaminado y responder después la pregunta derivada de la ficha.
- **Encaje:** mide la capacidad de verificación interna, el pensamiento crítico y la resistencia a información engañosa.
- **Puntuación:** puede separar la detección del dato falso y la resolución final para conceder crédito parcial.
- **Riesgo:** la falsedad debe poder deducirse a partir de conocimientos razonables o de contradicciones internas; no debería depender de información oscura ni de datos sujetos a cambios frecuentes.

### Respuesta en cadena — Futura

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

### La respuesta prohibida — Futura

Se formula una pregunta abierta, pero las respuestas más evidentes están expresamente prohibidas. Por ejemplo, nombrar un país de Sudamérica sin responder Brasil ni Argentina, o decir una palabra asociada al invierno sin usar «frío», «nieve» ni «Navidad».

- **Interacción:** escribir o elegir una respuesta válida mientras las opciones prohibidas permanecen visibles.
- **Encaje:** obliga a frenar respuestas automáticas y explorar conocimiento menos inmediato con muy poca complejidad de interacción.
- **Puntuación:** puede valorar acierto y velocidad; en partidas grupales, las respuestas menos repetidas podrían recibir una bonificación si todos comparten condiciones equivalentes.
- **Riesgo:** la validación de respuestas abiertas necesita un repertorio amplio de equivalencias y debe explicar con claridad por qué se rechaza una respuesta válida en apariencia.

### Titular incompleto — Futura

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

### Pregunta con interferencias — Futura

La información se presenta de forma incompleta o imperfecta: texto parcialmente borrado, audio con ruido, una imagen fragmentada, palabras mezcladas con caracteres irrelevantes o datos visibles durante intervalos muy breves. El jugador debe reconstruir información suficiente para responder.

- **Interacción:** observar o reproducir el estímulo y responder mediante un formato existente; algunas variantes pueden permitir reducir la interferencia a cambio de puntos.
- **Encaje:** incorpora percepción, reconstrucción y tolerancia a la incertidumbre a las pruebas de conocimiento.
- **Accesibilidad:** la dificultad debe proceder de una regla controlada, no de barreras visuales, auditivas, cognitivas o motrices; cada reto necesita una variante equivalente cuando el canal utilizado no sea accesible.
- **Riesgo:** el nivel de degradación debe calibrarse y verificarse en distintos dispositivos para que siempre quede información suficiente y la respuesta no dependa del azar.

### Eco — Futura

Se reproduce una secuencia visual o sonora y después aparece una segunda casi idéntica. El jugador debe determinar si ambas son exactamente iguales o identificar la diferencia, que puede afectar al orden, duración, intensidad, posición o número de elementos.

- **Interacción:** responder «igual» o «diferente» y, en variantes avanzadas, señalar el instante o elemento modificado.
- **Encaje:** combina memoria inmediata, atención y percepción con rondas breves y reglas muy claras.
- **Consideración competitiva:** el tiempo obligatorio de reproducción debe excluirse o normalizarse; solo el tiempo de decisión debería premiar la rapidez.
- **Riesgo:** las diferencias de audio, brillo, rendimiento o latencia entre dispositivos no deben alterar la dificultad ni revelar accidentalmente la respuesta.

### Prueba espejo — Futura

Dos retos se presentan simultáneamente y las acciones realizadas en uno afectan al otro. Ordenar números a la izquierda puede mover letras a la derecha; corregir una secuencia visual puede alterar una operación; cada elemento descartado en un panel puede desaparecer también en el otro.

- **Interacción:** manipular dos paneles vinculados y anticipar el efecto de cada acción antes de confirmar la solución conjunta.
- **Encaje:** prueba especial de alta dificultad que combina planificación, atención dividida y razonamiento sobre sistemas relacionados.
- **Uso recomendado:** retos excepcionales de uno a cinco minutos, con tutorial interactivo y dificultad progresiva.
- **Riesgo:** la relación entre ambos paneles debe ser consistente y visible; una interfaz sobrecargada o efectos difíciles de anticipar convertirían la prueba en ensayo y error.

## Criterio para promover una propuesta

Antes de habilitar competición, definir:

- La condición de éxito, los errores recuperables o definitivos, las penalizaciones y el crédito parcial.
- El tiempo medido y el tratamiento de periodos forzados de reproducción, exposición o animación.
- El contenido o semilla común que garantice un reto comparable para todos los participantes.
- La protección frente a latencia y diferencias de dispositivo, con alternativas accesibles de interacción.
- La estrategia editorial: datos estructurados, assets, validación de soluciones, dificultad y coste de producción.
- Las reglas de recuperación y la evidencia necesaria para admitir el formato en cada modo.

Registrar la decisión y actualizar capacidades, contratos y pruebas con la entrega. Esta lista no
fija una prioridad entre propuestas ni habilita formatos por sí sola.
