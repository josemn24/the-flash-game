# CYCLE-001 — ¿Existe participación repetida en la alpha social asíncrona?

## Estado del ciclo

- **Estado:** Planificación
- **Estado de máquina:** MVP_DESIGN
- **Siguiente puerta:** READY_TO_RUN
- **Condición de avance:** vehículo preparado, medición verificable y criterios de la puerta `READY_TO_RUN` completos.
- **Responsable:** Jose Moreno
- **Fecha de inicio:** Pendiente
- **Fecha de revisión:** Al finalizar la temporada alpha

## 1. Contexto

### Hechos observados

- La PoC tiene desafíos individuales jugables, una sala demo y una temporada mock locales. Fuente: `../../the-flash-poc.md`.
- No hay usuarios, creación o unión a salas, persistencia, backend, autenticación ni rankings compartidos. Fuentes: `../../../README.md`, `../../the-flash-poc.md`.
- No hay resultados de investigación o experimentos Lean disponibles en la documentación revisada.

### Afirmaciones documentadas

- El producto previsto organiza grupos privados en temporadas con desafíos periódicos asíncronos y ranking acumulado. Fuente: `../../salas-y-temporadas.md`.
- El contexto inicial describió una alpha técnica con Tabarnia de hasta once amistades. El diseño actual fija once invitaciones antes de ejecutar. Fuente: contexto de producto proporcionado y sección 7 de este ciclo.

### Inferencias

- Una alpha técnica mínima puede medir directamente la participación repetida en el loop previsto sin ampliar todavía el producto a más salas o funciones sociales.

### Supuestos

- Tabarnia aceptará de forma voluntaria una invitación ética a una temporada privada.
- Los desafíos mentales breves y variados, el calendario compartido y el ranking acumulado generarán interés suficiente para volver.

## 2. Decisión que necesitamos tomar

¿La evidencia de la alpha justificará PERSEVERAR con una segunda temporada del mismo loop social antes de ampliar The Flash?

## 3. Pregunta de aprendizaje

¿Tabarnia participa voluntariamente de forma repetida en una temporada alpha técnica de desafíos compartidos y asíncronos?

## 4. Hipótesis crítica

**Referencia:** HYP-001

Creemos que Tabarnia verá valor en repetir desafíos mentales breves asíncronos con una clasificación acumulada de temporada.

## 5. Por qué esta hipótesis es prioritaria

- Contiene incertidumbre alta sobre el problema y el comportamiento del grupo inicial.
- Si fuera falsa, ampliar salas, temporadas o funciones sociales no resolvería la falta de participación recurrente.
- La alpha puede obtener evidencia con el producto social previsto y un alcance técnico limitado.

## 6. Evidencia necesaria

### Evidencia que apoyaría la hipótesis

- Al menos seis de las once personas invitadas completan cinco o más desafíos.

### Evidencia que debilitaría la hipótesis

- Tres o menos personas invitadas completan cinco o más desafíos.

### Resultado inconcluso

- Cuatro o cinco personas invitadas completan cinco o más desafíos.
- La convocatoria, el registro de datos o un fallo técnico relevante impiden atribuir el comportamiento al loop evaluado.

## 7. Métrica y umbrales

Definidos antes de ejecutar el experimento. La consulta social se registra como contexto, pero no cambia la clasificación de HYP-001 en este ciclo.

### Métrica principal

**Nombre:** participación recurrente de temporada.
**Definición:** número de personas invitadas que completan cinco o más de los nueve desafíos, dividido entre las once invitaciones efectivamente enviadas.
**Forma de cálculo:** `participantes con >= 5 desafíos completados / 11`.

### Umbral de éxito

Seis o más personas invitadas completan cinco o más desafíos.

### Umbral de fracaso

Tres o menos personas invitadas completan cinco o más desafíos.

### Resultado inconcluso

Cuatro o cinco personas invitadas completan cinco o más desafíos, o existe una incidencia relevante de convocatoria, medición o estabilidad técnica.

### Origen del umbral

Decisión provisional de producto fijada antes de observar resultados. Busca una mayoría activa sin interpretar como fracaso una ausencia puntual en una primera alpha cerrada.

### Condición de cohorte

Antes de iniciar, deben enviarse exactamente once invitaciones a la cohorte fijada. Si no es posible, el experimento no se inicia: se revisan muestra, cálculo y umbrales antes de observar resultados.

### Métricas auxiliares

- Activación: personas invitadas que completan el primer desafío.
- Finalización: personas invitadas que completan el noveno desafío.
- Consulta social: visualizaciones, consultas o reacciones al ranking acumulado; evidencia contextual, no criterio de HYP-001.
- Abandono: momento y motivo conocido de dejar de participar.
- Calidad por desafío: inicio, finalización, tiempo, puntuación, abandono y feedback cualitativo.

## 8. Experimento

### Descripción

Ejecutar una temporada alpha técnica en una sala privada de Tabarnia. Se enviarán once invitaciones a la cohorte fijada. La aceptación real de la invitación se registrará como dato; no se presupone que todas las personas participen.

Antes de iniciar la alpha, dos amistades realizarán una prueba individual cualitativa de los desafíos seleccionados. Esta puerta previa sirve para corregir problemas evidentes de claridad o calidad; no constituye un ciclo Lean independiente ni evidencia de demanda.

### Método

- Una única sala privada y una única temporada.
- Nueve desafíos preconfigurados, publicados uno cada dos días.
- Cada desafío estará disponible durante 24 horas y admitirá un único intento por participante.
- La temporada tendrá una duración prevista de 17 días.
- Al cerrar cada intento, se guardará la puntuación comparable y se actualizará el ranking acumulado.

### Segmento participante

Tabarnia: once amistades de la cohorte fijada, invitadas éticamente por Jose.

### Duración máxima

Diecisiete días desde la publicación del primer desafío hasta el cierre del noveno.

### Número mínimo de observaciones

Once personas invitadas y nueve oportunidades de participación por persona. La métrica principal se evaluará contra las once invitaciones para preservar el efecto de aceptación y retención.

### Riesgos y sesgos

- Sesgo de conveniencia: las personas conocen al responsable.
- La muestra es pequeña y no representa el mercado general.
- El interés inicial puede deberse a la relación personal, no al producto.
- Un desafío ambiguo, una puntuación percibida como injusta o un fallo técnico puede reducir participación sin invalidar por sí solo el loop social.

## 9. MVP o vehículo experimental

### Propósito

Observar la participación repetida en la experiencia social asíncrona prevista con el mínimo producto técnico necesario.

### Elementos imprescindibles

- Identidad sencilla, invitación y acceso a una sala privada.
- Una temporada activa con programación de desafíos.
- Un intento por desafío, puntuación comparable y ranking acumulado.
- Registro de participación, finalización y consulta de resultados.

### Elementos reutilizables del producto actual

- Los desafíos jugables individuales de la PoC.
- Los modelos conceptuales de sala, temporada y publicación ya documentados.

### Elementos que no deben construirse

- Creación libre de salas, chat, perfiles avanzados, ranking global o notificaciones sofisticadas.
- Conquista, geolocalización o enfoque educativo.
- Nuevos sistemas o formatos que no sean necesarios para los nueve desafíos seleccionados.

### Criterio para detener la preparación

Detener la preparación cuando la prueba individual no revele bloqueos de claridad o calidad y la alpha pueda registrar la métrica principal y sus métricas auxiliares de forma fiable.

## 10. Plan de ejecución

1. Seleccionar los nueve desafíos y registrarlos antes de la prueba individual.
2. Probarlos individualmente con dos amistades y registrar bloqueos de claridad o calidad separados de la evidencia de HYP-001.
3. Corregir solo los bloqueos que impidan medir de forma fiable y preparar la sala, la temporada y el registro de métricas.
4. Fijar la cohorte y enviar exactamente once invitaciones; si no es posible, revisar el diseño antes de ejecutar.
5. Ejecutar los nueve desafíos, registrar resultados, analizar umbrales y tomar una única decisión estratégica.

## 11. Resultados observados

**Estado:** Pendiente de ejecución

### Datos

Pendiente.

### Comportamientos observados

Pendiente.

### Opiniones declaradas

Pendiente.

### Métrica obtenida

Pendiente.

### Anomalías

Pendiente.

### Datos faltantes

Pendiente.

### Desviaciones del experimento

Pendiente.

## 12. Análisis del aprendizaje

**Estado:** Pendiente

### Comparación con los umbrales

Pendiente.

### Evidencia que apoya la hipótesis

Pendiente.

### Evidencia que debilita la hipótesis

Pendiente.

### Explicaciones alternativas

Pendiente.

### Sesgos y limitaciones

Pendiente.

### Clasificación de la hipótesis

Pendiente: Apoyada, Debilitada, Refutada o Inconclusa.

### Qué hemos aprendido

Pendiente.

### Qué no podemos afirmar

Pendiente.

### Nivel de confianza

Pendiente.

## 13. Calidad del experimento

Si el diseño no permite aprendizaje fiable, decidir explícitamente si hay que repetir, reparar, ampliar la muestra, modificar la medición o declarar el resultado inconcluso antes de valorar la estrategia.

## 14. Decisión estratégica

**Decisión estratégica:** Pendiente — seleccionar una única opción: PERSEVERAR, PIVOTAR o PARAR.

Un resultado defectuoso no implica por sí solo pivotar o parar. Si se recomienda PIVOTAR, documentar la señal suficiente, el elemento que cambia, la visión conservada, la nueva hipótesis, el siguiente experimento y el criterio para volver a pivotar o parar.

## 15. Próxima incertidumbre

Qué formatos, reglas de puntuación y ajustes de cadencia sostienen mejor la participación tras la primera temporada.

## 16. Próxima acción

Seleccionar y registrar los nueve desafíos candidatos para la alpha de Tabarnia.

## 17. Documentos que deben actualizarse

Cuando el ciclo avance, actualiza:

- `../STATE.md`;
- `../STRATEGY.md` si cambian las apuestas vigentes;
- `../HYPOTHESES.md`;
- este documento.
