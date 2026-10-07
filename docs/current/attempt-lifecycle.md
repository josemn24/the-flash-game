# Modo, estado y resultado de los intentos

Estado: vigente. Contrato implementado en TypeScript y PostgreSQL; despliegue conjunto tras el
reinicio de datos acordado. Revisión: `20261007180832_attempt_lifecycle_contracts`.

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

## Despliegue y verificación

La [migración incremental](../../supabase/migrations/20261007180832_attempt_lifecycle_contracts.sql)
se generó después de actualizar el esquema declarativo. Se omitió del SQL generado la deriva
preexistente de funciones ajenas a este cambio; no se reescribieron migraciones anteriores.
No incluye backfills ni compatibilidad histórica. Aplicar ambas entregas juntas sobre la base
reiniciada acordada; esta implementación no ejecuta reinicios remotos.

La revisión esperada está sincronizada en `.env.example`, el health check y el verificador del
piloto. Las firmas públicas y el tipo `text` de `outcome` se conservan, por lo que no cambia el
esquema público representado por los tipos generados de Supabase.

La matriz se prueba en TypeScript y en
[`supabase/tests/attempt_lifecycle.test.sql`](../../supabase/tests/attempt_lifecycle.test.sql),
junto con cierres de cero puntos, invalidación, recuperación, repetición y lecturas sin cookie.
`npm run supabase:schema:test` crea y elimina una base temporal para comprobar seguridad,
pgTAP y concurrencia. `npm run supabase:schema:test -- --migrations` repite esas comprobaciones
cargando toda la cadena incremental sobre otra base limpia. `npm run test:e2e:isolated` comprueba los flujos en un stack independiente.
