> Estado: vigente. Fotografía de las comprobaciones automatizadas del repositorio a 2026-09-30;
> no sustituye una auditoría manual de accesibilidad o interacción.

# QA actual

## Extracción de renderizadores por formato — 2026-10-03

Comprobación focal de la fase 1, ejecutada entre el 2 y el 3 de octubre. Esta sección registra
el refactor de entrada de práctica y presentación de resultados; la fotografía general del resto
del documento corresponde al 30 de septiembre.

Los 31 formatos tienen `PracticeInput.tsx` y `ReviewContent.tsx`, seleccionados por registros
tipados con cobertura obligatoria mediante `satisfies`. Las fachadas conservan sus exports y
envoltorios públicos y quedan en 23 y 10 líneas. Se mantienen los genéricos, callbacks, claves
de reinicio, valores iniciales y CSS existentes. Los adaptadores competitivos, SQL y migraciones
no forman parte del cambio.

### Comprobaciones automatizadas

| Comprobación                           | Resultado                                                       |
| -------------------------------------- | --------------------------------------------------------------- |
| Extracción piloto de elección múltiple | 25 tests de 4 archivos correctos; TypeScript y ESLint correctos |
| `npm test`                             | 181 archivos, 1.239 tests correctos                             |
| `npm run typecheck`                    | Correcto                                                        |
| `npm run type-architecture`            | Correcto                                                        |
| `npm run lint`                         | Correcto, sin warnings                                          |
| `npm run style-architecture`           | Correcto; 98 CSS Modules                                        |
| `npm run format:check`                 | Correcto                                                        |
| `npm run build`                        | Correcto; Next.js 16.2.10, 36 páginas generadas                 |

Una comparación mediante AST y normalización de formato comprobó la equivalencia de las 72
declaraciones de función trasladadas, los 31 formatos de cada registro, las fronteras de cliente
y la reutilización de `ShortTextInput`. La suite existente cubre el feedback pendiente/error de
elección múltiple, las rutas parciales de Conectar parejas y la revisión de Mini-Wordle.

El build terminó antes de iniciar los servidores E2E. Se ejecutaron estas suites existentes
mediante `npm run test:e2e:isolated -- <specs>`:

| Suite                            | Resultado final |
| -------------------------------- | --------------- |
| `e2e/phase3-boundaries.spec.ts`  | 1/1 correcto    |
| `e2e/s03-flash.spec.ts`          | 4/4 correctos   |
| `e2e/s07-history-review.spec.ts` | 1/1 correcto    |
| `e2e/e01-mini-wordle.spec.ts`    | 2/2 correctos   |
| `e2e/e05-queens.spec.ts`         | 2/2 correctos   |

La primera ejecución de E01 falló esperando la pregunta inicial y la de E05 esperando el botón
de inicio. Ambas suites pasaron completas al repetirlas en un stack temporal nuevo, sin cambios
de código. El resultado final es de 10 tests correctos; no se ocultan los fallos de la primera
ejecución. Los stacks temporales se cerraron al terminar.

### Revisión en navegador

Se revisaron las entradas y resultados sobre el build de producción en Chrome, con viewports
de 1280 × 900 y 406 × 847. Las capturas y snapshots se guardaron bajo
`output/playwright/phase1/`, como evidencia local no versionada.

| Ejemplo           | Interacción y revisión comprobadas                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Elección múltiple | Selección de Ottawa, solución comentada, timeout y reintento                                                                   |
| Estimación        | Valor inicial de 300 m, ajuste con botones hasta 330 m, revisión exacta y reinicio a 300 m                                     |
| Mini-Wordle       | Carga del diccionario, envío de LUNA con Enter y revisión de letras, intentos y solución                                       |
| Queens            | Colocación de cinco coronas, envío automático y comparación de respuesta y solución                                            |
| Conectar parejas  | Resolución con Enter/flechas, 3/3 parejas y 100 % de cobertura; arrastre y conservación visual de rutas parciales tras timeout |

Las capturas conservan los estilos y la distribución responsive. Las revisiones largas de los
tableros utilizan el scroll del diálogo. Esta ronda cubre los cinco ejemplos indicados, no una
auditoría manual completa de los 31 formatos ni dispositivos físicos.

Observaciones para seguimiento:

- Los clics automatizados de Playwright sobre las celdas de Conectar parejas no iniciaron rutas.
  El arrastre y el teclado sí funcionaron. La interacción por clic queda sin validar en esta
  ronda; `ConnectPairsQuestion.tsx` no se ha modificado en el refactor.
- Los servidores E2E informaron de imágenes decorativas no válidas bajo `/flash-pop/`; los
  tests terminaron correctamente en las ejecuciones indicadas. Los assets y sus rutas no se
  han modificado.

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
`20260929210000_remove_legacy_flash_history_wrappers`. El historial local incluye además las revisiones declarativas de S17 y S15;
hay 30 tablas, una vista interna y un inventario de seguridad registrado. La CLI local tiene un proyecto
de staging vinculado, pero S17 todavía no se ha aplicado ni validado allí.

## Comprobaciones ejecutadas actualmente

- `npm run schema:revision:check`: correcto.
- `npm run docs:check`: correcto; 65 archivos Markdown comprobados.
- `npm run typecheck`: correcto.
- `npm run type-architecture`: correcto.
- `npm run lint`: correcto, con `--max-warnings=0`.
- `npm run build`: correcto con Next.js 16.2.10 en un checkout aislado; el workspace principal tenía
  un proceso Next activo manteniendo `.next/lock`.
- `npm test`: 158 archivos y 928 tests correctos.
- `npm run format:check`: correcto; `supabase/.temp/` queda excluido por ser salida generada de la
  CLI.
- `npm run stylelint`: correcto; no informa errores.
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
- Prettier no informa archivos pendientes; la salida generada de `supabase/.temp/` está excluida.
- El gate global de Vitest pasa con 928 tests; la suite SQL también pasa con Supabase local.
- ESLint y Stylelint no presentan errores ni warnings.
- El build se verificó en un checkout aislado porque el workspace principal mantiene un proceso Next
  activo sobre `.next/lock`.
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
