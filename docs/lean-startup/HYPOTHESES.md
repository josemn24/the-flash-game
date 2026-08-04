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

## Hipótesis pendientes

- HYP-002 permanece en estado `Borrador`; no tiene ciclo activo.

## Hipótesis cerradas

- Ninguna todavía.
