# Entrega inicial de proveedores de sesión

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [game-session-providers.md](../../current/game-session-providers.md).

### Resultado previo a la entrega Flash — 2026-10-18

| Comprobación                                                       | Resultado                                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest focal: sesión, proveedores, formatos, fachadas y Pirámide   | 164 pruebas correctas en 12 archivos, incluidas 34 nuevas pruebas del puerto y su integración con el motor.                                                                |
| E2E Flash                                                          | 5 correctos.                                                                                                                                                               |
| E2E Alfabeto                                                       | 7 correctos.                                                                                                                                                               |
| E2E Supervivencia                                                  | 1 correcto.                                                                                                                                                                |
| E2E Narrativa                                                      | 2 correctos.                                                                                                                                                               |
| E2E Pirámide                                                       | 5 correctos: recorrido S15 y cuatro casos Queens.                                                                                                                          |
| E2E Contrarreloj                                                   | 4 correctos.                                                                                                                                                               |
| Total de navegador                                                 | 24 correctos, sin casos omitidos ni casos marcados como inestables por Playwright.                                                                                         |
| Integración de los seis modos                                      | Auth, PostgREST, RLS y escenarios funcionales correctos.                                                                                                                   |
| TypeScript, ESLint focal, formato, arquitectura de tipos y enlaces | Correctos.                                                                                                                                                                 |
| Vitest completo de ese corte                                       | 2480 pruebas correctas; el resultado posterior está registrado en la [entrega Flash](local-session-deliveries-2026-10-18.md#entrega-flash-local-y-competitiva-2026-10-18). |

Ese corte precede a la corrección de las regresiones generales y a las pruebas de autoridades
locales. Esa entrega de Flash y Pirámide registró 2672 pruebas correctas en
la [entrega Flash](local-session-deliveries-2026-10-18.md#entrega-flash-local-y-competitiva-2026-10-18). La evidencia posterior de la consolidación
de Pirámide se registra por separado en [QA](qa-through-2026-10-21.md#consolidación-de-pirámide-fase-6--2026-10-19).

Se actualizó una referencia obsoleta de la
[integración de Narrativa](../../../scripts/integration/scenarios/narrative.mjs): ahora espera
`multiple-choice,short-text`, los dos formatos que ya define su
[fixture](../../../scripts/fixtures/scenarios/narrative.mjs). No se modificó el fixture ni el juego.
Flash se repitió con un fixture limpio después de una primera ejecución interrumpida por Fast
Refresh durante la edición; sus cinco casos pasan con el código inmóvil.

El motor conserva su nombre y ubicación bajo `competitive/` para evitar una migración de
importaciones adicional. La nueva frontera es el puerto inyectado, no un motor paralelo.
