# Extracción de operaciones de intentos

Estado: vigente. Organización de comandos implementada; la revisión y el alcance por entorno
se consultan en [estado actual](status.md). La secuencia de la entrega original está archivada.

## Responsabilidades

`execute_command` conserva su cuerpo: validación de entrada, identidad verificada, hash de
secretos, bloqueo idempotente, auditoría y almacenamiento del resultado. Las fachadas utilizadas
por el adaptador mantienen sus firmas y permisos.

`handle_attempt_command` conserva la autorización, bloqueos, sesión, replay, control optimista,
estado y cancelación, seguidos de la selección de operación y el epílogo común. El inicio mantiene
su ruta especial, porque todavía puede no existir el intento.

Los archivos planos `89_attempt_*` agrupan helpers, administración, inicio, sesión,
interacciones, evaluación y cierre. Las invitaciones viven en `89_invitation_commands.sql`.
Los siete helpers corresponden a `start`, `takeover`, `prepare`, `activate`,
`submission` (`receive`/`pass`), `evaluation` y `closure` (`complete`/`abandon`).

Excepto `start`, devuelven una fila con `updated_attempt public.attempts`,
`operation_result jsonb` y `clear_progress boolean`. El coordinador recibe esa fila en un
`record` y utiliza el intento actualizado antes de su epílogo. El inicio devuelve el sobre
JSON existente, incluido su replay. No se crean tipos persistentes ni nuevas tablas.

Los helpers son `VOLATILE`, `SECURITY INVOKER`, propiedad de `postgres`, con
`search_path = ''` y sin ejecución directa para `PUBLIC`, `anon`, `authenticated` o
`service_role`. El inventario registra sus firmas, volatilidad y ACL.

## Verificación reproducible

```bash
npm run supabase:schema:test
npm run supabase:schema:test -- --migrations
npm run supabase:schema:reconciliation:test
npm run supabase:schema:upgrade:test
npm test -- infrastructure/supabase/platform/health.test.ts
npm run test:e2e:isolated -- e2e/s03-flash.spec.ts e2e/s04-recovery.spec.ts e2e/s05-alphabet.spec.ts e2e/s14-survival.spec.ts e2e/s15-pyramid.spec.ts e2e/time-trial.spec.ts
npm run typecheck
npm run schema:revision:check
npm run docs:check
```

`SUPABASE_DB_CONTAINER` permite seleccionar un contenedor de PostgreSQL de pruebas. Cada suite
SQL crea y elimina sus propias bases. Los E2E usan un stack separado y lo eliminan al terminar.

La prueba de actualización está integrada en `verify:pilot`. Primero reconstruye todas las
migraciones anteriores al refactor y ejecuta las mismas expectativas de caracterización. Prepara
un resultado acreditado, una recepción pendiente con sesión transferida, un nivel de Pirámide
preparado y una interacción Narrativa activa. Aplica únicamente la migración del refactor y
comprueba todas las filas del dominio, OID, ACL, atributos y cuerpos ajenos al coordinador.
Después verifica los replays anteriores sin escrituras adicionales y continúa/cierra los intentos.

La secuencia de migración, aplicación local y resultados originales está en el
[informe histórico](../archive/reports/sql-attempt-handlers-2026-10-15.md).
