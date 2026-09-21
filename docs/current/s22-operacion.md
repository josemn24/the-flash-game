# S22 — Operación del piloto

> Estado: vigente. Alcance local/CI; no hay proyecto remoto enlazado.

S22 fija un alcance cerrado para operar localmente y en CI sin declarar todavía un entorno remoto.
El piloto incluye Flash competitivo persistido y portal superadmin sobre Supabase, incluidos E01
Mini-Wordle, E02 Logic-code, E03 Progressive-clues, E04 Matching, E05 Queens y E10 Progressive-image,
además de los formatos F habilitados. Los demás modos, formatos no migrados, E06–E09, abandono
automático, takeover y `results_locked_at` siguen fuera de alcance. D08a/S13 habilita avatares y
D08b habilita assets privados de E10 y `multiple-choice` desde el editor y el recorrido competitivo.

## Runtime scope

El servidor lee `FLASH_RUNTIME_SCOPE`:

- `pilot`: solo rutas persistidas; cualquier fallo de Auth, PostgREST o PostgreSQL termina en un
  error recuperable, `404` autorizado o `503`. No hay fallback a fixtures.
- `development`: permite las rutas explícitas de práctica, preview y demo.
- `test`: permite verificar contratos mock aislados y pruebas de UI.

Un build con `NODE_ENV=production` usa `pilot` si la variable no está definida. Un valor desconocido
falla al arrancar la composición server-only.

| Superficie | Pilot | Development/Test |
| --- | --- | --- |
| `/`, `/salas/[roomId]`, rankings, historial | Supabase | Supabase; mocks solo en aliases explícitos |
| `/desafios/[challengeId]?roomId=<UUID>` | Supabase; Flash admite MC + Mini-Wordle + Logic-code + Progressive-clues + Matching + E10 | Supabase |
| `/desafios/[challengeId]` sin sala | 404 | Preview mock explícito |
| aliases como `tabarnia-room` | 404 | Demo mock |
| `/formatos`, `/flash-pop/**` | Demo/práctica | Demo/práctica |
| `/admin` y `/api/internal/calendar/tick` | Supabase + autorización | Supabase + autorización |

## Contrato HTTP

Las mutaciones competitivas requieren `Origin` igual a `APP_ORIGIN` cuando el runtime es `pilot`.
Los cuerpos JSON están limitados a 32 KiB; el editor editorial limita el documento a 256 KiB.
Los errores competitivos tienen la forma `{ error: { code, requestId } }`, usan `Cache-Control:
no-store` y devuelven `X-Request-Id`. Un bucket en memoria limita comandos competitivos y comandos
administrativos durante el piloto; no es una garantía de escalado multiinstancia.

`GET /api/internal/health` exige `Authorization: Bearer <HEALTHCHECK_SECRET>` y comprueba Auth,
PostgreSQL y la revisión indicada por `EXPECTED_SCHEMA_REVISION`. Solo devuelve estado agregado y
no contiene credenciales, JWT, cookies ni datos de dominio.

## Verificación reproducible

Con Docker disponible y sin enlazar un proyecto remoto:

```bash
npm run verify:pilot
```

El comando arranca Supabase local, comprueba el esquema desde una base limpia, ejecuta tests,
typecheck, lint, build, escenarios de integración/E2E por fixture y una prueba de backup/restore.
Los logs y artefactos temporales se escriben en `output/s22/`, ignorado por Git.

Para una ejecución manual aislada:

```bash
npm run supabase:db:reset
npm run supabase:fixture -- --scenario s03
npm run test:integration:supabase -- --scenario s03
FLASH_RUNTIME_SCOPE=pilot APP_ORIGIN=http://127.0.0.1:3000 npm run test:e2e -- e2e/s03-flash.spec.ts
```

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
los puntos disponibles los decide PostgreSQL. Una respuesta incorrecta o timeout recibe cero puntos.

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

Queens valida cada colocación o retirada con `POST /api/competitive/attempts/[attemptId]/queens/place`.
El tablero se reconstruye desde eventos privados; las marcas X son locales y la solución solo aparece
en la revisión autorizada.

No existe todavía despliegue remoto ni rollback de migraciones destructivo. El rollback del piloto
es de aplicación: conservar el esquema compatible, detener el proceso actual y arrancar el build
anterior sin sustituir datos por mocks.
