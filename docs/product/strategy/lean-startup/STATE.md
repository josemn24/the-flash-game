> Estado: vigente. Registro del estado Lean actual.

# Estado Lean

## Resumen

- Fase actual: Análisis del aprendizaje
- Estado detallado: LEARNING_ANALYSIS; siguiente puerta DECISION.
- Ciclo activo: `cycles/CYCLE-001.md`
- Hipótesis crítica: HYP-001 — Participación recurrente en una competición asíncrona entre amistades. Estado: `Inconclusa` por calidad del experimento (2026-11-24).
- Pregunta de aprendizaje: ¿Las 14 personas invitadas a Tabarnia mantienen participación voluntaria hasta el final de nueve desafíos diarios?
- Decisión pendiente: ¿La evidencia justifica PERSEVERAR con una segunda temporada y qué fricción debe resolverse antes de ampliar?
- Ejecución: temporada jugada en staging. Invitaciones enviadas el 2026-11-05; nueve desafíos entre `T0` = 2026-11-06 14:00 UTC y el 2026-11-21; corte `Tdatos` = 2026-11-22 14:00 UTC; seguimiento cualitativo hasta el 2026-11-28.
- Resultado principal: `R = 12/14` (85,7 %). Once personas completaron los nueve desafíos, una completó siete, una completó cinco y una quedó sin intentos registrados. Numéricamente supera el umbral de apoyo (`R >= 8`).
- Motivo de la inconclusión: el calendario se adaptó durante la ejecución según la reacción del grupo y la disponibilidad del organizador (15 días con huecos en lugar de nueve ventanas consecutivas de 24 h) y el protocolo `tabarnia-daily-v2` no se congeló. Según la sección 7.6 del ciclo, eso invalida la ejecución del protocolo. La cadencia diaria no se probó.
- Fuente del contrato y de los resultados: [CYCLE-001](cycles/CYCLE-001.md), secciones 7 y 12–14.
- Datos faltantes: resto del expediente externo (avisos, incidencias, minutos y costes) y cierre del seguimiento cualitativo. M09 y M10 siguen pendientes.
- Responsable: Jose Moreno
- Próxima revisión: tras el cierre del seguimiento cualitativo el 2026-11-28.
- Hipótesis secundaria candidata: HYP-002 — Preferencia y contribución de modos y formatos. Permanece en `Borrador` y recoge señales exploratorias de Telegram y staging.
- Mapa ampliado: HYP-003 a HYP-009 cubren segmento, canal, operativa, técnica, legal o regulatoria, crecimiento e ingresos; todas permanecen en `Borrador`.
- Conservación: expediente externo identificable del estudio durante 90 días desde el cierre del informe, con eliminación a cargo del responsable; resumen agregado conservado. Los datos automáticos y partidas oficiales mantienen su política vigente.

## Próxima acción

Completar las secciones 12 y 13 de CYCLE-001 con el seguimiento cualitativo hasta el 2026-11-28 y consignar qué avisos, incidencias, minutos y costes siguen sin verificarse.

## Lo que sabemos

### Hechos observados

- En la temporada de Tabarnia en staging, 12 de las 14 personas invitadas completaron seis o más desafíos, incluidos al menos dos de los tres últimos. Once completaron los nueve. Fuente: [CYCLE-001, sección 12](cycles/CYCLE-001.md#12-resultados-observados).
- La participación por publicación se mantuvo entre 11 y 13 de 14, y 111 de 112 intentos iniciados terminaron.
- El calendario real fue adaptativo y no siguió las nueve ventanas consecutivas del protocolo.
- Diez personas dejaron 24 valoraciones en la app. Se recibieron entre una y cuatro valoraciones por desafío después del primero.

### Evidencia disponible

- Comportamiento de la cohorte de Tabarnia en una temporada, con medición completa de finalizaciones. La ejecución no es válida respecto al protocolo diario diseñado.
- Dos encuestas de Telegram y análisis por pregunta en staging, con señales sobre preferencias, progresión y corrección. [Resultados del ciclo](cycles/CYCLE-001.md#12-resultados-observados).

## Lo que creemos

### Inferencias

- La alta recurrencia observada justifica considerar una segunda temporada con el mismo grupo y un calendario fijado antes de jugar. Su priorización queda pendiente de la decisión estratégica.
- La cadencia puede ser una variable relevante para sostener la participación.

### Supuestos

- La relación personal con el organizador, los avisos y la novedad contribuyeron a la participación en una medida desconocida.

## Lo que desconocemos

- Si el grupo sostendría una cadencia diaria estricta de nueve días consecutivos.
- Si la participación se repite en una segunda temporada, sin novedad, o en otros grupos.
- Qué parte del efecto se debe al juego, al ranking, a la cadencia, a los avisos o a la relación con el organizador.
- Qué experiencias explican las preferencias declaradas y cuáles hacen que la gente quiera volver. Sigue abierto el seguimiento cualitativo.
- La carga operativa real de la temporada, la fricción técnica, los requisitos legales o regulatorios, el crecimiento y los ingresos.

## Referencias

- Visión: `VISION.md`
- Máquina de estados: `STATE_MACHINE.md`
- Estrategia: `STRATEGY.md`
- Hipótesis: `HYPOTHESES.md`
- Ciclo activo: `cycles/CYCLE-001.md`
