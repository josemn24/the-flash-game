# Reconciliación de comandos competitivos

> Estado: comportamiento vigente, integrado en el baseline inicial local. La ejecución y validación de staging quedan pendientes.

Fecha: 2026-10-09. Revisión incremental original:
`20261009190015_competitive_command_reconciliation`. Ahora forma parte de
`20261011180045_initial_schema`; el historial anterior permanece en Git.

## Comportamiento resultante

Los cierres de sesiones distinguen la pérdida de permisos del fin normal de un intento:

| Motivo terminal del intento | Motivo de revocación de sus sesiones activas |
| --------------------------- | -------------------------------------------- |
| `abandon`                   | `terminal`                                   |
| `inactivity_timeout`        | `terminal`                                   |
| `permission_revoked`        | `permission_revoked`                         |

El cierre conserva respuestas y evaluaciones aceptadas, termina intervalos abiertos, elimina
preparaciones pendientes, incrementa una vez la versión y no acredita puntos. Repetir el cierre
no genera otra transición ni otro evento de auditoría. Las sesiones revocadas anteriormente
por takeover conservan ese motivo; solo se etiquetan las sesiones todavía activas.

Activación, recuperación, pistas progresivas, Logic Code, Mini Wordle, Word Hashtag y Word
Search devuelven `session_transferred / 42501` cuando el controlador anterior pierde el control
por transferencia, incluido si esta ocurre mientras el comando espera el lock del intento.
Un token desconocido o revocado por cierre continúa devolviendo `session_revoked / 42501`.
La sesión antigua sigue sin poder escribir ni retomar el control automáticamente.

`take_over_attempt` delega al dispatcher común. El contrato exige `scheduledChallengeId`
y campos obligatorios no nulos. Los cuatro casos auditados de JSON `null` en
`scheduledChallengeId`, `attemptId`, `lockVersion` y `newSessionToken` devuelven ahora
`invalid_command / 22023`. El resultado válido conserva las mismas claves públicas,
el deadline y un único controlador. Dos transferencias con la misma versión producen un
ganador y un rechazo `stale_version / 40001`.

Un replay de takeover comprueba identidad y permisos competitivos vigentes antes de devolver
el resultado almacenado. Retirar la membresía provoca `not_authorized / 42501`; el replay
exacto de una transferencia anterior a la migración conserva íntegro su resultado cuando
la cuenta mantiene acceso. No crea sesión, incremento de versión ni auditoría adicionales.

La auditoría conserva `takeover_confirmed` y el `deadlineAt` del payload anterior de transferencia.
El cierre automático usa `runId:inactivity_timeout:attemptId` como identificador de evento,
mientras la respuesta de expiración conserva `runId`. Para correlacionar eventos de una misma
ejecución, debe usarse ese prefijo completo o los identificadores individuales, en lugar de
comparar `request_id` únicamente por igualdad con `runId`.

## Baseline y límites

La migración incremental original (`20261009190015_competitive_command_reconciliation.sql`) quedó
consolidada en el [baseline activo](../../supabase/migrations/20261011180045_initial_schema.sql),
generado desde los schemas declarativos. Su SQL anterior sigue disponible en Git. En la revisión
original se retiró el `DROP FUNCTION` que el generador proponía para el cambio de lenguaje de
`take_over_attempt`.

La migración abre una transacción, reemplaza once funciones y actualiza el dispatcher antes
de la fachada de transferencia. Utiliza `CREATE OR REPLACE` para conservar OIDs, dependencias,
propietarios y ACL. El único cambio de atributo es el lenguaje de la fachada, de PL/pgSQL a SQL.
Las otras tres diferencias de la [auditoría original](supabase-function-drift-audit.md) eran de
texto; se alineó el esquema con los cuerpos existentes para evitar reemplazos innecesarios.

No se añaden ni eliminan funciones, tablas o columnas. Las 217 funciones conservan sus firmas
y retornos; los tipos públicos generados permanecen iguales. El inventario de seguridad no
necesita entradas nuevas y pasa por ambas vías de carga. Los cambios de mensajes, validación,
autorización de replay y correlación de auditoría descritos arriba son intencionados.

La migración no reescribe sesiones históricas cuyo motivo sea SQL `NULL`, ni corrige motivos
incorrectos que un entorno hubiera persistido anteriormente. Esa reparación de datos requiere
comprobar los hechos de ese entorno y un trabajo separado. La presente actualización conserva
todos los datos existentes.

La revisión canónica de configuración y los marcadores de health se actualizaron al baseline.
Health comprueba la fachada SQL, el contrato del dispatcher, la condición de cierre y la detección
de transferencia. Las pruebas de actualización entre revisiones se retiraron al reiniciar la base;
las comprobaciones actuales validan la reconstrucción limpia y los contratos vigentes.

## Verificación reproducible

Desde la raíz del repositorio, con Supabase local iniciado:

```bash
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:reconciliation:test
```

Cada herramienta crea y elimina sus propias bases locales desechables. No usa la base de datos
de la aplicación para ejecutar las fixtures ni aplica migraciones a un entorno remoto.

Resultados locales verificados:

- 55 suites pgTAP por ambas vías de carga, incluidas 39 comprobaciones nuevas de cierre con
  respuestas aceptadas y una comprobación adicional de motivo de sesión tras expulsar un miembro.
- 158 casos SQL del corpus compartido y las 904 observaciones de caracterización de validadores
  mantienen sus expectativas. La concurrencia existente de comandos pasa por ambas vías.
- Las 217 definiciones efectivas coinciden entre esquema y migraciones: cero diferencias.
- Los 41 contratos de la auditoría original tienen ahora expectativas obligatorias de errores,
  estado, sesiones, auditoría y ausencia de puntos; todos pasan en ambas reconstrucciones.
- Seis carreras entre transferencia y acciones/recuperación, más cinco carreras adicionales:
  transferencias simultáneas, expiración/pérdida de permisos y transferencia/pérdida de permisos
  en ambos órdenes. Todas pasan en ambas reconstrucciones.
- La prueba histórica de actualización/reversión se retiró junto con las migraciones incrementales;
  las garantías actuales se prueban directamente desde schemas y desde el baseline.
- Tipos, arquitectura de tipos, tipos públicos generados y 107 pruebas unitarias de health,
  adaptador, API de sesión/transferencia, ciclo de vida y motor competitivo pasan.
- Los 12 E2E existentes de `s03-flash`, `s04-recovery`, `s15-pyramid`, `format-contracts`
  y `format-contracts-pyramid` pasan. Incluyen transferencia entre dos contextos, rechazo del
  controlador anterior, confirmaciones HTTP perdidas y evaluación de los siete niveles.
  Se ejecutaron con `test:e2e:isolated`, una configuración temporal que extiende
  `playwright.config.ts` y usa `npm run build`/`npm run start`; los specs, las expectativas y
  los timeouts de los tests permanecieron iguales. El stack aislado se eliminó al terminar.
- ESLint de los archivos modificados, formato, enlaces documentales y revisión canónica pasan.

La reconciliación se integra en `verify:pilot` mediante
`supabase:schema:reconciliation:test`, para que un cambio de reglas o una nueva divergencia
haga fallar la verificación. El informe JSON regenerable queda en
`output/audits/supabase-function-drift.json`, ignorado por Git.

## Reversión de la migración incremental original

La prueba de upgrade que generaba
`output/audits/competitive-command-reconciliation-rollback.sql` se retiró al reemplazar el
historial activo. El SQL de rollback puede recuperarse del historial Git si se necesita para
investigar una revisión anterior.

Tras desplegar el baseline, revertir cambios mediante una migración posterior y avanzar la
revisión canónica. No volver a aplicar la cadena incremental anterior sobre una base inicializada
con el baseline.

La reversión de la migración incremental original restauraba los mensajes, la aceptación de
`scheduledChallengeId: null`, el replay de takeover y los motivos `NULL` previos a la reconciliación.

## Estado de aplicación

El 2026-10-10 la base local se reconstruyó primero con 33 migraciones y después con el baseline
único. La validación del baseline y su estado final se registran en
[la guía de instalación limpia](supabase-clean-installation.md). No se ha accedido a staging.

El [procedimiento de instalación limpia](supabase-clean-installation.md) registra el estado local
y deja definida la ejecución posterior de staging. Ningún entorno remoto se ha
reiniciado ni desplegado durante este trabajo.
