> Estado: vigente. Fotografía de las comprobaciones automatizadas del repositorio a 2026-09-29;
> no sustituye una auditoría manual de accesibilidad o interacción.

# QA actual

## Estado de la aplicación

La integración local cubre S01–S15, S17, S17a, S18b parcial, S20, D08a/D08b, S05-Alphabet,
F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19 y E01–E06/E10. Incluye Auth, perfil, salas,
temporadas, calendario, Flash, Alphabet, Supervivencia, Pirámide, rankings, historial común,
revisión autorizada, portal de superadmin, biblioteca editorial y assets privados.

S18b solo habilita actualmente concesión/revocación de admin y eliminación lógica de miembros.
Transferencia de propiedad, bloqueo/desbloqueo e invitaciones completas siguen pendientes.
Narrativa, E07–E09, takeover, `results_locked_at`, pruebas fantasma y anonimización siguen pendientes;
la expiración por inactividad de intentos competitivos ya está implementada mediante tick y
reconciliación bajo demanda; S20 ya cubre las correcciones administrativas de resultados.

El esquema declarativo vigente contiene 54 archivos y la revisión canónica es
`20260929200000_room_member_review_modes`. El historial local incluye además las revisiones declarativas de S17 y S15;
hay 30 tablas, una vista interna y un inventario de seguridad registrado. La CLI local tiene un proyecto
de staging vinculado, pero S17 todavía no se ha aplicado ni validado allí.

## Comprobaciones ejecutadas actualmente

- `npm run schema:revision:check`: correcto.
- `npm run docs:check`: correcto; 65 archivos Markdown comprobados.
- `npm run typecheck`: correcto.
- `npm run type-architecture`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto con Next.js 16.2.10.
- `npm test`: 145 archivos y 840 tests correctos.
- `npm run format:check`: informa 156 archivos sin formato canónico; queda pendiente como deuda de
  formato y no bloquea la verificación funcional.
- `npm run stylelint`: informa 6 errores de selectores duplicados en 5 módulos CSS.
- `npm run test:pwa:worker`: correcto; el service worker es JavaScript válido.
- `npm run dictionary:check`: correcto; los diccionarios de 4 y 5 letras están actualizados.
- `npm run supabase:schema:test`: correcto; 54 archivos declarativos, inventario de seguridad y la
  suite nueva `s21_attempt_expiration.test.sql` pasan, incluidas las pruebas concurrentes.

Las validaciones focales de S17, la integración Auth/PostgREST/RLS y los E2E descritos en los registros
históricos siguen siendo evidencia de ejecuciones anteriores. No se repiten ni se presentan como una
ejecución completa del piloto en esta fotografía.

La validación local no equivale a
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

- La CLI local tiene staging vinculado, pero no se ha aplicado ni validado S17 en ese proyecto remoto.
- La validación E2E persistida es local y reproducible; no cubre staging o producción.
- Prettier mantiene 156 archivos sin formato canónico.
- El gate global de Vitest pasa con 840 tests; la suite SQL también pasa con Supabase local.
- ESLint no presenta errores; mantiene una advertencia preexistente de dependencia de hook en
  `features/game/useServerFlashSession.ts`.
- Stylelint informa seis selectores duplicados en
  `app/flash-pop-concepts/FlashPopConcepts.module.css`, `components/auth/AuthPanel.module.css`,
  `components/game/shared/ChallengeIntro.module.css`,
  `components/game/modes/alphabet/AlphabetGameApp.module.css` y
  `components/game/modes/flash-pop/RoomLeaderboard.module.css`.
- La integración Supabase y los E2E persistidos no forman parte de esta fotografía; la validación
  remota/staging sigue pendiente.
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
