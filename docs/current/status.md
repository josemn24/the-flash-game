> Estado: vigente. Fotografía del repositorio en la fecha de la última actualización.

Última actualización documental: 2026-09-16.

# Estado actual del proyecto

## Resumen

The Flash combina dos recorridos explícitos. La práctica, las previews y las capacidades aún no
migradas usan fixtures y un store mock normalizado. Las slices S01–S11 y la base transversal del
portal privado tienen integración real con Supabase local: Auth, perfil, lecturas autorizadas de
salas, un Flash competitivo persistido con evaluación server-side, recuperación/abandono, sus dos
rankings, historial y revisión después de volver, además del acceso seguro server-side para
superadministración, la creación auditada de salas privadas y la preparación/activación auditada
de temporadas y la publicación editorial auditada de Flash mínimo desde el portal.

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
- Historial Flash de publicaciones cerradas, ranking histórico y detalle de resultados reconstruidos
  desde versiones persistidas (S07).
- Revisión propia y revisión ajena completa para `owner`, `admin` y `member`; `spectator` puede leer
  historial/rankings, pero no respuestas ni soluciones ajenas (S07).
- Portal privado en `/admin`: contexto del operador superadmin, listado de salas activas y creación
  de salas activas con owner explícito y grupo inicial opcional. La creación usa resolución exacta de
  usuarios, slug server-side, transacción, idempotencia y una auditoría agregada; no hay todavía
  gestión posterior de miembros. S10 añade creación/edición de borradores y activación explícita de
  temporadas, con fechas editadas en la zona horaria de cada sala y persistidas en UTC. S11 añade
  creación, edición, preview y publicación separada de Flash mínimo: dos preguntas
  multiple-choice, 50 puntos cada una, con soluciones privadas e inmutabilidad al publicar.
- Recorridos mock para ajustes, práctica, previews y modos distintos de Flash.

### Modelo operativo de la beta cerrada

La UI pública no permite crear salas privadas ni gestionar invitaciones. Un portal privado de
superadmin prepara y activa temporadas, publica Flash mínimo y provisiona directamente a los
usuarios autenticados en las salas, creando o reactivando sus membresías sin flujo de aceptación de
invitaciones. La programación de desafíos y la ejecución del calendario quedan fuera de S11 y son
capacidades previstas para ese portal interno. La superficie `/admin` ya permite al superadmin crear salas activas y provisionar
directamente a usuarios Auth existentes. La UI pública no ofrece ninguna capacidad administrativa.

## Rutas principales

| Ruta                        | Estado                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `/`                         | Perfil y tarjetas de salas reales cuando hay sesión; práctica/demo mock en el resto. |
| `/salas/[roomId]`           | Detalle de sala real para salas persistidas; no cae silenciosamente al mock. |
| `/salas/[roomId]/ranking`   | Ranking de temporada real para salas persistidas; 404 si no hay temporada. |
| `/salas/[roomId]/historial` | Historial Flash real para salas persistidas; otros modos siguen mock. |
| `/salas/[roomId]/historial/[challengeId]` | Ranking histórico Flash real; 404 si la publicación no es accesible o no está consolidada. |
| `/salas/[roomId]/historial/[challengeId]/[memberId]` | Revisión histórica Flash autorizada; sin enlaces de revisión para spectators. |
| `/salas/[roomId]/ajustes`   | Vista mock de miembros y ajustes; gestión real está pendiente.      |
| `/admin`                    | Portal privado server-side para superadmins: contexto, salas, temporadas y editorial Flash mínimo. |
| `/desafios/[challengeId]`   | Desafío Flash competitivo real en contexto autorizado; preview mock explícito en los demás casos. |
| `/formatos`                 | Biblioteca estática de formatos y práctica local.                    |
| `/flash-pop`                | Lobby/demo de Flash Pop.                                             |

## Límites actuales

- La persistencia real verificada cubre los verticales Flash de S01–S11 y el stack local; no hay
  proyecto remoto vinculado.
- El portal privado de `/admin` permite crear salas activas, asignar un owner existente,
  provisionar un grupo inicial opcional y gestionar temporadas S10. S11 añade el editor local de
  Flash mínimo; la gestión posterior de miembros, reemplazo/archivado de contenido publicado y
  calendario aún no está implementada y no forma parte de la UI pública de la beta; Storage también
  sigue pendiente.
- El flujo de invitaciones conserva sus reglas de producto, pero no se ofrece en la UI pública ni se
  necesita para bootstrappear la beta: el superadmin añade directamente usuarios autenticados.
- Las políticas de permisos de sala e invitaciones ya están fijadas. S08 cubre únicamente el
  provisioning inicial directo desde el portal; la gestión posterior e invitaciones permanecen
  pendientes.
- Alphabet, Supervivencia, Pirámide y Narrativa todavía no tienen gameplay competitivo real.
- `results_locked_at`, el abandono automático por inactividad y el takeover entre dispositivos
  siguen fuera de S07 y deshabilitados.
- El historial solo consolida publicaciones Flash `closed` sin intentos `in_progress`; intentos
  `test`/`invalidated` y publicaciones `cancelled` quedan fuera de las proyecciones de usuario.
- Las rutas de práctica y preview pueden recibir soluciones y calcular localmente: no deben
  confundirse con el recorrido competitivo migrado.

## Verificación

Última verificación: 2026-09-16.

- `npm test`: 88 archivos de test y 568 tests superados, incluyendo parser, adaptador, acciones y
  componentes de S11.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run type-architecture` y
  `npm run docs:check`: correctos.
- `npm run supabase:schema:test`: correcto; inventario, provisioning, S02–S08, S10, S11, ACL del
  portal, idempotencia, rollback y carreras de comandos, activaciones y edición/publicación con
  conexiones PostgreSQL independientes.
- `npm run test:integration:supabase -- --scenario s10`: correcto con creación, edición, activación,
  RLS pública, Auth y ausencia de publicaciones ficticias.
- `npm run test:e2e -- e2e/s10-season.spec.ts`: 2/2 correctos; superadmin crea/edita/activa en `/admin`
  y un miembro no accede al portal.
- `npm run test:integration:supabase -- --scenario s11`: correcto con Auth, PostgREST, creación,
  edición, publicación, soluciones privadas y denegación del contexto editorial.
- `npm run test:e2e -- e2e/s11-editorial.spec.ts`: 2/2 correctos; superadmin crea/edita/previsualiza/
  publica Flash mínimo y un miembro no ve editor, borradores ni soluciones.
- `npm run test:integration:supabase -- --scenario portal`: correcto con Auth, PostgREST y
  denegación de acceso privado contra Supabase local.
- `npm run test:e2e -- e2e/admin-portal.spec.ts`: 2/2 correctos; superadmin, recarga, miembro
  denegado y sesión anónima.
- `npm run test:integration:supabase -- --scenario s08` y
  `npm run test:e2e -- e2e/admin-room-creation.spec.ts`: correctos; búsqueda de usuarios, creación
  con owner/grupo inicial, idempotencia, colisión de slug, recarga y acceso denegado.
- `npm run test:integration:supabase -- --scenario s07` y
  `npm run test:e2e -- e2e/s07-history-review.spec.ts`: correctos con Auth, PostgREST y sesiones
  de navegador contra Supabase local. S06 continúa cubierto por su escenario y E2E propios.
- `npm run format:check`: avisos de formato en 71 archivos; queda fuera del alcance de esta
  actualización documental.
- `npm run stylelint`: mantiene un selector duplicado preexistente en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`; no pertenece al portal.
