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
Tomar el control desde otro dispositivo revoca la sesión anterior sin crear otro intento.

## Consecuencias

- El backend debe ser el coordinador de inicio, progreso y finalización.
- Los checkpoints deben adaptarse al modo y no limitarse a un único formato de pregunta.
- Las restricciones de unicidad y las actualizaciones condicionales forman parte de la garantía, no
  solo la lógica del cliente.
- Los estados abandonado o expirado se conservan para impedir reintentos encubiertos y permitir
  auditoría.
