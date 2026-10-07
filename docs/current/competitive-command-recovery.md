# Recuperación de operaciones competitivas

> Estado: implementación local; validación en staging pendiente antes de publicar.

Fecha: 2026-10-06.

## Garantías y límites

Los cinco modos comparten el mismo motor de comandos. Un envío incierto conserva en memoria
su operación, payload, versión y clave. Se bloquean acciones incompatibles; los retries repiten
ese comando y una recarga reconstruye respuestas, puntos, progreso y tiempos desde PostgreSQL.
No se guardan respuestas sin enviar ni se crea una cola offline.

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

| Operación                                              | Timeout completo | Retries adicionales | Esperas     |
| ------------------------------------------------------ | ---------------- | ------------------- | ----------- |
| Preparación de cookie, inicio, recuperación y acciones | 5 s              | 1                   | 1 s         |
| Finalización                                           | 10 s             | 3                   | 1 / 2 / 4 s |

El timeout incluye respuesta y JSON. `Retry-After` prevalece. El transporte envía una petición;
el motor gestiona el ciclo. Abortar la espera no implica rollback. Al agotar, el estado continúa
incierto y se ofrece reintento manual del comando original. Una versión obsoleta se reconcilia;
permisos denegados y sesión revocada detienen escrituras/retries. Desmontar cancela esperas y descarta
respuestas tardías. Los deadlines competitivos permanecen intactos.

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

Verificación local completada el 2026-10-06:

- 1.489 pruebas unitarias en 206 archivos.
- 32 pruebas de navegador en 13 suites: cinco modos, seis formatos, Narrativa interactiva y
  recuperación/abandono. Todas pasan, sin casos omitidos ni resultados inestables.
- 51 suites pgTAP, 158 casos compartidos de conformidad y concurrencia con conexiones PostgreSQL
  independientes. La suite nueva de confirmaciones perdidas verifica 25 condiciones.
- Tipos, lint, arquitectura de tipos/estilos, Stylelint, enlaces documentales, revisión de esquema,
  tipos generados y formato correctos. Las 16 funciones de la migración coinciden con sus
  definiciones finales del esquema declarativo, incluidas las variantes actuales de Queens.

Las fixtures de pruebas respetan los relojes inmutables. La expiración se provoca cerrando una
publicación y simulando falta de actividad; se confirma desde otra conexión después del error HTTP.
El abandono explícito pierde la respuesta real tras el commit y recupera el mismo resultado
con la cookie ya eliminada, sin acreditación ni controlador activo.

Los eventos de recuperación se incorporan a `competitive_performance` cuando
`FLASH_PERFORMANCE_DIAGNOSTICS=1`: recepción pendiente, evaluación repetida/recuperada, solicitud
de recuperación, resultado terminal recuperado, resultado terminal por permiso recuperado y revisión
pendiente. El navegador registra
`competitive_command_uncertain` y `competitive_command_replay` con operación y contador/tipo de retry.
No incluyen payloads, respuestas, tokens, soluciones ni URLs firmadas. Son diagnósticos, no una cola
ni un registro alternativo de respuestas/puntos.

## Despliegue

1. Aplicar las migraciones [de recuperación](../../supabase/migrations/20261006110000_competitive_command_recovery.sql),
   [de cierre por permisos](../../supabase/migrations/20261007120000_permission_revoked_attempt_closure.sql)
   y [de transferencia](../../supabase/migrations/20261007130000_attempt_control_transfer.sql) antes del cliente;
   verificar la revisión `20261007130000_attempt_control_transfer`.
   Mantiene datos existentes; no recalcula puntos, añade tablas ni purga claves.
2. Validar en staging los mismos cortes después del commit y antes de la evaluación, fallo de
   acreditación, concurrencia, revocación y Storage. Usar cuentas/publicaciones de prueba.
3. Publicar el cliente después de validar. Una pestaña antigua sin cookie no consume un intento.
4. Vigilar operaciones inciertas, replays y recepciones pendientes. Un fallo de publicación se
   trata conforme a [la política de incidencias](../decisions/service-incidents.md).

No se han ejecutado migraciones ni pruebas contra staging. Quedan pendientes en staging la
transferencia multi-dispositivo, la compensación por incidentes, los cambios de puntuación y el autosave de formularios. Las
decisiones aprobadas para esos trabajos siguen vigentes.
