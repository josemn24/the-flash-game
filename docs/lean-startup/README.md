# Lean Startup

## Propósito

Esta carpeta ayuda a decidir qué aprender antes de ampliar The Flash. La unidad de progreso es el aprendizaje obtenido, no las funcionalidades, el código ni el número de documentos.

## Relación con el proyecto existente

El repositorio contiene una PoC frontend para jugar desafíos individuales. Este sistema mantiene separadas esa realidad técnica y las hipótesis sobre el producto social y persistente que se quiere explorar.

## Principios de trabajo

- Trabajar desde una decisión pendiente hacia la evidencia necesaria.
- Tratar las creencias como hipótesis refutables y fijar métricas y umbrales antes de observar resultados.
- Usar el MVP solo como vehículo de aprendizaje; no construir producto futuro por anticipado.
- Registrar comportamientos observables por separado de opiniones, conservar resultados negativos y declarar lo inconcluso cuando corresponda.
- Mantener una única acción inmediata y un solo ciclo activo.

## Estructura documental

- `VISION.md`: cambio deseado y límites relativamente estables.
- `STRATEGY.md`: apuestas vigentes, alcance de aprendizaje y principales incertidumbres modificables.
- `STATE.md`: fotografía breve del aprendizaje actual y enlace al único ciclo activo.
- `HYPOTHESES.md`: resumen vivo de las hipótesis y su estado.
- `cycles/`: historial detallado e inmutable de los ciclos.
- `templates/CYCLE.md`: plantilla manual para el siguiente ciclo.
- `AGENTS.md`: protocolo operativo para facilitar ciclos sin saltar pasos.
- `STARTER_PROMPT.md`: prompt copiable para iniciar un nuevo chat con un agente.
- `METHOD.md`: explicación del método y relación entre los documentos.

## Modos de funcionamiento

- **Instalación inicial:** si no hay un sistema funcional, se crea la estructura mínima, una visión provisional, hipótesis iniciales y un ciclo.
- **Continuación:** se lee primero `STATE.md`, después la visión, hipótesis y ciclo activo; se actualiza solo lo afectado y se conserva el historial.

## Cómo utilizar el sistema

1. Revisar `STATE.md`.
2. Consultar `VISION.md`.
3. Consultar `STRATEGY.md`.
4. Revisar `HYPOTHESES.md`.
5. Abrir el ciclo activo.
6. Definir la decisión.
7. Formular la pregunta de aprendizaje.
8. Seleccionar la hipótesis crítica.
9. Definir evidencia, métricas y umbrales.
10. Diseñar el experimento y el MVP mínimo.
11. Ejecutar el experimento.
12. Registrar resultados.
13. Analizar el aprendizaje.
14. Tomar una decisión.
15. Actualizar estrategia, hipótesis y estado.
16. Iniciar el siguiente ciclo.

## Ciclo de aprendizaje

El diseño comienza en sentido inverso: Decidir → Aprender → Hipótesis → Evidenciar → Medir → Experimentar → Crear.

La ejecución sigue Crear → Medir → Aprender. Si faltan datos para fijar un umbral, se registra `TODO` antes de ejecutar: no se ajusta después al resultado. `AGENTS.md` define las comprobaciones obligatorias para mantener este orden.

## Estados de las hipótesis

`Borrador` → `Priorizada` → `En prueba` → `Apoyada` / `Debilitada` / `Refutada` / `Inconclusa`.

También puede usarse `Archivada` cuando ya no sea relevante. «Apoyada» no significa demostrada para siempre.

## Cómo comenzar

Abra `STATE.md` y ejecute únicamente la acción indicada allí. Complete los datos mínimos que permitan convertir la hipótesis crítica en un experimento con comportamiento observable y umbrales previos.

Para una persona que quiera comprender el sistema, consulte `METHOD.md`. Para empezar un chat nuevo con un agente, copie `STARTER_PROMPT.md`; el agente deberá seguir `AGENTS.md`.

## Qué no incluye esta versión

Esta carpeta dirige decisiones mediante aprendizaje validado, pero no sustituye la documentación técnica, el roadmap, el sistema de tareas ni la analítica. No modifica el producto por sí sola ni automatiza la ejecución de experimentos. Tampoco incorpora scripts, validadores, dashboards, bases de datos, integraciones ni agentes autónomos.
