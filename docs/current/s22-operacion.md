# S22 — Operación del piloto

> Estado: vigente. La verificación funcional reproducible sigue siendo local/CI; el repositorio declara
> la integración de producción con Vercel Cron, pero el despliegue y sus logs deben validarse en el
> proyecto remoto.

S22 fija un alcance cerrado para operar localmente y en CI, y deja documentado el scheduler de
producción sin convertir el entorno remoto en requisito para la verificación reproducible.
El piloto incluye Flash, Narrative, Supervivencia y Pirámide competitivos persistidos y portal superadmin sobre Supabase, incluidos E01
Mini-Wordle, E02 Logic-code, E03 Progressive-clues, E04 Matching, E05 Queens, E06 Word-search, F08 Logic-matrix, F16 Zip, F18 Escape, F19 Word-hashtag y E10 Progressive-image,
además de los formatos F habilitados. Narrativa, formatos no migrados, E07–E09, takeover y
`results_locked_at` siguen fuera de alcance. La expiración por inactividad de intentos competitivos
sí está activa: 15 minutos sin actividad tras cierre/deadline, estado `abandoned`, sin puntos.
D08a/S13 habilita avatares y
D08b habilita assets privados de E10 y `multiple-choice` desde el editor y el recorrido competitivo.
S14 limita el editor de Supervivencia a formatos con evaluación server-side.

## Runtime scope

El servidor lee `FLASH_RUNTIME_SCOPE` para aplicar controles operativos y de origen; no selecciona
la composición de datos:

- `pilot`: cualquier fallo de Auth, PostgREST o PostgreSQL termina en un error recuperable, `404`
  autorizado o `503`. No hay fallback a fixtures.
- `development`: conserva los controles locales y permite verificar las pruebas de la aplicación.
- `test`: permite verificar contratos mock aislados y pruebas de UI.

Un build con `NODE_ENV=production` usa `pilot` si la variable no está definida. Un valor desconocido
falla al arrancar la composición server-only.

| Superficie                                  | Pilot                                                                                             | Development/Test             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `/`, `/salas/[roomId]`, rankings, historial | Supabase                                                                                          | Supabase                     |
| `/desafios/[challengeId]?roomId=<slug>`     | Supabase; Flash, Narrative, Supervivencia y Pirámide admiten los formatos con evaluación competitiva migrada | Supabase                     |
| `/desafios/[challengeId]` sin sala          | 404                                                                                               | 404                          |
| aliases como `tabarnia-room`                | Supabase; 404 si no existe como sala persistida                                                   | Supabase; nunca fixture mock |
| `/formatos`, `/demo/**`                     | Demo/práctica; `/flash-pop/**` redirige permanentemente a `/demo/**`                              | Demo/práctica                |
| `/admin` y `/api/internal/calendar/tick`    | Supabase + autorización                                                                           | Supabase + autorización      |

## Contrato HTTP

Las mutaciones competitivas requieren `Origin` igual a `APP_ORIGIN` cuando el runtime es `pilot`.
Los cuerpos JSON están limitados a 32 KiB; el editor editorial limita el documento a 256 KiB.
Los errores competitivos tienen la forma `{ error: { code, requestId } }`, usan `Cache-Control:
no-store` y devuelven `X-Request-Id`. Un bucket en memoria limita comandos competitivos y comandos
administrativos durante el piloto; no es una garantía de escalado multiinstancia.

`GET /api/internal/health` exige `Authorization: Bearer <HEALTHCHECK_SECRET>` y comprueba Auth,
PostgreSQL y la revisión indicada por `EXPECTED_SCHEMA_REVISION`. Solo devuelve estado agregado y
no contiene credenciales, JWT, cookies ni datos de dominio.

El calendar tick de producción se ejecuta mediante Vercel Cron con `GET
/api/internal/calendar/tick` a las 00:05 UTC y `Authorization: Bearer <CRON_SECRET>`. Vercel solo
programa cron para despliegues de producción: no se ejecuta en previews y no reintenta una
invocación fallida. La recuperación manual usa `CALENDAR_TICK_SECRET` y `npm run calendar:tick`,
que conserva el `POST` del endpoint. El tick incluye la limpieza global de intentos inactivos y
devuelve `abandonedAttempts`. La lectura de historial y los comandos de partida ejecutan además una
reconciliación limitada a la sala o al intento; una partida sin nuevas lecturas ni acciones puede
permanecer pendiente hasta la siguiente ejecución diaria. El tick sigue siendo idempotente y
`start_attempt` revalida la ventana temporal.

## Verificación reproducible

Con Docker disponible y sin desplegar sobre un proyecto remoto:

```bash
npm run verify:pilot
```

El comando arranca Supabase local, comprueba el esquema desde una base limpia, ejecuta tests,
typecheck, lint, build, escenarios de integración/E2E por fixture —incluido S17— y una prueba de backup/restore.
Los logs y artefactos temporales se escriben en `output/s22/`, ignorado por Git.

`npm run test:e2e -- e2e/<escenario>.spec.ts` es autocontenido para los escenarios registrados: arranca
Supabase, reinicia la base, recrea las cuentas Auth y el fixture, ejecuta Playwright y limpia al terminar.
Cuando otro comando ya ha preparado deliberadamente el fixture, `test:e2e:raw` permite ejecutar Playwright
sin repetir ese bootstrap; es el modo usado internamente por `verify:pilot`.

Para una ejecución manual aislada:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s03
npm run test:integration:supabase -- --scenario s03
FLASH_RUNTIME_SCOPE=pilot APP_ORIGIN=http://127.0.0.1:3000 npm run test:e2e -- e2e/s03-flash.spec.ts
```

Para S17, la verificación aislada cubre el historial editorial de Flash, Narrative, Supervivencia y Pirámide;
la corrección de una pregunta continúa pasando por `/admin/questions`.

Para E01, el reset debe ir seguido de la carga del diccionario antes de crear el fixture:

```bash
npm run supabase:db:reset
npm run supabase:dictionary:load
npm run supabase:fixture -- --scenario e01
npm run test:integration:supabase -- --scenario e01
npm run test:e2e -- e2e/e01-mini-wordle.spec.ts
```

El contrato público de Mini-Wordle solo incluye pregunta, pista, longitud, máximo de intentos y
progreso aceptado. `correctAnswer`, `additionalGuesses` y `dictionaryId` permanecen privados. Cada
palabra válida procede del diccionario general o de la lista `additionalGuesses` específica de la
pregunta; la solución puede ser una palabra temática aunque no esté en el diccionario general.
Las palabras específicas no se cargan en la tabla global. La restauración local debe conservar
`mini_wordle_guess_events`, recepciones, resultados y ranking; el comando de carga del diccionario
es idempotente y se ejecuta después de cada reset.

Para E02 no hace falta cargar diccionario:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario e02
npm run test:integration:supabase -- --scenario e02
npm run test:e2e -- e2e/e02-logic-code.spec.ts
```

Para E03 tampoco hace falta cargar diccionario:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario e03
npm run test:integration:supabase -- --scenario e03
npm run test:e2e -- e2e/e03-progressive-clues.spec.ts
```

Progressive-clues registra la primera pista con penalización cero y las siguientes mediante
`POST /api/competitive/attempts/[attemptId]/progressive-clues/reveal`. El payload jugable no
contiene la solución ni pistas futuras; `lockVersion`, el plazo, la secuencia, la idempotencia y
los puntos disponibles los decide PostgreSQL. `cluePenalty` se expresa sobre 100 puntos y escala al
valor del nivel: con 12 puntos y penalización 20, cada pista adicional resta 2. La evaluación usa el
máximo persistido por la última revelación. Una respuesta incorrecta o timeout recibe cero puntos.

Para E04:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario e04
npm run test:integration:supabase -- --scenario e04
npm run test:e2e -- e2e/e04-matching.spec.ts
```

Matching valida cada pareja con `POST /api/competitive/attempts/[attemptId]/matching/pair`.
Los eventos privados conservan aciertos y fallos; el jugador recibe solo progreso seguro y la
revisión autorizada reconstruye las correspondencias completas.

Para E05:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario e05
npm run test:integration:supabase -- --scenario e05
npm run test:e2e -- e2e/e05-queens.spec.ts
```

Queens actualiza el tablero localmente, guarda checkpoints con `POST /api/competitive/attempts/[attemptId]/queens/draft`
y valida automáticamente el tablero completo con `POST /api/competitive/attempts/[attemptId]/queens/validate`
al colocar las `N` coronas del tablero. Las validaciones incorrectas mantienen la interacción abierta y aplican
una penalización del 5%; las marcas X son locales y la solución solo aparece en la revisión autorizada.

No existe todavía despliegue remoto ni rollback de migraciones destructivo. El rollback del piloto
es de aplicación: conservar el esquema compatible, detener el proceso actual y arrancar el build
anterior sin sustituir datos por mocks.
