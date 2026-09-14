> Estado: vigente. Fotografía del repositorio en la fecha de la última actualización.

# Estado actual del proyecto

## Resumen

The Flash es actualmente una aplicación web frontend para validar desafíos rápidos y una experiencia
social simulada. Usa fixtures locales y un store mock normalizado; no tiene backend, base de datos,
autenticación real ni persistencia remota.

La interfaz ya representa una sala, miembros, temporada, publicaciones, rankings e historial mock.
Los resultados del jugador y los checkpoints de la sesión se conservan solo en memoria mientras vive
la sesión de React.

## Capacidades actuales

- 31 formatos de pregunta nativos, con ejemplos jugables en la biblioteca.
- Cinco modos: `flash`, `alphabet`, `survival`, `narrative` y `pyramid`.
- Siete desafíos definidos en el catálogo mock.
- Seis publicaciones programadas en la temporada mock; cinco cerradas y una abierta.
- Evaluación, puntuación, revisión y estados específicos por formato.
- Shell visual Flash Pop para las experiencias publicadas y la biblioteca.
- Acceso mock a sala, ranking, historial, detalle de miembro y ajustes.
- El ranking por desafío de los cinco modos aplica el comparador común de Flash Points, duración
  efectiva y `startedAt`, con posiciones compartidas; el ranking de temporada sigue usando solo
  Flash Points acumulados. En el mock, la duración se deriva de los `AttemptAnswer.timeUsedMs` y la
  aplicación está completa.

## Rutas principales

| Ruta                        | Estado                                                     |
| --------------------------- | ---------------------------------------------------------- |
| `/`                         | Página principal con salas mock y acceso a la experiencia. |
| `/salas/[roomId]`           | Detalle de sala, desafío disponible y resumen social.      |
| `/salas/[roomId]/ranking`   | Ranking de temporada.                                      |
| `/salas/[roomId]/historial` | Historial de publicaciones cerradas.                       |
| `/salas/[roomId]/ajustes`   | Vista mock de miembros y ajustes de sala.                  |
| `/desafios/[challengeId]`   | Desafío competitivo contextualizado o preview.             |
| `/formatos`                 | Biblioteca estática de formatos.                           |
| `/flash-pop`                | Lobby demo de Flash Pop.                                   |

Las rutas de sala y desafío son dinámicas. La biblioteca de formatos y sus fichas usan generación
estática.

## Límites actuales

- El jugador actual, la autenticación y los permisos son mock.
- El cliente recibe soluciones y calcula localmente parte de la evaluación; todavía no es una frontera
  segura para producción.
- La unicidad del intento, el abandono y la puntuación autoritativa están modelados y parcialmente
  simulados, pero aún no se validan en servidor.
- El contenido nuevo, la creación de salas, las invitaciones y la persistencia real siguen pendientes.

## Verificación

Última verificación: 2026-09-14.

- 81 archivos de test y 535 tests pasan con `npm test`.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run type-architecture` y
  `npm run style-architecture` pasan.
- `npm run format:check` informa avisos en 53 archivos; quedan fuera del alcance de este cambio
  documental.
- `npm run stylelint` informa un selector duplicado en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`.
