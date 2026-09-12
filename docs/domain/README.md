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
- Fecha de la última revisión: 2026-09-12.
- Alcance técnico actual: reglas, tipos TypeScript, fixtures canónicos, store normalizado y capa de
  consultas asíncrona server-only; todavía no define backend ni esquema SQL.
- Persistencia prevista: PostgreSQL, autenticación y almacenamiento mediante Supabase.

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

1. [`decisions.md`](decisions.md): reglas e invariantes aprobadas.
2. [`open-questions.md`](open-questions.md): decisiones configurables o aplazadas que no bloquean
   el modelo base.
3. [`adr/0001-separate-player-from-auth-identity.md`](adr/0001-separate-player-from-auth-identity.md):
   separación entre jugador e identidad de Supabase Auth.
4. [`adr/0002-immutable-published-content.md`](adr/0002-immutable-published-content.md):
   versionado e inmutabilidad del contenido publicado.
5. [`adr/0003-attempt-lifecycle-and-concurrency.md`](adr/0003-attempt-lifecycle-and-concurrency.md):
   ciclo de vida, reanudación y concurrencia de intentos.
6. [`adr/0004-server-authoritative-scoring.md`](adr/0004-server-authoritative-scoring.md):
   evaluación y puntuación autoritativas en servidor.
7. [`type-model.md`](type-model.md): capas de tipos, API canónica y compatibilidad temporal con el
   prototipo.
8. [`mock-data.md`](mock-data.md): almacén normalizado, aliases, datos reconciliados, selectores y
   controles de integridad.
9. [`data-access.md`](data-access.md): contratos de consultas, composición server-only,
   autorización mock, DTOs y fronteras de dependencia.

## Jerarquía documental

Cuando haya una contradicción, se aplicará este orden:

1. ADR aceptado más reciente.
2. `docs/domain/decisions.md`.
3. Documentación específica de un modo.
4. Documentos anteriores del prototipo, como `salas-y-temporadas.md` o
   `migracion-modelo-datos.md`.

## Cómo mantener estas decisiones

- Una regla nueva o una aclaración compatible se incorpora a `decisions.md`.
- Una decisión difícil de revertir se registra además mediante un ADR.
- Un cambio que sustituya un ADR crea otro ADR y marca el anterior como reemplazado.
- Las reglas específicas de un modo se documentan junto al modo y se resumen en
  `open-questions.md` hasta quedar cerradas.
- Los nombres del dominio deben mantenerse alineados con [`../glosario.md`](../glosario.md).
