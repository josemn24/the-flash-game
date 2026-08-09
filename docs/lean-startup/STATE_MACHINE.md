# Máquina de estados Lean

## Propósito

Esta máquina de estados hace explícitas las puertas de avance de un ciclo Lean. Es manual: no automatiza decisiones ni sustituye el juicio del equipo. Su regla es simple: un ciclo no avanza porque se haya completado una actividad, sino cuando existe la información o decisión necesaria para entrar con rigor en el siguiente estado.

`STATE.md` conserva la fase breve permitida por el sistema. El ciclo activo indica además el estado detallado de esta máquina y la condición concreta para avanzar.

## Flujo

```text
DISCOVERY
→ HYPOTHESIS_MAPPING
→ DECISION_FRAMING
→ LEARNING_QUESTION_DESIGN
→ HYPOTHESIS_SELECTION
→ EVIDENCE_DESIGN
→ MEASUREMENT_DESIGN
→ EXPERIMENT_DESIGN
→ MVP_DESIGN
→ READY_TO_RUN
→ RUNNING
→ RESULTS_PROCESSING
→ LEARNING_ANALYSIS
→ DECISION
→ NEXT_CYCLE
```

Desde `DECISION`, `PARAR` lleva a `STOPPED`. Desde `NEXT_CYCLE`, un pivot que cambie segmento, problema o contexto puede volver a `DISCOVERY`; en los demás casos vuelve a `DECISION_FRAMING`.

## Relación con las fases de `STATE.md`

| Estado detallado                                                       | Fase breve en `STATE.md`                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `DISCOVERY`                                                            | Descubrimiento                                                |
| `HYPOTHESIS_MAPPING`                                                   | Formulación de hipótesis                                      |
| `DECISION_FRAMING`, `LEARNING_QUESTION_DESIGN`, `HYPOTHESIS_SELECTION` | Priorización de hipótesis                                     |
| `EVIDENCE_DESIGN`, `MEASUREMENT_DESIGN`, `EXPERIMENT_DESIGN`           | Diseño del experimento                                        |
| `MVP_DESIGN`, `READY_TO_RUN`                                           | Preparación del MVP                                           |
| `RUNNING`                                                              | Ejecución                                                     |
| `RESULTS_PROCESSING`                                                   | Medición                                                      |
| `LEARNING_ANALYSIS`                                                    | Análisis del aprendizaje                                      |
| `DECISION`                                                             | Decisión                                                      |
| `NEXT_CYCLE`                                                           | Preparación del siguiente ciclo                               |
| `STOPPED`                                                              | Sin fase activa; el proyecto queda cerrado de forma explícita |

## Salidas verificables y ubicación

Cada estado debe dejar una salida verificable, pero la existencia de esa salida no basta para avanzar: la puerta de salida del estado debe cumplirse de forma sustantiva.

| Estados                           | Salida verificable                                                                   | Tipo                            | Ubicación                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DISCOVERY`                       | Contexto, fuentes, hechos, supuestos y lagunas iniciales                             | Documento vivo                  | `VISION.md`, `STRATEGY.md` o contexto del ciclo, según alcance                                           |
| `HYPOTHESIS_MAPPING`              | Hipótesis identificadas y priorización visible                                       | Documento vivo                  | `HYPOTHESES.md`                                                                                          |
| `DECISION_FRAMING` a `MVP_DESIGN` | Decisión, pregunta, hipótesis, evidencia, medición, protocolo y alcance del vehículo | Expediente de ciclo             | Secciones 2 a 9 de `cycles/CYCLE-XXX.md`                                                                 |
| `READY_TO_RUN`                    | Lista de comprobación, versión congelada y condiciones de inicio                     | Control de preparación          | Sección 10 de `cycles/CYCLE-XXX.md`                                                                      |
| `RUNNING`                         | Datos, comportamientos, incidencias, datos faltantes y desviaciones                  | Registro histórico              | Sección de resultados del ciclo; un archivo adicional solo si el volumen lo exige                        |
| `RESULTS_PROCESSING`              | Cálculo reproducible y comparación con umbrales                                      | Registro histórico              | Sección de resultados del ciclo                                                                          |
| `LEARNING_ANALYSIS`               | Interpretación, límites, confianza y clasificación de hipótesis                      | Análisis histórico              | Sección de análisis del ciclo                                                                            |
| `DECISION` y `NEXT_CYCLE`         | Decisión, siguiente incertidumbre y única acción inmediata                           | Registro histórico y transición | Secciones de decisión y cierre del ciclo; `STATE.md`, `HYPOTHESES.md` y `STRATEGY.md` cuando corresponda |
| `STOPPED`                         | Motivo, evidencia y condiciones de reapertura                                        | Registro histórico              | Ciclo de cierre; no requiere un archivo separado salvo necesidad real                                    |

No se sale de `MEASUREMENT_DESIGN` porque una sección esté rellenada, sino porque la medición sea inequívoca y reproducible. Del mismo modo, no se sale de `RUNNING` por una fecha aislada, sino al cumplirse una condición de finalización o parada definida.

## Estados y puertas de salida

### `DISCOVERY`

**Propósito:** comprender una situación, personas y problemas sin asumir que la solución es correcta.

**Avanza cuando:** existe un segmento o contexto inicial, un problema a investigar, hechos separados de supuestos y lagunas identificadas.

### `HYPOTHESIS_MAPPING`

**Propósito:** convertir la incertidumbre visible en hipótesis de problema, segmento, valor, uso, canal, ingresos, crecimiento o viabilidad.

**Avanza cuando:** existe un mapa proporcional de creencias relevantes y se conoce el coste de estar equivocados en las principales.

### `DECISION_FRAMING`

**Propósito:** formular la elección concreta que el ciclo debe desbloquear.

**Avanza cuando:** hay alternativas reales, una inversión o cambio que depende de ellas y evidencia capaz de afectar la elección.

### `LEARNING_QUESTION_DESIGN`

**Propósito:** expresar qué se necesita aprender para tomar la decisión.

**Avanza cuando:** existe una única pregunta respondible mediante comportamiento o evidencia observable, vinculada a la decisión.

### `HYPOTHESIS_SELECTION`

**Propósito:** elegir y refinar la hipótesis que concentra la incertidumbre crítica.

**Avanza cuando:** la hipótesis tiene segmento o contexto, comportamiento observable, posibilidad de apoyo/debilitamiento/refutación y decisión asociada.

### `EVIDENCE_DESIGN`

**Propósito:** decidir qué observaciones aumentarían, reducirían o no cambiarían la confianza.

**Avanza cuando:** se han definido evidencia de apoyo, debilitamiento e inconclusión, señales débiles que no cuentan y explicaciones alternativas relevantes.

### `MEASUREMENT_DESIGN`

**Propósito:** transformar la evidencia en una medición reproducible.

**Avanza cuando:** métrica principal, población, numerador, denominador, ventana, fuente de datos, umbrales, resultado inconcluso y origen de los umbrales están fijados antes de observar datos.

### `EXPERIMENT_DESIGN`

**Propósito:** elegir el protocolo más pequeño capaz de producir la medición.

**Avanza cuando:** segmento, método, muestra, duración, captura de datos, sesgos, condiciones de parada y acciones previstas son ejecutables; no existe una alternativa claramente menor con evidencia equivalente.

### `MVP_DESIGN`

**Propósito:** definir el vehículo mínimo, técnico o manual, que ejecuta el protocolo de forma fiable.

**Avanza cuando:** cada elemento a crear permite provocar el comportamiento o registrarlo, queda explícito lo que no se construirá y existe un criterio para detener la preparación.

### `READY_TO_RUN`

**Propósito:** actuar como puerta de control final, no como una actividad adicional.

**Avanza a `RUNNING` solo cuando:** decisión, pregunta, hipótesis, evidencia, métrica, umbrales, protocolo, MVP, responsable, muestra, duración, condiciones de parada, tratamiento de datos y consideraciones éticas están completos y coherentes. El diseño queda congelado al iniciar la recogida de datos.

**Salida verificable:** el control `READY_TO_RUN` del ciclo indica versión, responsable, estado de congelación y comprobaciones completadas o bloqueantes.

### `RUNNING`

**Propósito:** ejecutar el protocolo y registrar fielmente lo que ocurre.

**Avanza cuando:** se alcanza la muestra o duración definidas, una condición de parada, una imposibilidad documentada o el punto en que continuar no puede cambiar la decisión. Cualquier desviación se registra, sin cambiar silenciosamente hipótesis, métrica o umbrales.

### `RESULTS_PROCESSING`

**Propósito:** consolidar datos y calcular resultados antes de interpretarlos.

**Avanza cuando:** muestra analizada, numerador, denominador, métrica, anomalías, datos faltantes y desviaciones están documentados y los resultados se comparan con los umbrales.

### `LEARNING_ANALYSIS`

**Propósito:** determinar qué cambia realmente en la confianza de la hipótesis.

**Avanza cuando:** datos, comportamientos, opiniones, explicaciones alternativas, sesgos, limitaciones, clasificación de hipótesis y nivel de confianza están separados y documentados.

### `DECISION`

**Propósito:** convertir el aprendizaje en una consecuencia estratégica explícita.

**Avanza cuando:** se registra `PERSEVERAR`, `PIVOTAR` o `PARAR`, junto con la evidencia, nivel de confianza, siguiente incertidumbre y única acción inmediata. Si la evidencia no es fiable, primero se decide reparar, repetir, ampliar la muestra, modificar la medición o declarar inconcluso; eso es una decisión metodológica, no una cuarta decisión estratégica.

### `NEXT_CYCLE` y `STOPPED`

**`NEXT_CYCLE`:** actualiza estado, estrategia e hipótesis, cierra el ciclo anterior y prepara solo la siguiente incertidumbre necesaria.

**`STOPPED`:** conserva evidencia, aprendizaje y condiciones de reapertura. No borra el historial ni mantiene un ciclo activo.

## Reglas de transición

- No saltar un estado por tener una solución o tarea preferida.
- No pasar de `READY_TO_RUN` a `RUNNING` si quedan criterios esenciales por decidir.
- No reinterpretar umbrales después de entrar en `RUNNING`.
- No pasar de `RESULTS_PROCESSING` a una decisión estratégica sin `LEARNING_ANALYSIS`.
- Si una puerta no se cumple, la única acción inmediata debe resolver el requisito bloqueante más pequeño.

## Estado actual

CYCLE-001 se encuentra en `MVP_DESIGN`, dentro de la fase `Preparación del MVP`. Su siguiente puerta es `READY_TO_RUN`; las condiciones pendientes se mantienen en el ciclo activo y en `STATE.md`.
