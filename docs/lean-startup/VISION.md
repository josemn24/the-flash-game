# Visión

## Estado de la visión

Parcialmente documentada. La formulación procede de documentación de producto y del contexto proporcionado; aún no refleja evidencia de usuarios reales.

## Cambio que se quiere producir

Permitir que grupos de amigos mantengan una competición ligera y recurrente a través de desafíos mentales breves, variados y comparables. Cada persona juega dentro de una ventana compartida y acumula resultados durante una temporada.

## Personas o entidades beneficiadas

- Grupos de amigos que quieran una actividad competitiva compartida sin necesidad de coincidir en tiempo real.
- El grupo inicial Tabarnia, formado por hasta once amistades invitadas a una sala privada para la primera alpha.

## Situación que se desea transformar

La visión documentada propone pasar de desafíos aislados a una experiencia de sala privada, temporadas y ranking acumulado. No hay evidencia aún de que esta situación sea un problema prioritario para un segmento concreto.

## Principios que no se quieren sacrificar

- Desafíos breves, claros y comparables.
- Juego individual asíncrono dentro de un contexto social compartido.
- Reglas y puntuaciones comprensibles.
- Respeto por el tiempo de las personas: sin exigir presencia simultánea.

## Límites éticos y operativos

- No usar presión, spam ni mecánicas engañosas para forzar participación.
- No exponer resultados ni datos de una sala fuera de las expectativas de sus miembros.
- No asumir que la competitividad o las notificaciones son deseables sin evidencia.
- La actual operación depende de un único responsable; el alcance debe mantenerse proporcional.

## Qué pertenece a la visión

El cambio buscado —competición social recurrente, breve y asíncrona entre amistades— y los principios anteriores.

## Qué pertenece a la estrategia actual

La primera apuesta es una sala privada con una temporada, desafíos periódicos, puntuación acumulada y ranking. La alpha técnica comprobará este loop con Tabarnia; el backend, la autenticación y la persistencia son el vehículo mínimo elegido para observarlo, no evidencia de que la estrategia funcione.

La frecuencia de publicación, la selección de formatos, las reglas de puntuación, las notificaciones y la ampliación a más salas son opciones estratégicas modificables.

## Líneas no priorizadas en el ciclo actual

- **Conquista y geolocalización:** posible capa futura inspirada en la competición territorial, no alcance ni evidencia de la alpha.
- **Enfoque educativo:** posible producto para otro segmento y problema, no alcance ni evidencia de la alpha.

## Relación con el producto existente

La PoC actual permite jugar en solitario dentro de una sala y temporada demo locales. Es un punto de partida reutilizable para aprender sobre la experiencia, pero no demuestra que un grupo cree una sala, vuelva a participar ni valore un ranking compartido.

## Fuentes críticas consultadas

- `README.md` — alcance técnico actual y ausencia de backend, usuarios y persistencia.
- `docs/the-flash-poc.md` — propósito y límites de la PoC.
- `docs/salas-y-temporadas.md` — loop social y competitivo previsto; es una afirmación documentada, no evidencia de uso.
- Contexto del proyecto proporcionado para esta intervención — objetivo de producto y responsable.

## Hechos observados

- El repositorio declara una aplicación 100 % frontend sin backend, base de datos, autenticación ni servicios externos. Fuente: `README.md`.
- La PoC documentada ofrece un jugador, estado de sesión en memoria, una sala demo, una temporada activa y dos desafíos jugables. Fuente: `docs/the-flash-poc.md`.
- No se localizaron métricas, usuarios reales, entrevistas ni resultados de experimentos Lean en la documentación consultada.

## Afirmaciones documentadas

- La dirección de producto descrita es una sala privada de amigos con desafíos periódicos asíncronos y ranking de temporada. Fuente: `docs/salas-y-temporadas.md`.
- La PoC pretende explorar si el desafío individual es divertido y fluido. Fuente: `docs/the-flash-poc.md`.

## Inferencias

- La incertidumbre más costosa es si existe comportamiento recurrente de grupo alrededor del loop social; la alpha técnica permitirá medirlo directamente con la experiencia prevista.

## Supuestos

- Que un grupo de amigos querrá participar repetidamente en desafíos asíncronos compartidos.
- Que un ranking acumulado de temporada aportará motivación suficiente para sostener esa participación.
- Que los desafíos mentales breves y variados aportarán una diferenciación suficiente frente a una trivia convencional.

## Preguntas pendientes

- ¿Qué formatos y reglas de puntuación harán que las personas quieran volver?
- ¿Qué aceptación y participación recurrente observará Tabarnia en la alpha?
- ¿Qué ajustes de contenido, cadencia o ranking justificará una segunda temporada?
