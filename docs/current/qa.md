> Estado: vigente. Resumen de las comprobaciones automatizadas del repositorio; no sustituye una
> auditoría manual de accesibilidad o interacción.

# QA actual

## Última verificación

2026-09-14, sobre el estado actual del repositorio.

- `npm test`: 81 archivos de test y 535 tests superados.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- `npm run type-architecture`: correcto.
- `npm run dictionary:check`: correcto.
- `npm run docs:check`: correcto; 58 archivos Markdown comprobados.
- `npm run format:check`: avisos de formato en 53 archivos.
- `npm run stylelint`: una incidencia pendiente por selector duplicado en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`.

## Cobertura

La suite automatizada cubre los 31 formatos nativos, sus políticas de puntuación, sesiones de
juego, estados de resultado, datos mock, consultas server-only, rutas principales y contratos de
arquitectura.

La validación visual y manual específica de la migración Flash Pop se conserva en el
[`informe histórico de la fase 4`](../archive/redesign/qa-fase-4.md). Sus cifras y checklists no deben
interpretarse como una auditoría del estado actual.

## Limitaciones actuales

- Prettier todavía informa 53 archivos sin formato canónico.
- Stylelint todavía informa un selector duplicado en la ruta de conceptos Flash Pop.
- No existe una ronda manual vigente y exhaustiva documentada para todos los formatos, viewports,
  VoiceOver y `prefers-reduced-motion`.
