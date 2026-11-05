# Backlog técnico vigente

Estado: vigente. Pendientes contrastados con el repositorio el 2026-10-24; no es un compromiso de entrega.

## Criterio de lectura

Las capacidades implementadas están centralizadas en [estado actual](current/status.md).
Este documento conserva trabajo pendiente y dependencias; el
[plan anterior por vertical slices](archive/plans/vertical-slices-before-2026-10-24.md)
mantiene el diseño original, los criterios de aceptación y las entregas cerradas.

Una regla aprobada no implica que exista su interfaz, y una implementación verificada localmente
no acredita staging. Cada entrega nueva debe consultar decisiones, contrato específico y QA,
cerrar su recorrido completo y evitar fallback competitivo al mock.

## Pendientes de producto y operación

| Referencia original    | Pendiente real                                              | Condición de cierre                                                                                                               |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S09                    | Creación, aceptación y revocación de invitaciones completas | Tokens privados, permisos, caducidad y auditoría; separar del provisioning directo de la beta                                     |
| S18a                   | Salida propia y transferencia de propiedad de sala          | Propietario coherente, operación autorizada y recuperación de conflictos; no confundir con takeover de una partida, que ya existe |
| S18b, parcial          | Bloqueo/desbloqueo y resto de la matriz de membresías       | Mantener las acciones existentes del owner y coordinar pérdida de acceso e intentos activos                                       |
| S18c                   | Eliminación lógica y recuperación de salas                  | Política explícita, historial preservado y concurrencia con calendario/intentos                                                   |
| S19, parcial           | Cancelación de publicaciones abiertas/cerradas y temporadas | Resolver intentos y puntos sin sobrescribir hechos; la cancelación de publicaciones futuras ya existe                             |
| S21, parcial           | Consolidación y política de `results_locked_at`             | Definir cuándo se consolida una publicación sin cortar intentos todavía válidos                                                   |
| S23                    | Prueba interna persistida sin acreditación                  | Flujo privilegiado, auditable y separado de competición; no confundir con ensayos en memoria                                      |
| S24 / D09              | Anonimización, retención y purga                            | Preservar resultados y resolver identidad, propiedad, assets e idempotencia                                                       |
| S16, parcial           | Edición narrativa avanzada y ciclo de medios pendiente      | Ampliar la herramienta editorial sin duplicar el motor competitivo ya implementado                                                |
| S22 / entorno objetivo | Verificación operativa de staging                           | Contrastar esquema/app, servicios, cron, backups, recuperación y transferencia multi-dispositivo                                  |

La expiración por inactividad, la transferencia explícita de sesión y el cierre por pérdida de
permiso están implementados; no requieren desarrollar un heartbeat ni un segundo motor.

## Ampliaciones de formatos y contenido

Los diez formatos exclusivos de práctica necesitan su propia admisión y ejecución competitiva
si se decide ofrecerlos en salas. Las capacidades se consultan en el
[registro](../lib/question-formats/definitions.ts) y en la [matriz actual](current/status.md).
Los escenarios anteriores F*/E* permanecen como referencia en el plan archivado; no habilitan
por sí mismos un formato ni fijan prioridad.

Contrarreloj ya integra Queens y Conectar parejas. Incorporar otros formatos requiere reglas,
calibración y conformidad específicas. La cobertura de ensayos se mantiene mediante el
[banco versionado](current/rehearsals.md), sin asociaciones fijas.

Revisar los textos legacy de la biblioteca (`guide.ts` y `scoringPolicies.ts`) que todavía
describen crédito parcial de Matching o penalizaciones de selección de forma ambigua. Esta
limpieza corrige la referencia Markdown; no cambia esos módulos de presentación ni el scoring.
Cualquier corrección posterior debe describir el comportamiento del evaluador, sin introducir
otra política de juego por editar una etiqueta.

## Decisiones antes de ampliar alcance

- D05/D06: aplicar la matriz normativa de permisos e invitaciones; no inventar un rol editorial.
- D07: cerrar acceso y presentación de intentos invalidados antes de ampliar su consulta ordinaria.
- D09: definir retención y anonimización antes de exponer purga o salida definitiva.
- Revisar [cuestiones abiertas](decisions/open-questions.md) y
  [decisiones aprobadas](decisions/decisions.md) antes de implementar.
- Mantener separados los experimentos Lean, los fixtures técnicos y la verificación de despliegue.

## Comprobación y cierre de una entrega

Cada pendiente debe terminar con autorización, lecturas y mutaciones, reglas de dominio,
persistencia cuando proceda, manejo de fallos, pruebas apropiadas y documentación vigente.
Usar [QA](current/qa.md), la [guía de entornos](current/supabase-clean-installation.md) y los
contratos específicos. Registrar resultados fechados en el archivo, sin duplicarlos en los índices.
