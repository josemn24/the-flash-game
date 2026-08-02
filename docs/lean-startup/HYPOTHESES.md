# Hipótesis

## Cómo utilizar este documento

Las hipótesis representan creencias importantes que deben comprobarse antes de tomar decisiones relevantes. El detalle de cambios, evidencia y decisiones vive en su ciclo relacionado; aquí solo se mantiene el resumen actual.

## Hipótesis activas

### HYP-001 — Participación recurrente en una competición asíncrona entre amistades

**Tipo:** Problema  
**Estado:** Borrador  
**Prioridad:** Alta  
**Incertidumbre:** Alta  
**Coste de estar equivocados:** Alto

**Hipótesis**

Creemos que un segmento inicial de grupos de amigos verá valor en coordinar y repetir desafíos breves asíncronos con una clasificación acumulada de temporada.

**Segmento**

TODO — Jose debe concretar un grupo inicial alcanzable, su contexto compartido y el modo de invitación ético.

**Problema**

TODO — confirmar que el segmento tiene interés real en una actividad competitiva recurrente que no requiera coincidir en tiempo real.

**Comportamiento esperado**

Tras aceptar participar en una temporada manual, las personas del grupo juegan voluntariamente más de un desafío dentro de su ventana disponible y consultan el resultado compartido. El número mínimo y el periodo se definirán antes de ejecutar.

**Base de la hipótesis**

### Hechos observados

- La PoC actual permite jugar desafíos individuales, pero no salas reales, usuarios, persistencia ni rankings compartidos. Fuentes: `README.md`, `docs/the-flash-poc.md`.

### Afirmaciones documentadas

- El loop previsto es sala privada → temporada → desafíos periódicos → ranking de temporada. Fuente: `docs/salas-y-temporadas.md`.

### Inferencias

- La repetición por parte de un grupo es un requisito previo más relevante que implementar la infraestructura que lo soportaría.

### Supuestos

- Un ranking acumulado y los desafíos asíncronos motivarán participación repetida en el segmento inicial.

**Evidencia que podría apoyarla**

- Comportamiento predefinido de participación repetida y consulta voluntaria de resultados por parte del segmento elegido, medido en una simulación manual.

**Evidencia que podría debilitarla**

- No aceptación, baja participación repetida o indiferencia observada ante el resultado compartido según umbrales definidos antes de ejecutar.

**Decisión que permitirá tomar**

Si conviene preparar un MVP social manual como siguiente vehículo de aprendizaje o revisar el segmento/problema antes de construir infraestructura.

**Ciclo relacionado**

`cycles/CYCLE-001.md`

## Hipótesis pendientes

- Ninguna todavía.

## Hipótesis cerradas

- Ninguna todavía.
