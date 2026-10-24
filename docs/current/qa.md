> Estado: vigente. Guía de comprobación; los resultados de cada entrega permanecen fechados en el archivo.

# QA actual

## Comprobaciones documentales y estáticas

Desde la raíz del repositorio:

```bash
npm run docs:check
npm run schema:revision:check
npm run type-architecture
npm run typecheck
npm run lint
npm run stylelint
npm run style-architecture
npm run format:check
```

`docs:check` comprueba documentos, enlaces locales y anclas. No verifica URLs externas ni
demuestra coherencia funcional. La revisión canónica está centralizada en
[estado actual](status.md) y se contrasta con los marcadores de código.

Para cambios solo documentales bastan enlaces, revisión de esquema, formato del diff y lint/tests
de cualquier comprobador modificado. No es necesario reiniciar bases, desplegar ni ejecutar
partidas para acreditar una corrección de Markdown.

## Pruebas funcionales

| Alcance                                                          | Comando o referencia                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Dominio, scoring, contratos, componentes y autoridades de sesión | `npm test -- --maxWorkers=1`                                                           |
| Banco y cobertura de ensayos                                     | `npm run rehearsals:check`                                                             |
| Diccionarios versionados                                         | `npm run dictionary:check`                                                             |
| Recorridos locales de cinco modos, sin Supabase                  | `npm run test:e2e:local-rehearsals`                                                    |
| Competición, permisos, persistencia y recuperación               | `npm run test:e2e:isolated -- <spec>`                                                  |
| SQL, RLS/ACL, conformidad y concurrencia                         | `npm run supabase:schema:test` y la variante `-- --migrations`                         |
| Actualización y reconciliación SQL                               | `npm run supabase:schema:upgrade:test` y `npm run supabase:schema:reconciliation:test` |
| Tipos Supabase generados                                         | `npm run supabase:types:check`                                                         |
| Compilación optimizada                                           | `npm run build`                                                                        |

Los E2E aislados crean y eliminan su propio stack. Las pruebas SQL crean bases desechables y
requieren un contenedor de pruebas disponible; consultar el
[workflow de base de datos](../../supabase/README.md). Los comandos generales de fixtures y
`test:e2e` pueden preparar o reiniciar datos locales: elegir el runner apropiado antes de ejecutar.

Las matrices específicas pertenecen a [formatos competitivos](competitive-format-contracts.md),
[práctica](practice-format-contracts.md), [proveedores](game-session-providers.md),
[Pirámide](pyramid-session-contract.md), [Contrarreloj](domain/contrarreloj.md) y
[resiliencia](resilience-matrix.md).

## Alcance de la evidencia

Un resultado debe indicar fecha, revisión o diff, comandos ejecutados, entorno y límites.
Una ejecución local no acredita staging, calibración editorial ni comportamiento de usuarios.
No presentar cifras de una entrega anterior como el total actual de pruebas.

El registro consolidado hasta el 2026-10-21 conserva las verificaciones de
[ensayos dinámicos](../archive/reports/qa-through-2026-10-21.md#generación-dinámica-de-pruebas--2026-10-21),
[aplicación local](../archive/reports/qa-through-2026-10-21.md#aplicación-local-y-comprobación-de-betavip--2026-10-21)
y [cierre de Pirámide](../archive/reports/qa-through-2026-10-21.md#cierre-de-la-fase-6--2026-10-19).
Los demás informes están en el [índice histórico](../archive/reports/README.md).
