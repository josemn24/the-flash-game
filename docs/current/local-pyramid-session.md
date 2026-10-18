# Autoridades locales de Flash, Pirámide y Supervivencia

Estado: ensayos locales de Flash, Pirámide y Supervivencia; Flash y Supervivencia comparten sus
vistas y adaptadores de sesión con competición.

Las autoridades locales implementan el mismo puerto que consume el motor competitivo. La
composición de producción conserva el proveedor remoto; las composiciones bajo `/demo/` crean
proveedores locales en memoria. Flash y Supervivencia comparten sus vistas competitivas y controles
de pregunta entre ambas autoridades. El [contrato funcional](pyramid-session-contract.md) y el
[puerto de sesión](game-session-providers.md) siguen siendo las referencias de comportamiento.

## Composición

```ts
const provider = createLocalPyramidSessionProvider({
  definition,
  dictionaries, // ReadonlyMap<dictionaryId, ReadonlySet<palabra normalizada>>
  clock, // opcional: SessionClock; el predeterminado usa el reloj del sistema
  createSessionId, // opcional: el predeterminado genera un UUID
});
```

`LocalPyramidDefinition` contiene los metadatos públicos de un desafío de siete niveles y las
preguntas canónicas, soluciones y revelaciones privadas vinculadas por `challengeItemId`.
La composición debe resolver previamente las referencias gráficas y cargar los diccionarios de
Mini-Wordle. No se debe entregar esta definición privada a una vista.

La construcción valida los formatos y sus versiones con las capacidades competitivas y los
validadores de publicación existentes. Comprueba la correspondencia entre niveles, preguntas,
soluciones y tiempos, las siete posiciones y los pesos enteros positivos que suman 100. Las
pistas deben estar completas y ordenadas por índice. Copia la definición y los diccionarios para
que cambios posteriores del consumidor no alteren la autoridad.

Cada instancia conserva una sola sesión. Crear otra instancia inicia un ensayo independiente.
La memoria dura mientras exista esa instancia: no hay persistencia entre recargas completas,
transferencia entre dispositivos, ranking ni acreditación oficial. El proveedor no realiza
HTTP, lecturas de archivos ni llamadas a Supabase. Las marcas, gestos, foco y animaciones
permanecen en los controles actuales.

## Organización

| Archivo                                                                                                                                | Responsabilidad                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`local-pyramid.ts`](../../types/gameplay/local-pyramid.ts)                                                                            | Entrada privada y canónica de composición.                                                                   |
| [`localPyramid.ts`](../../features/game/session/providers/localPyramid.ts)                                                             | Autoridad en memoria específica de progresión, puntuación y cierre de Pirámide.                              |
| [`localFlash.ts`](../../features/game/session/providers/localFlash.ts), [`localSurvival.ts`](../../features/game/session/providers/localSurvival.ts) | Fachadas locales tipadas que componen la autoridad secuencial compartida.                           |
| [`sequentialProvider.ts`](../../features/game/session/providers/localShared/sequentialProvider.ts)                                     | Cola, evaluación y sesión lineal compartidas por Flash y Supervivencia; cada política conserva sus reglas.   |
| [`runtime.ts`](../../features/game/session/providers/localShared/runtime.ts)                                                           | Cola de comandos serializada e idempotencia compartida.                                                     |
| [`definition.ts`](../../features/game/session/providers/localShared/definition.ts)                                                     | Validación, resolución privada y payloads públicos para Flash, Pirámide y Supervivencia.                     |
| [`formats.ts`](../../features/game/session/providers/localShared/formats.ts)                                                           | Transiciones puras de los protocolos de interacción especiales.                                              |
| [`resolution/`](../../lib/scoringCore/resolution/registry.ts)                                                                          | Los 21 resolutores competitivos puros, compartidos con las fachadas del servidor.                            |
| [`competitiveReceipt.ts`](../../lib/scoringCore/competitiveReceipt.ts), [`pyramid.ts`](../../lib/scoringCore/pyramid.ts)               | Evaluación de recepciones y consecuencias específicas de Pirámide.                                           |
| [`pyramidProgress.ts`](../../lib/gameplay/pyramidProgress.ts)                                                                          | Progreso compartido: solo `correct` supera un nivel; los demás resultados aportan cero y cierran el ascenso. |
| [`survivalProgress.ts`](../../lib/gameplay/survivalProgress.ts)                                                                        | Deriva vidas, pruebas alcanzadas y eliminación a partir de resultados evaluados.                             |
| [`localPyramidDefinition.ts`](../../infrastructure/mock/localPyramidDefinition.ts)                                                     | Composición de publicaciones mock canónicas, fuera de los proveedores y de la práctica legacy.               |
| [`corpus.ts`](../../test-utils/game-session-conformance/corpus.ts), [`driver.ts`](../../test-utils/game-session-conformance/driver.ts) | Casos comunes, soluciones, errores y herramientas de reloj/entrega.                                          |
| [`pyramid-session-conformance.spec.ts`](../../e2e/pyramid-session-conformance.spec.ts)                                                 | Comparación del proveedor local con el adaptador remoto real y del motor con ambas autoridades.              |

Las fachadas bajo `server/evaluation/formats/` mantienen `server-only` y su API anterior; delegan
en las implementaciones puras. Los resolutores exclusivos de práctica conservan su tratamiento.
PostgreSQL mantiene una implementación independiente de las transiciones: no se modifican
esquemas, endpoints, reglas competitivas ni sus permisos y garantías transaccionales.

Texto corto conserva ahora `answerPlaceholder` al construir su pregunta canónica. El contrato
admite ese payload opcional y mantiene la compatibilidad con los fixtures cuyo payload es
`null`. La evaluación ignora este dato de presentación. La composición conserva asimismo la
grafía editorial de las soluciones de Mini-Wordle para la revisión; las reglas normalizan
las palabras al validar y puntuar los intentos.

El control de arquitectura impide importar transporte, React, Next, servidor, catálogos mock o
infraestructura desde las autoridades locales y los resolutores puros. Solo las composiciones
dedicadas de `/demo/` pueden seleccionar proveedores locales.

## Semántica de sesión

### Pirámide

Los 15 comandos aplicables comparten el contrato existente. `alphabetPass` y `takeover`
responden `invalid_command`. Las revisiones son numéricas, pero el motor conserva su valor como
un token opaco: no calcula el siguiente.

Una cola serializa los comandos. Las claves idempotentes se comprueban antes de la revisión y
del plazo. Repetir operación y entrada con la misma clave conserva la respuesta; cambiar su
entrada produce conflicto. Los rechazos de formato no consumen oportunidades. Las respuestas
se copian antes de salir del proveedor.

La recuperación conserva la idempotencia por identidad y revisión, como la clave derivada del
endpoint remoto. Completar con una interacción activa o una recepción pendiente se rechaza sin
evaluarla ni consumirla; la repetición original o la recuperación son las vías de conciliación.

Preparar autoriza únicamente el nivel siguiente y no inicia el tiempo. Activar fija todo su
intervalo; las repeticiones conservan el plazo. No hay reloj global y el cierre ordinario de la
publicación no corta una sesión iniciada dentro de su ventana.

La recepción conserva la entrada y el tiempo efectivos antes de la evaluación. Una cancelación
anterior a la aceptación no escribe; una interrupción posterior deja una recepción que la
repetición o la recuperación pueden evaluar una sola vez. La recepción original nunca se
sustituye por una respuesta posterior.

Recuperar un nivel activo cierra esa interacción conforme a las reglas del servidor. Queens y
Word Search reconstruyen los eventos aceptados; Word Hashtag reconstruye los intercambios.
Otros formatos pueden cerrarse con una respuesta nula, aunque exista progreso intermedio.
Recuperar durante el briefing no abre un intervalo. No debe interpretarse recuperar como una
reanudación universal.

Solo `failed` o `summit` permiten completar normalmente. El abandono se distingue de ese
resultado y no entrega soluciones. La revisión se devuelve exclusivamente al completar o
recuperar un resultado terminal y solo comprende niveles autorizados y resueltos.

### Flash

Flash reutiliza la cola, firma idempotente, compilación de preguntas y transiciones de formato.
Su autoridad mantiene una secuencia lineal: preparar inicia el plazo de la pregunta, y una
respuesta incorrecta o una pregunta sin respuesta no interrumpe el recorrido. Completar se
acepta cuando se han resuelto las 16 preguntas; la revisión terminal conserva sus payloads
privados dentro de la instancia local. No hay activación por separado, oportunidades de Queens
que afecten niveles futuros ni dependencia de la ventana de publicación. Una repetición crea
otra instancia y una recarga completa inicia otro ensayo.

El ensayo canónico está disponible en
`/demo/flash-pop/desafios/tabarnia-flash-01`. La práctica didáctica de
`/demo/flash-pop/flash/tabarnia-flash-01` permanece separada.

### Supervivencia

Supervivencia comparte el proveedor secuencial de Flash y conserva su progresión propia mediante
`survivalPolicy` y `deriveSurvivalProgress`. Un resultado incorrecto o sin respuesta consume una
vida; Queens también consume vida si hubo validaciones incorrectas. El intento termina al agotarse
las vidas o al alcanzar todas las preguntas. La revisión local contiene las preguntas alcanzadas y
la puntuación usa los mismos resolutores competitivos.

El ensayo canónico de 20 retos y tres vidas está disponible en
`/demo/flash-pop/desafios/tabarnia-challenge-03`. La definición se limita al identificador de demo,
contiene soluciones y se entrega al proveedor local; no se selecciona desde las rutas competitivas.

## Verificación reproducible

El corpus deriva de los ejemplos publicados de contratos: 25 combinaciones cubren los 21
formatos y todas las versiones admitidas. Una prueba compara esa cobertura con el registro de
capacidades para detectar futuros formatos o versiones sin escenario.

La conformidad remota utiliza el adaptador y transporte reales, HTTP, cookies de autenticación
y un stack Supabase desechable. La comparación normaliza las identidades, las revisiones opacas,
las fechas y las URLs firmadas. Conserva puntuaciones, oportunidades, estados, respuestas y
detalles de evaluación. El reloj local reproduce los milisegundos efectivos aceptados por el
servidor; no se admiten tolerancias de puntuación. Los diagnósticos locales opcionales pueden
ser más ricos, pero cada campo público remoto debe coincidir.

La conformidad de Flash recorre las 16 preguntas canónicas contra una publicación SBR sembrada
en Supabase. Compara también los payloads públicos y de revisión, respuestas, puntos y tiempos
aceptados. El fixture SBR conserva el contenido editorial compartido con el mock canónico.

Los cambios de tiempo y la interrupción de evaluación de los tests se limitan a la base temporal.
Las confirmaciones perdidas y cancelaciones se inyectan desde herramientas de prueba; el
proveedor no incorpora latencia artificial. Las pruebas de permisos, límites de solicitudes y
transacciones siguen siendo independientes. La suite intensiva de conformidad eleva únicamente
el presupuesto de solicitudes de su proceso temporal para no mezclar throttling con reglas de
juego.

```bash
npm test -- features/game/session/providers features/game/competitive/core/localPyramidEngine.test.ts infrastructure/mock/localPyramidDefinition.test.ts
FLASH_RATE_LIMIT_BURST=10000 npm run test:e2e:isolated -- e2e/pyramid-session-conformance.spec.ts
npm run test:e2e:isolated -- e2e/flash-session-conformance.spec.ts
npm run test:e2e:local-rehearsals
E2E_INTEGRATION_SCENARIOS=sbr npm run test:e2e:isolated -- e2e/sbr-persisted.spec.ts
E2E_INTEGRATION_SCENARIOS=s03,s05,s14,narrative,s15,time-trial npm run test:e2e:isolated -- e2e/s03-flash.spec.ts e2e/s05-alphabet.spec.ts e2e/s14-survival.spec.ts e2e/narrative.spec.ts e2e/s15-pyramid.spec.ts e2e/pyramid-queens.spec.ts e2e/time-trial.spec.ts
npm run supabase:schema:test
npm run type-architecture
npm run docs:check
npx tsc --noEmit --incremental false
```

El comando SQL requiere un contenedor PostgreSQL de pruebas mediante `SUPABASE_DB_CONTAINER`;
crea y elimina una base independiente. El runner E2E crea y elimina su propio stack Supabase.

El resultado fechado a continuación corresponde a la primera entrega de Pirámide. La ejecución
posterior de la suite completa y las validaciones añadidas al ampliar Flash se registran en la
sección de la entrega Flash.

## Resultado de la primera entrega de Pirámide — 2026-10-18

| Comprobación                               | Resultado                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cobertura de formatos                      | 21 formatos; 25 combinaciones de formato y versión, contrastadas automáticamente con el registro de capacidades.                                                                |
| Conformidad HTTP, Auth y Supabase temporal | 161 escenarios únicos acreditados: 160 correctos en la matriz y siete casos Word Search correctos en la repetición focal, seis de ellos ya incluidos.                           |
| Motor compartido con ambas autoridades     | 25 recorridos de siete niveles, incluidos en la matriz real; comparación de fases, preguntas, respuestas, puntuación y bloqueo.                                                 |
| Regresión de los seis modos                | 24 E2E correctos: Flash 5, Alfabeto 7, Supervivencia 1, Narrativa 2, Pirámide 5 y Contrarreloj 4; sin omitidos ni inestables. Integraciones de Auth, PostgREST y RLS correctas. |
| Referencia SQL                             | 67 suites correctas, 158 casos compartidos de formatos, 904 observaciones de validación y pruebas de concurrencia correctas.                                                    |
| Vitest completo de esa entrega             | 2652 pruebas correctas; el resultado actualizado aparece en la sección siguiente.                                                                                               |
| Controles estáticos                        | TypeScript, ESLint de los archivos modificados, formato, arquitectura y enlaces correctos.                                                                                      |

La repetición focal conserva las reglas actuales de Word Search: una selección degenerada se
rechaza; una selección válida que no coincide con un objetivo se registra como error, pero no
descuenta puntos. La prueba de victoria tras ese error se corrigió para comprobar ese
comportamiento, y los siete escenarios del formato se ejecutaron de nuevo sin fallos. No se
modificó el proveedor ni el evaluador para ajustar ese resultado.

La matriz también comprueba recepción pendiente tras un fallo de evaluación real en la base
temporal, recuperación y repetición sin duplicar puntuación, confirmaciones perdidas, errores y
penalizaciones intermedias, tres fallos de Queens, acierto después de uno y dos fallos, agotamiento
de Wordle y de movimientos Hashtag, recuperación específica por formato, revisión autorizada y
cima de siete niveles. Las comparaciones mantienen íntegros los puntos y los tiempos aceptados.

### Entrega Flash local y competitiva (2026-10-18)

| Comprobación                            | Resultado                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Suite Vitest                            | 255 archivos y 2672 tests correctos.                                                                            |
| Ensayos locales de Pirámide y Flash     | 6 E2E correctos; Flash completa 16 preguntas, revisa y repite sin llamadas a Auth, Storage o juego competitivo. |
| Regresión competitiva SBR               | 2 E2E correctos contra el stack Supabase aislado.                                                               |
| Conformidad de Flash local con Supabase | 1 E2E correcto; 16 preguntas, respuestas, payloads, puntuación, tiempos y revisión.                             |
| TypeScript, ESLint, arquitectura y docs | Correctos para la entrega.                                                                                      |
