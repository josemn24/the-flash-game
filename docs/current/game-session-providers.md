# Proveedores de sesión

Estado: vigente. Puerto, proveedor remoto y composición compartida de sesiones.

El motor recibe una autoridad mediante `GameSessionProvider`. Los seis modos competitivos
seleccionan el proveedor remoto. Flash, Supervivencia, Pirámide, Alfabeto y Contrarreloj también
admiten una autoridad local en memoria para demos y pruebas autorizadas antes de competir.
Narrativa conserva su práctica propia y no participa en la generación de ensayos.

Las tres entradas de ejecución (`run`, `retry` y `takeOver`) comparten el coordinador
`afterCommand`, que vuelve a consultar el snapshot entre efectos. `ModePolicy.finalization`
selecciona la política pura de cierre global de Alfabeto o Contrarreloj; el resto de modos
usa una política neutra. `commandRecoveryPolicy` clasifica fallos y calcula esperas, mientras
el motor conserva cola, contadores, temporizadores y cancelación. `finalizeGlobalClock`
espera a que se acepte o reconcilie el comando pendiente. La confirmación visual de abandono
sigue dentro del motor y las fachadas de los hooks mantienen sus interfaces externas.

La [verificación de la refactorización](../archive/reports/session-engine-refactor-2026-10-28.md)
registra las pruebas nuevas, los recorridos persistidos y las incidencias previas de fixtures.

La práctica didáctica de formatos permanece separada y no certifica la equivalencia competitiva.
Las [autoridades locales](local-pyramid-session.md), [ensayos](rehearsals.md) y
[contrato de Pirámide](pyramid-session-contract.md) desarrollan sus reglas.
Los informes de implementación están en el [archivo](../archive/reports/README.md).

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

`SessionAcceptanceByOperation` relaciona operación, efecto y campos obligatorios. `execute<K>`
y `CommandStep<K>` conservan esa relación: una evaluación exige estado, puntos y duración;
un cierre exige identidad, revisión y puntuación autoritativa. `AuthoritativeSessionUpdate`
permanece como estructura parcial para ensamblar proyecciones internas, no como resultado
aceptado del puerto. El discriminante `operation` es interno; no cambia el JSON HTTP.

El proveedor remoto recibe `GameSessionValidationContext` desde la composición: modo y metadatos
públicos de los ítems, sin soluciones. Valida identidad, revisión, variantes de preparación,
resultados evaluados y progresos antes de aceptar. Reutiliza los validadores públicos del catálogo
con el formato, versión, tiempo y puntos del ítem. Las listas inválidas se rechazan enteras;
no se filtran elementos ni se convierten puntuaciones o duraciones ausentes en cero.
Los proveedores locales cruzan el mismo constructor validado antes de devolver su resultado.
Las lecturas guardadas tienen un DTO propio: PostgreSQL elimina nulos recursivamente, incluso
respuestas parciales reconstruidas desde eventos. Su `answer` puede faltar y se normaliza a `null`
solo al construir el estado terminal del proveedor, conservando el JSON HTTP. Los comandos y las
proyecciones activas siguen exigiendo `answer`, aunque su valor sea `null`.

El constructor conserva configuración pública validada y hechos inmutables del reloj. Durante la
preparación registra `maxMoves` para Hashtag. La confirmación de un movimiento debe traer tablero y `correctCells`
completos, con contadores compatibles con esa configuración. Los adaptadores visuales aplican
el estado validado, sin combinar datos incompletos con el tablero anterior. Cero movimientos es
válido en progreso inicial; un intercambio confirmado exige movimientos consumidos positivos.
Los replays conservan su contador, sin exigir incrementos nuevos.

`GameSessionProvider<M>` y `TimeTrialSessionAcceptance` expresan los requisitos adicionales por
modo. El inicio y la transferencia conservan su respuesta vigente sin exigir `timeTrial`;
la preparación exige el reloj completo. La evaluación genérica tampoco publica `timeTrial` y
conserva el reloj ya instalado por una preparación o recuperación válida. Contrarreloj distingue reloj aún no iniciado, reloj
activo y resultado reglamentario.
Preparar o recuperar una prueba en juego requiere un reloj global activo; el abandono previo al
inicio admite la variante sin reloj. El replay actualiza la referencia visual `serverNow` y
conserva los timestamps de la operación original.
Ninguna confirmación no terminal puede borrar un reloj activo de la misma sesión. La ausencia
legítima de un reloj opcional no produce cambios. Un replay antiguo de inicio o transferencia
se acepta omitiendo únicamente su proyección de reloj no iniciado; el resultado cacheado y el
resto del acuse permanecen intactos. El abandono terminal mantiene su variante sin reloj.

La aceptación de `prepareSession` contiene únicamente `{ ready: true }`. No identifica intentos,
no aplica relojes y no cambia los hechos del constructor, aunque incluya campos adicionales.
Un contrato inválido produce incertidumbre antes de actualizar los hechos o el motor.

`state` contiene solo cambios públicos seleccionados explícitamente. `review` permanece separado
y solo aparece al completar o recuperar una sesión terminal. Si falla su decodificación o
adaptación, se conserva el resultado confirmado y se ofrece recuperación de la revisión mediante
`reviewPending`. Un fallo de revisión no reenvía la escritura de cierre.

El adaptador PostgreSQL vincula cada función SQL con su entrada, resultado y decodificador en
`AttemptSqlCommandMap` y `attemptSqlDecoders`. No admite funciones arbitrarias ni resultados elegidos
por el llamador. También valida lecturas de evaluación persistida, contexto privado, recuperación,
resultados guardados y la respuesta vacía de preparación de sesión. Para preparación y movimientos Hashtag, el adaptador lee el contexto del ítem de la versión
asociada al intento autorizado, dentro de la misma transacción y antes del commit. El contexto
es obligatorio para sus decodificadores, no cruza HTTP y no usa valores ficticios. La validación de payloads
almacenados con assets precede a su resolución autorizada; la validación pública no usa soluciones.

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

Los resultados fechados se conservan en el [informe de entrega](../archive/reports/session-providers-2026-10-18.md).

## Extensión de Supervivencia

Supervivencia usa ahora el mismo puerto y motor con autoridad remota o local. Su vista compartida
conserva vidas, eliminación, feedback, resultados y revisión; la política de modo decide cuándo
terminar el recorrido. La composición productiva sigue seleccionando explícitamente el proveedor
remoto, y las rutas `/demo/` seleccionan el local solo para fixtures aprobados.

## Consolidación de Pirámide: fase 6

Estado: completada el 2026-10-19. La [matriz de cierre](../archive/reports/qa-through-2026-10-21.md#cierre-de-la-fase-6--2026-10-19)
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
