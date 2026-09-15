> Estado: vigente. Resumen de las comprobaciones automatizadas del repositorio; no sustituye una
> auditoría manual de accesibilidad o interacción.

# QA actual

## Última verificación

2026-09-15, sobre el estado actual del repositorio y el stack local de Supabase.

- `npm test`: 77 archivos de test y 518 tests superados.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- `npm run type-architecture`: correcto.
- `npm run dictionary:check`: correcto.
- `npm run docs:check`: correcto; 63 archivos Markdown comprobados.
- `npm run supabase:schema:test`: correcto; pasan las suites de esquema/RLS, provisioning, S02,
  S03, S04 y las pruebas concurrentes con conexiones PostgreSQL independientes.
- `npm run format:check`: avisos de formato en 56 archivos; quedan fuera del alcance de esta
  actualización documental.

## Cobertura

La suite automatizada cubre los 31 formatos nativos, sus políticas de puntuación, sesiones de
juego, estados de resultado, datos mock, consultas server-only, rutas principales y contratos de
arquitectura. Las suites de Supabase cubren el esquema, RLS, comandos, provisioning, lecturas de
salas, gameplay Flash, recuperación e interacciones concurrentes sobre PostgreSQL local.

La validación visual y manual específica de la migración Flash Pop se conserva en el
[`informe histórico de la fase 4`](../archive/redesign/qa-fase-4.md). Sus cifras y checklists no deben
interpretarse como una auditoría del estado actual.

## Limitaciones actuales

- Prettier todavía informa 56 archivos sin formato canónico.
- La validación E2E de S01–S04 usa escenarios locales reproducibles; no se ha verificado un proyecto
  remoto porque no hay uno vinculado en este entorno.
- No existe una ronda manual vigente y exhaustiva documentada para todos los formatos, viewports,
  VoiceOver y `prefers-reduced-motion`.
