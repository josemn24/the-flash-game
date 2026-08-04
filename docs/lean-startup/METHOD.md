# Método Lean Startup en esta carpeta

## Propósito

Lean Startup no consiste en producir más documentos ni en convertir cada idea en una funcionalidad. Su propósito aquí es reducir incertidumbres importantes mediante ciclos de aprendizaje que sustentan decisiones de producto.

La unidad de progreso es el aprendizaje que cambia o mantiene una decisión con una confianza explícita.

## Dos órdenes complementarios

La planificación se diseña hacia atrás desde una decisión:

```text
Decidir → Aprender → Hipótesis → Evidenciar → Medir → Experimentar → Crear
```

La ejecución del vehículo experimental avanza hacia delante:

```text
Crear → Medir → Aprender
```

Diseñar primero evita construir una solución sin saber qué comportamiento tendría que observarse para justificarla. Ejecutar después produce la evidencia definida, no evidencia elegida retrospectivamente.

## Elementos del ciclo

| Elemento | Pregunta que responde | Documento principal |
| --- | --- | --- |
| Visión | ¿Qué cambio queremos producir y qué principios se mantienen? | `VISION.md` |
| Estrategia | ¿Qué apuestas modificables estamos haciendo ahora? | `STRATEGY.md` |
| Estado | ¿Dónde estamos, qué incertidumbre domina y qué se hace ahora? | `STATE.md` |
| Hipótesis | ¿Qué creencia crítica puede estar equivocada? | `HYPOTHESES.md` |
| Ciclo | ¿Qué decisión, evidencia, métrica, experimento y aprendizaje sostienen la apuesta? | `cycles/CYCLE-XXX.md` |
| Máquina de estados | ¿Qué puerta debe cumplirse antes de avanzar? | `STATE_MACHINE.md` |
| Protocolo | ¿Cómo debe actuar quien facilita el proceso? | `AGENTS.md` |
| Historial | ¿Qué ocurrió y por qué se tomó una decisión anterior? | ciclos cerrados |

La visión no se usa para justificar cualquier solución. La estrategia contiene segmento, problema, propuesta de valor, canal y vehículo actuales; puede cambiar cuando la evidencia lo requiera.

## Cómo formular un ciclo

1. **Decidir.** Formular una elección concreta que dependa de aprendizaje, no una lista de funcionalidades.
2. **Aprender.** Convertir la decisión en una pregunta respondible mediante comportamiento o evidencia observable.
3. **Hipótesis.** Expresar la creencia crítica como una relación entre segmento, problema o comportamiento esperado.
4. **Evidenciar.** Definir qué datos apoyarían, debilitarían o dejarían inconclusa la hipótesis.
5. **Medir.** Fijar una métrica, denominador, umbrales y origen de los umbrales antes de observar resultados.
6. **Experimentar.** Elegir el experimento más pequeño que pueda producir esa medición y reconocer sus sesgos.
7. **Crear.** Preparar únicamente el MVP, prototipo o mecanismo manual imprescindible para ejecutar el experimento de forma fiable.
8. **Aprender y decidir.** Comparar resultados con los umbrales, evaluar la calidad del experimento y elegir `PERSEVERAR`, `PIVOTAR` o `PARAR` cuando proceda.

Si el experimento no produce evidencia fiable, primero se decide si hay que repararlo, repetirlo, ampliar la muestra, modificar la medición o declararlo inconcluso. Eso no es automáticamente un pivot.

## Tipos de información

- **Hecho observado:** información verificable en el repositorio o mediante medición.
- **Afirmación documentada:** declaración existente que aún puede requerir validación.
- **Opinión declarada:** percepción expresada por una persona; no demuestra comportamiento.
- **Inferencia:** interpretación razonable de hechos o afirmaciones.
- **Supuesto:** creencia no probada que puede importar para una decisión.
- **Hipótesis:** supuesto preparado para someterse a evidencia previa.
- **Evidencia:** observación obtenida por el experimento según sus criterios definidos.
- **Decisión:** elección explícita que explica qué evidencia la justifica y qué no permite concluir.

Separar estas categorías evita tratar una intención, una opinión positiva o una afirmación técnica como aprendizaje validado.

## Calidad de la evidencia

Las métricas útiles están vinculadas a una decisión y describen comportamientos observables. Los contadores que no cambiarían una decisión son métricas de vanidad.

Los umbrales no se modifican después de obtener datos. Los resultados negativos, anomalías, datos faltantes y limitaciones se conservan en el ciclo para que una decisión posterior pueda revisarse sin reescribir la historia.

## Estados y conservación del historial

Una hipótesis avanza normalmente de `Borrador` a `Priorizada`, luego a `En prueba`, y finalmente a `Apoyada`, `Debilitada`, `Refutada` o `Inconclusa`. También puede quedar `Archivada` si deja de ser relevante. «Apoyada» no significa demostrada para siempre.

`STATE.md` es una fotografía actual, no un diario. `HYPOTHESES.md` es un resumen vivo. Los ciclos cerrados contienen el historial detallado de razonamiento, evidencia y decisiones; no se borran ni se alteran retrospectivamente.

La fase breve de `STATE.md` se complementa con el estado detallado de `STATE_MACHINE.md`. La máquina no añade trabajo por sí misma: evita saltar de diseño a ejecución sin cumplir las condiciones de transición, especialmente la puerta `READY_TO_RUN`.

Cada estado deja una salida verificable en los documentos existentes: documento vivo, diseño congelable o registro histórico. La salida no sustituye el criterio de avance; ambos se describen en `STATE_MACHINE.md` para conservar trazabilidad sin crear un archivo por estado.

## Uso práctico

Para facilitar una intervención, seguir `AGENTS.md`. Para iniciar un chat nuevo, copiar `STARTER_PROMPT.md`. Para entender el estado de la apuesta actual, empezar siempre por `STATE.md` y consultar después `STATE_MACHINE.md`.
