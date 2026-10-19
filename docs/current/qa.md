> Estado: vigente. Las secciones fechadas registran las comprobaciones de cada entrega y
> conservan sus resultados históricos. No sustituyen una auditoría manual de accesibilidad o interacción.

# QA actual

## Cierre de la fase 6 — 2026-10-19

**Estado: completada.** Se han contrastado los criterios de cierre con el código actual y con
las ejecuciones registradas en esta entrega. La unificación de Pirámide queda cerrada en el
repositorio, con validación local y contra Supabase aislado.

| Criterio                                            | Evidencia de cumplimiento                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todas las partidas comparten controlador y vista    | Las composiciones local y competitiva usan `usePyramidGameSession` y `PyramidGameView`, seleccionando sus proveedores respectivos. Los [contratos de tipos](../../components/game/shells/GameAppContracts.type-test.ts) aceptan `LocalPyramidDefinition` para la entrada mock y rechazan la entrada antigua y las definiciones privadas en competición.                                                                           |
| Ejecuciones locales aisladas y resultado confirmado | Las ocho [pruebas de composición local](../../components/game/shells/LocalPyramidGameApp.test.tsx) cubren callback único para `summit` y `failed`, respuestas, puntos, duración, inicio estable, revisión, replay, cambio de desafío/versión, diccionarios con carga/error/reintento y descarte de cargas tardías.                                                                                                                |
| Tipos neutrales y retirada completa                 | Resumen y progreso mínimo viven en [tipos de gameplay](../../types/gameplay/pyramid.ts); `PyramidAttemptOutcome` permanece en dominio. El controlador, almacenamiento, presentaciones, exportaciones y helpers sustituidos ya no tienen consumidores. Se conservan las reglas puras y los estilos de la vista compartida.                                                                                                         |
| Fronteras protegidas y motor estable                | El [checker](../../scripts/check-type-architecture.mjs) impide reintroducir los módulos retirados o importar datos locales privados desde la presentación pública y la composición remota. Las [pruebas del hook](../../features/game/competitive/core/useCompetitiveSession.test.tsx) acreditan estabilidad con dependencias iguales, cancelación al cambiar proveedor/desafío o desmontar e invalidación de respuestas tardías. |
| Suite unitaria y controles de calidad               | 2700 pruebas en 260 archivos; TypeScript, arquitectura de tipos y estilos, ESLint sin avisos, Stylelint, enlaces, formato de archivos modificados y build correctos. Los ignores globales excluyen `output/**` y se conserva `--max-warnings=0`.                                                                                                                                                                                  |
| E2E local completo en paralelo                      | 39/39 correctos: los 13 casos repetidos tres veces con cinco workers, sin reintentos ni omitidos. El [diagnóstico de Contrarreloj](#replay-local-de-contrarreloj--2026-10-19) registra la corrección del reloj del E2E y la comprobación de dos partidas completas por formato.                                                                                                                                                   |
| Conformidad y regresiones competitivas              | 161 escenarios de Pirámide con los 21 formatos y 25 combinaciones de formato/versión, incluidos Queens, recuperación, idempotencia, deadlines y revisión bloqueada. Otros 24 E2E y las integraciones Auth/PostgREST/RLS acreditan la regresión de los seis modos.                                                                                                                                                                 |
| SQL completo en base desechable                     | 67 suites desde los 96 archivos declarativos, inventario de seguridad, 158 casos compartidos, 904 observaciones y pruebas de concurrencia/deadlines correctos. Se ejecutó con Docker, en un contenedor independiente y secuencialmente respecto del runner E2E. Ambos entornos se eliminaron al terminar.                                                                                                                         |

Las secciones siguientes conservan la evidencia fechada de la implementación y del diagnóstico
posterior; sus resultados históricos no se sustituyen por los del cierre.

## Replay local de Contrarreloj — 2026-10-19

La investigación reprodujo el fallo del segundo arranque de Queens: la suite completa pasó
12/13 con cinco workers y el caso focal falló en sus tres repeticiones con tres workers. La traza
confirma que el controlador cambia a la cuenta atrás (`data-gameplay-layout="game"`), mientras
`AnimatePresence` conserva la introducción hasta terminar su animación de salida.

El reloj simulado adelantaba `performance.now()` respecto de `document.timeline.currentTime`,
que utiliza Web Animations. En las tres capturas de diagnóstico la diferencia era de unos
4,6 segundos; Motion asignaba a las animaciones nativas un inicio futuro y la espera superaba
los cinco segundos de la aserción. El problema se originaba en el E2E.

`local-time-trial-rehearsal.spec.ts` utiliza ahora el reloj real del navegador y espera los estados
visibles de la cuenta atrás 3–2–1, sin adelantos artificiales ni pausas fijas. Queens y Conectar
parejas completan y revisan dos partidas consecutivas, comprobando el reinicio desde la primera
prueba, ambos tamaños de tablero, 100 puntos y ausencia de llamadas al backend.

- Suite E2E local completa: `npm run test:e2e:local-rehearsals -- --workers=5 --repeat-each=3`,
  39/39 correctos (13 casos repetidos tres veces) en 2,3 minutos, sin reintentos ni omitidos.
  Se mantienen las animaciones y los timeouts existentes.
- Motor, adaptador React y proveedor local de Contrarreloj: 69 pruebas unitarias correctas en
  tres archivos.
- TypeScript, arquitectura de tipos, ESLint con cero avisos, enlaces y formato de los archivos
  modificados: correctos.

## Consolidación de Pirámide: fase 6 — 2026-10-19

La entrada local recibe definiciones canónicas y comparte controlador y vista con competición.
Se retiraron las dos presentaciones y el controlador anteriores, junto con sus transiciones y
almacenamiento. Los tipos de resultado y progreso del lobby son neutrales. Las pruebas nuevas
cubren emisión única del resultado, revisión, replay, cambio de desafío/versión, preparación y
reintento de diccionarios, estabilidad del motor e invalidación de respuestas tardías.

- Suite unitaria completa: 260 archivos y 2700 pruebas correctas.
- ESLint completo: correcto con cero avisos. `output/**` se excluye como artefactos generados;
  las reglas de dependencias de hooks y variables sin uso permanecen activas.
- Arquitectura de tipos y estilos, Stylelint, enlaces y formato de los archivos modificados: correctos.
- TypeScript y build de producción de Next.js: correctos.
- Ensayos locales sin backend: 13 E2E correctos en una ejecución completa con un worker. La primera
  ejecución concurrente pasó 12/13 y falló en el segundo arranque tras replay de Contrarreloj Queens;
  su repetición aislada pasó 3/3, y la repetición completa pasó 13/13 sin cambios de código o pruebas.
- Conformidad de Pirámide: 161 escenarios correctos con HTTP, Auth y Supabase temporal reales,
  incluidos los 21 formatos y 25 combinaciones de formato/versión, consecuencias y tiempos exactos,
  tres fallos de Queens, recuperación, idempotencia, pérdida de confirmación y revisión autorizada.
- Regresión competitiva de los seis modos: 24 E2E correctos (Flash 5, Alfabeto 7, Supervivencia 1,
  Narrativa 2, Pirámide 5 y Contrarreloj 4), sin omitidos ni reintentos de Playwright. Las integraciones
  de Auth, PostgREST y RLS de los seis escenarios también finalizaron correctamente.
- Total del runner remoto: 185 E2E correctos en un stack Supabase desechable.

- SQL completo: 67 suites correctas desde los 96 archivos declarativos, inventario de seguridad,
  158 casos compartidos de formatos y 904 observaciones de validación correctos. También pasan las
  pruebas concurrentes y las carreras de deadline tras adquirir el bloqueo de Contrarreloj y Conectar parejas.

El stack E2E y el contenedor SQL independientes se eliminaron al terminar. Las comprobaciones
se ejecutaron secuencialmente entre ambos entornos; no se modificaron esquemas, endpoints ni
bases existentes. Las secciones históricas siguientes se conservan.

## Primer baseline de Supabase — 2026-10-11 (histórico)

El baseline anterior `20261010214230_initial_schema` se probó desde cero en Supabase local. Pasan las 55
suites SQL, inventario y concurrencia al cargar `supabase/schemas/` y al aplicar la única migración;
la reconciliación informa cero diferencias de definición y comportamiento. Pasan también las 158
comprobaciones SQL compartidas, las 904 observaciones de validación, los contratos concurrentes,
`schema:revision:check`, `supabase:types:check`, `docs:check` y `verify:pilot` completo, incluidos
unit tests, typecheck, arquitectura, lint, build, integración, E2E, diccionario y backup/restore.

El reset local final confirma una sola revisión aplicada, cero usuarios de Auth, cero filas en las
tablas de `public` y `private`, cero objetos de Storage y únicamente los buckets locales configurados
vacíos. No se hicieron operaciones ni validaciones en staging.

Las secciones fechadas a continuación conservan el contexto de comprobaciones anteriores.

## Baseline regenerado desde schemas — 2026-10-11

La revisión activa `20261011180045_initial_schema` contiene el estado de los 82 archivos
declarativos. Las tres migraciones que estaban activas antes de esta regeneración se conservan en
Git. No contenían DML ni backfills que deban repetirse después del reset.

Las 55 suites SQL, el inventario de seguridad, 158 casos compartidos de conformidad, 904
observaciones de validación y las pruebas concurrentes pasan tanto desde `schemas/` como desde el
baseline. La reconciliación confirma 222 funciones, 41 contratos, cinco carreras adicionales y
cero diferencias de definición o comportamiento. Pasan `schema:revision:check`, `supabase:types:check`,
`docs:check`, typecheck, arquitectura de tipos y estilos, ESLint, formato y build.

`verify:pilot` se detuvo en Vitest: la aserción de agenda de
`scripts/seed-betavip.test.mjs` no coincide con el SQL que genera el seed. La prueba de arquitectura
que falló en esa ejecución por una colisión de archivo temporal pasa aislada. En una ejecución
serial, las otras 225 suites (2.060 pruebas) pasan; el seed conserva un fallo aislado (10/11).
Por ese corte no se ejecutaron las etapas de integración y E2E de `verify:pilot`.

Tras el reset final local, el ledger contiene solo `20261011180045`, Auth tiene cero usuarios, las
tablas de `public` y `private` suman cero filas y Storage no tiene objetos. Los buckets locales
`avatars` y `question-assets` están vacíos. No se cargaron fixtures, bootstrap ni diccionarios y no
se ejecutaron operaciones contra staging.

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

El esquema declarativo vigente contiene 82 archivos y la revisión activa es
`20261011180045_initial_schema`, un baseline generado desde esos archivos. Las 33 migraciones
incrementales anteriores se conservan en Git. El esquema contiene 31 tablas, dos vistas internas y un
inventario de seguridad registrado. La validación del baseline se ejecuta en local; staging queda
fuera de esta fotografía.

## Comprobaciones ejecutadas — fotografía anterior al baseline

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
- `npm run supabase:schema:test`: correcto; 80 archivos declarativos, inventario de seguridad y la
  suite nueva `s21_attempt_expiration.test.sql` pasan, incluidas las pruebas concurrentes.

Las validaciones focales de S17, la integración Auth/PostgREST/RLS y los E2E descritos en los registros
históricos siguen siendo evidencia de ejecuciones anteriores. No se repiten ni se presentan como una
ejecución completa del piloto en esta fotografía.

La validación local no equivale a
validación de staging.

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
- La validación E2E persistida es local y reproducible; no cubre staging.
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

## Incidencia de la prueba SQL de Logic Code

Durante la verificación de la instalación limpia, la comprobación de ocultación de la solución
en `e02_logic_code.test.sql` rechazó una respuesta válida porque un UUID aleatorio contenía
los dígitos `0420`. La comparación anterior buscaba esa subcadena en todo el JSON serializado.
La prueba ahora comprueba valores JSON completos y la ausencia de la clave `correctAnswer`.
No se modifican payloads, validadores ni reglas de Logic Code; se elimina un falso positivo
de la prueba existente.

La ejecución completa detectó además expectativas anteriores a cambios ya presentes en el código:
BetaVIP publica la imagen progresiva durante 5.000 ms y las revisiones autorizadas de otros miembros
resuelven assets privados. Se actualizaron esas expectativas sin cambiar el contenido ni la
autorización SQL, y se añadió el caso sin filas de revisión autorizadas. La comprobación de carpetas
ignora `.DS_Store` y el fixture temporal reservado del checker de arquitectura para evitar que
las pruebas concurrentes interfieran. Se retiraron dos variables sin uso en helpers de pruebas.

## Contrarreloj: Conectar parejas — 2026-10-16

- 245 suites unitarias y 2.407 pruebas aprobadas con `npm test -- --maxWorkers=1`.
- 67 suites SQL completas aprobadas desde el esquema declarativo y desde migraciones, con inventario
  de permisos, 158 casos de conformidad, 904 observaciones de validación y carreras concurrentes.
- La suite focal `time_trial_connect_pairs.test.sql` añade 43 comprobaciones: geometría de caminos,
  soluciones alternativas, contenido homogéneo, edición/publicación, reloj único, idempotencia,
  recuperación, revisión protegida y recepciones evaluadas después del límite.
- Compilación, TypeScript, arquitectura de tipos y estilos, revisión de esquema y enlaces aprobados.
  ESLint del código fuente pasa con `--ignore-pattern 'output/**'`; el comando sin exclusión detecta
  un warning previo en un script de backup generado bajo `output/local/backups/`.
- Los tipos generados de `public` coinciden byte a byte con `database.types.ts`: no hay nuevas firmas públicas.
- 24 pruebas E2E aprobadas en el stack aislado: Conectar parejas 4/4 (incluido editor y publicación),
  Contrarreloj Queens 4/4, Flash 5/5, Alfabeto 7/7, Supervivencia 1/1, Pirámide 1/1 y Narrativa 2/2.
  Las integraciones Auth/PostgREST/RLS de ambos formatos de Contrarreloj también pasan.
- Una carrera real de Conectar parejas verifica que adquirir el bloqueo después del deadline
  rechaza la respuesta completa sin crear recepción; pasa desde schemas y migraciones.
- Solo se utilizan contenedores y bases desechables. No se aplica la migración a los datos existentes
  ni se ejecutan operaciones de staging; la calibración editorial sigue pendiente.
