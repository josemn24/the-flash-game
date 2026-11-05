# Refactorización del motor de sesión

Fecha: 2026-10-28. Evidencia local de la entrega; no acredita staging.
Referencia previa: `7c5feeadf4fc62df514a2bb138b62d05f51ab558`.

## Cambios comprobados

- `run`, `retry` y `takeOver` comparten `afterCommand`, con origen explícito y lectura del
  snapshot actual entre efectos asíncronos.
- Las políticas puras de finalización conservan las diferencias entre Alfabeto y Contrarreloj.
  `finalizeGlobalClock` mantiene el cierre pendiente sin descartar comandos inciertos.
- La clasificación común de fallos y el presupuesto de reintentos están separados de los efectos,
  contadores y temporizadores del motor. Se conservan mensajes, eventos e idempotencia.
- La confirmación de abandono permanece en el motor. No cambian proveedores, contratos HTTP,
  puntuación, esquema SQL ni interfaces de los componentes.

Se añadieron 49 pruebas: 21 de coordinación y regresión, 22 de recuperación/reintentos y seis
de políticas de finalización. El E2E de transferencia Flash ahora comprueba el replay exacto,
un único intento, revocación de controladores y una sola acreditación.

## Resultados

| Comprobación                                                       | Resultado                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| Suite unitaria completa, sin paralelismo entre archivos            | 3342 aprobadas; diez fallos previos en tres archivos |
| Pruebas nuevas                                                     | 49 aprobadas                                         |
| Tipos, arquitectura de tipos, ESLint, enlaces y formato del cambio | Correctos                                            |
| E2E distintos aprobados                                            | 193, contando la repetición aislada de Alfabeto      |
| E2E de conformidad de Contrarreloj                                 | Tres fallos por definiciones de prueba incompatibles |

Los E2E usaron stacks Supabase temporales, con preparación por escenario y limpieza final.
Pasaron Flash (cinco casos), recuperación S04 (cuatro), Alfabeto (nueve, incluida conformidad),
Narrativa (dos), Supervivencia (uno), Pirámide (uno), conformidad Flash/Supervivencia (dos),
conformidad de Pirámide (161) y los recorridos competitivos de Queens y Conectar parejas
(cuatro por variante). Las integraciones de Supabase de ambas variantes de Contrarreloj también
pasaron antes de sus recorridos de navegador.

## Incidencias anteriores a la entrega

Los mismos diez casos unitarios fallan en una copia limpia de la referencia previa:

- `FlashPopRoomMemberDetail.test.tsx`: tres discrepancias entre textos/puntos de la vista y las expectativas.
- `localTimeTrial.test.ts`: cinco expectativas incompatibles con los tableros actuales de demo.
- `server/composition/demo.test.ts`: dos expectativas de dos tableros frente a seis actuales.

La conformidad E2E de Queens, Conectar parejas y timeout construye una definición local combinando
seis tableros de demo con los identificadores de dos tableros del fixture competitivo. El proveedor
la rechaza con `invalid_local_time_trial_definition`, antes de ejecutar el motor. Se reprodujo
esa construcción y su rechazo en la referencia previa para ambas variantes, sin modificar sus
fuentes. La misma discrepancia afecta al caso de timeout de Queens.

Al ejecutar juntas la interfaz y la conformidad de Alfabeto, ambas consumen el intento de la
misma cuenta y publicación. El caso de interfaz esperó un enlace «Jugar» que ya no estaba
disponible. Se verificó con datos nuevos y de forma separada: pasó. Un intento de repetición
agotó el margen de arranque del servidor; la comprobación final usó una configuración temporal
con logs y un margen de inicio mayor, sin cambiar la configuración versionada.

Estas incidencias se conservan separadas de la refactorización: no se modificaron sus fixtures,
las expectativas unitarias previas ni los recorridos funcionales para ocultarlas.

## Reproducción

```bash
npm test -- --no-file-parallelism
npm run typecheck
npm run type-architecture
npm run lint
npm run docs:check
npm run test:e2e:isolated -- e2e/s03-flash.spec.ts e2e/s04-recovery.spec.ts
npm run test:e2e:isolated -- e2e/s05-alphabet.spec.ts --workers=1
```

Ejecutar la conformidad de Alfabeto en otra invocación, con otro fixture recién preparado.
Los logs y el resumen de la ejecución están en `output/session-engine-refactor/` y son artefactos
locales ignorados por Git; este informe conserva los resultados y límites de la verificación.
