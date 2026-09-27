# Changelog

Todos los cambios relevantes de The Flash se documentan en este archivo.

La sección `[Unreleased]` recoge los cambios preparados para la próxima versión. Toda pull
request que modifique la experiencia del jugador, los datos, la operación o el despliegue debe
actualizar esa sección y enlazar la entrada con su pull request o commit de origen.

## [Unreleased]

### Mejorado

- Se ha refinado el feedback visual de las respuestas y sus estados de acierto o error. ([`053bb0f`][commit-053bb0f])
- Se ha mejorado la interfaz de las preguntas de emparejamiento y sus colores. ([`646aae1`][commit-646aae1], [`c4330d3`][commit-c4330d3])
- Se han añadido esqueletos de carga y un indicador visual para los enlaces pendientes. ([`0a7daf3`][commit-0a7daf3])
- Se ha mejorado la experiencia de Queens para tableros de tamaño variable. ([`8c90ae4`][commit-8c90ae4], [`3729f54`][commit-3729f54])
- Se ha incorporado una navegación hacia atrás más coherente durante el recorrido. ([`19331a3`][commit-19331a3])

### Operación

- Se ha añadido la configuración necesaria para el despliegue mediante Vercel. ([`b2330e6`][commit-b2330e6])
- Se han actualizado las migraciones y el refactor de la slice S17 junto con las preguntas de emparejamiento. ([`6f3e960`][commit-6f3e960], [`706ef37`][commit-706ef37])
- Se ha corregido la preparación local de datos de BetaVIP. ([`daab89d`][commit-daab89d])

## [0.5.0] - 2026-09-26

### Añadido

- Se ha preparado la alpha de staging con bootstrap, fixtures y credenciales para escenarios de prueba. ([PR #4][pr-4], [PR #5][pr-5])
- Se han ampliado los recorridos competitivos persistidos sobre Supabase, incluyendo resultados, historial, revisión y ranking. ([PR #3][pr-3], [PR #4][pr-4])
- Se ha ampliado el portal privado de superadministración para gestionar usuarios, salas, intentos y contenido editorial. ([PR #4][pr-4], [PR #5][pr-5])
- Se han incorporado escenarios BetaVIP con desafíos de supervivencia, geografía y pirámide. ([PR #5][pr-5])

### Mejorado

- Se han integrado más formatos jugables en los desafíos competitivos, incluyendo Escape, Zip, Hashtag de palabras, sopa de letras, Mini-Wordle y Pirámide. ([PR #3][pr-3], [PR #4][pr-4])
- Se han mejorado las pantallas de resultados y revisión, incluyendo respuestas correctas, puntos de pistas y estados visuales de los formatos. ([PR #3][pr-3], [PR #4][pr-4])

### Corregido

- Se han corregido problemas de migraciones, conexión, inspección de intentos y bootstrap del entorno de staging. ([PR #4][pr-4], [PR #5][pr-5])

## [0.4.0] - 2026-09-25

### Añadido

- Se han implementado las primeras slices verticales persistidas sobre Supabase, con autenticación, salas, temporadas, intentos y rankings. ([PR #3][pr-3])
- Se han incorporado nuevos recorridos y formatos competitivos, como Mini-Wordle, código lógico, emparejamiento, sopa de letras, matrices lógicas, Zip, Escape y Hashtag de palabras. ([PR #3][pr-3])
- Se ha añadido un portal privado de administración con salas, calendario, publicaciones y datos de Tabarnia. ([PR #3][pr-3])
- Se ha añadido soporte PWA y un escenario de datos jugable con avatares. ([PR #3][pr-3])

### Mejorado

- Se han unificado los estados de carga, respuesta y revisión en los recorridos Flash, Supervivencia y Pirámide. ([PR #3][pr-3])
- Se han ampliado las pruebas E2E y los comandos de verificación de los recorridos persistidos. ([PR #3][pr-3])

## [0.3.0] - 2026-09-21

### Añadido

- Se ha incorporado el sistema visual Flash Pop, con nuevas tarjetas, variantes, animaciones y componentes compartidos. ([PR #2][pr-2])
- Se han añadido pantallas de inicio, detalle de sala, ajustes, perfil, ranking e historial. ([PR #2][pr-2])

### Mejorado

- Se han migrado los recorridos de Flash, Supervivencia, Pirámide y Alfabeto al nuevo lenguaje visual. ([PR #2][pr-2])
- Se han mejorado la presentación de resultados, la revisión de respuestas, el feedback de aciertos y errores y la navegación. ([PR #2][pr-2])
- Se ha añadido una cuenta atrás común y se han refinado los layouts responsive de los juegos. ([PR #2][pr-2])

## [0.2.0] - 2026-08-30

### Añadido

- Se ha ampliado la experiencia hasta una biblioteca de veinticinco formatos jugables. ([PR #1][pr-1])
- Se han añadido los primeros desafíos y contenidos narrativos, incluyendo supervivencia, Pirámide, Alfabeto, Wordle, sopa de letras, Escape, Queens, Zip y Tuberías. ([PR #1][pr-1])
- Se han incorporado mapas de calor, etiquetado de imágenes, memoria, secuencias, matrices lógicas, Sudoku y rompecabezas deslizantes. ([PR #1][pr-1])
- Se ha añadido una biblioteca interactiva con reglas, recomendaciones, accesibilidad y ejemplos de cada formato. ([PR #1][pr-1])

### Mejorado

- Se han refinado el temporizador, la puntuación, las penalizaciones, las transiciones y el feedback de las respuestas. ([PR #1][pr-1])
- Se han mejorado los contenidos visuales, las ilustraciones y la experiencia responsive de los desafíos. ([PR #1][pr-1])

## [0.1.0] - 2026-07-11

### Añadido

- Se ha creado la primera prueba de concepto de The Flash, centrada en partidas individuales contra el reloj. ([`764935b`][commit-764935b])
- Se han incorporado dos etapas locales de diez preguntas con elección múltiple, verdadero o falso, respuesta corta y preguntas visuales. ([`764935b`][commit-764935b])
- Se han añadido temporizador individual, avance automático, puntuación por velocidad, resultados detallados, revisión de respuestas y repetición de partidas. ([`764935b`][commit-764935b])
- Se ha publicado una experiencia responsive, accesible y completamente en español. ([`764935b`][commit-764935b])

[Unreleased]: https://github.com/josemn24/the-flash-game/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/josemn24/the-flash-game/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/josemn24/the-flash-game/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/josemn24/the-flash-game/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/josemn24/the-flash-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/josemn24/the-flash-game/tree/v0.1.0
[pr-1]: https://github.com/josemn24/the-flash-game/pull/1
[pr-2]: https://github.com/josemn24/the-flash-game/pull/2
[pr-3]: https://github.com/josemn24/the-flash-game/pull/3
[pr-4]: https://github.com/josemn24/the-flash-game/pull/4
[pr-5]: https://github.com/josemn24/the-flash-game/pull/5
[commit-053bb0f]: https://github.com/josemn24/the-flash-game/commit/053bb0f
[commit-646aae1]: https://github.com/josemn24/the-flash-game/commit/646aae1
[commit-19331a3]: https://github.com/josemn24/the-flash-game/commit/19331a3
[commit-c4330d3]: https://github.com/josemn24/the-flash-game/commit/c4330d3
[commit-b2330e6]: https://github.com/josemn24/the-flash-game/commit/b2330e6
[commit-0a7daf3]: https://github.com/josemn24/the-flash-game/commit/0a7daf3
[commit-8c90ae4]: https://github.com/josemn24/the-flash-game/commit/8c90ae4
[commit-3729f54]: https://github.com/josemn24/the-flash-game/commit/3729f54
[commit-706ef37]: https://github.com/josemn24/the-flash-game/commit/706ef37
[commit-6f3e960]: https://github.com/josemn24/the-flash-game/commit/6f3e960
[commit-daab89d]: https://github.com/josemn24/the-flash-game/commit/daab89d
[commit-764935b]: https://github.com/josemn24/the-flash-game/commit/764935b
