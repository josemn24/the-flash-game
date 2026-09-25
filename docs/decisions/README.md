> Estado: vigente. Índice normativo de decisiones aprobadas y cuestiones abiertas.

# Decisiones

Esta sección contiene las reglas que gobiernan el trabajo nuevo. Los documentos históricos no pueden
contradecir estas decisiones sin que antes se registre una nueva decisión o ADR.

## Documentos

- [`decisions.md`](decisions.md): reglas e invariantes generales aprobadas.
- [`open-questions.md`](open-questions.md): decisiones aplazadas o configurables.
- [`adr/`](adr/): decisiones arquitectónicas difíciles de revertir.

## Orden de precedencia

1. El ADR aceptado más reciente que no haya sido reemplazado.
2. `decisions.md`.
3. Contratos específicos de [`../current/domain/`](../current/domain/).
4. Documentación editorial de [`../content/`](../content/).

Los ADR describen por qué se tomó una decisión. Los documentos de dominio describen cómo se expresa
en el modelo y los documentos de contenido describen su aplicación editorial.
