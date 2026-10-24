# Primeras entregas de autoridades locales

> Estado: histórico. Conservado durante la limpieza del 2026-10-24. Las afirmaciones,
> comandos y cifras describen su entrega original; no son instrucciones de despliegue actual.
> Referencia vigente: [local-pyramid-session.md](../../current/local-pyramid-session.md).

El resultado fechado a continuación corresponde a la primera entrega de Pirámide. La ejecución
posterior de la suite completa y las validaciones añadidas al ampliar Flash se registran en la
sección de la entrega Flash.

## Resultado de la primera entrega de Pirámide — 2026-10-18

| Comprobación                               | Resultado                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cobertura de formatos                      | 21 formatos; 25 combinaciones de formato y versión, contrastadas automáticamente con el registro de capacidades.                                                                |
| Conformidad HTTP, Auth y Supabase temporal | 161 escenarios únicos acreditados: 160 correctos en la matriz y siete casos Word Search correctos en la repetición focal, seis de ellos ya incluidos.                           |
| Motor compartido con ambas autoridades     | 25 recorridos de siete niveles, incluidos en la matriz real; comparación de fases, preguntas, respuestas, puntuación y bloqueo.                                                 |
| Regresión de los seis modos                | 24 E2E correctos: Flash 5, Alfabeto 7, Supervivencia 1, Narrativa 2, Pirámide 5 y Contrarreloj 4; sin omitidos ni inestables. Integraciones de Auth, PostgREST y RLS correctas. |
| Referencia SQL                             | 67 suites correctas, 158 casos compartidos de formatos, 904 observaciones de validación y pruebas de concurrencia correctas.                                                    |
| Vitest completo de esa entrega             | 2652 pruebas correctas; el resultado actualizado aparece en la sección siguiente.                                                                                               |
| Controles estáticos                        | TypeScript, ESLint de los archivos modificados, formato, arquitectura y enlaces correctos.                                                                                      |

La repetición focal conserva las reglas actuales de Word Search: una selección degenerada se
rechaza; una selección válida que no coincide con un objetivo se registra como error, pero no
descuenta puntos. La prueba de victoria tras ese error se corrigió para comprobar ese
comportamiento, y los siete escenarios del formato se ejecutaron de nuevo sin fallos. No se
modificó el proveedor ni el evaluador para ajustar ese resultado.

La matriz también comprueba recepción pendiente tras un fallo de evaluación real en la base
temporal, recuperación y repetición sin duplicar puntuación, confirmaciones perdidas, errores y
penalizaciones intermedias, tres fallos de Queens, acierto después de uno y dos fallos, agotamiento
de Wordle y de movimientos Hashtag, recuperación específica por formato, revisión autorizada y
cima de siete niveles. Las comparaciones mantienen íntegros los puntos y los tiempos aceptados.

### Entrega Flash local y competitiva (2026-10-18)

| Comprobación                            | Resultado                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Suite Vitest                            | 255 archivos y 2672 tests correctos.                                                                            |
| Ensayos locales de Pirámide y Flash     | 6 E2E correctos; Flash completa 16 preguntas, revisa y repite sin llamadas a Auth, Storage o juego competitivo. |
| Regresión competitiva SBR               | 2 E2E correctos contra el stack Supabase aislado.                                                               |
| Conformidad de Flash local con Supabase | 1 E2E correcto; 16 preguntas, respuestas, payloads, puntuación, tiempos y revisión.                             |
| TypeScript, ESLint, arquitectura y docs | Correctos para la entrega.                                                                                      |
