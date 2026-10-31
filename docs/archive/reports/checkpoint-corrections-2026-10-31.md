# Corrección de checkpoints y cierre competitivo

Fecha: 2026-10-31. Entorno: local, con bases de datos y stacks de pruebas desechables.
Revisión: `20261031160000_checkpoint_execution_and_review_fixes`.

## Cambios verificados

- Los reintentos y temporizadores pertenecen a un comando, una generación y una ejecución.
  Adelantar un borrador invalida sus efectos y su limpieza tardía, sin bloquear los reintentos
  del cierre ni restaurar un tablero anterior después de una validación.
- La cola continúa desde la operación definitiva que sustituye al checkpoint. La siguiente
  pregunta puede prepararse mientras la respuesta HTTP del borrador anterior sigue retenida.
  Las tareas y reintentos aún no enviados de la generación retirada se descartan.
- SQL admite una ruta formada solo por su extremo inicial y conserva las restricciones de
  continuidad, límites, casillas repetidas y solapamientos.
- El cierre que reconcilia una evaluación pendiente captura `review_state` antes de limpiar
  `progress_payload`, tanto para respuesta nula SQL como JSON. Los replays mantienen una sola
  respuesta y acreditación.
- La revisión de Conectar parejas calcula las métricas del tablero conservado cuando la
  respuesta evaluada es nula. Tres casillas de 25 muestran un 12 %, manteniendo la puntuación
  oficial del intento.
- Solicitar el cierre global cancela el temporizador de avance entre tableros. Los avances
  tardíos se ignoran durante `finalizing` y tras el resultado, sin preparar otra pregunta.

La migración correctiva se añade después de las migraciones existentes. El esquema declarativo,
los marcadores de revisión y la documentación de recuperación quedan alineados.

## Pruebas y resultados

| Comprobación             | Ejecución                                                                                        | Resultado                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Suite unitaria completa  | `npm test -- --maxWorkers=1`                                                                     | 297 suites, 3.760 pruebas correctas, incluida la regresión del cierre retrasado                                                           |
| Tipos y calidad estática | `npm run typecheck`, `npm run lint`, `npm run type-architecture`                                 | Correctos                                                                                                                                 |
| Documentación y revisión | `npm run docs:check`, `npm run schema:revision:check`                                            | Correctos                                                                                                                                 |
| Formato                  | Prettier sobre archivos modificados compatibles y `git diff --check`                             | Correctos                                                                                                                                 |
| SQL declarativo          | `npm run supabase:schema:test`                                                                   | 71 suites, 2.068 comprobaciones pgTAP; conformidad de 158 casos y 904 observaciones de validación; carreras con conexiones independientes |
| Historial SQL            | `npm run supabase:schema:test -- --migrations`                                                   | Mismos resultados que el esquema declarativo                                                                                              |
| Actualización            | `npm run supabase:schema:upgrade:test`                                                           | Los seis verificadores pasan, incluido el nuevo ensayo desde la revisión anterior con recepciones pendientes de Queens y Conectar parejas |
| Reconciliación           | `npm run supabase:schema:reconciliation:test`                                                    | 259 funciones; cero diferencias de definición y cero diferencias en 41 sondeos de comportamiento; ACL y carreras verificadas              |
| Tipos generados          | `npm run supabase:types:check` con `SUPABASE_TYPES_DB_URL` apuntando a una base temporal migrada | Coinciden con el archivo versionado                                                                                                       |
| Navegador competitivo    | E2E aislados de Queens, Conectar parejas y timeout/conformidad                                   | 10 pruebas correctas; las integraciones de Auth, PostgREST y RLS de ambos formatos también pasan                                          |
| Navegador local          | `npm run test:e2e:local-time-trial`                                                              | 4 pruebas correctas, incluida revisión y replay sin llamadas al backend                                                                   |
| Compilación optimizada   | `FLASH_NEXT_DIST_DIR=.next/checkpoint-verification npm run build`                                | Correcta                                                                                                                                  |

Comando del recorrido competitivo:

```bash
npm run test:e2e:isolated -- \
  e2e/time-trial.spec.ts \
  e2e/time-trial-connect-pairs.spec.ts \
  e2e/time-trial-timeout-conformance.spec.ts
```

Las regresiones de navegador retienen respuestas después de su commit real. Cubren el avance
al siguiente tablero y el cierre que falla mientras sigue en vuelo un reintento de checkpoint.
Las pruebas deterministas cubren también la limpieza tardía del indicador de validación, la
invalidación de trabajo encolado, la propiedad de reservas y la agrupación de ediciones.

Los informes JSON del navegador se conservan localmente bajo `output/playwright/competitive-*`;
la auditoría SQL está en `output/audits/supabase-function-drift.json`. Son artefactos de ejecución
ignorados por Git.

## Seguimiento: avance durante un cierre retrasado

La prueba anterior del timeout entre tableros resolvía `complete` inmediatamente. Se sustituye
por dos casos, Queens y Conectar parejas, con reloj simulado y una respuesta de cierre retenida
más allá de los 1.100 ms del feedback. Ambos reproducían la salida indebida de `finalizing`
antes de la corrección.

La regresión comprueba que se conservan el tablero provisional y el deadline mientras el cierre
sigue pendiente. También invoca el avance tardío durante el cierre y después del resultado, y
deja pasar otros 30 segundos simulados: solo existe la preparación inicial, se confirma un único
cierre y no aparece `attempt_session_missing`.

La verificación focalizada de este seguimiento pasa con 424 pruebas en 17 suites; la suite completa
repetida pasa con 3.760 pruebas en 297 suites. También pasan TypeScript, lint, arquitectura de tipos,
enlaces documentales, revisión esperada del esquema y la compilación optimizada repetida. Esta
corrección modifica únicamente la coordinación del cliente; las verificaciones SQL y E2E de la tabla anterior corresponden a la
validación previa de los checkpoints.

## Ajustes de expectativas durante la verificación

Se actualizaron las expectativas anteriores de bloqueo del tablero y presupuesto limitado de
reintentos de Contrarreloj. Las comprobaciones de reloj autoritativo e idempotencia permanecen.
Los verificadores de actualización histórica contemplan la nueva columna nullable y comprueban
que las respuestas anteriores reciban `review_state = null`, conservando los valores existentes.

La suite completa detectó además una expectativa editorial obsoleta para la letra C: la pregunta
actual usa «Ciri», pero la prueba todavía esperaba «Cien anos de soledad». Se actualizó únicamente
la variante de prueba a «CIRI»; el contenido y la evaluación del producto no cambiaron.

## Alcance de la evidencia

Las bases temporales y el stack competitivo se eliminan al terminar. La configuración de tipos
que Next.js modifica durante E2E y build se restaura, conservando las ediciones del workspace.
Los cambios que ya estaban preparados en Git se preservan.

La migración se valida en instalaciones temporales y no se aplica a la base habitual ni a staging.
La evidencia acredita los recorridos técnicos locales; no acredita operación de staging,
calibración editorial ni comportamiento de usuarios reales. La revisión conserva el último
checkpoint aceptado por el servidor, que puede ser anterior a la última edición local.
