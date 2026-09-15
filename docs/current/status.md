> Estado: vigente. Fotografía del repositorio en la fecha de la última actualización.

# Estado actual del proyecto

## Resumen

The Flash combina dos recorridos explícitos. La práctica, las previews y las capacidades aún no
migradas usan fixtures y un store mock normalizado. Las slices S01–S06 tienen integración real con
Supabase local: Auth, perfil, lecturas autorizadas de salas, un Flash competitivo persistido con
evaluación server-side, recuperación/abandono y sus dos rankings.

No hay un proyecto remoto de Supabase vinculado desde este entorno (`linked_project: null`). El
estado verificado corresponde al stack local y no permite afirmar el estado de producción o staging.

## Capacidades actuales

- 31 formatos de pregunta nativos, con ejemplos jugables en la biblioteca.
- Cinco modos: `flash`, `alphabet`, `survival`, `narrative` y `pyramid`.
- Autenticación Supabase local, provisioning idempotente de `Player`, logout y edición del nombre.
- Home, detalle de sala e introducción con lecturas autorizadas reales (S02).
- Flash competitivo real de dos preguntas `multiple-choice`, con sesiones exclusivas, tiempos,
  respuestas, evaluación privada, puntuación y ledger de puntos (S03).
- Recuperación tras recarga o fallo parcial, bloqueo de segunda sesión y abandono explícito (S04).
- Ranking de temporada y de la publicación abierta actual desde los RPCs reales, con posición
  persistida en las tarjetas de sala y lectura autorizada para spectators (S06).
- Recorridos mock para historial, miembros, ajustes, práctica y previews.

## Rutas principales

| Ruta                        | Estado                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `/`                         | Perfil y tarjetas de salas reales cuando hay sesión; práctica/demo mock en el resto. |
| `/salas/[roomId]`           | Detalle de sala real para salas persistidas; no cae silenciosamente al mock. |
| `/salas/[roomId]/ranking`   | Ranking de temporada real para salas persistidas; 404 si no hay temporada. |
| `/salas/[roomId]/historial` | Historial mock; la lectura y revisión real corresponden a S07.      |
| `/salas/[roomId]/ajustes`   | Vista mock de miembros y ajustes; gestión real está pendiente.      |
| `/desafios/[challengeId]`   | Desafío Flash competitivo real en contexto autorizado; preview mock explícito en los demás casos. |
| `/formatos`                 | Biblioteca estática de formatos y práctica local.                    |
| `/flash-pop`                | Lobby/demo de Flash Pop.                                             |

## Límites actuales

- La persistencia real verificada cubre el vertical Flash de S01–S06 y el stack local; no hay
  proyecto remoto vinculado.
- El ranking histórico de publicaciones cerradas, la revisión ampliada, configuración, miembros,
  creación de salas, invitaciones, editor, publicación, calendario y Storage siguen pendientes.
- Alphabet, Supervivencia, Pirámide y Narrativa todavía no tienen gameplay competitivo real.
- El takeover entre dispositivos y el abandono automático por inactividad siguen deshabilitados.
- Las rutas de práctica y preview pueden recibir soluciones y calcular localmente: no deben
  confundirse con el recorrido competitivo migrado.

## Verificación

Última verificación: 2026-09-15.

- `npm test`: 78 archivos de test y 523 tests superados.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run type-architecture` y
  `npm run docs:check`: correctos.
- `npm run supabase:schema:test`: correcto; 266 comprobaciones SQL, inventario, provisioning, S02,
  S03, S04, posición de tarjetas y carreras con conexiones PostgreSQL independientes.
- `npm run test:integration:supabase -- --scenario s06` y `npm run test:e2e -- e2e/s06-ranking.spec.ts`:
  correctos con Auth, PostgREST y dos sesiones de navegador contra Supabase local.
- `npm run format:check`: avisos de formato en 56 archivos; queda fuera del alcance de esta
  actualización documental.
