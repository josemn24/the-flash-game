> Estado: archivado. Evidencia de la implementación experimental retirada; no acredita el modelo vigente ni su despliegue.

# Verificación local de medición de Tabarnia

Fecha: 2026-10-24. Protocolo: `tabarnia-daily-v2`.
Revisión: `20261024133000_product_measurement_journal_context`.

La [verificación posterior de staging](staging-measurement-verification.md) acredita la revisión
configurable, la preservación de datos y el ensayo remoto de la plantilla y dos experimentos
independientes. Este informe conserva el alcance y los resultados de la entrega local anterior.

## Entorno y preservación de datos

Docker y Supabase local están operativos. Se aplicaron de forma incremental:

- `20261024120000_product_measurement.sql`.
- `20261024133000_product_measurement_journal_context.sql`.

No se reinició la base habitual. Los recuentos y hashes del contenido de las 32 tablas previas
(11.769 filas) coinciden antes y después de la primera migración. Las 40 tablas presentes tras
ella también conservan recuentos y hashes al aplicar la corrección adicional.

Los tipos de `infrastructure/supabase/database.types.ts` se regeneraron desde Supabase local;
`npm run supabase:types:check` confirma la coincidencia con la revisión final.

Las bases de los contratos SQL son desechables. El E2E usa un proyecto Docker propio, API
en el puerto 55321 y aplicación en 3300, con 14 participantes sintéticos y nueve ventanas diarias.
El runner elimina ese stack y restaura los archivos de fixture y configuración al terminar.
Supabase habitual permanece disponible en 54321.

## Resultados

| Comprobación                                                         | Resultado                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tipos, lint, arquitectura, documentación y compilación de producción | Pasan; health local confirma esquema y corrección instalados                                            |
| `npm test`                                                           | 3289 pruebas, 277 archivos; todas pasan                                                                 |
| `npm run supabase:schema:test`                                       | 69 suites, 1987 comprobaciones pgTAP; inventario y contrato de medición pasan                           |
| `npm run supabase:schema:test -- --migrations`                       | Mismos contratos ejecutados desde el historial completo; pasan                                          |
| Conformidad adicional SQL                                            | 158 casos compartidos, 904 observaciones de validación y carreras concurrentes pasan en ambas rutas     |
| `npm run supabase:schema:upgrade:test`                               | Pasan las actualizaciones de comandos, biblioteca, ensayos y medición; datos previos preservados        |
| `npm run supabase:schema:reconciliation:test`                        | 248 funciones idénticas y 41 comprobaciones de comportamiento coincidentes; carreras concurrentes pasan |
| `npm run test:e2e:isolated -- e2e/product-measurement.spec.ts`       | Un recorrido ampliado en Chromium; pasa con Auth y PostgREST reales                                     |

El E2E comprueba:

- Los seis tipos de evento llegan a Supabase al recorrer sala, introducción, ensayo completo,
  partida competitiva, revisión y ranking. El ensayo no crea intentos oficiales.
- Una valoración se guarda aunque su respuesta HTTP se pierda. El reintento conserva el
  identificador, no duplica la revisión y el valor aparece tras recargar.
- Un participante no puede exportar identidades. El operador ve la matriz de 14×9 y descarga
  sus 126 oportunidades con `Cache-Control: no-store`.
- El feedback externo anónimo se registra sin códigos individuales; su CSV neutraliza fórmulas.
  La corrección aparece como revisión dos y conserva el valor anterior en la auditoría privada.
- Intentar conservar el corte antes de tiempo no crea un snapshot; descargar CSV tampoco lo crea.
- El mantenimiento rechaza solicitudes sin secreto y acepta el secreto operativo. Sin registros
  vencidos devuelve cero y conserva la finalización competitiva.

Los contratos SQL y unitarios cubren además los umbrales, derrotas/cero puntos, datos no
evaluables, reconstrucción al corte, snapshots inmutables y eliminación de registros vencidos
con conservación de agregados y hechos competitivos. El E2E recorre Flash y su ensayo;
no representa nueve días de uso real ni evidencia de recurrencia o disfrute de Tabarnia.

## Correcciones que dejó la verificación

La prueba del formulario encontró una ambigüedad entre una variable PL/pgSQL y los alias usados
al validar personas/publicaciones del registro manual. La corrección usa alias distintos y se
entrega como una migración adicional: la migración ya aplicada se conserva intacta. El contrato
SQL ahora comprueba tanto la creación anónima como la corrección auditada.

Los runners históricos de actualización contrastan el inventario actual después de cargar las
migraciones posteriores. La caracterización de octubre 15 conserva su documento anterior al
campo `difficulty`; la suite del esquema vigente sigue comprobando ese campo. También se
alinearon dos diferencias de espacios del esquema declarativo con las definiciones migradas.

El endpoint de health identifica la corrección del registro manual, además de la existencia de
tablas y RPC; una prueba comprueba que rechaza la función anterior a esa corrección.

## Alcance pendiente

Esta evidencia acredita preparación técnica local. Staging, sus secretos/cron y el ensayo en el
entorno objetivo siguen pendientes. Tampoco se han fijado los nueve contenidos reales, la lista
nominal de 14 personas ni el calendario absoluto, ni se ha iniciado la alpha.

El control completo permanece en [CYCLE-001](../../product/strategy/lean-startup/cycles/CYCLE-001.md#10-control-ready_to_run).
La siguiente acción del ciclo es seleccionar y registrar sus nueve desafíos candidatos.
