# Estrategia actual

## Estado de la estrategia

Provisional. Describe la apuesta vigente para CYCLE-001; no es evidencia de demanda ni forma parte inmutable de la visión. La temporada de CYCLE-001 se ejecutó en staging y su resultado se registró el 2026-11-24 como inconcluso por calidad del experimento. Las apuestas se revisarán al registrar la decisión estratégica del ciclo.

## Objetivo estratégico actual

Obtener evidencia sobre si un grupo inicial repite desafíos compartidos de forma asíncrona antes de ampliar The Flash a más salas o funcionalidades sociales.

## Segmento

Tabarnia: cohorte de 14 amistades invitadas por Jose a una sala privada de la primera alpha. Las invitaciones se enviaron por Telegram el 2026-11-05; la cuenta operativa con rol `owner` queda excluida de la medición.

**Estado de evidencia:** observado en una temporada. 12 de 14 personas mantuvieron participación según la definición de CYCLE-001, con cadencia flexible. No prueba transferencia a otros grupos.

## Problema

Comprobar si este grupo obtiene valor de una actividad competitiva recurrente que no exige coincidir en tiempo real.

**Estado de evidencia:** HYP-001 quedó `Inconclusa` respecto al protocolo diario. Hay comportamiento recurrente observado y preferencias declaradas de una parte del grupo. Sigue abierta su relación con la repetición en otra temporada.

## Propuesta de valor

Desafíos mentales breves, variados y comparables que permiten competir con amistades en una ventana compartida y seguir una puntuación acumulada de temporada.

**Estado de evidencia:** comportamiento repetido observado en una temporada de Tabarnia con cadencia flexible; no aísla qué elemento de la propuesta lo produce.

## Solución o vehículo actual

Una alpha con una sala privada, nueve desafíos, un intento por participante y publicación, puntuaciones comparables y ranking acumulado. El protocolo `tabarnia-daily-v2` preveía nueve ventanas consecutivas de 24 horas. En la ejecución real, el organizador espació las publicaciones durante 15 días y el protocolo no se congeló.

El repositorio ya aporta Auth, salas, temporadas, publicaciones, intentos, rankings, programación
local, portal privado y varios recorridos server-side sobre Supabase. La temporada de Tabarnia se
jugó en staging con nueve desafíos de cinco modos distintos. El detalle está en la sección 12 de
CYCLE-001.

**Fuente:** `cycles/CYCLE-001.md`; `../../../../README.md` y `../../../current/status.md` para los
límites actuales de la aplicación.

## Medición y decisión

Tabarnia es una sala más: utiliza la misma captura automática por temporada que las demás salas. Los criterios se definen antes de observar resultados y se aplican en la fase posterior de análisis; no configuran el producto ni condicionan técnicamente la apertura de temporadas.

El [contrato de medición](cycles/CYCLE-001.md#7-contrato-de-medición) es la referencia canónica. Una persona mantiene participación sostenida si completa seis o más de los nueve desafíos, incluidos al menos dos de los tres últimos. La métrica divide esas personas entre las 14 invitaciones efectivamente enviadas, incluidas las rechazadas o sin activación.

- Ocho o más: apoyo a HYP-001 en esta cohorte y temporada.
- Cuatro o menos: debilitamiento.
- Entre cinco y siete, o datos cuya incertidumbre cruce categorías: inconclusión.

Son criterios de éxito específicos del estudio de Tabarnia, no referencias del sector ni evidencia estadística de mercado. El corte principal es 24 horas después de cerrar el noveno desafío; los intentos iniciados válidamente se atribuyen a su publicación y las finalizaciones se deduplican por persona/publicación. Los detalles de elegibilidad, datos faltantes e invalidaciones pertenecen al contrato.

Activación, evolución por desafío, introducción a inicio, finalización, continuidad final, disfrute, ranking, ensayos/revisión, fiabilidad y esfuerzo operativo explican el resultado. No sustituyen la métrica principal ni abren otro ciclo. La preparación usará persistencia existente, eventos mínimos y registros manuales cuando permitan obtener evidencia equivalente con menos trabajo.

## Canal

Invitación directa de Jose a la cohorte definida y un aviso general al abrir cada publicación, en el grupo privado de Telegram fijado antes de iniciar. La ayuda solicitada y los contactos adicionales se registran; no se planifica insistencia individual para forzar participación. No se usarán campañas ni adquisición pagada. El resultado evaluará una experiencia con esos avisos, sin atribuirle uso espontáneo sin recordatorios.

**Estado de evidencia:** el responsable declaró el envío de invitaciones privadas por Telegram y aportó dos encuestas del grupo. Queda pendiente contrastar el registro de avisos y ayuda por publicación.

## Ingresos

Desconocido. CYCLE-001 registra esfuerzo y costes como contexto para futuras decisiones de sostenibilidad; no prueba pagador, precio o ingresos. Una intención declarada de pagar no se considera compra. HYP-009 permanece en `Borrador`.

## Crecimiento

Desconocido. La alpha no busca validar adquisición ni expansión; busca aprendizaje sobre participación recurrente en una sola cohorte.

## Operación

Jose Moreno es el responsable. En la ejecución de CYCLE-001, la fase de juego duró 15 días en lugar de nueve, porque el responsable ajustó el calendario a su disponibilidad y al ritmo del grupo. El diseño previsto era el siguiente: la fase de juego dura nueve días, con corte principal 24 horas después del cierre del noveno desafío y seguimiento cualitativo hasta siete días después de ese cierre. Antes se exige prueba individual sin exposición de respuestas oficiales, verificación operativa del entorno y prueba completa de medición.

Se congelan criterios y lista nominal antes de enviar invitaciones reales, cuyo registro inicia la recogida de datos. Como control organizativo del estudio, la apertura requiere 14 invitaciones enviadas y acceso provisionado. La aplicación no impone ese control. Si no se cumple, no se abre y se conserva la desviación; no se sustituyen participantes ni se ajustan umbrales tras observar comportamiento. Supabase y el portal aportan actividad, disfrute 1–5 y CSV comunes. Invitaciones, feedback externo, incidencias y costes se conservan en el expediente privado del estudio. El responsable elimina las copias identificables de ese expediente a los 90 días del cierre, conservando agregados; los datos automáticos de la aplicación mantienen su política vigente. La implementación no inicia la alpha.

## Ventajas esperadas

- El juego asíncrono reduce la necesidad de coordinación en tiempo real.
- Los desafíos breves y variados pueden facilitar la repetición.
- El ranking acumulado puede dar continuidad entre desafíos.

Son inferencias y supuestos; HYP-001 evalúa principalmente la repetición, no demuestra por separado cuál de estos elementos la causa.

## Principales incertidumbres

1. Si la cohorte vuelve a jugar una segunda temporada con un calendario fijado de antemano. Es una candidata a siguiente incertidumbre, pendiente de la decisión del ciclo.
2. Si la propuesta de valor, la cadencia y el ranking contribuyen al comportamiento observado.
3. Si el vehículo técnico propuesto es realmente el mecanismo mínimo para obtener esa evidencia.
4. Ingresos, crecimiento y viabilidad fuera de una primera cohorte.

## Relación con la visión y el ciclo activo

La visión y sus principios se mantienen en `VISION.md`. La hipótesis, criterios de evidencia y decisión de esta apuesta están en `HYPOTHESES.md` y `cycles/CYCLE-001.md`.
