# Recuperación de operaciones competitivas

> Estado: implementación local; validación en staging pendiente antes de publicar.

Última actualización: 2026-10-31.

## Garantías y límites

Los seis modos comparten el mismo motor de comandos. Un envío incierto conserva en memoria
su operación, payload, versión y clave. Se bloquean acciones incompatibles; los retries repiten
ese comando y una recarga reconstruye respuestas, puntos, progreso y tiempos desde PostgreSQL.
Queens y Conectar parejas guardan checkpoints validados de sus tableros; el último aceptado
puede conservarse como `reviewState` al cerrar una respuesta nula, también al reconciliar una
evaluación pendiente. Esta captura se completa antes de limpiar el progreso mutable. No acredita
puntos y permite revisar el tablero sin convertir el borrador en una respuesta evaluada.
Los borradores aún no enviados permanecen solo en memoria y no existe una cola offline.

El estado de transporte del motor distingue `idle`, `submitting`, `uncertain`, `reconciling`,
`confirmed` y `definitive_failure`. `uncertain` no equivale a rechazo: mantiene el comando
original y bloquea acciones incompatibles hasta que un replay exacto o la recuperación server-side
confirme los hechos. `confirmed` solo se alcanza después de aplicar la respuesta autoritativa;
`definitive_failure` elimina el comando pendiente para errores de negocio/autorización o cuando una
recuperación autoritativa lo sustituye, nunca para crear un retry con una operación distinta.

La preparación `POST /api/competitive/attempts/session` autoriza la publicación y establece una
cookie HttpOnly sin consumir intento ni iniciar relojes. `start` exige esa cookie antes de escribir.
Una pestaña antigua o un navegador que no devuelve la cookie recibe `attempt_session_missing`
y una indicación de recarga. Si ya existe un controlador, `start` devuelve `attempt_control_required`
con metadatos seguros; «Continuar aquí» usa la cookie candidata y una clave idempotente para
transferir explícitamente el mismo intento. Perder la confirmación conserva la cookie candidata,
por lo que el replay puede recuperar el resultado sin crear otra sesión.

El [cierre autoritativo](attempt-lifecycle.md#total-autoritativo-al-completar) calcula el total
en PostgreSQL para los seis modos, después de reconciliar las evaluaciones pendientes.
Su payload privado no acepta `score`; la app debe desplegarse después de la migración.

La recuperación prioriza recepciones pendientes y la evaluación usa el contenido congelado.
Una evaluación registrada se lee sin recalcular; una carrera consulta el resultado persistido
sin alterar la versión del comando del jugador. Los replays de formatos y recuperación comprueban
identidad, permiso competitivo y controlador antes de devolver hechos.

El cierre conserva las transacciones y restricciones existentes: intento, puntuación, sesión,
acreditación, auditoría y resultado idempotente se confirman juntos. La lectura del resultado
completado exige cuenta propietaria y permisos vigentes, pero no la cookie ya revocada. Una revisión
fallida o que tarda más de 2 segundos devuelve `review: []` y `reviewPending: true`; los puntos siguen
visibles. Reintentar la revisión usa recuperación del resultado, sin acreditar ni finalizar de nuevo.
Las lecturas de página también conservan el resultado si falla la resolución de assets de revisión.
La expiración confirmada se comunica después del commit: conserva hechos anteriores y nunca reabre
ni acredita el intento abandonado.
Si se pierde la confirmación de un abandono explícito, la cuenta propietaria con permisos vigentes
recupera el resultado original aunque su cookie ya esté revocada. Una expiración sin comando de
abandono no se presenta como un abandono solicitado por el jugador.
Si la membresía competitiva pasa a `removed` o `banned`, la misma transacción cierra los intentos
competitivos activos como `abandoned` con `terminalReason: permission_revoked`, conserva respuestas y
evaluaciones aceptadas, revoca sesiones y no acredita puntos. El propietario puede recuperar esa
proyección terminal segura aunque la membresía ya no esté activa; no recibe nuevas preguntas ni
soluciones y no puede enviar comandos.

## Presupuesto del cliente

### Contrato de errores y presentación

Los códigos de intentos, sesión y transporte están tipados en
`types/contracts/competitive-errors.ts`. El catálogo puro `lib/competitiveErrors.ts` describe
su motivo, sin estados HTTP ni mensajes de interfaz. El adaptador PostgreSQL reconoce exactamente
los identificadores actuales de las excepciones y los convierte en errores de aplicación;
conserva SQLSTATE, causa y diagnósticos temporales. No requiere una migración SQL.

HTTP asigna los estados y el proveedor remoto distingue rechazo confirmado de resultado incierto.
La política del motor decide conservación del comando, bloqueo y reintentos. El formateador solo
produce mensajes y feedback: cambiar o retirar un texto no puede cambiar la recuperación.

- `survival_not_terminal` y `pyramid_not_terminal` al completar son conflictos 409 confirmados.
  Se retira el comando rechazado, se cancelan las esperas y se bloquean escrituras hasta una
  recarga manual de la proyección autorizada. No se inventa un resultado ni se acredita puntuación.
- `request_predates_presentation` conserva su código y devuelve 409. Permite otra entrada en la
  pregunta activa, sin repetir automáticamente el comando ni alterar versión o deadline.
- Un código 4xx desconocido se normaliza como `unknown_rejection` y exige recarga manual.
  Los 5xx desconocidos y las respuestas perdidas o ilegibles conservan el tratamiento incierto.
  Los 401 y los límites de frecuencia mantienen su tratamiento específico.
- La acción de recargar es independiente del permiso para repetir una escritura: la interfaz
  puede ofrecer «Recargar partida» aunque el comando rechazado no sea reintentable.

Las autoridades locales utilizan el mismo vocabulario. Versiones obsoletas, transferencia,
autorización, esperas temporales y presupuestos conservan sus políticas específicas.

### Respuestas incompletas o incompatibles

Cada comando SQL tiene un decodificador obligatorio, ejecutado dentro de su transacción y antes
del `COMMIT`. Una respuesta incompatible provoca rollback de esa transacción. No deshace una
recepción de respuesta ya confirmada en una transacción anterior: la evaluación sigue usando el
mismo recibo y los hechos persistidos. La expiración conserva su regla especial de commit.

Un incumplimiento nuevo de contrato se comunica como `502 / invalid_backend_response`. El log
conserva operación, requestId y ruta del campo, sin volcar payloads, soluciones ni tokens. Los
contratos de ciclo de vida mantienen el error `invalid_attempt_lifecycle` existente.

El proveedor valida también el HTTP después de cualquier commit. Una respuesta perdida, truncada
o incompatible es un resultado incierto: conserva exactamente operación, payload, revisión y
clave idempotente; bloquea escrituras incompatibles y usa el presupuesto y esperas vigentes.
No se sustituye la operación por una escritura nueva ni se amplía ningún deadline. El replay
puede devolver la revisión original; no se exige un incremento artificial. Contrarreloj conserva
la actualización autorizada de `serverNow` para la visualización.

Preparación admite las variantes vigentes: Pirámide antes de activación, Narrativa sin reloj
competitivo y Alfabeto ya agotado. Las respuestas evaluadas exigen puntos y duración; el cierre
exige puntuación autoritativa, sin sumar resultados locales como fallback. Una revisión fallida
conserva esa puntuación y se recupera por lectura, con `reviewPending`.

La preparación valida con tiempo, puntos, modo y versión del ítem asociado al intento, leídos
tras la autorización SQL y antes del commit en la misma transacción. No utiliza constantes ni
metadatos aportados por el cliente. La lectura queda dentro del adaptador y no amplía el JSON HTTP.

Hashtag exige tablero completo, celdas y contadores coherentes con su configuración pública.
El proveedor conserva el `maxMoves` validado al preparar el ítem; no conserva ni consulta soluciones.
Una confirmación inválida no sustituye el tablero anterior ni consume el comando pendiente.
El progreso inicial admite `movesUsed: 0`; la confirmación de `wordHashtagSwap` exige un entero
positivo. Un replay válido conserva los contadores originales, sin exigir otro incremento.

El inicio y la transferencia conservan su JSON vigente: identidad, revisión y deadline, sin
exigir una proyección `timeTrial` que esos endpoints no publican. Contrarreloj exige el progreso
completo de reloj en preparación, validación Queens, recuperación y cierre reglamentario.
La evaluación genérica conserva su JSON sin reloj: el motor mantiene el reloj ya validado, sin
reiniciarlo ni reconstruir progreso ausente. Antes de preparar la primera
prueba admite inicio y deadline nulos juntos; para jugar exige reloj
activo con la duración global configurada. El cierre reglamentario exige motivo terminal; el
abandono conserva su variante propia y admite las proyecciones guardadas que no publican reloj. Tanto el replay local como el remoto
refrescan solo `serverNow`, sin reiniciar inicio ni deadline, incluso si se pierde la primera
confirmación de preparación. Una respuesta posterior que cambie el inicio o deadline global ya
validado de la misma sesión se trata como incierta y no sustituye ese reloj.
La misma protección impide volver a un reloj no iniciado en cualquier confirmación no terminal,
incluidos borradores Queens y evaluación genérica. Un reloj opcional ausente conserva el reloj
instalado. Los replays legítimos de inicio o transferencia anteriores a la primera preparación
se aceptan sin su proyección obsoleta de `timeTrial`, manteniendo intacto el resultado cacheado.
El abandono terminal conserva su variante propia.

`prepareSession` se proyecta exclusivamente como `{ ready: true }`: los campos adicionales no
pueden modificar la identidad, el reloj ni los hechos conservados por el proveedor. Todas estas
comprobaciones ocurren antes de actualizar esos hechos o confirmar cambios en el motor.

### Límites y esperas

| Operación                                                          | Timeout completo | Retries adicionales                                         | Esperas                                 |
| ------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------- | --------------------------------------- |
| Preparación de cookie, inicio, recuperación y acciones definitivas | 5 s              | 1                                                           | 1 s                                     |
| Borradores Queens y Conectar parejas                               | 5 s              | Mientras el fallo sea recuperable y el comando siga vigente | 1 / 2 / 4 / 8 / 16 / 30 s; después 30 s |
| Finalización de Contrarreloj                                       | 10 s             | Mientras el fallo sea recuperable y el comando siga vigente | 1 / 2 / 4 / 8 / 16 / 30 s; después 30 s |
| Finalización de los demás modos                                    | 10 s             | 3                                                           | 1 / 2 / 4 s                             |

El timeout incluye respuesta y JSON. `Retry-After` prevalece. El transporte envía una petición;
el motor gestiona el ciclo. Abortar la espera no implica rollback. Al agotar, el estado continúa
incierto y se ofrece reintento manual del comando original. Una versión obsoleta se reconcilia;
permisos denegados y sesión revocada detienen escrituras/retries. Desmontar cancela esperas y descarta
respuestas tardías. Los deadlines competitivos permanecen intactos.

Los checkpoints mantienen el tablero editable. El primer envío agrupa unos 300 ms de ediciones y
los siguientes se limitan aproximadamente a uno por segundo; un replay conserva exactamente el
payload, la versión y la clave originales. La validación Queens, el envío completo de Conectar
parejas y el cierre por tiempo pueden adelantar un checkpoint. La continuación de la cola depende
de la operación definitiva, no de la respuesta HTTP del borrador antiguo.

Cada ejecución y sus temporizadores tienen propietario y generación. Adelantar un borrador retira
sus tareas aún no enviadas y sus reintentos; las respuestas y los bloques de limpieza tardíos no
pueden modificar la nueva ejecución. Si un temporizador del comando vigente vence durante su
propio reintento, la intención se conserva hasta que este termine. Las generaciones retiradas no
pueden reactivar efectos de avance o finalización. PostgreSQL conserva la serialización y decide
qué snapshot aceptado corresponde al cierre.

Solicitar el cierre global cancela también el avance pendiente entre tableros, incluso cuando
deba esperar a otro comando. Un avance tardío se ignora durante la finalización y después del
resultado; un cierre lento no borra el tablero provisional ni prepara otra pregunta.

El cálculo del presupuesto y la clasificación de fallos son funciones puras de
`features/game/competitive/core/commandRecoveryPolicy.ts`; no envían comandos ni mantienen
estado. El motor conserva los contadores y las esperas. Los conflictos de transferencia
se clasifican antes que la pérdida general de autorización; una sesión transferida detiene
las escrituras sin intentar recuperar el control. La recuperación terminal por permisos
conserva su límite de un intento antes de retirar el contenido protegido.

`afterCommand` coordina ejecución inicial, repetición y transferencia con su origen explícito.
No iguala los tres caminos: la reconciliación de una acción incierta de Alfabeto durante el
cierre sigue perteneciendo al envío inicial; un conflicto de transferencia sigue siendo
definitivo. Las decisiones de cierre global se consultan de nuevo después de cada efecto
asíncrono y no se calculan por adelantado desde un snapshot anterior. Las pruebas deterministas
del motor caracterizan estas diferencias, el cierre concurrente y el replay exacto de una
transferencia cuya confirmación se pierde.

## Evidencia reproducible

- `npm run test -- --no-file-parallelism`: contratos, resolución de recepciones, timeouts completos,
  límites exactos, cancelación, permisos y revisión pendiente. La ejecución secuencial evita una
  carrera preexistente entre tests de arquitectura que crean archivos temporales en la raíz.
- `npm run supabase:schema:test`: inventario/ACL, pgTAP, fallos antes del commit, diez conexiones
  repitiendo el comando, conflicto de payload y carreras entre recepción, recuperación y evaluación.
- `npm run test:e2e -- e2e/s03-flash.spec.ts e2e/s05-alphabet.spec.ts e2e/narrative.spec.ts e2e/s14-survival.spec.ts e2e/s15-pyramid.spec.ts`:
  app y PostgreSQL reales. La interceptación deja terminar el HTTP real y descarta la primera
  confirmación de inicio, respuesta y cierre. Verifica mismo comando, una acreditación y saldo igual
  al score, además de recarga/revisión. Las suites de formatos E01/E02/E03/E05/E06/F19 añaden pérdidas
  de confirmación posteriores a pistas, movimientos y validaciones.
- `npm run typecheck`, `npm run lint`, `npm run type-architecture`, `npm run docs:check`,
  `npm run schema:revision:check`, `npm run supabase:types:check` y formato del diff.

Los resultados de la primera entrega se conservan en el
[informe del 2026-10-06](../archive/reports/competitive-command-recovery-2026-10-06.md).
No acreditan staging ni el total actual de pruebas.

Los eventos de recuperación se incorporan a `competitive_performance` cuando
`FLASH_PERFORMANCE_DIAGNOSTICS=1`: recepción pendiente, evaluación repetida/recuperada, solicitud
de recuperación, resultado terminal recuperado, resultado terminal por permiso recuperado y revisión
pendiente. El navegador registra
`competitive_command_uncertain` y `competitive_command_replay` con operación y contador/tipo de retry.
No incluyen payloads, respuestas, tokens, soluciones ni URLs firmadas. Son diagnósticos, no una cola
ni un registro alternativo de respuestas/puntos.

## Despliegue

1. Tras el reset acordado, reconstruir la base con el [baseline activo](../../supabase/migrations/20261011180045_initial_schema.sql)
   y las migraciones incrementales antes del cliente; verificar la revisión canónica de
   [estado actual](status.md), según la [guía de entornos](supabase-clean-installation.md). El baseline incluye
   recuperación, cierre por permisos, transferencia y reconciliación. El reset elimina los datos
   anteriores; no se migran intentos ni sesiones entre revisiones.
   La [reconciliación](competitive-command-reconciliation.md) documenta errores de transferencia,
   validación de campos nulos y permisos vigentes en replays; las transferencias ya confirmadas
   conservan su resultado y su deadline cuando la cuenta mantiene acceso.
2. Validar en staging los mismos cortes después del commit y antes de la evaluación, fallo de
   acreditación, concurrencia, revocación y Storage. Usar cuentas/publicaciones de prueba.
3. Publicar el cliente después de validar. Una pestaña antigua sin cookie no consume un intento.
4. Vigilar operaciones inciertas, replays y recepciones pendientes. Un fallo de publicación se
   trata conforme a [la política de incidencias](../decisions/service-incidents.md).

La verificación multi-dispositivo en staging sigue pendiente. La compensación por incidencias
y el autosave de formularios necesitan definir o implementar su alcance en el
[backlog](../implementation-plan.md); no son capacidades acreditadas por esta entrega.
