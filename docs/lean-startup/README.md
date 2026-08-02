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
- `STATE.md`: fotografía breve del aprendizaje actual y enlace al único ciclo activo.
- `HYPOTHESES.md`: resumen vivo de las hipótesis y su estado.
- `cycles/`: historial detallado e inmutable de los ciclos.
- `templates/CYCLE.md`: plantilla manual para el siguiente ciclo.

## Modos de funcionamiento

- **Instalación inicial:** si no hay un sistema funcional, se crea la estructura mínima, una visión provisional, hipótesis iniciales y un ciclo.
- **Continuación:** se lee primero `STATE.md`, después la visión, hipótesis y ciclo activo; se actualiza solo lo afectado y se conserva el historial.

## Cómo utilizar el sistema

1. Revisar `STATE.md`.
2. Consultar `VISION.md`.
3. Revisar `HYPOTHESES.md`.
4. Abrir el ciclo activo.
5. Definir la decisión.
6. Formular la pregunta de aprendizaje.
7. Seleccionar la hipótesis crítica.
8. Diseñar el experimento.
9. Definir evidencia, métricas y umbrales.
10. Ejecutar el experimento.
11. Registrar resultados.
12. Analizar el aprendizaje.
13. Tomar una decisión.
14. Actualizar el estado.
15. Iniciar el siguiente ciclo.

## Ciclo de aprendizaje

Decisión → aprendizaje necesario → hipótesis → evidencia → experimento → MVP → resultados → aprendizaje → decisión → siguiente acción.

La ejecución sigue Crear → Medir → Aprender. Si faltan datos para fijar un umbral, se registra `TODO` antes de ejecutar: no se ajusta después al resultado.

## Estados de las hipótesis

`Borrador` → `Priorizada` → `En prueba` → `Apoyada` / `Debilitada` / `Refutada` / `Inconclusa`.

También puede usarse `Archivada` cuando ya no sea relevante. «Apoyada» no significa demostrada para siempre.

## Cómo comenzar

Abra `STATE.md` y ejecute únicamente la acción indicada allí. Complete los datos mínimos que permitan convertir la hipótesis crítica en un experimento con comportamiento observable y umbrales previos.

## Qué no incluye esta versión

Esta carpeta dirige decisiones mediante aprendizaje validado, pero no sustituye la documentación técnica, el roadmap, el sistema de tareas ni la analítica. No modifica el producto por sí sola ni automatiza la ejecución de experimentos. Tampoco incorpora scripts, validadores, dashboards, bases de datos, integraciones ni agentes autónomos.
