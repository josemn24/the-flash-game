> Estado: vigente. Fotografía del repositorio en la fecha de la última actualización.

Última actualización documental: 2026-09-22.

# Estado actual del proyecto

## Resumen

The Flash combina dos recorridos explícitos. La práctica, las previews y las capacidades aún no
migradas usan fixtures y un store mock normalizado. Las slices S01–S13, S17a, S18b parcial, D08a/D08b,
S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16 y E01–E06/E10, junto con la base transversal del
portal privado tienen integración real con Supabase local: Auth, perfil, lecturas autorizadas de
salas, un Flash competitivo persistido con evaluación server-side, recuperación/abandono, sus dos
rankings, historial y revisión después de volver, y E01 Mini-Wordle con eventos intermedios
persistidos, E02 Logic-code con eventos privados y evaluación al acertar, E03 Progressive-clues
con revelaciones privadas y penalización basada en eventos, E04 Matching con parejas privadas,
feedback incremental y crédito parcial, y E05 Queens con colocaciones persistidas y penalización
server-side, y E06 Word-search con selecciones privadas, recuperación e idempotencia, además del acceso seguro server-side para
superadministración, la creación auditada de salas privadas y la preparación/activación auditada
de temporadas y la publicación editorial auditada de Flash mínimo desde el portal. F01/F02/F06 añaden
`true-false`, `odd-one-out` y `ordering` al Flash competitivo con evaluación server-side y payloads v1.
F07/F08/F12 añaden `classification`, `logic-matrix` y `anagram` con validación de labels/categorías, consumo de fichas,
asignaciones parciales y soluciones privadas en payloads v1.
F03 añade `estimation` al Flash competitivo con payload v2, tolerancia privada, crédito parcial
por proximidad y soporte opcional para imágenes privadas de `question-assets`.
F04 añade `heat-map` al Flash competitivo con payload v2, superficie privada resuelta por URL firmada,
objetivo y radios privados, y crédito parcial espacial server-side.
F16 añade `zip` como respuesta final server-side: la cuadrícula y checkpoints son públicos, la solución
única permanece privada, el recorrido parcial se conserva como draft de timeout y la revisión terminal
reutiliza el contenido privado autorizado.
S12 añade
programación/reprogramación de publicaciones Flash, calendario efectivo con tick local protegido y
apertura/cierre/finalización por reloj PostgreSQL. S17a añade la biblioteca editorial de preguntas
reutilizables. D08a/D08b/S13 añade los buckets `avatars` y `question-assets`, el registro privado
`media_assets`, confirmación server-side de avatares y resolución pública de rutas estables. D08b
integra E10 con `question-assets`: el editor sube y confirma assets privados, las versiones nuevas
persisten `assetId` y `prepare_interaction` emite una URL firmada solo tras autorizar la partida.
La misma infraestructura ya está integrada en `multiple-choice`: su biblioteca usa `media.assetId`
en payload v2 y el runtime entrega únicamente `media.src` al jugador autorizado.

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
  usuarios, slug server-side, transacción, idempotencia y una auditoría agregada. S18b ya permite al
  owner conceder/quitar admin y eliminar lógicamente miembros desde ajustes; transferencia de
  propiedad, bloqueo/desbloqueo e invitaciones completas siguen pendientes. S10 añade creación/edición de borradores y activación explícita de
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
  E05 añade mezclas `multiple-choice` + `queens`, tablero 5×5, coronas precolocadas, eventos de
  colocación/retirada, penalización del 5% por conflicto, recuperación sin marcas X y resolución
  automática con evaluación server-side.
  S05 añade Alphabet competitivo persistido: referencias `short-text` publicadas, reloj global,
  vueltas, pases, recuperación de la letra activa y revisión terminal sin solución durante el juego.
  F01/F02/F06/F07/F08/F12 permiten publicar mezclas con `true-false`, `odd-one-out`, `ordering`,
  `classification`, `anagram`, `estimation` y `heat-map`; las respuestas, asignaciones, fichas,
  permutaciones, estimaciones y coordenadas se validan y evalúan exclusivamente en el servidor.
- La reorganización del portal ya convierte `/admin` en un dashboard breve basado en
  `SuperadminDashboardModel`. `/admin/rooms` es la entrada operativa principal: sus tarjetas llevan a
  `/admin/rooms/[roomId]`, donde viven las pestañas `overview`, `seasons`, `members` y `calendar`.
  Temporadas, usuarios activos y calendario se cargan acotados a la sala; desafíos Flash y preguntas
  siguen siendo áreas globales. Las Server Actions conservan autorización, auditoría, idempotencia y
  concurrencia optimista, y vuelven al detalle de la sala con avisos contextuales. `/admin/questions`
  conserva su biblioteca funcional dentro del shell común; `/admin/questions/new` y
  `/admin/questions/[questionVersionId]` también usan ese shell con breadcrumbs coherentes.
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

| Ruta                                                 | Estado                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                                  | Perfil y tarjetas de salas reales cuando hay sesión; práctica/demo mock en el resto.                      |
| `/salas/[roomId]`                                    | Detalle de sala real con calendario temporal para salas persistidas; no cae silenciosamente al mock.      |
| `/salas/[roomId]/ranking`                            | Ranking de temporada real para salas persistidas; 404 si no hay temporada.                                |
| `/salas/[roomId]/historial`                          | Historial Flash real para salas persistidas; otros modos siguen mock.                                     |
| `/salas/[roomId]/historial/[challengeId]`            | Ranking histórico Flash real; 404 si la publicación no es accesible o no está consolidada.                |
| `/salas/[roomId]/historial/[challengeId]/[memberId]` | Revisión histórica Flash autorizada; sin enlaces de revisión para spectators.                             |
| `/salas/[roomId]/ajustes`                            | Ajustes reales parciales: el owner puede conceder/quitar admin y eliminar lógicamente miembros; otras operaciones siguen pendientes. |
| `/admin`                                             | Dashboard privado server-side: métricas, alertas, accesos rápidos, salas resumidas y próximos desafíos.   |
| `/admin/rooms`                                       | Gestión protegida de salas activas y creación de salas.                                                   |
| `/admin/rooms/[roomId]`                              | Detalle protegido de una sala activa con resumen, temporadas, usuarios activos y calendario.              |
| `/admin/challenges`                                  | Catálogo protegido de desafíos Flash definidos.                                                          |
| `/admin/challenges/new`                              | Preparación protegida de un nuevo desafío Flash.                                                         |
| `/admin/challenges/[challengeDefinitionId]`         | Detalle protegido, edición de borradores e historial de versiones Flash.                                |
| `/admin/questions`                                   | Biblioteca de preguntas funcional con navegación común.                                                   |
| `/admin/questions/new`                               | Editor protegido para crear una versión de pregunta, dentro del shell común.                              |
| `/admin/questions/[questionVersionId]`               | Editor protegido de una versión existente, dentro del shell común.                                        |
| `/desafios/[challengeId]`                            | Desafío Flash competitivo real con UUID y sala autorizada; en `pilot`, sin sala o con alias devuelve 404. |
| `/formatos`                                          | Biblioteca estática de formatos y práctica local.                                                         |
| `/flash-pop`                                         | Lobby/demo de Flash Pop.                                                                                  |

## Límites actuales

- La persistencia real verificada cubre los verticales Flash de S01–S13, D08a/D08b, E01–E06/E10 y F01/F02/F03/F04/F06/F07/F08/F12 sobre el stack local; no hay
  proyecto remoto vinculado.
- El portal privado de `/admin` permite crear salas activas, asignar un owner existente,
  provisionar un grupo inicial opcional y gestionar temporadas S10. S11 añade el editor local de
  Flash mínimo; la gestión posterior de miembros es parcial en ajustes (S18b), mientras que
  transferencia, bloqueo/desbloqueo e invitaciones completas, además del reemplazo/archivado de
  contenido publicado y calendario S12, siguen siendo local-first y no forman parte de la UI pública.
  D08a/S13 ya
  cubren avatares persistidos y assets privados de E10 y `multiple-choice`. La subida de imágenes de
  `multiple-choice` vive en la biblioteca de preguntas; el editor inline de Flash solo reutiliza
  versiones publicadas.
- El flujo de invitaciones conserva sus reglas de producto, pero no se ofrece en la UI pública ni se
  necesita para bootstrappear la beta: el superadmin añade directamente usuarios autenticados.
- Las políticas de permisos de sala e invitaciones ya están fijadas. S08 cubre el provisioning
  inicial directo desde el portal y S18b cubre solo concesión/revocación de admin y eliminación
  lógica por el owner; transferencia, bloqueo/desbloqueo y el flujo completo de invitaciones permanecen
  pendientes.
- Supervivencia, Pirámide y Narrativa todavía no tienen gameplay competitivo real.
- `results_locked_at`, el abandono automático por inactividad y el takeover entre dispositivos
  siguen fuera de S07 y deshabilitados.
- El historial solo consolida publicaciones Flash `closed` sin intentos `in_progress`; intentos
  `test`/`invalidated` y publicaciones `cancelled` quedan fuera de las proyecciones de usuario.
- Las rutas de práctica y preview pueden recibir soluciones y calcular localmente: no deben
  confundirse con el recorrido competitivo migrado.

## Verificación

Última verificación: 2026-09-22.

- `npm test`: 121 archivos y 714 tests superados en la última ejecución completa registrada; incluye reglas, adaptadores, health check y ruta HTTP,
  UI pública de E01–E06 y F08,
  navegación del portal y acciones administrativas; además de S05-Alphabet,
  el contrato E10, S11/S12 y la integración D08b-MC.
- `npm run typecheck`, `npm run lint`, `npm run build` y
  `npm run docs:check`: correctos.
- La validación de pulido cubre el shell administrativo, breadcrumbs, navegación activa, enlace de
  accesibilidad al contenido principal y anuncios `aria-live` para operaciones completadas.
- La reorganización del portal valida el adaptador del dashboard, el dashboard sin formularios y la
  compatibilidad de las redirecciones con 19 tests dirigidos; `npm run supabase:schema:test` también pasa con la nueva función de
  lectura registrada en el inventario de seguridad.
- `npm run verify:pilot`, ejecutado sobre Supabase local reconstruido desde cero, es correcto:
  el runner carga fixtures aislados y ejecuta integración y E2E para portal, S02, S03, E01–E06, F08,
  S04, S06, S07 y S10–S12; también pasan el fixture de navegador, `flash-layout`, diccionario
  y backup/restore.
- Las pruebas E2E administrativas y de slices que antes estaban bloqueadas por el fixture de login
  quedan cerradas dentro del piloto completo. `npm run stylelint` mantiene un fallo histórico fuera
  del portal en el selector duplicado de `app/flash-pop-concepts/FlashPopConcepts.module.css`;
  los estilos modificados de administración pasan Stylelint de forma aislada.
- `npm run type-architecture`: correcto; los contratos comparten `AnswerResultDetails` desde
  `types/contracts` y `app/actions/room-members.ts` atraviesa la fachada server-only.
- `npm run supabase:schema:test`: correcto sobre 40 archivos declarativos y la revisión canónica
  `20260922103932_declarative_sync`; cubre inventario, provisioning, S02–S08, S05-Alphabet,
  S10–S13, S17a, S18b parcial, E01–E06, F08, F16 y E10, ACL del portal, idempotencia, rollback y carreras de comandos con
  conexiones PostgreSQL independientes. S13 verifica Flash de 2, 5 y 20 preguntas, reducción
  de 20 a 2 y suma de 100 puntos.
- `npm run schema:revision:check`: correcto; las cuatro fuentes de configuración coinciden con la
  última migración versionada.
- Validación enfocada F16: tests de dominio/adaptadores, `typecheck`, arquitectura, lint, build,
  `docs:check`, integración Auth/PostgREST/RLS y `npm run test:e2e -- e2e/f16-zip.spec.ts` (3/3).
- No se ejecutó `npm run verify:pilot` completo para F16; sus puertas equivalentes se ejecutaron de
  forma dirigida según el alcance de la slice.
- `npm run supabase:db:schema:sync -- --name s05_alphabet`: correcto; generó
  `supabase/migrations/20260919184450_s05_alphabet.sql`.
- La segunda ejecución de `npm run supabase:db:schema:sync -- --name s05_alphabet_check` informó
  `No schema changes found`, tras reparar el cierre SQL perdido de la migración histórica F04.
- E10 añade `progressive-image` al recorrido competitivo persistido: fixture mixto, validación
  pública/privada, reloj iniciado por servidor, recuperación y evaluación normalizada; la imagen
  original es pública y no se presenta como revelación protegida.
  - D08a/S13 valida los bytes reales de avatares, limita JPEG/PNG/WebP a 5 MB y 2048 px, confirma
    `media_assets` antes de cambiar `players.avatar_path` y conserva el avatar anterior ante fallos.
- `npm run test:integration:supabase -- --scenario e10`: correcto; el E2E E10 incluye el recorrido
  completo y el control de spectator. Su verificación se mantiene fuera de la matriz S22 de
  ejecución del piloto, pero está cubierta por su escenario dedicado.
- `npm run test:integration:supabase -- --scenario s10`: correcto con creación, edición, activación,
  RLS pública, Auth y ausencia de publicaciones ficticias.
- `npm run test:e2e -- e2e/s10-season.spec.ts`: 2/2 correctos; superadmin crea/edita/activa en `/admin`
  y un miembro no accede al portal.
- `npm run test:integration:supabase -- --scenario s11`: el escenario declarativo de publicación
  queda cubierto por la suite de schema, incluida la pregunta `estimation` v2.
- `npm run test:e2e -- e2e/s11-editorial.spec.ts`: correcto dentro del piloto; cubre creación, edición,
  preview protegido, publicación explícita de siete preguntas y publicación del Flash, además de la
  invisibilidad del editor para un miembro.
- `npm run test:integration:supabase -- --scenario e03` y
  `npm run test:e2e -- e2e/e03-progressive-clues.spec.ts`: correctos; cubren publicación mixta,
  proyección sin solución/pistas futuras, revelación idempotente, recarga, penalización y revisión.
- `npm run test:integration:supabase -- --scenario e04` y
  `npm run test:e2e -- e2e/e04-matching.spec.ts`: correctos; cubren correspondencias privadas,
  penalización, recarga, reintento idempotente, cierre y revisión autorizada.
- `npm run test:integration:supabase -- --scenario e05`: correcto con fixture mixto, lectura Queens
  sin solución y aislamiento del spectator; el fixture temporal se limpió tras la prueba.
- `npm run test:e2e -- e2e/e05-queens.spec.ts`: correcto; cubre coronas persistidas, recarga,
  conflicto, reintento idempotente, resolución y revisión autorizada.
- `npm run test:integration:supabase -- --scenario s12` y
  `npm run test:e2e -- e2e/s12-calendar.spec.ts`: correctos tras reconstruir la base local; cubren
  programación, tick temporal protegido, calendario y acceso del miembro al desafío.
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
