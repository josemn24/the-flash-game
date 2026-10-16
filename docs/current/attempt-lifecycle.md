# Modo, estado y resultado de los intentos

Estado: vigente. Contrato implementado en TypeScript y PostgreSQL. Revisión canónica: `20261015212231_question_library_pagination`.

`status` describe el ciclo de vida. `outcome` conserva el desenlace oficial y no determina los
puntos. El modo procede de la versión inmutable del desafío, sin una columna adicional en
`public.attempts`.

| Estado        | Flash, Alfabeto, Narrative   | Supervivencia                | Pirámide                     |
| ------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| `in_progress` | `null`                       | `null`                       | `null`                       |
| `abandoned`   | `null`                       | `null`                       | `null`                       |
| `completed`   | `null`                       | `survived` / `eliminated`    | `summit` / `failed`          |
| `invalidated` | Conserva el resultado previo | Conserva el resultado previo | Conserva el resultado previo |

Un intento activo puede completarse o abandonarse. Solo un intento completado o abandonado
puede invalidarse; la invalidación conserva el resultado, puntuación, respuestas y tiempos
originales. Los ajustes y las reversiones del ledger siguen determinando los saldos efectivos.
Un abandono invalidado conserva `outcome: null`.

Los tipos canónicos y el contrato discriminado están en
[`types/domain/attempt.ts`](../../types/domain/attempt.ts). El validador puro
[`lib/attemptLifecycle.ts`](../../lib/attemptLifecycle.ts) comprueba valores y combinaciones;
no evalúa respuestas ni recalcula puntuaciones. Los adaptadores validan el JSON de PostgreSQL
antes de construir contratos de aplicación, también en historial y administración.

La finalización, el abandono y las confirmaciones terminales recuperadas devuelven
`challengeMode` y `outcome` explícitos, incluido `null`. La recuperación devuelve además
`terminalOutcome`, una señal derivada de las respuestas evaluadas. Puede contener `eliminated`
o `failed` mientras `status` sigue siendo `in_progress` y el resultado persistido es `null`.
El progreso visual mantiene su propio estado `in_progress`.

Supervivencia y Pirámide derivan el resultado oficial de respuestas persistidas. Los otros modos
asignan `null` explícitamente al completar. Las entradas HTTP actuales no aceptan autoridad
sobre el resultado; aunque el navegador añada un campo `outcome`, no se transmite al comando.
`passed` sigue existiendo como acción de pasar una letra, pero no como desenlace de intento.
No se traducen valores históricos. Una combinación desconocida o incompatible produce
`invalid_attempt_lifecycle`, con HTTP 500 y sin devolver el payload inválido.

PostgreSQL combina dos CHECK sobre los valores y estados con el `guard_attempt` existente,
que resuelve el modo mediante `challenge_version_id`. Se conservan el control de concurrencia,
la inmutabilidad y la acreditación idempotente.

## Total autoritativo al completar

En los seis modos, `complete_attempt` suma los puntos de `private.attempt_answers` dentro de
la transacción de cierre, con el intento bloqueado. Primero incorpora la evaluación pendiente
de Alfabeto o Contrarreloj, resuelve los cierres temporales y valida la terminalidad específica
del modo. Después realiza una única suma, usada para `attempts.score`, la acreditación y la
respuesta. La evaluación individual permanece en TypeScript.

El JSON privado requiere `idempotencyKey`, `attemptId`, `lockVersion` y `sessionToken`.
Conserva los campos opcionales `pendingEvaluation` y `outcome`; este último sigue sin determinar
el desenlace. `score` es un campo prohibido y devuelve `invalid_command`, incluso en un replay.
Los ajustes administrativos conservan su propio contrato con `score`. La ruta HTTP sigue
filtrando los campos autoritativos del navegador y no cambia su interfaz pública.

El adaptador utiliza la frontera transaccional común para expiración, claims, traducción de
errores y actualización del reloj de Contrarreloj. No consulta la suma antes del comando ni
envía un total. Los replays recuperan el resultado registrado sin volver a sumar o acreditar.
Abandonar conserva un total nulo y no acredita puntos aceptados. Si falla la acreditación,
se revierten también el cierre, las sesiones, la auditoría y las evaluaciones añadidas al cerrar.

La migración [authoritative_completion_score](../../supabase/migrations/20261014200324_authoritative_completion_score.sql)
reemplaza únicamente el dispatcher y el handler de intentos, conservando firmas y permisos.
El health check comprueba el contrato sin `score` y la suma interna; las pruebas del esquema
ejecutan esa misma consulta con los cuerpos anteriores para verificar que los rechaza.

## Despliegue y verificación

El ciclo de vida está incluido en el [baseline activo](../../supabase/migrations/20261011180045_initial_schema.sql),
generado desde el esquema declarativo. La reconstrucción vigente aplica además todas las
migraciones incrementales, incluida la del total autoritativo, antes de servir la app.
No incluye backfills ni adaptación de solicitudes idempotentes antiguas. Esta implementación
no reinicia ni despliega staging.

La revisión esperada está sincronizada en `.env.example`, el health check y el verificador del
piloto. Las firmas públicas y el tipo `text` de `outcome` se conservan, por lo que no cambia el
esquema público representado por los tipos generados de Supabase.

La matriz se prueba en TypeScript y en
[`supabase/tests/attempt_lifecycle.test.sql`](../../supabase/tests/attempt_lifecycle.test.sql),
junto con cierres de cero puntos, invalidación, recuperación, repetición y lecturas sin cookie.
La suite [authoritative_completion_score](../../supabase/tests/authoritative_completion_score.test.sql)
contrasta respuesta, intento, respuestas aceptadas y ledger para los seis modos, y comprueba
el rechazo sin efectos del antiguo payload. La suite de cierre de Alfabeto cubre además el
rollback de una evaluación pendiente cuando falla la acreditación; las pruebas con conexiones
independientes cubren el último envío, la versión obsoleta y las finalizaciones simultáneas.
`npm run supabase:schema:test` crea y elimina una base temporal para comprobar seguridad,
pgTAP y concurrencia. `npm run supabase:schema:test -- --migrations` repite esas comprobaciones
cargando el baseline sobre otra base limpia. `npm run test:e2e:isolated` comprueba los flujos en un stack independiente.
