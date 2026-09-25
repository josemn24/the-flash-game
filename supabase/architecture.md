# Arquitectura de la base de datos

Esta página resume las fronteras de la base de datos. La arquitectura completa de la aplicación se
documenta en [`docs/current/architecture.md`](../docs/current/architecture.md).

## Dos esquemas con responsabilidades distintas

- `public` contiene la superficie de datos que puede proyectarse mediante la Data API: identidad
  propia, salas, membresías, temporadas, publicaciones e información resumida de los intentos.
- `private` contiene soluciones, contenido editorial, sesiones, tiempos autoritativos, respuestas,
  puntuaciones, auditoría y eventos internos de los modos de juego.

El schema `private` no está expuesto por PostgREST. La configuración solo expone `public` y
`graphql_public`; las ACL y RLS añaden una segunda frontera de seguridad.

## Flujo de dominio

```text
player
  └─ room_membership ─ room ─ season ─ scheduled_challenge ─ attempt
                                                   └─ challenge_version
                                                        └─ challenge_item
                                                             └─ question_version
                                                                  └─ solución privada
```

Las preguntas y desafíos están versionados. Un `challenge_item` selecciona una versión exacta de
pregunta, conserva su posición y sus puntos, y las versiones publicadas se congelan para preservar
el histórico.

Cada intento se relaciona con un jugador y una publicación. Sus sesiones, intervalos de tiempo,
recepciones, respuestas y entradas de puntuación se guardan de forma separada para poder validar
orden, tiempo, idempotencia y auditoría sin confiar en fechas o resultados enviados por el cliente.

## Comandos y autoridad del servidor

Las mutaciones competitivas y administrativas se ejecutan mediante funciones privadas y wrappers
estrechos. El navegador no tiene DML genérico sobre las tablas de dominio ni recibe soluciones
durante el juego.

Los comandos privados:

- validan el actor y la sesión controladora;
- bloquean el intento cuando es necesario;
- persisten el reloj antes de devolver contenido jugable;
- usan claves de idempotencia para reintentos seguros;
- registran eventos append-only cuando el modo lo necesita;
- dejan la evaluación y la acreditación en transacciones coherentes.

Los modos Mini-Wordle, Logic-code, Progressive-clues, Matching y Queens persisten sus eventos en
tablas privadas vinculadas a `attempts` y `challenge_items`. El progreso público se reconstruye
desde esos eventos sin revelar soluciones ni pistas futuras.

## Seguridad y acceso

- Auth identifica al usuario; `players.id` es la identidad propia del dominio.
- Las lecturas públicas pasan por RLS o funciones autorizadas por membresía.
- Las soluciones, tokens y datos operativos no tienen lectura directa del navegador.
- `service_role` no sustituye los comandos ni recibe DML genérico sobre el dominio.
- Los tokens de sesión se almacenan como hashes. Las claves de idempotencia se acotan al actor y a
  la operación/contenido para que los reintentos sean seguros.
- Las restricciones, triggers e índices protegen integridad, unicidad, histórico y concurrencia.

La matriz detallada de permisos y el inventario de seguridad están en
[`schemas/README.md`](schemas/README.md) y [`security-inventory.json`](security-inventory.json).

## Storage y assets

`private.media_assets` es el registro de negocio de los objetos almacenados en Supabase Storage.
Los bytes viven en los buckets:

- `avatars`: lectura pública mediante ruta estable y actualización autorizada del avatar propio.
- `question-assets`: bucket privado para imágenes editoriales y previews autorizadas.

Las versiones editoriales guardan `assetId` y metadatos, no URLs firmadas. El servidor genera una URL
firmada solo después de comprobar autorización y estado del asset. La subida a Storage y la
confirmación en PostgreSQL son pasos separados con limpieza compensatoria y auditada.

## Fuentes relacionadas

- [`schemas/README.md`](schemas/README.md): inventario SQL, decisiones, protocolo y pruebas.
- [`README.md`](README.md): workflow declarativo y migraciones.
- [`../docs/current/status.md`](../docs/current/status.md): capacidades implementadas y pendientes.
- [`../supabase/config.toml`](config.toml): exposición de schemas, migraciones y seed.
