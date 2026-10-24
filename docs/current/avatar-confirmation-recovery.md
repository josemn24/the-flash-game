# Confirmación y limpieza segura de avatares

Estado: implementación y validación local. La comprobación en staging permanece pendiente antes de publicar.

## Garantías

La confirmación conserva en una transacción el estado `ready`, la referencia del perfil,
la auditoría y el resultado idempotente. Perder la respuesta no autoriza borrar la imagen.
La lectura privada de confirmación verifica la cuenta activa, operación, clave y archivo;
recupera el registro original y devuelve el perfil vigente. No necesita descargar el objeto
ni volver a inspeccionarlo. Un reintento antiguo no restaura un avatar sustituido.

La cancelación obtiene primero de PostgreSQL el estado `deleted`. Solo una respuesta
confirmada con ese estado permite eliminar los bytes en Storage. Una respuesta perdida
del commit de cancelación conserva el objeto hasta otro intento seguro. Los avatares
listos o referenciados no se compensan. La limpieza del antiguo exige un archivo registrado,
del propietario, archivado y sin referencias; confirma `archived → deleted`, borrando
`archived_at` y estableciendo `deleted_at`, antes de llamar a Storage.

Confirmación, cancelación y limpieza bloquean primero al jugador y después los archivos.
Las llamadas a Storage quedan fuera de esas transacciones. Los archivos `deleted` no
pueden volver a confirmarse, salvo la lectura sin escrituras de un resultado histórico.
Las preparaciones repetidas informan del estado actual: no emiten otra URL para un avatar
que ya dejó de estar pendiente.

El resultado de éxito se construye con los datos confirmados. La lectura antigua del perfil
posterior al commit se elimina del camino obligatorio. Un fallo de limpieza o revalidación
se registra y conserva el éxito del guardado.

## Cliente y recuperación

- `confirmation_pending` significa que no se puede confirmar el resultado, aunque el
  servidor podría haber guardado la imagen. Se muestra «No hemos podido confirmar la imagen».
- «Reintentar confirmación» conserva `assetId` y la clave originales en memoria, sin otro
  upload ni otro guardado del nombre. No se añade una cola offline ni persistencia del archivo.
- Se bloquean nuevas sustituciones mientras la operación esté pendiente. Cerrar/reabrir
  el diálogo no descarta el comando mientras siga montada la pantalla.
- Una recarga lee el perfil persistido; pierde los identificadores en memoria. Si no hubo
  confirmación, el archivo pendiente permanece para recuperación operativa.
- Cambiar de cuenta o desmontar descarta respuestas tardías. Los errores definitivos de
  permisos, conflicto o archivo inválido terminan el reintento pendiente.
- El nombre se guarda independientemente: un fallo del avatar no lo revierte.

## Operación y límites

Se mantienen los registros existentes y la limpieza síncrona actual; no se añade un proceso
periódico. Los eventos `confirmation_pending`, `confirmation_recovered`, `cleanup_failed`
y `revalidation_failed` usan la observabilidad existente. Incluyen identificadores opacos,
nunca el archivo, nombre del usuario, URL firmada, clave idempotente, token ni error bruto.

Para un `cleanup_failed`, consultar el registro por `assetId` y verificar referencias en
`players.avatar_path`. Si el fallo ocurrió al reclamar la limpieza del avatar anterior, el
identificador corresponde a la confirmación nueva: consultar su resultado persistido para
identificar `oldObjectPath`, sin eliminar el avatar nuevo. Reintentar la cancelación (pendiente) o la reclamación de limpieza
(archivado/ya marcado `deleted`) desde el servidor con la identidad del propietario.
Eliminar el objeto únicamente tras recibir `deleted`; si la cuenta ya no permite ejecutar
el comando, tratarlo como mantenimiento manual auditado con las mismas verificaciones.
No asumir que todos los archivos marcados `deleted` ya desaparecieron de Storage.
Los objetos eliminados antes de este cambio requieren una copia recuperable o nueva subida.

## Validación y despliegue

El [informe de la entrega original](../archive/reports/avatar-confirmation-recovery-2026-10-06.md)
conserva los resultados locales y la cobertura de fallos. La comprobación actual debe incluir cortes
tras el commit, limpieza, cancelación/confirmación concurrentes y reintento sin otra subida.
[QA](qa.md) describe cómo elegir los runners y distinguir local de staging.

1. Aplicar la cadena de migraciones activa, que comienza con el
   [baseline](../../supabase/migrations/20261011180045_initial_schema.sql), antes del código nuevo.
   El entorno debe haberse
   reiniciado; no se conservan datos anteriores.
2. Desplegar el servidor y cliente nuevos; verificar readiness para las dos funciones privadas
   y la revisión canónica de [estado actual](status.md). Seguir la [guía de entornos](supabase-clean-installation.md). Evitar un despliegue con
   servidores antiguos que aún ejecuten la compensación destructiva; pausar las subidas
   durante esa transición si la plataforma mantiene ambas versiones activas.
3. En staging, ejecutar con cuentas de prueba los mismos cortes posteriores al commit,
   sustituciones y carreras; verificar PostgreSQL y Storage antes de publicar.
4. Vigilar `cleanup_failed` y `confirmation_pending`. Una caída de Storage puede dejar
   objetos pendientes de limpieza; no revertir referencias confirmadas para eliminarlos.
