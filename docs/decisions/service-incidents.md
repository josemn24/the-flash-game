> Estado: aprobado como política de producto; implementación y detalles operativos pendientes.

# Incidencias del servicio durante una partida

- Fecha de aprobación: 2026-10-06.
- Alcance: los cinco modos competitivos y sus dependencias de Auth, APIs, PostgreSQL y recursos imprescindibles de Storage.
- Origen: acuerdo explícito del responsable del producto en la conversación de diseño de resiliencia.

## Contexto

Un fallo del servicio puede dejar una respuesta sin confirmación o impedir continuar una partida.
La recuperación debe conservar los hechos aceptados y mantener condiciones justas para todos los
participantes, sin conceder nuevas oportunidades sobre preguntas ya vistas.

## Decisión aprobada

1. **Fallo breve:** recuperar la partida conservando respuestas y puntos ya guardados, sin repetir
   preguntas vistas. Resolver primero cualquier respuesta recibida cuya confirmación o evaluación
   esté pendiente. La recuperación sigue siendo autoritativa e idempotente y no reinicia plazos
   desde el navegador.
2. **Fallo del servicio que impide continuar:** marcar el intento como afectado por una incidencia,
   sin penalizar automáticamente al jugador por esa incidencia, y someter el caso a revisión del
   superadmin. Conservar respuestas, puntos originales y evidencias para resolverlo de forma
   auditada; el fallo no demuestra abandono voluntario ni fraude.
3. **Caída general que compromete la competición:** cancelar esa publicación para todos y
   reprogramarla con contenido nuevo. La resolución debe aplicarse también a quienes ya jugaron,
   conservando el histórico y auditando los efectos sobre puntos y rankings.
4. **Compensación:** no conceder puntos automáticamente ni habilitar replay individual sobre
   contenido ya visto. Las resoluciones administrativas deben mantener condiciones justas para todos.

Esta política regula incidencias del servicio confirmadas. Una pérdida de conexión local, una recarga
o una respuesta HTTP perdida no prueba por sí sola una caída del servicio: primero se aplican la
reconciliación y las reglas de recuperación vigentes en
[ADR-0003](adr/0003-attempt-lifecycle-and-concurrency.md). Las incidencias confirmadas requieren el
tratamiento adicional aprobado aquí, sin borrar ni reescribir los hechos originales.

## Qué falta definir

- Qué duración e impacto distinguen un fallo breve de uno que impide continuar.
- Qué evidencias confirman una incidencia del servicio, su intervalo y los intentos afectados;
  cómo distinguirla de un problema exclusivo del dispositivo o conexión del jugador.
- Cómo representar y persistir la marca de incidencia y qué ocurre con el intento, sus plazos y
  sus puntos mientras está pendiente de revisión. No se decide aquí un nuevo estado de `Attempt`.
- Cómo tramita el superadmin la revisión individual, qué resoluciones puede aplicar y en qué plazo.
- Cómo cancelar una publicación ya abierta o cerrada por una incidencia general y cómo neutralizar
  de forma auditada su contribución competitiva. El flujo actual de cancelación de publicaciones
  futuras no acredita esta capacidad.
- Cómo elegir la nueva ventana, contenido y comunicación de la publicación de reemplazo.

## Criterios de aceptación para la futura implementación

- Perder una confirmación después de guardar una respuesta y recuperar produce una sola respuesta,
  una sola evaluación y ninguna acreditación duplicada.
- Una incidencia confirmada que impide continuar queda registrada para revisión sin borrar hechos
  aceptados, conceder puntos automáticos ni tratarse como abandono voluntario.
- Una cancelación por caída general afecta de forma coherente a todos los participantes, incluidos
  quienes terminaron antes; conserva originales y auditoría, y la publicación de reemplazo utiliza
  contenido nuevo.

## Referencias

- [Decisiones generales](decisions.md): sección 16.
- [Cuestiones operativas pendientes](open-questions.md): incidencias durante partidas.
- [Matriz de resiliencia](../current/resilience-matrix.md): R02, R07, R08, R28 y R44.

El acuerdo está documentado; no implica que su comportamiento esté implementado o verificado.
