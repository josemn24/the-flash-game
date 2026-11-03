# Consolidación de migraciones — 2026-11-03

Estado: verificado en stacks desechables. Base local habitual y staging sin modificar.

La [reinstalación local posterior](local-reinstallation-2026-11-03.md), autorizada después de
esta consolidación, registra por separado la adopción en el entorno habitual. Staging no se modificó.

## Referencia y alcance

- Commit de referencia: `f317fc44e3df1519164a68ce91f3a9cc5ecdc50a`.
- Historial retirado: 26 migraciones, conservadas en Git; 102 archivos declarativos.
- Nueva revisión: `20261103090247_initial_schema`.
- SHA256 de la inicial: `e688c9c345cbafc70df78e255afdd26d753ff841b54a78f4d4e5646c78ddd6c9`.
- Herramientas: Supabase CLI 2.118.0, PostgreSQL 17.6.
- Stack desechable: `flash-consolidation`, puertos 5632x. La base local habitual y staging quedan fuera.

La inicial se generó desde una copia del esquema y un historial vacío mediante
`db schema declarative sync --name initial_schema --no-apply --strict-coverage`.
Se añadió únicamente la notificación operativa de recarga de PostgREST. El backfill histórico de
mediciones se retiró del esquema declarativo: las temporadas nuevas mantienen sus funciones y triggers.
No se incluyeron datos, diccionarios, usuarios ni archivos en la inicial.

## Equivalencia y cobertura conservada

El comparador reconstruye tres bases desechables: esquema actual, historial anterior y nueva inicial.
Compara catálogos por nombres, sin OIDs ni orden físico de columnas de tablas, preservando el orden
de vistas y retornos de funciones. Los cuerpos de funciones se comparan íntegros. Los permisos de
schema se comparan por acceso efectivo y delegación, incluido PUBLIC: las concesiones explícitas
redundantes del esquema public no constituyen diferencias de acceso. El resto de atributos,
restricciones, índices, triggers, políticas, ACL y defaults se comparan sin exclusiones funcionales.
Las pruebas negativas alteran una restricción, un índice, el permiso CREATE de un schema y una política; revierten cada modificación.

| Verificador histórico retirado | Garantía vigente                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handlers de intentos           | Caracterización SQL y contrato de continuación: replay sin escrituras, evaluación pendiente, Pirámide preparada, abandono Narrativa, sesiones y acreditación. |
| Biblioteca editorial           | Suites de autorización, paginación y caracterización, incluido replay editorial, rollback y reutilización de versiones.                                       |
| Ensayos                        | Suites de ensayos y dificultad, inventario sin asociaciones retiradas y creación de contenido con defaults vigentes.                                          |
| Medición por temporada         | Contratos de alcance, eventos, valoraciones, retirada experimental y fiabilidad, con concurrencia.                                                            |
| Calendario                     | Contrato de carreras entre ediciones, inicio de juego, apertura tras bloqueo y tick; suites SQL del portal.                                                   |
| Checkpoints                    | Cierre con evaluación pendiente de Queens y Conectar parejas, captura del tablero, replay y una sola acreditación.                                            |

Los escenarios de calendario, checkpoints y continuación confirman transacciones y usan bases independientes.
Los contratos se ejecutan tanto desde schemas como desde migraciones. Los casos negativos de health
usan mutaciones transaccionales de funciones actuales y no leen el historial retirado.
CI y el piloto sustituyen `supabase:schema:upgrade:test` por `supabase:schema:equivalence:test`.
Los cambios futuros vuelven al flujo de migraciones incrementales.

## Evidencia de ejecución

Resultados ejecutados en recursos desechables:

| Comprobación                                | Resultado                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Esquema, historial anterior e inicial nueva | Cero diferencias de catálogo; cuatro mutaciones negativas detectadas y revertidas.                                             |
| SQL desde esquema y migración               | 71 suites y 2.068 checks por vía, más 158 casos compartidos y 904 observaciones de validación.                                 |
| Reconciliación                              | 259 funciones, cero diferencias de definición y 41 sondas iguales; carreras competitivas verificadas.                          |
| Instalación real                            | Una entrada en el ledger, recuentos exactos de las 37 tablas de dominio a cero, Auth y objetos vacíos y dos buckets canónicos. |
| Segunda generación declarativa              | `No schema changes found`; ningún archivo adicional.                                                                           |
| Tipos públicos                              | Coincidencia byte por byte; `supabase:types:check` selecciona el stack con `SUPABASE_TEST_WORKDIR`.                            |
| RPC de mantenimiento                        | HTTP, permisos, timeouts, expiración, rollback y replay pasan desde esquema e inicial.                                         |
| Bootstrap mínimo                            | Un administrador y jugador, cero salas y partidas, diccionarios de 2.433 y 8.774 palabras, portal y sondeo SQL correctos.      |
| Health HTTP privado                         | Respuesta 200 con `auth`, `database` y `schema` en true.                                                                       |
| Unitarias                                   | 300 archivos y 4.127 pruebas pasan, incluidas tres regresiones de proveedores y los formatos reales de avatares.               |
| E2E                                         | 206 casos distintos verificados entre las rondas descritas abajo, sin fallos pendientes.                                       |
| Build y estáticos                           | Build, typecheck, arquitectura de tipos, lint, formato, revisión y enlaces documentales correctos.                             |

La cobertura E2E comprende portal (3), calendario (4), medición (3), ensayos (18), recuperación (4),
sesión Flash/Supervivencia (2), Alfabeto (2), Pirámide (161), Contrarreloj Queens (1), Contrarreloj
Conectar parejas (1), Narrativa (4) y versionado editorial (3). Se repitieron los dos ensayos de
Conectar parejas afectados por la corrección del proveedor.

La repetición completa de Pirámide pasó 160 casos y recibió un error de transporte en Escape
cuando un build simultáneo eliminó el directorio de Next usado por el servidor E2E. La repetición
posterior de ese único caso pasó sin procesos que compartieran el directorio. Se comprobó la
identidad del caso en ambos JSON: los 161 casos quedan cubiertos. No se añadieron reintentos ni
se relajaron expectativas para ocultar errores. Los siete fallos de Pirámide y el de Contrarreloj
Conectar parejas detectados antes de las correcciones de proveedores quedaron resueltos.

Los hashes y diferencias están en `output/audits/schema-equivalence.json`; el contexto y los
26 hashes originales, en `output/audits/consolidation-context.json`. El resumen ejecutado está en
`output/audits/consolidation-verification.json` y la cobertura por escenario, en
`output/audits/consolidation-e2e-coverage.json`. El informe completo de Pirámide previo a repetir
Escape se conserva en `output/audits/pyramid-conformance-full.json`. Los logs correspondientes
están en el mismo directorio. Estos informes no contienen credenciales.

Todos los stacks y directorios temporales se retiraron, incluidas las credenciales del bootstrap.
El build necesitó acceso de red a sus fuentes de Google. Las comprobaciones de TypeScript se
repitieron tras finalizar las unitarias, cuyos tests de arquitectura crean y eliminan archivos temporales.

## Correcciones de proveedores autorizadas durante la validación

La conformidad E2E encontró dos discrepancias previas del proveedor local con Supabase. Se
corrigen en esta entrega a petición del usuario, sin cambiar el SQL ni las reglas competitivas:

- Conectar parejas devuelve progreso nulo hasta que se acepta un checkpoint. Un checkpoint
  explícito con caminos vacíos sigue siendo un borrador aceptado y se conserva como tal.
- La recuperación de Queens en Pirámide conserva el tablero de revisión cuando la recepción
  es nula, incluso antes del deadline. Mantiene evaluación, puntos y consecuencias del servidor.

Tres pruebas de regresión cubren la distinción entre tablero intacto y checkpoint vacío,
el comienzo de otro nivel y la recuperación de Queens sin agotar el reloj. Se repiten la
conformidad completa de Pirámide, Contrarreloj Conectar parejas y los ensayos afectados.

## Ajustes de fixtures y pruebas auxiliares

La validación encontró expectativas anteriores del seed de Tabarnia: siete avatares y once subidas,
frente a los quince avatares y diecinueve objetos actuales. Se corrigieron los recuentos y se
renombró `dark.jpg` a `dark.webp` porque los bytes versionados ya eran WebP. Una prueba comprueba
que todos los avatares coinciden con su formato declarado; no se relajan límites de Storage.
La fixture HTTP de mantenimiento crea una ventana ya vencida para simular un tick retrasado,
en lugar de reprogramar una publicación futura hacia el pasado, prohibido por las reglas vigentes.
El E2E de medición comprueba el enunciado completo dentro de la región de pregunta, permitiendo
que el contexto y el interrogante ocupen elementos separados.

El primer reset del stack temporal interrumpió dos verificadores lanzados antes de que terminara;
se repitieron correctamente después del reset. Los procesos de comprobación posteriores se
coordinaron sin reconstruir el contenedor que estaban utilizando.

## Adopción en entornos existentes

No aplicar esta inicial sobre tablas existentes. Local y staging requieren una reinstalación acordada
si sus datos son prescindibles o una reconciliación preparada tras comprobar esquema, respaldo y
restauración. Auth, Storage y diccionarios se coordinan con sus herramientas específicas.
La [guía de entornos](../../current/supabase-clean-installation.md#adoptar-el-historial-consolidado)
describe las operaciones posteriores. Esta entrega no acredita la revisión instalada en esos destinos.

## Reproducir la referencia histórica

Con un contenedor PostgreSQL de pruebas disponible, recuperar el historial sin modificar el checkout:

```bash
FLASH_REFERENCE_DIR=$(mktemp -d)
git archive f317fc44e3df1519164a68ce91f3a9cc5ecdc50a supabase/migrations | tar -x -C "$FLASH_REFERENCE_DIR"
npm run supabase:schema:equivalence:test -- --reference-dir="$FLASH_REFERENCE_DIR/supabase/migrations"
rm -rf "$FLASH_REFERENCE_DIR"
```

El comparador admite `SUPABASE_DB_CONTAINER` para seleccionar el contenedor de pruebas. La ejecución
ordinaria sin referencia compara el esquema declarativo y el historial activo y es la puerta de CI.
