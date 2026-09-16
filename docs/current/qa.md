> Estado: vigente. Resumen de las comprobaciones automatizadas del repositorio; no sustituye una
> auditoría manual de accesibilidad o interacción.

# QA actual

## Última verificación

2026-09-16, sobre el estado actual del repositorio y el stack local de Supabase.

- `npm test`: 89 archivos de test y 575 tests superados.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- `npm run type-architecture`: correcto.
- `npm run dictionary:check`: correcto.
- `npm run docs:check`: correcto; 63 archivos Markdown comprobados.
- `npm run supabase:schema:test`: correcto; inventario, provisioning, S02–S08, S10–S12, portal
  privado, comandos editoriales/calendario y pruebas concurrentes con conexiones PostgreSQL independientes.
- `npm run test:integration:supabase -- --scenario portal`: correcto con Auth y PostgREST local.
- `npm run test:integration:supabase -- --scenario s11`: correcto con Auth/PostgREST, grafo
  editorial completo, idempotencia, publicación e aislamiento del contexto protegido.
- `npm run test:e2e -- e2e/admin-portal.spec.ts`: 2/2 correcto con acceso superadmin, recarga y
  denegación de miembro/anónimo.
- `npm run test:integration:supabase -- --scenario s08`: correcto con lookup exacto, creación de
  owner/grupo inicial, idempotencia y colisión de slug mediante Auth/PostgREST local.
- `npm run test:e2e -- e2e/admin-room-creation.spec.ts`: 2/2 correcto con wizard, confirmación,
  recarga y denegación de usuario normal/anónimo.
- `npm run test:integration:supabase -- --scenario s07`: correcto con Auth y PostgREST local.
- `npm run test:e2e -- e2e/s07-history-review.spec.ts`: 1/1 correcto con ranking histórico,
  revisión propia/ajena y spectator en sesiones de navegador aisladas.
- `npm run test:e2e -- e2e/s11-editorial.spec.ts`: 2/2 correcto con creación, edición, preview,
  publicación explícita e invisibilidad del editor para un miembro.
- La integración Auth/PostgREST y el E2E de S12 quedan preparados en `scripts/integration/scenarios/s12.mjs`
  y `e2e/s12-calendar.spec.ts`, pero requieren aplicar primero las migraciones S12 al Supabase local
  persistente; no se ejecutó un reset global para conservar fixtures ajenos.
- S06 continúa verificado por `s06` y `e2e/s06-ranking.spec.ts`.
- `npm run format:check`: avisos de formato en 71 archivos; quedan fuera del alcance de esta
  actualización documental.

## Cobertura

La suite automatizada cubre los 31 formatos nativos, sus políticas de puntuación, sesiones de
juego, estados de resultado, datos mock, consultas server-only, rutas principales y contratos de
arquitectura. Las suites de Supabase cubren el esquema, RLS, comandos, provisioning, lecturas de
salas, gameplay Flash, recuperación, rankings, historial, revisión autorizada e interacciones
concurrentes sobre PostgreSQL local.

La validación visual y manual específica de la migración Flash Pop se conserva en el
[`informe histórico de la fase 4`](../archive/redesign/qa-fase-4.md). Sus cifras y checklists no deben
interpretarse como una auditoría del estado actual.

## Limitaciones actuales

- Prettier todavía informa 71 archivos sin formato canónico.
- Stylelint mantiene un selector duplicado preexistente en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`.
- La validación E2E de S01–S12 usa escenarios locales reproducibles; no se ha verificado un proyecto
  remoto porque no hay uno vinculado en este entorno.
- `results_locked_at`, abandono automático, takeover, modos distintos de Flash y la revisión
  administrativa de intentos invalidados siguen fuera de S07.
- No existe una ronda manual vigente y exhaustiva documentada para todos los formatos, viewports,
  VoiceOver y `prefers-reduced-motion`.
