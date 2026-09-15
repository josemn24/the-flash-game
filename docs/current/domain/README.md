# Modelo de dominio

## Propósito

Esta carpeta contiene las reglas de dominio acordadas para evolucionar The Flash desde el prototipo
frontend actual hacia un producto persistido con Supabase. Describe el comportamiento esperado del
producto antes de concretarlo en tipos TypeScript, tablas SQL, políticas RLS o endpoints.

Estas decisiones son la fuente de verdad para el trabajo nuevo relacionado con usuarios, salas,
temporadas, publicaciones, intentos, puntuaciones, rankings e historial.

## Estado

- Estado: modelo aprobado y fases 3 y 4 cerradas.
- Versión: 1.
- Fecha de la última revisión: 2026-09-13.
- Alcance técnico actual: reglas, tipos TypeScript, fixtures canónicos, store normalizado y capa de
  consultas asíncrona server-only. Las slices S01–S04 ya tienen integración real documentada en
  `data-access.md` y `supabase/README.md`; esta carpeta conserva las reglas de dominio y no sustituye
  la documentación del backend ni del esquema SQL.
- Persistencia: PostgreSQL y autenticación mediante Supabase; Storage y el resto de capacidades se
  incorporan por slices posteriores.

## Mapa conceptual

```text
Player ──< RoomMembership >── Room ──< Season ──< ScheduledChallenge
                                      │                    │
                                      │                    └── ChallengeVersion
                                      │                               │
                                      │                               └── ChallengeItem ── QuestionVersion
                                      │
                                      └── RoomInvitation

Player ──< Attempt >── ScheduledChallenge
              │
              └── AttemptAnswer
```

Los rankings y el historial son proyecciones derivadas de publicaciones, membresías e intentos. No
son fuentes de verdad independientes en la primera versión.

## Documentos

1. [`domain-requirements.md`](domain-requirements.md): síntesis funcional del dominio, actores,
   requisitos, estados, permisos e inconsistencias observadas.
2. [`domain-model.md`](domain-model.md): modelo conceptual, relaciones, límites naturales,
   estados, invariantes, permisos y eventos del dominio.
3. [`../../decisions/decisions.md`](../../decisions/decisions.md): reglas e invariantes aprobadas.
4. [`../../decisions/open-questions.md`](../../decisions/open-questions.md): decisiones configurables
   o aplazadas que no bloquean el modelo base.
5. [`../../decisions/adr/`](../../decisions/adr/): decisiones arquitectónicas aceptadas.
6. [`type-model.md`](type-model.md): capas de tipos, API canónica y compatibilidad temporal con el
   prototipo.
7. [`mock-data.md`](mock-data.md): almacén normalizado, aliases, datos reconciliados, selectores y
   controles de integridad.
8. [`data-access.md`](data-access.md): contratos de consultas, composición server-only,
   autorización mock, DTOs y fronteras de dependencia.
9. [`mode-contracts.md`](mode-contracts.md): contrato funcional recomendado de inicio, tiempo,
   finalización, reanudación, revisión y replay para cada modo de juego.
10. [`../data-model.md`](../data-model.md): propuesta de persistencia relacional y sus garantías;
    no sustituye al modelo conceptual de esta carpeta.

Los casos de uso transversales del producto están en [`../use-cases.md`](../use-cases.md).

## Jerarquía documental

Cuando haya una contradicción, se aplicará este orden:

1. ADR aceptado más reciente.
2. [`../../decisions/decisions.md`](../../decisions/decisions.md).
3. Documentación específica de un modo.
4. Documentos históricos de [`../../archive/`](../../archive/).

## Cómo mantener estas decisiones

- Una regla nueva o una aclaración compatible se incorpora a `decisions.md`.
- Una decisión difícil de revertir se registra además mediante un ADR.
- Un cambio que sustituya un ADR crea otro ADR y marca el anterior como reemplazado.
- Las reglas específicas de un modo se documentan junto al modo y se resumen en
  `open-questions.md` hasta quedar cerradas.
- Los nombres del dominio deben mantenerse alineados con [`../glosario.md`](../glosario.md).
