# ADR 0002: Hacer inmutable el contenido publicado

- Estado: aceptado.
- Fecha: 2026-09-12.

## Contexto

Una definición global puede reutilizarse en varias salas y temporadas. Si una pregunta o un desafío
publicado cambia en el sitio, una partida antigua podría dejar de poder revisarse o recalcularse con
el contenido que realmente jugó el usuario.

## Decisión

Se separan la identidad estable de una definición y sus versiones. Una publicación apunta a una
`ChallengeVersion`, que a su vez referencia versiones concretas de preguntas y conserva su orden,
configuración de modo y reparto de puntos.

Las versiones en borrador son editables. Desde el momento en que se publican son inmutables; cualquier
cambio crea una versión nueva. El contenido utilizado se archiva en lugar de eliminarse.

## Consecuencias

- Una partida histórica puede reconstruirse exactamente.
- Corregir incluso una errata requiere una nueva versión.
- La capa editorial debe distinguir claramente borrador, publicación y archivo.
- Aumenta el número de registros, pero se eliminan mutaciones retroactivas y ambigüedad histórica.
