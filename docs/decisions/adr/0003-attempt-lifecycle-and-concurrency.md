# ADR 0003: Intentos reanudables con control de concurrencia

- Estado: aceptado.
- Fecha: 2026-09-12.

## Contexto

El cliente actual puede reiniciarse o recargarse. En un producto competitivo, cerrar el navegador,
cambiar de dispositivo o repetir una petición no debe conceder un intento nuevo ni permitir repetir
preguntas ya vistas. También hay que evitar dos sesiones concurrentes sobre el mismo intento.

## Decisión

Iniciar un desafío crea o recupera atómicamente un intento persistido. Empezar consume el intento,
pero este puede reanudarse. Por defecto hay un único intento por jugador y publicación; los modos
pueden definir una política distinta y, si permiten varios, se acredita el mejor.

Cada intento tiene una única sesión activa, operaciones idempotentes, checkpoints y un `lock_version`.

## Actualización del MVP (2026-09-15)

La transferencia de control entre dispositivos se aplaza. Mientras el MVP esté vigente, un token de
sesión distinto no puede revocar ni sustituir la sesión activa: recibe un conflicto de sesión activa
y no crea otro intento. Solo la misma sesión puede reanudar; el abandono explícito sigue siendo la
salida terminal disponible para el jugador.

## Actualización de recuperación (2026-09-15)

Cerrar la pestaña, perder conexión o perder una respuesta HTTP no demuestra que el jugador no haya
visto la interacción. Una unidad temporal e intervalo confirmados antes de devolver contenido se
consideran por tanto consumidos. La recuperación con la sesión original debe ser autoritativa y
atómica:

1. Si el servidor ya recibió una respuesta, la recupera y evalúa idempotentemente antes de avanzar.
2. Si no hay recepción, no reentrega el payload ni reinicia el reloj: cierra el intervalo y aplica
   la consecuencia del modo.
3. Solo el abandono explícito pasa el intento a `abandoned`; la interrupción se mantiene en
   `in_progress` mientras se resuelve o termina reglamentariamente por la propia mecánica.

Flash avanza tras `unanswered`; Supervivencia aplica su pérdida normal de vida; Narrativa continúa
desde la reacción o escena correspondiente; Pirámide falla y completa si ya comenzó el nivel; y
Alfabeto mantiene su deadline global y registra un pase por interrupción distinto del pase voluntario.
`invalidated` se reserva para fraude o administración y no forma parte de esta recuperación.

## Consecuencias

- El backend debe ser el coordinador de inicio, progreso y finalización.
- Los checkpoints deben adaptarse al modo y no limitarse a un único formato de pregunta.
- Las restricciones de unicidad y las actualizaciones condicionales forman parte de la garantía, no
  solo la lógica del cliente.
- Los estados terminales y las respuestas/intervalos conservados impiden reintentos encubiertos y
  permiten auditoría; `expired` sigue describiendo solo una publicación cerrada antes de iniciar.
- La futura migración de intervalos debe distinguir el pase voluntario de Alfabeto del cierre por
  recuperación, sin crear un nuevo estado de respuesta final.
- El comando técnico de takeover queda deshabilitado hasta que exista una política de producto,
  UX y pruebas específicas para esa transferencia.
