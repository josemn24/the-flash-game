# Guía editorial de Contrarreloj

Estado: vigente para Queens y Conectar parejas.

Última actualización: 2026-10-16. Formatos: Queens y Conectar parejas, identificador `time-trial`.

## Preparación del contenido

Crear entre 2 y 20 pruebas de un mismo formato: Queens de 4×4 a 8×8 o Conectar parejas con
tableros cuadrados de 4×4 a 8×8 y de tres parejas al lado del tablero. Los tamaños de Conectar
parejas pueden mezclarse dentro de una secuencia; no mezclar formatos. Se pueden escribir documentos en el editor o
reutilizar versiones publicadas de la biblioteca. Todos los jugadores recibirán el mismo orden y
contenido. La versión publicada congela preguntas, soluciones privadas, orden, pesos y duración;
las correcciones requieren una nueva revisión editorial y publicación.

Ordenar por dificultad creciente comprobada mediante resoluciones. El tamaño por sí solo no prueba
la dificultad: quitar pistas o encadenar deducciones puede hacer más complejo un tablero del mismo
tamaño. Verificar conectividad de regiones, solución, pistas, legibilidad y navegación por teclado.
En Conectar parejas, comprobar que todas las rutas sean ortogonales, unan los extremos, no se
solapen y cubran el tablero completo. Se aceptan soluciones legales alternativas. Calibrar la dificultad
por las deducciones y tiempos observados, no solo por el número de parejas.
Escape, Mini-Wordle y Hashtag requieren ampliaciones posteriores.

## Duración y puntos

Introducir una duración global obligatoria en segundos enteros positivos. No existe duración
predeterminada. Se almacena en milisegundos y el límite del campo permite hasta 2.147.483 segundos.
Los tiempos individuales de las preguntas no se aplican a Contrarreloj.

Asignar a cada prueba un peso entero positivo; todos deben sumar exactamente 100. Resolverla concede
el peso completo, sin bonus de velocidad, crédito parcial ni penalización por errores internos.
Reordenar conserva pesos. El editor no ajusta automáticamente una suma incorrecta al guardar.
No se aplica la antigua propuesta proporcional de CT-01.

## Calibración

Resolver primero cada tablero y después la secuencia completa en los dispositivos previstos.
Registrar tiempo hasta el último acierto, pruebas resueltas antes del límite y puntos de bloqueo.
El reloj incluye validaciones, cargas y los 1,1 segundos de transición; no hay pausas ni compensaciones.
Elegir la duración a partir de esas resoluciones, evitando una cifra basada solo en tamaños.

Cada tablero Queens permite dos validaciones completas incorrectas; la tercera termina el desafío. Los
movimientos exploratorios no consumen oportunidades. En Conectar parejas se pueden borrar, recortar
y rehacer caminos libremente, sin contador de errores. Recuperar una prueba activa sin recepción final
la cierra sin respuesta y termina el intento, conservando los aciertos anteriores. La introducción
debe explicar estas reglas antes de iniciar.

## Revisión antes de publicar

- Cantidad admitida, un único formato compatible y soluciones verificadas.
- Progresión de dificultad justificada por resoluciones completas.
- Duración global explícita, calibrada en móvil y escritorio.
- Pesos positivos que suman 100 y orden compartido para todos.
- Introducción, teclado, controles táctiles y movimiento reducido revisados.
- Recorrido en staging: acierto, tercer error, timeout, recuperación y revisión protegida.

Las [decisiones CT-01 a CT-05](../../decisions/open-questions.md#contrarreloj-decisiones-pendientes)
están cerradas para este alcance. El [contrato funcional](../../current/domain/contrarreloj.md)
detalla recepción, ranking y conservación de puntos. La validación automatizada del contenido no
sustituye su calibración editorial ni demuestra que un desafío real haya sido publicado en staging.
