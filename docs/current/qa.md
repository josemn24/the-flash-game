> Estado: vigente. Resumen de las comprobaciones automatizadas del repositorio; no sustituye una
> auditoría manual de accesibilidad o interacción.

# QA actual

## Última verificación

2026-09-17, sobre el estado actual del repositorio y el stack local de Supabase.

- `npm test`: 98 archivos de test y 627 tests superados.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto tras añadir el runtime fail-closed, límites HTTP y health privado.
- `npm run type-architecture`: correcto.
- `npm run dictionary:check`: correcto.
- `npm run docs:check`: correcto; 64 archivos Markdown comprobados.
- `npm run verify:pilot`: pendiente de ejecutar con los escenarios E03–E04; el runner ya incluye sus
  fixture, integración y E2E además de los recorridos existentes.
- `npm run supabase:schema:test`: correcto; 27 archivos declarativos, inventario, provisioning,
  S02–S08, S10–S13, E01–E04, portal privado, comandos editoriales/calendario y pruebas concurrentes
  con conexiones PostgreSQL independientes. S13 cubre 2–20 preguntas, puntos por item, suma 100,
  crecimiento y reducción del grafo editorial.
- `npm run test:integration:supabase -- --scenario portal`: correcto con Auth y PostgREST local.
- `npm run test:integration:supabase -- --scenario s11`: correcto con Auth/PostgREST, grafo
  editorial de cinco preguntas, idempotencia, publicación e aislamiento del contexto protegido.
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
  resumen dinámico de 5 preguntas/100 puntos, publicación explícita e invisibilidad del editor para
  un miembro.
- `npm run test:integration:supabase -- --scenario e01`: cubre publicación editorial mixta, lectura
  sin solución y aislamiento del spectator mediante Auth/PostgREST local.
- `npm run test:e2e -- e2e/e01-mini-wordle.spec.ts`: cubre Auth, elección múltiple + Mini-Wordle,
  palabra temática fuera del diccionario general, palabra general, progreso tras recarga, palabra
  inválida/duplicada, respuesta HTTP perdida y reintento idempotente.
- `npm run test:integration:supabase -- --scenario e02`: cubre publicación editorial mixta, payload
  público sin solución, progreso de códigos, duplicados sin penalización y ceros iniciales.
- `npm run test:e2e -- e2e/e02-logic-code.spec.ts`: cubre Auth, elección múltiple + Logic-code,
  recarga, duplicado, respuesta HTTP perdida, reintento idempotente y spectator.
- `npm run test:integration:supabase -- --scenario e03`: preparado para cubrir publicación editorial mixta, ausencia
  de solución/pistas futuras en la proyección jugable y aislamiento del spectator.
- `npm run test:e2e -- e2e/e03-progressive-clues.spec.ts`: preparado para cubrir primera pista, revelación secuencial,
  respuesta HTTP perdida, reintento idempotente, recarga, penalización visible, variante normalizada
  y revisión autorizada.
- `npm run test:integration:supabase -- --scenario e04`: preparado para cubrir publicación mixta,
  correspondencias privadas y aislamiento del spectator.
- `npm run test:e2e -- e2e/e04-matching.spec.ts`: preparado para cubrir feedback por pareja,
  penalización, recarga, reintento idempotente, cierre automático y revisión.
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
salas, gameplay Flash, recuperación, rankings, historial, revisión autorizada, eventos Mini-Wordle y
Logic-code, Progressive-clues y Matching,
e interacciones concurrentes sobre PostgreSQL local. Los fallos de Auth/PostgREST/PostgreSQL deben
ser visibles; ninguna ruta competitiva puede sustituirlos con mocks.

La validación visual y manual específica de la migración Flash Pop se conserva en el
[`informe histórico de la fase 4`](../archive/redesign/qa-fase-4.md). Sus cifras y checklists no deben
interpretarse como una auditoría del estado actual.

## Interacciones server-authoritative

El flujo competitivo Flash debe verificarse con estas condiciones de red:

- Respuesta rápida, inferior a `250 ms`: no se muestra loading visible.
- Respuesta lenta, de `600–1000 ms`: la opción elegida permanece marcada, el resto de controles queda
  bloqueado y aparece `Comprobando respuesta…` sin mostrar todavía si es correcta.
- Respuesta confirmada: desaparece el estado pendiente y comienza el feedback normal del modo.
- Error o respuesta HTTP perdida: se muestra un error accionable y el reintento conserva la misma clave
  de idempotencia; no se crea una segunda respuesta competitiva.
- Accesibilidad: el estado se anuncia con `role="status"` y el contenedor de interacción comunica
  `aria-busy` mientras espera.

Esta comprobación es actualmente específica del recorrido Flash competitivo persistido. Los modos
locales no deben añadir este loading; al migrar un modo a evaluación server-side, sus pruebas deben
incorporar la misma matriz y adaptar únicamente el texto o la presentación al formato.

## Limitaciones actuales

- Prettier todavía informa 71 archivos sin formato canónico.
- Stylelint mantiene un selector duplicado preexistente en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`.
- La validación E2E de S01–S12 usa escenarios locales reproducibles; no se ha verificado un proyecto
  remoto porque no hay uno vinculado en este entorno.
- `results_locked_at`, abandono automático, takeover, Storage, modos distintos de Flash, E05–E10 y
  la revisión administrativa de intentos invalidados siguen fuera del piloto.
- No existe una ronda manual vigente y exhaustiva documentada para todos los formatos, viewports,
  VoiceOver y `prefers-reduced-motion`.
