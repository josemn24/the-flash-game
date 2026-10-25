# Estrategia actual

## Estado de la estrategia

Provisional. Describe la apuesta vigente para CYCLE-001; no es evidencia de demanda ni forma parte inmutable de la visión.

## Objetivo estratégico actual

Obtener evidencia sobre si un grupo inicial repite desafíos compartidos de forma asíncrona antes de ampliar The Flash a más salas o funcionalidades sociales.

## Segmento

Tabarnia: cohorte de 14 amistades a quienes Jose invitará a una sala privada de la primera alpha. Lista nominal y envíos pendientes; cuentas de pruebas y organizador en su función operativa quedan excluidos de la medición.

**Estado de evidencia:** supuesto; todavía no se han enviado invitaciones ni observado participación.

## Problema

Comprobar si este grupo obtiene valor de una actividad competitiva recurrente que no exige coincidir en tiempo real.

**Estado de evidencia:** hipótesis HYP-001, no hecho observado.

## Propuesta de valor

Desafíos mentales breves, variados y comparables que permiten competir con amistades en una ventana compartida y seguir una puntuación acumulada de temporada.

**Estado de evidencia:** afirmación estratégica; pendiente de observar comportamiento repetido.

## Solución o vehículo actual

Una alpha con una sala privada, nueve desafíos diarios en ventanas consecutivas de 24 horas, un intento por participante y publicación, puntuaciones comparables y ranking acumulado. El protocolo `tabarnia-daily-v2` está definido y pendiente de congelar; sustituye el diseño anterior antes de observar resultados.

El repositorio ya aporta Auth, salas, temporadas, publicaciones, intentos, rankings, programación
local, portal privado y varios recorridos server-side sobre Supabase. La selección de los nueve
desafíos, la preparación concreta de la cohorte y la validación de staging siguen pendientes. La
medición está contrastada en Supabase local y E2E aislado; esa verificación técnica no constituye
evidencia de demanda.

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

**Estado de evidencia:** supuesto operativo.

## Ingresos

Desconocido. CYCLE-001 registra esfuerzo y costes como contexto para futuras decisiones de sostenibilidad; no prueba pagador, precio o ingresos. Una intención declarada de pagar no se considera compra. HYP-009 permanece en `Borrador`.

## Crecimiento

Desconocido. La alpha no busca validar adquisición ni expansión; busca aprendizaje sobre participación recurrente en una sola cohorte.

## Operación

Jose Moreno es el responsable. La fase de juego dura nueve días, con corte principal 24 horas después del cierre del noveno desafío y seguimiento cualitativo hasta siete días después de ese cierre. Antes se exige prueba individual sin exposición de respuestas oficiales, verificación operativa del entorno y prueba completa de medición.

Se congelan criterios y lista nominal antes de enviar invitaciones reales, cuyo registro inicia la recogida de datos. Como control organizativo del estudio, la apertura requiere 14 invitaciones enviadas y acceso provisionado. La aplicación no impone ese control. Si no se cumple, no se abre y se conserva la desviación; no se sustituyen participantes ni se ajustan umbrales tras observar comportamiento. Fecha absoluta, participantes y contenidos siguen pendientes. Supabase y el portal aportan actividad, disfrute 1–5 y CSV comunes. Invitaciones, feedback externo, incidencias y costes se conservan en el expediente privado del estudio. El responsable elimina las copias identificables de ese expediente a los 90 días del cierre, conservando agregados; los datos automáticos de la aplicación mantienen su política vigente. La implementación no inicia la alpha.

## Ventajas esperadas

- El juego asíncrono reduce la necesidad de coordinación en tiempo real.
- Los desafíos breves y variados pueden facilitar la repetición.
- El ranking acumulado puede dar continuidad entre desafíos.

Son inferencias y supuestos; HYP-001 evalúa principalmente la repetición, no demuestra por separado cuál de estos elementos la causa.

## Principales incertidumbres

1. Si la cohorte acepta y completa repetidamente los desafíos.
2. Si la propuesta de valor, la cadencia y el ranking contribuyen al comportamiento observado.
3. Si el vehículo técnico propuesto es realmente el mecanismo mínimo para obtener esa evidencia.
4. Ingresos, crecimiento y viabilidad fuera de una primera cohorte.

## Relación con la visión y el ciclo activo

La visión y sus principios se mantienen en `VISION.md`. La hipótesis, criterios de evidencia y decisión de esta apuesta están en `HYPOTHESES.md` y `cycles/CYCLE-001.md`.
