# Proveedores de sesión: fase 1

Estado: implementado el contrato y el proveedor remoto el 2026-10-18. La autoridad local de
Pirámide se documenta en [la fase 2](local-pyramid-session.md).

El motor competitivo existente recibe ahora una autoridad de sesión mediante un puerto. La
composición de producción selecciona el proveedor remoto, que usa los mismos endpoints,
cookies, comandos idempotentes y tiempos de espera del transporte anterior. La Pirámide y los
otros cinco modos conservan sus políticas, evaluadores, transiciones y pantallas.

El [contrato funcional de Pirámide](pyramid-session-contract.md) sigue siendo la referencia.
Esta fase prepara la sustitución de autoridad. La fase 2 incorpora el proveedor local; la vista
unificada corresponde a una fase posterior. La práctica existente todavía no certifica
equivalencia competitiva.

## Archivos y responsabilidades

| Archivo                                                                                                                                                                                                                                                                                                  | Responsabilidad                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`types/contracts/game-session.ts`](../../types/contracts/game-session.ts)                                                                                                                                                                                                                               | Unión discriminada de los 17 comandos, entrada específica por operación, revisión y fallos neutrales.                               |
| [`types/gameplay/authoritative-session.ts`](../../types/gameplay/authoritative-session.ts)                                                                                                                                                                                                               | Estado inicial, actualización pública y resultado aceptado con efecto explícito; revisión terminal separada.                        |
| [`application/ports/game-session.ts`](../../application/ports/game-session.ts)                                                                                                                                                                                                                           | Puerto asíncrono `execute(command, { signal })` y reloj inyectable.                                                                 |
| [`features/game/session/providers/remote.ts`](../../features/game/session/providers/remote.ts)                                                                                                                                                                                                           | Traducción al cliente HTTP existente, selección de campos públicos, normalización de recibos y clasificación de fallos.             |
| [`features/game/session/providers/remoteBootstrap.ts`](../../features/game/session/providers/remoteBootstrap.ts)                                                                                                                                                                                         | Convierte la proyección de sala en estado inicial neutral.                                                                          |
| [`features/game/competitive/core/sessionEngine.ts`](../../features/game/competitive/core/sessionEngine.ts)                                                                                                                                                                                               | Mismo motor, ahora con `provider`, `initialSession` y `clock`; no importa transporte, cliente HTTP ni modelos de sala.              |
| [`commandExecutor.ts`](../../features/game/competitive/core/commandExecutor.ts)                                                                                                                                                                                                                          | Mantiene cola única y comando original para repetición; resuelve revisión al despachar comandos nuevos.                             |
| [`attemptLifecycle.ts`](../../features/game/competitive/core/attemptLifecycle.ts), [`projection.ts`](../../features/game/competitive/core/projection.ts), [`runtime.ts`](../../features/game/competitive/core/runtime.ts), [`sessionReducer.ts`](../../features/game/competitive/core/sessionReducer.ts) | Consumen actualizaciones tipadas, recibos normalizados y revisión separada; mantienen las fases anteriores.                         |
| [`phaseTimers.ts`](../../features/game/competitive/core/phaseTimers.ts), [`clock.ts`](../../features/game/session/clock.ts)                                                                                                                                                                              | Programación y cancelación de esperas mediante el reloj inyectado.                                                                  |
| [`useCompetitiveSession.ts`](../../features/game/competitive/core/useCompetitiveSession.ts)                                                                                                                                                                                                              | Composición React/Next: crea proveedor remoto, estado inicial y callback de refresco. Mantiene el contrato externo de las fachadas. |
| [`formats/adapter.ts`](../../features/game/competitive/formats/adapter.ts), [`modes/policy.ts`](../../features/game/competitive/modes/policy.ts)                                                                                                                                                         | Sustituyen el objeto JSON genérico por la actualización pública tipada; conservan la normalización y las políticas actuales.        |
| [`check-type-architecture.mjs`](../../scripts/check-type-architecture.mjs)                                                                                                                                                                                                                               | Impide que núcleo, formatos y políticas vuelvan a importar transporte, proveedores concretos o modelos de sala.                     |

## Contrato y compatibilidad

Los comandos usan `sessionId`, `revision` y `challengeId`. Solo el adaptador remoto conoce su
correspondencia con `attemptId`, `lockVersion` y `scheduledChallengeId`. La revisión es numérica
en esta fase: el controlador conserva su valor sin incrementarlo ni inferir el siguiente.
Un proveedor futuro debe confirmar la nueva revisión en sus respuestas.

La respuesta del puerto distingue:

- `accepted`: confirmación con efecto `acknowledged`, `progress`, `evaluated` o `completed`.
  Una evaluación termina una interacción; solo `completed` termina la sesión.
- `rejected`: respuesta negativa confirmada, como entrada inválida, versión obsoleta o límite
  temporal de solicitudes. Conserva código y datos de reintento necesarios para la UX actual.
- `uncertain`: no se puede confirmar la entrega o interpretar la respuesta. No autoriza otra
  escritura; se conserva el comando original hasta repetición o recuperación.

La política actual del motor decide cómo reaccionar a cada código. Un rechazo por `429` conserva
la entrada y espera `Retry-After`; una versión obsoleta inicia recuperación sin reformular la
respuesta antigua. Los rechazos definitivos de formato liberan la entrada para corregirla.
Se conservan los límites de reintentos y las reglas especiales de Alfabeto y Contrarreloj.

Una repetición conserva operación, payload, identidad, revisión y clave idempotente. El puerto
no transporta cookies, tokens, estados HTTP ni detalles internos de la base. La cancelación
usa `AbortSignal`; desmontar el motor cancela el transporte y las esperas e ignora resultados
tardíos incluso si un proveedor no atiende la señal.

`state` contiene solo cambios públicos seleccionados explícitamente. `review` es un campo
separado del resultado y solo se entrega al completar o recuperar una sesión terminal. Los
payloads públicos y progresos de cada formato continúan pasando por los adaptadores actuales:
su representación de entrada sigue siendo `unknown` hasta esa validación. No se duplica el
catálogo de preguntas ni se implementa un segundo motor en esta fase.

## Verificación

Las pruebas nuevas cubren los 17 endpoints/cuerpos, conservación del comando tras incertidumbre,
rechazos y fallos de transporte, revisión solo terminal, recibos recuperados y transferencia.
También ejecutan el motor con un proveedor programado sin HTTP, un reloj independiente del
reloj global y una respuesta tardía después del desmontaje.

```bash
npm test
npm run type-architecture
npm run docs:check
npx tsc --noEmit --incremental false
E2E_INTEGRATION_SCENARIOS=s03,s05,s14,narrative,s15,time-trial npm run test:e2e:isolated -- e2e/s03-flash.spec.ts e2e/s05-alphabet.spec.ts e2e/s14-survival.spec.ts e2e/narrative.spec.ts e2e/s15-pyramid.spec.ts e2e/pyramid-queens.spec.ts e2e/time-trial.spec.ts
```

El runner recrea únicamente su stack Supabase temporal y lo elimina al terminar. Los tests de
referencia SQL de fase 0 siguen vigentes; esta fase no modifica SQL, rutas ni evaluadores.

### Resultado del 2026-10-18

| Comprobación                                                       | Resultado                                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Vitest focal: sesión, proveedores, formatos, fachadas y Pirámide   | 164 pruebas correctas en 12 archivos, incluidas 34 nuevas pruebas del puerto y su integración con el motor. |
| E2E Flash                                                          | 5 correctos.                                                                                                |
| E2E Alfabeto                                                       | 7 correctos.                                                                                                |
| E2E Supervivencia                                                  | 1 correcto.                                                                                                 |
| E2E Narrativa                                                      | 2 correctos.                                                                                                |
| E2E Pirámide                                                       | 5 correctos: recorrido S15 y cuatro casos Queens.                                                           |
| E2E Contrarreloj                                                   | 4 correctos.                                                                                                |
| Total de navegador                                                 | 24 correctos, sin casos omitidos ni casos marcados como inestables por Playwright.                          |
| Integración de los seis modos                                      | Auth, PostgREST, RLS y escenarios funcionales correctos.                                                    |
| TypeScript, ESLint focal, formato, arquitectura de tipos y enlaces | Correctos.                                                                                                  |
| Vitest completo                                                    | 2480 pruebas correctas y dos fallos preexistentes, reproducidos también sobre una copia limpia de `HEAD`.   |

Los dos fallos de la suite general son la expectativa de cinco preguntas frente a las seis
actuales en [`seed-betavip.test.mjs`](../../scripts/seed-betavip.test.mjs) y el ciclo entre dominios
de componentes detectado por [`flashPopTokenGuard.test.ts`](../../components/game/modes/flash-pop/flashPopTokenGuard.test.ts).
No dependen del puerto de sesión y quedan fuera de esta fase.

Se actualizó una referencia obsoleta de la
[integración de Narrativa](../../scripts/integration/scenarios/narrative.mjs): ahora espera
`multiple-choice,short-text`, los dos formatos que ya define su
[fixture](../../scripts/fixtures/scenarios/narrative.mjs). No se modificó el fixture ni el juego.
Flash se repitió con un fixture limpio después de una primera ejecución interrumpida por Fast
Refresh durante la edición; sus cinco casos pasan con el código inmóvil.

El motor conserva su nombre y ubicación bajo `competitive/` para evitar una migración de
importaciones adicional. La nueva frontera es el puerto inyectado, no un motor paralelo.

## Siguiente frontera

La [fase 2](local-pyramid-session.md) implementa la autoridad local en memoria sobre este puerto
y comparte reglas puras con la evaluación actual, incluyendo idempotencia, activación,
recuperación y revisión.
La fase de presentación podrá consumir ese proveedor desde el mismo controlador y retirar la
duplicación de UI. Las rutas competitivas siguen seleccionando explícitamente el remoto.
