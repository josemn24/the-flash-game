# Reprogramación de temporadas y desafíos

Estado: vigente.

Las fechas de una temporada son independientes de las de sus desafíos. Cada publicación no cancelada debe quedar dentro de la temporada y las ventanas no pueden solaparse; el inicio es inclusivo y el cierre exclusivo.

El superadmin puede preparar publicaciones en borrador. Publicar mantiene el estado persistido `active`; el portal muestra «Programada», «En curso» o «Finalizada» según el reloj. No se necesita otro scheduler para habilitar una ventana: las escrituras competitivas comprueban su disponibilidad efectiva en PostgreSQL.

Antes de la apertura, el calendario permite editar ambos extremos. Cuando una publicación ya ha abierto solo puede ampliarse su cierre mientras siga abierta, incluso si todavía nadie ha iniciado un intento. Las pruebas del superadmin no bloquean las fechas. Las publicaciones cerradas y temporadas terminadas no se reabren.

El inicio de temporada queda protegido cuando alcanza la apertura de un desafío o existen intentos competitivos. El fin puede ajustarse mientras la temporada siga vigente, sin excluir publicaciones ni terminarla inmediatamente. Los cambios nunca modifican intentos, sus límites individuales, sesiones, respuestas o Flash Points.

Los controles trabajan en minutos. Los extremos intactos conservan el timestamp original, incluidos segundos, microsegundos y la ocurrencia durante un cambio de horario. Un extremo editado se resuelve al minuto elegido en la zona de la sala. Una hora inexistente se rechaza y una nueva hora ambigua elige la primera ocurrencia.

«Reprogramar calendario» permite conservar las publicaciones o desplazar las editables con el inicio de la temporada. «Editar fechas» permite mover una publicación futura o ella y las posteriores. El desplazamiento UTC conserva duraciones y separaciones; la vista previa presenta las horas locales con su zona. Ampliar los límites de temporada exige una selección explícita.

Las RPC `preview_superadmin_calendar_change` y `apply_superadmin_calendar_change` comparten validación. El guardado exige versiones vigentes, motivo y clave idempotente; bloquea sala, temporada y publicaciones en orden y vuelve a comprobar el reloj. La exclusión y contención se difieren únicamente durante el cambio conjunto y se validan antes de finalizar. Un conflicto revierte la operación completa. Cada cambio efectivo genera una auditoría agrupada; guardar fechas idénticas conserva `updated_at` y no añade auditoría del dominio.

La migración inicial incluye estos contratos y debe aplicarse antes de desplegar la aplicación. Los calendarios existentes no se redondean ni se regeneran durante su edición. `scripts/test-calendar-contract.mjs` verifica las carreras entre ediciones, inicio de juego, apertura y tick en bases desechables, desde esquema y migraciones; las suites SQL y E2E cubren las operaciones del portal. El verificador histórico de actualización permanece en Git.
