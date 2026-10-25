> Estado: vigente. Registro del estado Lean actual.

# Estado Lean

## Resumen

- Fase actual: Preparación del MVP
- Estado detallado: MVP_DESIGN; siguiente puerta READY_TO_RUN, todavía no superada.
- Ciclo activo: `cycles/CYCLE-001.md`
- Hipótesis crítica: HYP-001 — Participación recurrente en una competición asíncrona entre amistades
- Pregunta de aprendizaje: ¿Las 14 personas invitadas a Tabarnia mantienen participación voluntaria hasta el final de nueve desafíos diarios?
- Decisión pendiente: ¿La evidencia justifica PERSEVERAR con una segunda temporada y qué fricción debe resolverse antes de ampliar?
- Diseño: 14 invitaciones, nueve ventanas consecutivas de 24 horas, un intento por publicación; protocolo `tabarnia-daily-v2` definido el 2026-10-24 y pendiente de congelar.
- Métrica principal: personas que completan al menos seis desafíos, incluidos dos de los tres últimos, divididas entre las 14 invitaciones; ocho o más apoya, cuatro o menos debilita y cinco a siete resulta inconcluso, sujeto a calidad de datos.
- Fuente del contrato: [CYCLE-001, sección 7](cycles/CYCLE-001.md#7-contrato-de-medición). Tabarnia utiliza la medición automática común por temporada; la cohorte de invitaciones y el cálculo del estudio se preparan fuera de la aplicación. Verificación del entorno objetivo y del análisis pendiente.
- Separación de responsabilidades: todas las salas recogen datos comunes; los criterios de éxito de Tabarnia se fijan aquí y se evalúan posteriormente, sin configurar ni bloquear la aplicación.
- Límites de fuentes: el retorno del portal cuenta inicios en dos publicaciones y no sustituye la métrica principal. Los CSV muestran agregados y estado actual; el ensayo externo debe contrastar fechas, corte, auditoría y tramos sin captura según las secciones 7.4–7.5 del ciclo.
- Incertidumbre principal: aceptación y participación recurrente de Tabarnia en el loop social asíncrono.
- Responsable: Jose Moreno
- Próxima revisión: Tras el corte principal (cierre del noveno desafío + 24 horas) y el seguimiento cualitativo de siete días; inicio pendiente.
- Bloqueos: Nueve versiones y orden sin seleccionar; cohorte nominal, calendario absoluto, prueba individual y operación de staging sin verificar. La implementación y las pruebas locales no permiten iniciar la alpha sin ese control.
- Hipótesis secundaria candidata: HYP-002 — Preferencia y contribución de modos y formatos; permanece en `Borrador` y no abre un segundo ciclo.
- Mapa ampliado: HYP-003 a HYP-009 cubren segmento, canal, operativa, técnica, legal o regulatoria, crecimiento e ingresos; todas permanecen en `Borrador`.
- Instrumentos complementarios previstos: disfrute opcional 1–5 en app; problemas, encuesta final y hasta cinco conversaciones voluntarias por Telegram o entrevista, registrados en el expediente privado del estudio; separados del comportamiento y de la clasificación principal.

- Conservación: expediente externo identificable del estudio durante 90 días desde el cierre del informe, con eliminación a cargo del responsable; resumen agregado conservado. Los datos automáticos y partidas oficiales mantienen su política vigente.

## Próxima acción

Seleccionar y registrar en CYCLE-001 los nueve desafíos candidatos para la alpha de Tabarnia.

## Lo que sabemos

### Hechos observados

- El repositorio combina recorridos mock/práctica con un vehículo técnico persistido localmente sobre
  Supabase: dispone de Auth, salas, temporadas, publicaciones, intentos, rankings, portal privado y
  varios formatos competitivos server-side. Fuente: `../../../current/status.md`.
- La disponibilidad de este vehículo técnico no constituye evidencia de que Tabarnia participe de
  forma recurrente ni de que el loop social aporte valor.
- El responsable ha solicitado 14 invitaciones y nueve desafíos diarios; CYCLE-001 conserva la revisión del diseño previo, sin resultados ni decisiones estratégicas inventados.

### Evidencia disponible

- No hay evidencia de comportamiento de usuarios ni resultados Lean registrados.

## Lo que creemos

### Inferencias

- La adopción y repetición del loop social es más incierta que ampliar formatos o infraestructura técnica.

### Supuestos

- Tabarnia podría querer competir de manera asíncrona con nueve desafíos breves y un resultado acumulado.

## Lo que desconocemos

- La aceptación real de las 14 invitaciones, la disposición a volver, los formatos que mejor sostienen la participación y el interés por el ranking.
- La contribución relativa de cada modo o formato no se puede atribuir con los datos actuales; solo está prevista como observación exploratoria de CYCLE-001.
- La transferibilidad a otros segmentos, el canal fuera de la cohorte inicial, la carga operativa, la fiabilidad del vehículo, los requisitos legales o regulatorios, el crecimiento y los ingresos.

## Referencias

- Visión: `VISION.md`
- Máquina de estados: `STATE_MACHINE.md`
- Estrategia: `STRATEGY.md`
- Hipótesis: `HYPOTHESES.md`
- Ciclo activo: `cycles/CYCLE-001.md`
