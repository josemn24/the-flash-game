> Estado: vigente. Índice normativo de decisiones aprobadas y cuestiones abiertas.

# Decisiones

Esta sección contiene las reglas que gobiernan el trabajo nuevo. Los documentos históricos no pueden
contradecir estas decisiones sin que antes se registre una nueva decisión o ADR.

## Documentos

- [`decisions.md`](decisions.md): reglas e invariantes generales aprobadas.
- [Guardado de partidas](decisions.md#19-guardado-automático-y-recuperación-de-partidas) y
  [pérdida del permiso para jugar](decisions.md#20-pérdida-del-permiso-para-jugar): acuerdos de resiliencia
  sobre hechos aceptados, bloqueo inmediato y cierre del intento sin acreditación.
- [`open-questions.md`](open-questions.md): decisiones aplazadas o configurables.
- [`service-incidents.md`](service-incidents.md): política aprobada para fallos del servicio durante
  partidas; distingue recuperación, revisión individual y cancelación general.
- [`request-retries.md`](request-retries.md): timeouts y límites de reintento aprobados por operación,
  conservación de estado y comportamiento al agotarlos.
- [`adr/`](adr/): decisiones arquitectónicas difíciles de revertir.
- [ADR-0006](adr/0006-explicit-attempt-control-transfer.md): transferencia explícita de una partida
  a otra sesión de la misma cuenta, con un único controlador; aprobada y pendiente de implementar.

## Orden de precedencia

1. El ADR aceptado más reciente que no haya sido reemplazado.
2. `decisions.md`.
3. Contratos específicos de [`../current/domain/`](../current/domain/).
4. Documentación editorial de [`../content/`](../content/).

Los ADR describen por qué se tomó una decisión. Los documentos de dominio describen cómo se expresa
en el modelo y los documentos de contenido describen su aplicación editorial.
