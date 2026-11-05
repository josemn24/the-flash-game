# Reinstalación local — 2026-11-03

Estado: entorno local habitual reinstalado y verificado. Staging sin acceder ni modificar.

## Destino y operaciones

Proyecto local `the-flash-game`: API `http://127.0.0.1:54321`, PostgreSQL en el puerto 54322
y aplicación en `http://127.0.0.1:3000`. Supabase CLI 2.118.0 y PostgreSQL 17.6.
La revisión instalada es `20261103090247_initial_schema`; su SHA256 es
`e688c9c345cbafc70df78e255afdd26d753ff841b54a78f4d4e5646c78ddd6c9`.

Se retiraron los volúmenes anteriores únicamente de este proyecto mediante
`supabase stop --no-backup --project-id the-flash-game` y se inició de nuevo con `supabase start`.
Se actualizaron las conexiones y credenciales locales de `.env.local` desde el estado de la CLI,
manteniendo las preferencias de origen de desarrollo. Después se ejecutaron:

```bash
npm run supabase:environment:reset -- --target local
npm run supabase:local:bootstrap -- --target local
npm run supabase:types:check
npm run supabase:schema:equivalence:test
npm run supabase:schema:test -- --migrations
```

El reset completó Storage, Auth, PostgreSQL, verificación y retirada de artefactos anteriores.
El bootstrap creó el perfil mínimo, sin escenarios de ejemplo. No se ejecutaron comandos
remotos ni se cargó configuración de staging.

## Estado final y comprobaciones

| Comprobación             | Resultado                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historial aplicado       | Una única entrada: `20261103090247`.                                                                                                                      |
| Perfil mínimo            | Un usuario Auth, un jugador, una asignación de superadmin y su evento de auditoría.                                                                       |
| Diccionarios             | `es-general-4.v1`: 2.433 palabras; `es-general-5.v1`: 8.774.                                                                                              |
| Tablas de dominio        | Recuento exacto de 37 tablas; las otras 33 vacías. Sin salas, temporadas, contenido, intentos, puntos ni medición.                                        |
| Storage                  | Cero objetos. `avatars` público, 5 MiB; `question-assets` privado, 50 MiB. Ambos admiten JPEG, PNG y WebP.                                                |
| Auth y REST              | Respuestas HTTP 200 en la API local.                                                                                                                      |
| Health de aplicación     | HTTP 200, scope `development`; `auth`, `database` y `schema` en `true`.                                                                                   |
| Equivalencia             | Cero diferencias entre esquema declarativo e inicial; cuatro mutaciones negativas detectadas.                                                             |
| Tipos públicos           | `supabase:types:check` correcto, sin regenerar tipos.                                                                                                     |
| Suite SQL                | 71 suites, 2.068 checks, 158 casos compartidos y 904 observaciones de validación.                                                                         |
| Seguridad y concurrencia | Inventario, mutaciones de health, carreras y contratos de calendario, checkpoints y continuación correctos.                                               |
| Navegador real           | Login, salas vacías, portal superadmin y persistencia al recargar. Logout y redirección de `/admin` al acceso anónimo correctos; cero errores de consola. |
| Limpieza de pruebas      | Sin bases desechables de equivalencia, suites ni contratos al finalizar.                                                                                  |

Las suites SQL y el comparador usan bases desechables dentro del servidor local. Una comprobación
posterior confirma que el contenido del entorno habitual conserva exactamente el perfil mínimo.
El navegador de pruebas cerró sesión y se retiró; Supabase y la aplicación de desarrollo quedaron
iniciados al terminar la operación.

## Acceso y evidencia

Administrador: `superadmin@the-flash.local`. La contraseña aleatoria permanece únicamente en
`output/local/bootstrap-credentials.json`, con permisos `0600`; no se incluye en este informe.
La aplicación lee las credenciales renovadas desde `.env.local`.

Los registros operativos locales quedan en:

- `output/local/reset-manifest.json` y `bootstrap-manifest.json`.
- `output/local/reinstallation-verification.json`: recuentos exactos, buckets, HTTP y resumen de pruebas.
- `output/local/reinstallation-equivalence.json`: hashes, diferencias y pruebas negativas.
- `output/local/reinstallation-schema-tests.log` y `reinstallation-schema-result.json`: salida completa y código de salida cero.
- `output/playwright/local-reinstallation/admin.png`: captura del portal sin credenciales.

Esta operación comprueba la instalación real y el acceso sobre el perfil mínimo. La cobertura
completa de modos competitivos, administración y recuperación se ejecutó antes en stacks
desechables y está descrita en la [entrega de consolidación](migration-consolidation-2026-11-03.md).
No se repitieron esos escenarios con contenido en la base habitual. Staging conserva su estado
anterior y requiere su propia adopción verificada del nuevo historial.
