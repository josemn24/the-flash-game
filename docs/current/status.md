> Estado: vigente. Fotografía del repositorio en la fecha de la última actualización.

Última actualización documental: 2026-09-18.

# Estado actual del proyecto

## Resumen

The Flash combina dos recorridos explícitos. La práctica, las previews y las capacidades aún no
migradas usan fixtures y un store mock normalizado. Las slices S01–S12 y la base transversal del
portal privado tienen integración real con Supabase local: Auth, perfil, lecturas autorizadas de
salas, un Flash competitivo persistido con evaluación server-side, recuperación/abandono, sus dos
rankings, historial y revisión después de volver, y E01 Mini-Wordle con eventos intermedios
persistidos, E02 Logic-code con eventos privados y evaluación al acertar, E03 Progressive-clues
con revelaciones privadas y penalización basada en eventos, y E04 Matching con parejas privadas,
feedback incremental y crédito parcial, además del acceso seguro server-side para
superadministración, la creación auditada de salas privadas y la preparación/activación auditada
de temporadas y la publicación editorial auditada de Flash mínimo desde el portal. S12 añade
programación/reprogramación de publicaciones Flash, calendario efectivo con tick local protegido y
apertura/cierre/finalización por reloj PostgreSQL. S17a añade la biblioteca editorial de preguntas
reutilizables. D08a/S13 añade los buckets `avatars` y `question-assets`, el registro privado
`media_assets`, confirmación server-side de avatares y resolución pública de rutas estables. La
integración editorial de imágenes de preguntas queda para una slice posterior.

No hay un proyecto remoto de Supabase vinculado desde este entorno (`linked_project: null`). El
estado verificado corresponde al stack local y no permite afirmar el estado de producción o staging.
S22 fija el runtime `pilot` para operar únicamente Flash persistido y portal; las demos mock no son
fallback de las rutas competitivas. Consulta [`s22-operacion.md`](s22-operacion.md).

## Capacidades actuales

- 31 formatos de pregunta nativos, con ejemplos jugables en la biblioteca.
- Cinco modos: `flash`, `alphabet`, `survival`, `narrative` y `pyramid`.
- Autenticación Supabase local, provisioning idempotente de `Player`, logout y edición del nombre.
- Home, detalle de sala e introducción con lecturas autorizadas reales (S02).
- Flash competitivo real de 2 a 20 preguntas, 100 puntos totales, con sesiones exclusivas, tiempos,
  respuestas, evaluación privada, puntuación y ledger de puntos (S03/E01). E01 admite desafíos
  mixtos `multiple-choice` + `mini-wordle`; cada palabra procede del diccionario general o de
  palabras temáticas privadas de la pregunta, y el feedback/historial se calculan y persisten en
  PostgreSQL sin enviar la solución.
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
  creación, edición, preview y publicación separada de Flash mínimo; E01 añade Mini-Wordle y permite
  publicar mezclas con soluciones privadas, palabras específicas fuera del diccionario general e
  inmutabilidad al publicar. E02 añade mezclas `multiple-choice` + `logic-code`, códigos numéricos
  con ceros iniciales, duplicados sin penalización, progreso tras recarga y reintento idempotente.
  E03 añade mezclas `multiple-choice` + `progressive-clues`, primera pista gratuita, revelaciones
  transaccionales, penalización escalada por puntos del item, evaluación desde eventos y protección
  contra pistas futuras.
  E04 añade mezclas `multiple-choice` + `matching`, correspondencias uno a uno, eventos privados de
  aciertos/fallos, penalización del 10%, progreso tras recarga y evaluación parcial en timeout.
- Recorridos mock para ajustes, práctica, previews y modos distintos de Flash, únicamente en scope
  `development`/`test` o bajo rutas demo explícitas.

### Modelo operativo de la beta cerrada

La UI pública no permite crear salas privadas ni gestionar invitaciones. Un portal privado de
superadmin prepara y activa temporadas, publica Flash mínimo y provisiona directamente a los
usuarios autenticados en las salas, creando o reactivando sus membresías sin flujo de aceptación de
invitaciones. La superficie `/admin` permite programar y reprogramar publicaciones Flash futuras;
el calendario se ejecuta localmente con `POST /api/internal/calendar/tick` y
`npm run calendar:tick`. La superficie ya permite al superadmin crear salas activas y provisionar
directamente a usuarios Auth existentes. La UI pública no ofrece ninguna capacidad administrativa.

## Rutas principales

| Ruta                        | Estado                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `/`                         | Perfil y tarjetas de salas reales cuando hay sesión; práctica/demo mock en el resto. |
| `/salas/[roomId]`           | Detalle de sala real con calendario temporal para salas persistidas; no cae silenciosamente al mock. |
| `/salas/[roomId]/ranking`   | Ranking de temporada real para salas persistidas; 404 si no hay temporada. |
| `/salas/[roomId]/historial` | Historial Flash real para salas persistidas; otros modos siguen mock. |
| `/salas/[roomId]/historial/[challengeId]` | Ranking histórico Flash real; 404 si la publicación no es accesible o no está consolidada. |
| `/salas/[roomId]/historial/[challengeId]/[memberId]` | Revisión histórica Flash autorizada; sin enlaces de revisión para spectators. |
| `/salas/[roomId]/ajustes`   | Vista mock de miembros y ajustes; gestión real está pendiente.      |
| `/admin`                    | Portal privado server-side para superadmins: contexto, salas, temporadas, editorial Flash con MC/Mini-Wordle y calendario. |
| `/desafios/[challengeId]`   | Desafío Flash competitivo real con UUID y sala autorizada; en `pilot`, sin sala o con alias devuelve 404. |
| `/formatos`                 | Biblioteca estática de formatos y práctica local.                    |
| `/flash-pop`                | Lobby/demo de Flash Pop.                                             |

## Límites actuales

- La persistencia real verificada cubre los verticales Flash de S01–S13, D08a y E01–E04/E10 sobre el stack local; no hay
  proyecto remoto vinculado.
- El portal privado de `/admin` permite crear salas activas, asignar un owner existente,
  provisionar un grupo inicial opcional y gestionar temporadas S10. S11 añade el editor local de
  Flash mínimo; la gestión posterior de miembros, reemplazo/archivado de contenido publicado y
  calendario S12 es local-first y no forma parte de la UI pública de administración. D08a/S13 ya
  cubren avatares persistidos; `question-assets` queda preparado para una slice editorial posterior.
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

Última verificación: 2026-09-18.

- `npm test`: 98 archivos y 634 tests superados; incluye reglas, adaptadores y UI pública de E01–E04
  y el contrato E10
  además de S11/S12.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run type-architecture` y
  `npm run docs:check`: correctos.
- `npm run verify:pilot`: pendiente de ejecutar con los escenarios E03–E04; el runner ya incluye sus
  fixture, integración y E2E además de los recorridos existentes.
- `npm run supabase:schema:test`: correcto; 32 archivos declarativos, inventario, provisioning,
  S02–S08, S10–S13, E01–E04 y E10, ACL del portal, idempotencia, rollback y carreras de comandos con
  conexiones PostgreSQL independientes. S13 verifica Flash de 2, 5 y 20 preguntas, reducción
  de 20 a 2 y suma de 100 puntos.
- E10 añade `progressive-image` al recorrido competitivo persistido: fixture mixto, validación
  pública/privada, reloj iniciado por servidor, recuperación y evaluación normalizada; la imagen
  original es pública y no se presenta como revelación protegida.
- D08a/S13 valida los bytes reales de avatares, limita JPEG/PNG/WebP a 5 MB y 2048 px, confirma
  `media_assets` antes de cambiar `players.avatar_path` y conserva el avatar anterior ante fallos.
- `npm run test:integration:supabase -- --scenario e10`: correcto; el E2E E10 incluye el recorrido
  completo y el control de spectator. En esta sesión el caso jugador quedó pendiente por un timeout
  del entorno local al iniciar el intento, con artefactos de trace incompletos.
- `npm run test:integration:supabase -- --scenario s10`: correcto con creación, edición, activación,
  RLS pública, Auth y ausencia de publicaciones ficticias.
- `npm run test:e2e -- e2e/s10-season.spec.ts`: 2/2 correctos; superadmin crea/edita/activa en `/admin`
  y un miembro no accede al portal.
- `npm run test:integration:supabase -- --scenario s11`: correcto con Auth, PostgREST, creación,
  edición, publicación de cinco preguntas, soluciones privadas y denegación del contexto editorial.
- `npm run test:e2e -- e2e/s11-editorial.spec.ts`: 2/2 correctos; superadmin crea/edita/previsualiza/
  publica un Flash de cinco preguntas, ve el resumen dinámico 5/100 y un miembro no ve editor,
  borradores ni soluciones.
- `npm run test:integration:supabase -- --scenario e03`: escenario añadido para publicación mixta,
  proyección sin solución ni pistas futuras y aislamiento del spectator.
- `npm run test:e2e -- e2e/e03-progressive-clues.spec.ts`: escenario añadido para primera pista,
  revelación idempotente, reducción del máximo, recarga, respuesta normalizada y revisión.
- `npm run test:integration:supabase -- --scenario e04`: escenario añadido para publicación mixta,
  payload jugable sin correspondencias y aislamiento del spectator.
- `npm run test:e2e -- e2e/e04-matching.spec.ts`: escenario añadido para parejas, penalización,
  recarga, respuesta HTTP perdida, reintento idempotente y revisión autorizada.
- `npm run test:integration:supabase -- --scenario s12`: pendiente de aplicar la migración S12 al
  Supabase persistente local; la suite declarativa sobre una base aislada ya pasa y la prueba no se
  repite con un reset global para no eliminar fixtures no relacionados.
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
