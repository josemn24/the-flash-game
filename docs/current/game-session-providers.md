# Proveedores de sesión

Estado: contrato y proveedor remoto implementados el 2026-10-18; consolidación de Pirámide
completada el 2026-10-19, con [criterios de cierre acreditados](qa.md#cierre-de-la-fase-6--2026-10-19).
Las ampliaciones locales de Pirámide y Flash, incluida la vista compartida Flash, se documentan en
[autoridades locales](local-pyramid-session.md).

El motor competitivo existente recibe ahora una autoridad de sesión mediante un puerto. La
composición de producción selecciona el proveedor remoto, que usa los mismos endpoints,
cookies, comandos idempotentes y tiempos de espera del transporte anterior. Los seis modos
conservan sus políticas, evaluadores y transiciones; Flash y Pirámide también admiten un
proveedor local en sus composiciones de ensayo.

El [contrato funcional de Pirámide](pyramid-session-contract.md) sigue siendo la referencia.
La fase 1 preparó la sustitución de autoridad. Las fases posteriores añadieron proveedores y
ensayos locales para Pirámide, y extendieron a Flash el adaptador y la presentación compartidos.
La práctica didáctica permanece separada y no certifica por sí sola la equivalencia competitiva.

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

### Resultado previo a la entrega Flash — 2026-10-18

| Comprobación                                                       | Resultado                                                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Vitest focal: sesión, proveedores, formatos, fachadas y Pirámide   | 164 pruebas correctas en 12 archivos, incluidas 34 nuevas pruebas del puerto y su integración con el motor.     |
| E2E Flash                                                          | 5 correctos.                                                                                                    |
| E2E Alfabeto                                                       | 7 correctos.                                                                                                    |
| E2E Supervivencia                                                  | 1 correcto.                                                                                                     |
| E2E Narrativa                                                      | 2 correctos.                                                                                                    |
| E2E Pirámide                                                       | 5 correctos: recorrido S15 y cuatro casos Queens.                                                               |
| E2E Contrarreloj                                                   | 4 correctos.                                                                                                    |
| Total de navegador                                                 | 24 correctos, sin casos omitidos ni casos marcados como inestables por Playwright.                              |
| Integración de los seis modos                                      | Auth, PostgREST, RLS y escenarios funcionales correctos.                                                        |
| TypeScript, ESLint focal, formato, arquitectura de tipos y enlaces | Correctos.                                                                                                      |
| Vitest completo de ese corte                                       | 2480 pruebas correctas; el resultado posterior está registrado en la [entrega Flash](local-pyramid-session.md). |

Ese corte precede a la corrección de las regresiones generales y a las pruebas de autoridades
locales. Esa entrega de Flash y Pirámide registró 2672 pruebas correctas en
[`local-pyramid-session.md`](local-pyramid-session.md). La evidencia posterior de la consolidación
de Pirámide se registra por separado en [QA](qa.md#consolidación-de-pirámide-fase-6--2026-10-19).

Se actualizó una referencia obsoleta de la
[integración de Narrativa](../../scripts/integration/scenarios/narrative.mjs): ahora espera
`multiple-choice,short-text`, los dos formatos que ya define su
[fixture](../../scripts/fixtures/scenarios/narrative.mjs). No se modificó el fixture ni el juego.
Flash se repitió con un fixture limpio después de una primera ejecución interrumpida por Fast
Refresh durante la edición; sus cinco casos pasan con el código inmóvil.

El motor conserva su nombre y ubicación bajo `competitive/` para evitar una migración de
importaciones adicional. La nueva frontera es el puerto inyectado, no un motor paralelo.

## Extensión de Supervivencia

Supervivencia usa ahora el mismo puerto y motor con autoridad remota o local. Su vista compartida
conserva vidas, eliminación, feedback, resultados y revisión; la política de modo decide cuándo
terminar el recorrido. La composición productiva sigue seleccionando explícitamente el proveedor
remoto, y las rutas `/demo/` seleccionan el local solo para fixtures aprobados.

## Consolidación de Pirámide: fase 6

Estado: completada el 2026-10-19. La [matriz de cierre](qa.md#cierre-de-la-fase-6--2026-10-19)
enlaza criterios, implementación y verificaciones.

Todas las composiciones de partidas de Pirámide seleccionan proveedor y comparten
`usePyramidGameSession` y `PyramidGameView`. La variante local de `GameApp` recibe una
`LocalPyramidDefinition`; ya no admite el agregado anterior con preguntas de práctica.
`LocalPyramidGameApp` prepara diccionarios públicos, conserva una autoridad por ejecución y
emite `onComplete` solo tras confirmación terminal. Replay o cambio de desafío/versión descartan
esa autoridad. Los tipos de resumen y progreso están en `types/gameplay/pyramid.ts`.

El hook compartido crea el motor con dependencias explícitas: recrear el objeto de opciones no
reinicia la sesión. Cambiar proveedor o desafío desmonta el motor anterior y cancela sus efectos.
La arquitectura rechaza módulos retirados y definiciones locales privadas en la presentación
pública o las composiciones remotas.
