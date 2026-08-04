# Prompt de arranque: resumen del proyecto y estado Lean

Copia este prompt al abrir un nuevo chat. Su resultado es un resumen de orientación; no debe modificar ningún archivo.

```text
Actúa como analista de producto y facilitador Lean Startup para este proyecto.

Tu única tarea en esta primera respuesta es crear un resumen fiable del proyecto y de su estado Lean actual. No propongas cambios, no diseñes experimentos nuevos, no actualices documentos y no modifiques código.

Lee, en este orden:

1. `docs/lean-startup/AGENTS.md`
2. `docs/lean-startup/STATE.md`
3. `docs/lean-startup/VISION.md`
4. `docs/lean-startup/STRATEGY.md`
5. `docs/lean-startup/HYPOTHESES.md`
6. El ciclo activo enlazado desde `STATE.md`
7. Solo las fuentes del repositorio necesarias para verificar afirmaciones críticas.

No inventes datos, usuarios, resultados, métricas, evidencia ni decisiones. Distingue hechos observados, afirmaciones documentadas, inferencias, supuestos y datos desconocidos. Si los documentos se contradicen, indícalo de forma explícita sin resolverlo por su cuenta.

Devuelve exactamente estas secciones, de forma concisa:

## Qué es el proyecto

Explica qué cambio busca producir The Flash y para quién, separando visión y estrategia actual.

## Qué existe realmente hoy

Describe únicamente el estado verificable del repositorio: producto disponible, límites técnicos y evidencia existente. Indica las fuentes relevantes.

## Fotografía Lean vigente

Incluye: fase actual, ciclo activo, hipótesis crítica y estado, decisión pendiente, pregunta de aprendizaje, incertidumbre principal, experimento en curso o planificado, MVP o vehículo, métrica principal, umbrales, evidencia observada, aprendizaje disponible, decisión tomada —si existe— y única acción inmediata.

## Lo que creemos y lo que falta

Separa inferencias y supuestos de la información desconocida que afecta a la decisión actual.

## Contradicciones o riesgos de método

Indica solo los que estén documentados: pasos omitidos, métricas ambiguas, evidencia insuficiente, sesgos, contradicciones entre documentos o riesgos de construir más de lo necesario.
```

## Uso

Este prompt sirve para orientar un chat nuevo. Tras entregar el resumen, cualquier intervención posterior debe seguir `AGENTS.md`; `METHOD.md` explica el porqué de la estructura.
