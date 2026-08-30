# Hipótesis

## Cómo utilizar este documento

Las hipótesis representan creencias importantes que deben comprobarse antes de tomar decisiones relevantes. El detalle de cambios, evidencia y decisiones vive en su ciclo relacionado; aquí solo se mantiene el resumen actual.

## Hipótesis activas

### HYP-001 — Participación recurrente en una competición asíncrona entre amistades

- **Tipo:** Problema
- **Estado:** Priorizada
- **Prioridad:** Alta
- **Incertidumbre:** Alta
- **Coste de estar equivocados:** Alto

**Hipótesis**

Creemos que un segmento inicial de grupos de amigos verá valor en coordinar y repetir desafíos breves asíncronos con una clasificación acumulada de temporada.

**Nota de clasificación**

Se mantiene como `Problema` por continuidad documental, aunque el comportamiento esperado también expresa una hipótesis de valor y uso recurrente. Esta ambigüedad no cambia la decisión ni el experimento de CYCLE-001.

**Segmento**

Tabarnia: cohorte prevista de once amistades a quienes Jose puede invitar éticamente a una sala privada de la primera alpha. La cohorte debe fijarse antes de ejecutar.

**Problema**

Confirmar si este grupo encuentra valor suficiente en una actividad competitiva recurrente que no exige coincidir en tiempo real.

**Comportamiento esperado**

Tras aceptar participar en la alpha, las personas juegan voluntariamente al menos cinco de los nueve desafíos disponibles durante 24 horas cada dos días. La consulta o reacción al ranking se registra como métrica auxiliar, no como criterio de clasificación de esta hipótesis.

**Base de la hipótesis**

### Hechos observados

- La PoC actual permite jugar desafíos individuales, pero no salas reales, usuarios, persistencia ni rankings compartidos. Fuentes: `README.md`, `docs/the-flash-poc.md`.

### Afirmaciones documentadas

- El loop previsto es sala privada → temporada → desafíos periódicos → ranking de temporada. Fuente: `docs/salas-y-temporadas.md`.

### Inferencias

- La repetición por parte de un grupo es la incertidumbre principal que debe medirse con la alpha técnica prevista.

### Supuestos

- Un ranking acumulado y los desafíos asíncronos motivarán participación repetida en el segmento inicial.

**Evidencia que podría apoyarla**

- Al menos seis de las once personas invitadas completan cinco o más desafíos.

**Evidencia que podría debilitarla**

- Tres o menos personas invitadas completan cinco o más desafíos.

**Decisión que permitirá tomar**

Si la evidencia justifica PERSEVERAR con una segunda temporada del mismo loop social o si, tras revisar la calidad del experimento, hay que reconsiderar estrategia antes de ampliar el producto.

**Ciclo relacionado**

`cycles/CYCLE-001.md`

### HYP-002 — Preferencia y contribución de modos y formatos

- **Tipo:** Valor / uso
- **Estado:** Borrador
- **Prioridad:** Pendiente de priorización después de CYCLE-001
- **Incertidumbre:** Desconocida
- **Coste de estar equivocados:** No evaluado

**Hipótesis candidata**

Creemos que determinados modos y formatos de desafío generan más activación, finalización y repetición que otros dentro de una competición asíncrona.

**Estado metodológico**

No está seleccionada como hipótesis crítica ni tiene todavía decisión, experimento, población, métrica principal o umbrales propios. En CYCLE-001 solo puede observarse de forma exploratoria, sin cambiar la decisión principal sobre recurrencia.

La encuesta post-temporada prevista en CYCLE-001 podrá aportar opiniones declaradas para esta hipótesis, pero no demostrará por sí sola preferencia ni intención de repetición.

**Qué tendría que definirse antes de probarla**

- Qué decisión concreta desbloquea.
- Qué significa «mejor» entre modos y formatos.
- Qué comportamiento observable se comparará.
- Qué condiciones deben mantenerse equivalentes.
- Métrica principal, denominador, ventana, umbrales y resultado inconcluso.

**Ciclo relacionado**

Ninguno todavía.

## Mapa de hipótesis candidatas

Estas hipótesis amplían el mapa de incertidumbres del proyecto, pero no son hipótesis activas ni abren ciclos adicionales. Todas permanecen en `Borrador` hasta que una decisión concreta justifique priorizarlas con evidencia, métrica y umbrales propios.

### HYP-003 — Segmento fuera de la cohorte inicial

- **Tipo:** Segmento
- **Estado:** Borrador
- **Hipótesis candidata:** otros grupos de amistades con contexto y necesidades similares a Tabarnia podrían participar recurrentemente en el loop social.
- **Desconocido actual:** si el comportamiento observado en Tabarnia sería transferible a otros grupos.
- **Ciclo relacionado:** Ninguno.

### HYP-004 — Canal de invitación directa

- **Tipo:** Canal
- **Estado:** Borrador
- **Hipótesis candidata:** la invitación directa y ética puede alcanzar y activar una cohorte inicial suficiente para una temporada privada.
- **Desconocido actual:** aceptación, activación y coste operativo de este canal fuera de la cohorte prevista.
- **Ciclo relacionado:** Ninguno; CYCLE-001 solo lo usa como supuesto operativo.

### HYP-005 — Viabilidad operativa de una temporada

- **Tipo:** Operativa
- **Estado:** Borrador
- **Hipótesis candidata:** una única persona responsable puede preparar, publicar, registrar y cerrar una temporada sin una carga que impida repetirla.
- **Desconocido actual:** esfuerzo real, incidencias y capacidad de mantener la operación.
- **Ciclo relacionado:** Ninguno.

### HYP-006 — Fiabilidad técnica del vehículo mínimo

- **Tipo:** Técnica
- **Estado:** Borrador
- **Hipótesis candidata:** el vehículo mínimo puede permitir el acceso privado, ejecutar los desafíos y registrar participación, resultados y ranking con fiabilidad suficiente para aprender.
- **Desconocido actual:** si la implementación prevista funcionará sin incidencias relevantes; la PoC actual no dispone de estas capacidades.
- **Ciclo relacionado:** CYCLE-001 la trata como condición de calidad del experimento, no como hipótesis principal.

### HYP-007 — Cumplimiento y expectativas sobre datos y resultados

- **Tipo:** Legal o regulatoria
- **Estado:** Borrador
- **Hipótesis candidata:** el acceso, registro y exposición de resultados de una sala privada pueden organizarse conforme a las obligaciones aplicables y a las expectativas de sus miembros.
- **Desconocido actual:** requisitos concretos antes de operar con cuentas, datos personales, comunicaciones o rankings reales.
- **Ciclo relacionado:** Ninguno; requiere revisión antes de escalar el uso.

### HYP-008 — Crecimiento más allá de la cohorte inicial

- **Tipo:** Crecimiento
- **Estado:** Borrador
- **Hipótesis candidata:** la participación recurrente podría generar invitaciones, recomendaciones o nuevas salas sin depender exclusivamente del responsable inicial.
- **Desconocido actual:** si existe expansión orgánica y qué comportamiento la produciría.
- **Ciclo relacionado:** Ninguno.

### HYP-009 — Sostenibilidad económica

- **Tipo:** Ingresos
- **Estado:** Borrador
- **Hipótesis candidata:** existiría una forma de capturar valor económico compatible con la visión y suficientemente atractiva para el segmento.
- **Desconocido actual:** quién pagaría, por qué propuesta y bajo qué modelo.
- **Ciclo relacionado:** Ninguno.

## Hipótesis pendientes

- HYP-002 permanece en estado `Borrador`; no tiene ciclo activo.
- HYP-003 a HYP-009 permanecen en estado `Borrador`; no tienen ciclo activo.

## Hipótesis cerradas

- Ninguna todavía.
