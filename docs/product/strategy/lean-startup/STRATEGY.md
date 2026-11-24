# Estrategia actual

## Estado de la estrategia

Provisional. [CYCLE-001](cycles/CYCLE-001.md#15-decisión-estratégica) se cerró el 2026-11-24 con `PERSEVERAR`. [CYCLE-002](cycles/CYCLE-002.md) prepara Tabarnia 2. HYP-001 quedó `Inconclusa` para el protocolo diario y HYP-010 examina la repetición entre temporadas.

## Objetivo estratégico actual

Comprobar si la cohorte de Tabarnia vuelve a jugar una segunda temporada asíncrona de nueve días consecutivos con el calendario fijado antes de empezar. Medir el trabajo de preparación y operación para decidir si procede probar el paquete con otro anfitrión y qué conviene simplificar primero.

## Segmento

Tabarnia 2 se dirige a la misma cohorte de 14 amistades invitadas por Jose a la primera alpha. La cuenta operativa con rol `owner` queda excluida de la medición.

**Estado de evidencia:** observado en una temporada. 12 de 14 personas mantuvieron participación según la definición de CYCLE-001, con cadencia flexible. No prueba transferencia a otros grupos.

## Problema

Comprobar si este grupo encuentra valor suficiente para volver a una actividad competitiva asíncrona en otra temporada.

**Estado de evidencia:** hay recurrencia dentro de Tabarnia 1 y preferencias declaradas de una parte del grupo. La repetición en otra temporada es el comportamiento pendiente de observar.

## Propuesta de valor

Desafíos mentales breves, variados y comparables que permiten competir con amistades en una ventana compartida y seguir una puntuación acumulada de temporada.

**Estado de evidencia:** comportamiento repetido observado en una temporada de Tabarnia con cadencia flexible; no aísla qué elemento de la propuesta lo produce.

## Solución o vehículo actual

Tabarnia 2 usará la sala privada y el ranking acumulado con un intento por participante y publicación. Habrá nueve ventanas consecutivas de 24 horas, con dos Flash y dos Alfabetos de cultura general, dos Contrarrelojes y dos Tableros únicos de lógica y una Pirámide especial de lógica el día 5. El organizador prepara el calendario completo desde el portal y usa plantillas y contenido revisado donde encajen. [Diseño de Tabarnia 2](cycles/CYCLE-002.md#calendario-y-mezcla-de-modos).

El repositorio ya aporta Auth, salas, temporadas, publicaciones, intentos, rankings, programación
local, portal privado y varios recorridos server-side sobre Supabase. La temporada de Tabarnia se
jugó en staging con nueve desafíos de cinco modos distintos. El detalle está en la sección 12 de
CYCLE-001.

El alcance técnico actual está en [el README del proyecto](../../../../README.md) y [el estado de la aplicación](../../../current/status.md).

## Medición y decisión

Tabarnia es una sala más: utiliza la misma captura automática por temporada que las demás salas. Los criterios se definen antes de observar resultados y se aplican en la fase posterior de análisis; no configuran el producto ni condicionan técnicamente la apertura de temporadas.

El [contrato de medición de CYCLE-002](cycles/CYCLE-002.md#7-métrica-y-umbrales) cuenta a quienes completan seis o más desafíos, incluidos al menos dos de los tres últimos, sobre las 14 personas de la cohorte inicial. El denominador incluye a quienes declinen o no vuelvan a jugar.

- Ocho o más: apoyo a HYP-010 en esta cohorte y temporada.
- Cuatro o menos: debilitamiento.
- Entre cinco y siete, o datos cuya incertidumbre cruce categorías: inconclusión.

Son criterios de producto para esta cohorte. El corte principal es 24 horas después de cerrar el noveno desafío. El contrato define elegibilidad, deduplicación y tratamiento de datos faltantes.

El retorno inicial y la participación por desafío aportan contexto. Los minutos activos por fase y las intervenciones manuales permiten identificar trabajo que se repite en cada temporada. Una comparación de ahorro con Tabarnia 1 requiere un registro equivalente.

## Canal

Para Tabarnia 2 se prevé invitación directa de Jose a la cohorte original y un aviso general en Telegram por apertura. Se registran el aviso, la ayuda solicitada y los contactos adicionales. El comportamiento observado se interpretará con esos avisos.

**Estado de evidencia:** el responsable declaró el envío de invitaciones privadas por Telegram y aportó dos encuestas del grupo. Queda pendiente contrastar el registro de avisos y ayuda por publicación.

## Ingresos

Desconocido. El esfuerzo de CYCLE-002 aporta contexto para futuras decisiones de sostenibilidad. HYP-009 permanece en `Borrador`.

## Crecimiento

Desconocido fuera de Tabarnia. Una prueba con otro anfitrión se evaluará con el resultado de CYCLE-002.

## Operación

Jose Moreno es el responsable. Antes de convocar a Tabarnia 2 se fijan las nueve publicaciones y sus versiones, los horarios, la cohorte y la medición. El trabajo de selección, autoría, revisión, programación, coordinación y soporte se registra desde la preparación. La fecha de inicio sigue pendiente.

La primera mejora de operación se elegirá según dónde se acumulen los minutos y las intervenciones. El calendario puede simplificarse con un paquete de desafíos, una fecha y un ritmo. Si el esfuerzo se concentra en autoría y revisión, se puede ampliar el banco para las plantillas más usadas. El autoservicio del anfitrión y el generador competitivo son inversiones que se decidirán con esa evidencia.

## Ventajas esperadas

- El juego asíncrono reduce la necesidad de coordinación en tiempo real.
- Los desafíos breves y variados pueden facilitar la repetición.
- El ranking acumulado puede dar continuidad entre desafíos.

Son inferencias y supuestos. HYP-010 mide la repetición de la experiencia completa.

## Principales incertidumbres

1. Si la cohorte vuelve a jugar una segunda temporada con un calendario fijado de antemano.
2. Si la propuesta de valor, la cadencia y el ranking contribuyen al comportamiento observado.
3. Si el vehículo técnico propuesto es realmente el mecanismo mínimo para obtener esa evidencia.
4. Ingresos, crecimiento y viabilidad fuera de una primera cohorte.

## Relación con la visión y el ciclo activo

La visión y sus principios se mantienen en [VISION](VISION.md). La hipótesis y el protocolo vigentes están en [HYPOTHESES](HYPOTHESES.md) y [CYCLE-002](cycles/CYCLE-002.md).
