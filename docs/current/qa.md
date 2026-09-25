> Estado: vigente. Fotografía de las comprobaciones automatizadas del repositorio a 2026-09-25;
> no sustituye una auditoría manual de accesibilidad o interacción.

# QA actual

## Estado de la aplicación

La integración local cubre S01–S15, S17a, S18b parcial, D08a/D08b, S05-Alphabet,
F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19 y E01–E06/E10. Incluye Auth, perfil, salas,
temporadas, calendario, Flash, Alphabet, Supervivencia, Pirámide, rankings, historial Flash,
revisión autorizada, portal de superadmin, biblioteca editorial y assets privados.

S18b solo habilita actualmente concesión/revocación de admin y eliminación lógica de miembros.
Transferencia de propiedad, bloqueo/desbloqueo e invitaciones completas siguen pendientes.
Narrativa, E07–E09, abandono automático, takeover, `results_locked_at`, correcciones administrativas,
pruebas fantasma y anonimización también permanecen fuera del alcance operativo actual.

El esquema declarativo vigente contiene 47 archivos y la revisión canónica es
`20260924120000_s18_superadmin_user_commands`. Hay 89 migraciones versionadas, 30 tablas, una vista
interna y un inventario de seguridad registrado. No hay proyecto remoto de Supabase vinculado.

## Comprobaciones ejecutadas actualmente

- `npm run schema:revision:check`: correcto.
- `npm run docs:check`: correcto; 64 archivos Markdown comprobados.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto con dos warnings no bloqueantes en `FlashPopRoomRanking.tsx` y
  `scripts/integration/scenarios/s15.mjs`.
- `npm test`: 130 archivos correctos y 1 fallido; 773 tests pasan de 774. El fallo está en
  `lib/challengeIntro.test.tsx`, por la discrepancia entre `España` y `Supervivencia: España`.
- `npm run format:check`: informa 151 archivos sin formato canónico; queda fuera del alcance de
  esta actualización documental.
- `npm run supabase:schema:test`: no se pudo repetir en esta sesión porque Docker no está accesible.

La última validación completa registrada de Supabase local cargó los 47 schemas declarativos,
verificó el inventario de seguridad, pgTAP y las carreras PostgreSQL. Esa evidencia no equivale a
validación de staging o producción.

## Evidencia funcional vigente

Las suites locales registradas cubren, entre otros recorridos:

- publicación, programación y ejecución de Pirámide con siete niveles;
- recuperación autoritativa, timeout, scoring y aislamiento de spectators;
- Word Search y Word Hashtag con soluciones privadas y progreso server-side;
- Progressive Clues, Matching, Queens, Mini-Wordle y Logic-code con eventos privados;
- Flash, Supervivencia y Alphabet con sesiones, recepción, evaluación y puntuación autoritativas;
- portal privado, provisioning de usuarios Auth, creación de salas, temporadas y calendario;
- assets de avatar y `question-assets` con confirmación y resolución autorizadas.

No se debe interpretar la existencia de un test focal histórico como validación del entorno remoto.

## Limitaciones conocidas

- Docker no está disponible en la sesión actual para repetir `supabase:schema:test` o el piloto completo.
- No existe proyecto Supabase remoto vinculado.
- La validación E2E persistida es local y reproducible; no cubre staging o producción.
- Prettier mantiene 151 archivos sin formato canónico.
- ESLint mantiene dos warnings no bloqueantes.
- Stylelint conserva un selector duplicado histórico en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`.
- No existe una ronda manual exhaustiva vigente para todos los formatos, viewports, VoiceOver y
  `prefers-reduced-motion`.

## Interacciones server-authoritative

El flujo competitivo Flash debe conservar estas garantías:

- las respuestas lentas muestran estado pendiente sin revelar corrección;
- los controles se bloquean mientras el servidor procesa la operación;
- los errores de red permiten reintentar con la misma clave de idempotencia;
- una respuesta HTTP perdida no crea una segunda respuesta competitiva;
- el estado pendiente se anuncia con `role="status"` y `aria-busy`.

Los modos todavía locales no deben usar estas garantías como autoridad competitiva hasta completar
su propia vertical slice.
