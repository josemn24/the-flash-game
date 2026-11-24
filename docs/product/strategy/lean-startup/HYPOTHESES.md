# Hipótesis

## Cómo utilizar este documento

Las hipótesis representan creencias importantes que deben comprobarse antes de tomar decisiones relevantes. El detalle de cambios, evidencia y decisiones vive en su ciclo relacionado; aquí solo se mantiene el resumen actual.

## Hipótesis activas

### HYP-001 — Participación recurrente en una competición asíncrona entre amistades

- **Tipo:** Problema
- **Estado:** Inconclusa (2026-11-24, por calidad del experimento)
- **Prioridad:** Alta
- **Incertidumbre:** Alta
- **Coste de estar equivocados:** Alto

**Hipótesis**

Creemos que un segmento inicial de grupos de amigos verá valor en coordinar y repetir desafíos breves asíncronos con una clasificación acumulada de temporada.

**Nota de clasificación**

Se mantiene como `Problema` por continuidad documental, aunque el comportamiento esperado también expresa una hipótesis de valor y uso recurrente. Esta ambigüedad no cambia la decisión ni el experimento de CYCLE-001.

**Segmento**

Tabarnia: cohorte de 14 amistades invitadas por Jose a una sala privada. Se fija la lista antes de enviar invitaciones; deben registrarse los 14 envíos antes de abrir la temporada. Cuentas de pruebas y organizador en su función operativa quedan fuera de la medición.

**Problema**

Confirmar si este grupo encuentra valor suficiente en una actividad competitiva recurrente que no exige coincidir en tiempo real.

**Comportamiento esperado**

Al menos ocho de las 14 personas invitadas completan voluntariamente seis o más de los nueve desafíos diarios, incluidos dos de los desafíos siete, ocho y nueve. Cada publicación tiene una ventana de 24 horas y un intento oficial. Quienes rechazan, no acceden o dejan de jugar siguen en el denominador; no se condiciona la métrica a aceptar la invitación.

El [contrato de CYCLE-001](cycles/CYCLE-001.md#7-contrato-de-medición), versión `tabarnia-daily-v2`, define finalización, corte, deduplicación, fuentes y tratamiento de datos faltantes. Una derrota reglamentaria cuenta como finalización; ensayo o abandono no. Ranking, disfrute y costes son contexto. El análisis combina datos de temporada y el expediente privado de invitaciones, incidencias y feedback. No hay un motor de evaluación Lean en la aplicación.

«Personas que vuelven» en el portal significa iniciar dos publicaciones distintas y no equivale
a la participación sostenida de esta hipótesis. La cobertura temporal y la reconstrucción del corte
deben verificarse con las fuentes detalladas; los CSV comunes por sí solos no completan ese análisis.

**Base de la hipótesis**

### Hechos observados

- La aplicación actual permite jugar desafíos individuales y dispone además de un vehículo técnico
  persistido localmente con Auth, salas, publicaciones, intentos, rankings y portal privado. Fuentes:
  `../../../../README.md`, `../../../current/status.md`.
- Estas capacidades técnicas permiten preparar la alpha, pero no demuestran por sí mismas participación
  recurrente, valor percibido ni deseo de volver.

### Afirmaciones documentadas

- El loop previsto es sala privada → temporada → desafíos periódicos → ranking de temporada. Fuente histórica: [salas y temporadas](../../../archive/salas-y-temporadas.md).

### Inferencias

- La repetición por parte de un grupo es la incertidumbre principal que debe medirse con la alpha técnica prevista.

### Supuestos

- Un ranking acumulado y los desafíos asíncronos motivarán participación repetida en el segmento inicial.

**Evidencia que podría apoyarla**

- Ocho o más personas cumplen la definición de participación sostenida de CYCLE-001.

**Evidencia que podría debilitarla**

- Cuatro o menos personas cumplen esa definición.

**Resultado inconcluso**

Entre cinco y siete personas cumplen la definición, o problemas de calidad del experimento impiden clasificarlo según el contrato. Los umbrales se fijan antes de observar resultados; no prueban demanda fuera de esta cohorte ni sostenibilidad a largo plazo.

**Resultado de CYCLE-001 (2026-11-24)**

La temporada se ejecutó en staging con la cohorte de 14 personas invitadas. `R = 12/14`: once personas completaron los nueve desafíos y una completó siete con dos de los tres últimos. Numéricamente supera el umbral de apoyo.

La hipótesis queda `Inconclusa` por calidad del experimento: el calendario se adaptó durante la ejecución (15 días con huecos en lugar de nueve ventanas consecutivas de 24 h) y el protocolo no se congeló. La cadencia diaria que exige la hipótesis no se probó. Lo observado es una señal fuerte de recurrencia en esta cohorte con cadencia flexible decidida por el organizador. Detalle en [CYCLE-001, secciones 12–14](cycles/CYCLE-001.md#12-resultados-observados).

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

**Señales exploratorias de CYCLE-001.** En Telegram, 6/6 personas eligieron tableros de lógica y 4/6 eligieron Alfabeto temático. Los mismos 13 jugadores completaron ambos Alfabetos. `Cumbre lógica` recibió 3/8 votos como favorita y 5/9 como la menos gustada. Estas señales orientan qué comparar, y los efectos de la mecánica, el tema, la dificultad y la eliminación siguen abiertos. [Resultados del ciclo](cycles/CYCLE-001.md#opiniones-declaradas).

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
- **Desconocido actual:** esfuerzo real, incidencias y capacidad de mantener la operación. CYCLE-001 aporta contexto: el organizador ajustó el calendario a mano según su disponibilidad. Los minutos y costes del expediente externo no se han registrado todavía.
- **Ciclo relacionado:** Ninguno.

### HYP-006 — Fiabilidad técnica del vehículo mínimo

- **Tipo:** Técnica
- **Estado:** Borrador
- **Hipótesis candidata:** el vehículo mínimo puede permitir el acceso privado, ejecutar los desafíos y registrar participación, resultados y ranking con fiabilidad suficiente para aprender.
- **Contexto de staging:** 111 de 112 intentos iniciados por la cohorte terminaron, con un abandono por inactividad. Trece respuestas de texto corto se recalificaron a acierto por variantes válidas. Hubo 86 recepciones marcadas por vencimiento y la extracción carece del tiempo del cliente para verificar el reloj visible. [Anomalías del ciclo](cycles/CYCLE-001.md#anomalías).
- **Desconocido actual:** la frecuencia y el alcance de incidencias en los dispositivos utilizados, la coherencia de los relojes cerca del plazo y la cobertura del registro externo de incidencias.
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

- Ninguna. HYP-001 tiene una clasificación `Inconclusa` en CYCLE-001, pero sigue abierta hasta registrar la decisión estratégica del ciclo.
