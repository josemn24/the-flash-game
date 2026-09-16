# Decisiones del dominio

## Estado y alcance

- Estado: aprobado.
- Versión: 1.2.
- Fecha: 2026-09-15.
- Este documento define comportamiento e invariantes, no tablas SQL concretas.

## 1. Producto y participación

- The Flash será inicialmente un juego competitivo asíncrono.
- Una cuenta puede pertenecer simultáneamente a varias salas.
- Todo desafío competitivo pertenece a una sala y no puede jugarse fuera de ella.
- Cada desafío se publica dentro de la temporada de una sala mediante una ventana explícita de
  disponibilidad.
- Puede haber días sin desafíos y una publicación puede permanecer disponible durante varios días.
- La práctica se limita a ejemplos aislados de formatos como Queens o Escape. No crea intentos,
  puntos, historial ni posiciones en rankings.
- Todos los desafíos tienen un máximo común de 100 puntos enteros.
- El modo determina cómo se distribuyen los puntos y sus reglas de intento, tiempo, finalización y
  desempate.
- Mientras una publicación está disponible, no jugar se representa mediante la ausencia de un
  intento; no se crea un resultado ficticio de cero puntos. Si la publicación termina antes de que
  el jugador empiece, el estado visible es `expired`, sin intento jugado ni puntos.
- La disponibilidad de la publicación (`available`, `locked`, `expired`) es independiente del ciclo
  de vida del intento. `expired` no es un estado persistido de `Attempt`; identifica una publicación
  cerrada antes de que el jugador iniciara.
- Llegar al final reglamentario del flujo produce un intento `completed`, incluso con cero Flash
  Points. En La Pirámide, tanto completar los siete niveles como fallar un nivel que termina el
  modo constituyen una finalización reglamentaria y producen `completed`; no es necesario haber
  jugado los siete niveles para ese estado. La interfaz puede mostrar feedback específico de
  “desafío superado” solo al completar correctamente los siete niveles. No existe un estado
  funcional global de desafío “superado” o “fallido”, ni ese feedback específico se convierte en
  una propiedad de dominio.
- Solo abandonar explícitamente un intento iniciado produce `abandoned`; consume el intento y se
  proyecta como `notCompleted`. Cerrar la pestaña o perder conexión activa la recuperación
  autoritativa por modo y no es, por sí solo, una transición terminal.
- La política predeterminada permite un único intento. Un modo puede sustituirla explícitamente y,
  si permite varios intentos, cuenta el mejor.
- Para el MVP, un intento `in_progress` tiene una única sesión controladora. Una recarga en esa
  sesión puede reanudarlo; una cookie/token distinto recibe un conflicto de sesión activa y no
  transfiere el control. El takeover entre dispositivos queda expresamente fuera del MVP.

## 2. Jugadores e identidad

- Un jugador representa una persona con una cuenta autenticada. No habrá invitados inicialmente.
- Supabase Auth será el primer proveedor de autenticación.
- La identidad de dominio se separa de la identidad del proveedor: `player.id` es estable y
  `player.auth_user_id` referencia a Supabase Auth, es único y puede quedar vacío.
- El perfil es global: no existen nombres o avatares distintos por sala.
- El nombre visible no es único y el jugador puede modificar nombre y avatar.
- Los avatares se suben a Supabase Storage. El dominio conserva la ruta estable del objeto, no una
  URL firmada temporal.
- El jugador actual se obtiene de la sesión autenticada; nunca es una propiedad de `Room`.
- El correo y otros datos privados de autenticación no forman parte del perfil social.
- Al eliminar la cuenta se desvincula la identidad de autenticación, se eliminan los datos
  personales y el avatar, y el perfil pasa a mostrarse como participante anonimizado. Su ID y sus
  resultados históricos se conservan.

## 3. Salas, membresías e invitaciones

- Las salas son privadas.
- El acceso se realiza mediante invitaciones revocables y con caducidad.
- Los roles de sala son `owner`, `admin`, `member` y `spectator`.
- Cada sala tiene exactamente un `owner`; puede tener varios administradores.
- La propiedad se expresa únicamente mediante el rol de la membresía. `Room` no duplica un
  `owner_id` independiente.
- `owner`, `admin` y `member` pueden competir. `spectator` puede consultar la sala y sus rankings,
  pero no iniciar intentos competitivos.
- El propietario puede transferir la propiedad manualmente.
- Si abandona, la propiedad se transfiere al administrador activo más antiguo o, en su defecto, al
  miembro activo más antiguo.
- Si no hay otro miembro elegible, el propietario debe nombrar uno o eliminar la sala antes de
  abandonarla.
- Los estados de una membresía son `active`, `left`, `removed` y `banned`.
- `left` es una salida voluntaria; `removed` permite una futura invitación; `banned` impide volver
  hasta que se retire el bloqueo.
- Volver a entrar reactiva la relación del jugador con la sala sin eliminar su historial.
- Salir, ser expulsado o ser bloqueado no elimina automáticamente resultados obtenidos. Los
  intentos fraudulentos se invalidan de forma explícita.
- La zona horaria pertenece a la sala. El valor inicial será `Europe/Madrid`.
- Una sala se elimina primero de forma lógica y recuperable. Su purga definitiva elimina los datos
  que solo tienen significado dentro de ella.

### 3.1 Gestión de sala e invitaciones (2026-09-16)

- `owner` puede gestionar la sala, temporadas, publicaciones, invitaciones y membresías, y puede
  transferir la propiedad. No puede invalidar intentos ni corregir puntos; esas operaciones quedan
  reservadas a `superadmin`.
- `admin` puede editar la sala, crear y revocar invitaciones, cambiar roles y expulsar, bloquear o
  desbloquear miembros. Puede gestionar cualquier membresía salvo la de `owner`, incluida la de
  otros admins, pero solo `owner` puede conceder el rol `admin`.
- `member` no realiza operaciones de administración. `spectator` tampoco.
- `superadmin` puede realizar prácticamente cualquier operación de sala, membresía, publicación,
  inspección, invalidación y corrección necesaria para operar la plataforma, sin convertirse por
  ello en miembro competitivo ni saltarse las invariantes de identidad. Toda acción de
  `superadmin` que afecte directamente a una sala exige motivo cuando corresponda y queda registrada
  en auditoría.
- `editor`/autor no es un rol de sala concedible por invitación en esta fase. Su alcance editorial
  específico queda separado de esta matriz y se concretará en las slices de contenido; mientras tanto, las
  capacidades globales de contenido corresponden a `superadmin`.
- Las invitaciones pueden conceder `admin`, `member` o `spectator` cuando las crea `owner`; las
  creadas por `admin` solo pueden conceder `member` o `spectator`.
- Una invitación es de un solo uso por defecto. Puede configurarse explícitamente como multiuso
  hasta 20 aceptaciones; la UI no ofrece invitaciones ilimitadas.
- La caducidad por defecto es de 7 días y nunca puede superar 30 días. El servidor calcula y valida
  esos límites usando su reloj autoritativo.
- `owner` y cualquier `admin` pueden revocar invitaciones. La revocación solo bloquea aceptaciones
  futuras y no modifica membresías ya creadas.
- Una membresía `left` o `removed` se reactiva con el rol de la nueva invitación y conserva su
  historial. Una membresía `banned` no puede reincorporarse.
- Un miembro `active` que acepta otra invitación no consume usos ni cambia de rol automáticamente.
  El cambio de rol se realiza mediante la gestión de membresías.
- El token en claro solo se muestra al crear la invitación; después se conserva únicamente su hash.
  No se envía correo desde la aplicación. Crear, aceptar y revocar invitaciones son operaciones
  auditables y los errores de token no disponible no revelan si fue inválido, caducado, revocado o
  agotado.

### 3.2 Alcance operativo de la beta cerrada (2026-09-16)

- La UI pública de la primera versión no permite crear salas privadas, crear, aceptar o revocar
  invitaciones, ni preparar o activar temporadas.
- Las operaciones administrativas que sí se habiliten en la beta se realizarán desde un portal
  privado para superadministradores. El portal debe autenticar y autorizar server-side cada acción,
  usar comandos estrechos y registrar en auditoría las acciones que afecten directamente a una sala.
- Durante la beta, el superadmin puede añadir directamente a un usuario autenticado a una sala o
  reactivar su membresía, asignándole un rol permitido (`admin`, `member` o `spectator`). Este alta
  directa es provisioning operativo: no crea ni consume una invitación y no requiere que el usuario
  acepte un enlace.
- El superadmin puede crear salas y asignar su propietario inicial desde ese portal. No se convierte
  automáticamente en miembro competitivo por operar la sala.
- La configuración y activación de temporadas también es una tarea exclusiva del portal durante la
  beta. S11 habilita la publicación mínima de Flash y S12 la programación/reprogramación y el tick
  local de calendario desde esa misma superficie interna; cancelación, automatización remota y
  reemplazo de versiones publicadas quedan para slices posteriores.
- Los usuarios finales solo consultan y juegan en salas ya provisionadas. No deben aparecer CTA ni
  rutas públicas que sugieran gestión de salas, membresías, invitaciones o temporadas.
- Las reglas de invitaciones documentadas arriba se conservan como política del producto para una
  fase posterior; no son un requisito de bootstrap ni un flujo público o necesario de esta beta.

## 4. Superadministración y pruebas fantasma

- `superadmin` es un rol global de plataforma y no una membresía de sala.
- El privilegio no puede concederse desde el cliente ni desde metadatos modificables por el propio
  usuario.
- Los superadministradores pueden inspeccionar salas, editar contenido y realizar pruebas.
- Las operaciones administrativas sensibles se auditan.
- Las partidas de prueba se ejecutan en modo fantasma y se marcan como no competitivas.
- Un intento fantasma no consume intentos oficiales, no concede Flash Points, no aparece en rankings,
  no cuenta como participación y no genera actividad social ordinaria.

## 5. Temporadas

- Cada temporada pertenece exactamente a una sala.
- Una sala puede no tener una temporada activa y nunca puede tener más de una.
- Los estados son `draft`, `scheduled`, `active`, `finished` y `cancelled`.
- Una temporada tiene fechas de inicio y fin almacenadas en UTC. El estado también es explícito
  porque puede existir cancelación o cierre administrativo.
- Una temporada en borrador puede editarse. Durante una temporada activa solo pueden cambiarse de
  forma controlada publicaciones futuras. Una temporada finalizada es inmutable salvo correcciones
  auditadas.
- Cada temporada comienza con cero Flash Points y posee su propio ranking.
- La temporada no tiene niveles, hitos, metas, desbloqueos ni recompensas funcionales; su progreso
  se expresa únicamente como total acumulado, sin barra ni denominador.
- No habrá un ranking acumulado global de la sala.
- Un miembro que entra durante la temporada comienza con cero Flash Points y puede competir desde
  su incorporación.
- Los Flash Points conseguidos antes de abandonar permanecen en el ranking de la temporada.
- Al finalizar no se admiten nuevos intentos. Los iniciados válidamente pueden terminar dentro de
  su plazo individual y el resultado definitivo se cierra después de que todos hayan expirado.

## 6. Catálogo y contenido editorial

- Una `ChallengeDefinition` es una identidad global y reutilizable entre salas.
- Una `ChallengeVersion` contiene una revisión concreta del contenido.
- Un `ScheduledChallenge` publica una versión concreta dentro de una temporada.
- Los estados editoriales son `draft`, `published` y `archived`.
- Una versión en borrador es editable. Una versión publicada es inmutable.
- Cualquier cambio posterior, incluida una corrección, crea una versión nueva.
- Una definición que ya haya sido utilizada se archiva en lugar de eliminarse.
- Las preguntas son reutilizables y versionables.
- Una versión de desafío referencia versiones concretas de preguntas para que una partida histórica
  pueda reconstruirse exactamente.
- El orden de las preguntas forma parte de la versión.
- La posición, letra, nivel, briefing, reacciones y puntuación asignada pertenecen al elemento que
  incluye la pregunta en el desafío, no a la pregunta global.
- La configuración completa debe sumar exactamente 100 puntos.
- Inicialmente solo se publica contenido en español. El idioma no se incrusta en los IDs.
- Los medios se referencian mediante rutas estables de assets versionados o de Storage.
- Se conserva autoría y fecha de creación y publicación del contenido.

## 7. Programación de desafíos

- Un `ScheduledChallenge` pertenece a una temporada y referencia una `ChallengeVersion` publicada.
- La ventana se expresa mediante `opens_at` inclusivo y `closes_at` exclusivo.
- Las fechas se almacenan en UTC y se introducen y presentan usando la zona horaria de la sala.
- La publicación actual se determina únicamente por sus fechas y estado, no mediante hashes o una
  rotación implícita.
- No pueden solaparse dos publicaciones competitivas dentro de la misma temporada.
- El número u orden de publicación es único dentro de la temporada.
- Los placeholders visuales no son publicaciones persistidas.
- Una publicación puede reprogramarse antes de abrirse. Después solo puede cancelarse mediante una
  operación administrativa auditada.
- Una publicación cancelada conserva sus intentos para auditoría, pero no contribuye a rankings ni
  aparece como un desafío finalizado ordinario.
- Se puede iniciar un intento mientras el instante del servidor sea anterior a `closes_at`.
- Un intento iniciado válidamente puede terminar después de `closes_at`, hasta el `deadline_at`
  calculado por el servidor.
- La publicación se considera definitivamente cerrada cuando ningún intento válido puede seguir
  activo.

## 8. Intentos

- Un intento pertenece a un jugador y a un desafío programado. Este último determina sala,
  temporada, contenido y reglas.
- Para iniciar un intento el jugador debe tener una membresía competitiva activa.
- Empezar consume uno de los intentos permitidos, aunque después se cierre o refresque el navegador.
- Mientras el intento siga `in_progress`, regresar al desafío con la sesión controladora reanuda el
  mismo intento; no crea otro. Antes de exponer contenido nuevo, el servidor reconcilia una
  recepción ya aceptada o consume la interacción abierta según el contrato del modo.
- Los estados del intento iniciado son `in_progress`, `completed`, `abandoned` e `invalidated`.
  `expired` describe la publicación que termina antes de que el jugador cree un intento y no genera
  respuestas, puntos ni resultado propio.
- No existe un resultado funcional global `passed` o `failed`. Los modos pueden conservar estados o
  feedback internos, como `summit` en La Pirámide, pero no deben usarse para determinar si el desafío
  competitivo está completado.
- En La Pirámide, `PyramidAttemptOutcome` (`summit`/`failed`) es feedback interno del modo. Ambos
  corresponden a un intento `completed` cuando el modo termina reglamentariamente; `failed` no se
  proyecta como `notCompleted`.
- La acción explícita e idempotente de abandono conserva las respuestas aceptadas, elimina el
  snapshot recuperable y hace el intento terminal. Los eventos `pagehide`, `visibilitychange` u
  `offline` solo pueden enviar avisos auxiliares: no son prueba de abandono. Mientras no se apruebe
  la política posterior de heartbeat/lease, la falta de actividad no cierra el intento.
- El intervalo del heartbeat, la duración del lease y el periodo de gracia para una desconexión son
  cuestiones operativas aún abiertas; no se fija aquí un valor.
- El servidor asigna identificadores, timestamps, deadlines, estados y puntuaciones.
- Crear o recuperar el intento es una operación atómica e idempotente.
- Solo puede haber una sesión de juego activa por intento.
- Durante el MVP, continuar en otro navegador o dispositivo no toma el control ni revoca la sesión
  original: se bloquea y debe volver a la sesión que creó el intento o abandonarlo explícitamente.
- Cada escritura comprueba una versión de bloqueo para rechazar actualizaciones concurrentes u
  obsoletas.
- Se guarda un checkpoint al confirmar una respuesta o alcanzar un punto de control relevante para
  el modo.
- El servidor valida el orden, la pregunta esperada, el plazo y la idempotencia de cada envío.
- Todos los intentos se conservan aunque no sean el resultado acreditado.
- Se usarán conceptos separados para `attempt_number`, `challenge_version_id`,
  `client_state_schema_version` y `lock_version`; no habrá un `attemptVersion` ambiguo.

## 9. Respuestas y progreso

- Una respuesta pertenece a un intento y a un elemento de la versión del desafío, no únicamente a
  un ID global de pregunta.
- Solo existe una respuesta final por intento y elemento, aunque un formato pueda conservar eventos
  o envíos intermedios.
- Se guarda el payload enviado, los instantes de presentación y envío, el tiempo utilizado, el
  resultado, los puntos concedidos y los detalles necesarios para revisión.
- Las respuestas polimórficas se almacenan como JSONB validado según el formato. IDs, relaciones y
  campos de consulta frecuente permanecen como columnas normales.
- Los borradores permanecen en el cliente por defecto. Un modo que necesite reanudación compleja
  puede persistir un `progress_payload` validado.
- Los envíos intermedios relevantes se registran como eventos o contadores y no sobrescriben
  silenciosamente la respuesta final.
- Se distinguen `correct`, `partial`, `incorrect`, `unanswered` y `timeout`.
- Todas las duraciones internas se expresan en milisegundos.
- El tiempo competitivo se calcula y limita usando timestamps del servidor; el tiempo comunicado
  por el cliente es solo telemetría.
- Se conservan tanto la respuesta bruta como la evaluación concedida para permitir auditoría.

## 10. Puntuación

- El servidor es la única autoridad sobre corrección y puntuación.
- La puntuación de un desafío es un entero entre 0 y 100.
- No se permiten puntuaciones negativas ni en el resultado final de una pregunta o prueba ni en el
  total del desafío.
- Cada modo define su crédito parcial, tratamiento del tiempo y penalizaciones. Una penalización
  puede reducir la puntuación disponible de una pregunta o prueba, pero el resultado final de esa
  unidad se limita a cero y no reduce el total acumulado por debajo de cero.
- Si se permiten varios intentos, se acredita el mejor según el comparador del modo.
- Las reglas de puntuación no tendrán inicialmente un sistema de versiones independiente.
- La configuración de puntuación queda congelada dentro de la versión publicada y se almacenan los
  puntos realmente concedidos.
- Un cambio futuro del algoritmo no recalcula automáticamente resultados anteriores.
- Una corrección administrativa crea un ajuste auditado sin modificar silenciosamente respuestas
  originales.
- La puntuación competitiva se denomina **Flash Points**. Los Flash Points obtenidos al jugar un
  desafío se suman al total de la temporada activa de la sala.
- `⚡` y “Flash Points” son equivalentes como representación de interfaz. El texto completo se
  conserva en documentación, títulos explicativos y etiquetas accesibles.
- No existe un concepto funcional separado de XP, rayos acumulados, energía, vidas como saldo,
  monedas, niveles, hitos ni otra recompensa que compita con Flash Points.

## 11. Rankings

- Hay exactamente dos rankings: uno por desafío programado y otro por temporada. No hay ranking
  global, ranking acumulado de sala ni otros rankings funcionales.
- Participan `owner`, `admin` y `member`.
- No participan espectadores, superadministradores, intentos fantasma, intentos invalidados ni
  publicaciones canceladas.
- El ranking del desafío incluye únicamente jugadores con un intento competitivo completado, incluso
  cuando su puntuación sea cero. Los intentos abandonados, expirados o invalidados quedan fuera.
- El ranking de temporada suma el resultado acreditado de cada publicación en Flash Points.
- Los miembros activos sin puntuación pueden mostrarse con cero Flash Points en la temporada.
- Los antiguos miembros permanecen si consiguieron Flash Points, identificados como tales o
  anonimizados cuando corresponda.
- **Decisión vigente provisional (2026-09-14):** los cinco modos actuales comparten el comparador del
  ranking por desafío: primero más Flash Points, después menor duración efectiva del intento y,
  finalmente, `startedAt` más antiguo. La duración efectiva es la suma autoritativa de
  `AttemptAnswer.timeUsedMs`; no incluye cuenta atrás, pausas ni esperas externas.
- Si los tres criterios coinciden, se comparte posición usando ranking de competición (`1, 1, 3`).
  Un `playerId` puede ordenar visualmente una lista estable, pero nunca decide la competición.
- El ranking de temporada solo ordena por Flash Points acumulados; la duración y `startedAt` no se
  aplican allí.
- Un modo futuro podrá sustituir esta regla mediante una decisión específica del modo, sin modificar
  este comparador común ni los contratos de los demás modos.
- En la temporada manda la suma de Flash Points. Los empates comparten posición y cualquier orden adicional
  es únicamente visual.
- Los miembros y espectadores pueden consultar los rankings de su sala.
- Inicialmente los rankings se derivan de intentos. Solo se materializarán si el volumen lo exige.

## 12. Historial y actividad

- El historial contiene publicaciones competitivas definitivamente cerradas.
- Una publicación finalizada aparece aunque nadie haya jugado.
- El número de participantes cuenta jugadores competitivos distintos que iniciaron un intento. El
  número de finalizadores puede mostrarse por separado.
- Título, imagen y demás contenido histórico proceden de la versión publicada inmutable.
- El ranking histórico se deriva de los intentos acreditados y puede reflejar correcciones
  administrativas auditadas.
- Las pruebas fantasma quedan excluidas.
- Una publicación cancelada puede consultarse aparte, pero no aparece como finalizada normalmente.
- La actividad social se derivará de eventos estructurados; no se persistirán frases ya renderizadas.
- El feed social puede aplazarse sin afectar al modelo principal.

## 13. Seguridad y límites cliente-servidor

- El navegador recibe únicamente el contenido público necesario para jugar.
- Las soluciones y la configuración privada no son accesibles directamente para clientes
  autenticados.
- Inicio, checkpoints, respuestas y finalización se validan en servidor.
- Para mantener feedback inmediato, el servidor puede devolver corrección y puntos sin revelar la
  solución completa durante la ventana competitiva.
- La revisión completa se habilita al finalizar el intento o cerrar la publicación, según la regla
  del modo.
- Siempre que sea viable, las preguntas se entregan progresivamente. Los modos que necesiten todo el
  contenido reciben únicamente su representación pública.
- Las tablas de salas usan Row Level Security. Las políticas comprueban jugador, membresía y rol.
- Los espectadores pueden leer metadatos y rankings, pero no obtener payloads jugables.
- Las operaciones competitivas se ejecutan mediante endpoints o funciones transaccionales.
- El backend nunca confía en puntos, timestamps, estado o corrección enviados por el cliente.
- Se aplican validación de payload, límites de frecuencia e idempotencia.
- La protección cubre manipulación del cliente, reinicios y concurrencia; no puede impedir que dos
  personas compartan información fuera de la aplicación.

## 14. Convenciones de persistencia

- PostgreSQL, Supabase Auth y Supabase Storage serán la infraestructura inicial.
- Tablas y columnas usan nombres `snake_case` en minúsculas.
- Las identidades persistidas usan UUID. Los nombres legibles se guardan como slugs separados.
- La estrategia concreta de generación de UUID se validará al diseñar el esquema sin hacer depender
  al dominio de una extensión concreta.
- Las fechas usan `timestamptz` y UTC; las duraciones usan enteros en milisegundos.
- Los estados se representan inicialmente con texto y restricciones explícitas.
- Las invariantes importantes se protegen también mediante restricciones de base de datos.
- Las claves foráneas y las columnas utilizadas por RLS se indexan.
- JSONB se reserva para contenido y respuestas polimórficas; no sustituye relaciones estructurales.
- Intentos, respuestas y eventos competitivos son esencialmente append-only.
- Jugadores y salas admiten borrado lógico. El contenido publicado se archiva.
- Las operaciones concurrentes usan escrituras atómicas y control de versión.
- Los fixtures y seeds tienen IDs y fechas deterministas.
- La aplicación usa privilegios mínimos y nunca expone credenciales administrativas al navegador.
