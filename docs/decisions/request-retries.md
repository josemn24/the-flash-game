> Estado: aprobado como política de producto; aplicación completa en el runtime pendiente.

# Esperas y reintentos de peticiones

- Fecha de aprobación: 2026-10-06.
- Origen: acuerdo explícito del responsable del producto en la conversación de resiliencia.
- Alcance: login, consultas de salas/rankings, respuestas/acciones de juego y finalización de partida.

## Valores iniciales aprobados

| Operación                      | Timeout por petición | Reintentos automáticos adicionales | Espera antes de cada reintento |
| ------------------------------ | -------------------- | ---------------------------------- | ------------------------------ |
| Login                          | 5 segundos           | 0                                  | Reintento manual               |
| Consultas de salas y rankings  | 10 segundos          | Hasta 2                            | 1 y 2 segundos                 |
| Respuestas y acciones de juego | 5 segundos           | Hasta 1                            | 1 segundo                      |
| Finalización de partida        | 10 segundos          | Hasta 3                            | 1, 2 y 4 segundos              |

Los reintentos son adicionales a la petición inicial: una finalización puede enviar hasta cuatro
peticiones dentro del mismo ciclo automático. Si el servidor devuelve `Retry-After`, se respeta
esa espera en lugar de la espera local. No se hacen peticiones periódicas durante ella.

El timeout limita la espera de una petición completa, incluida su respuesta. Las llamadas internas
de Auth/DB/API deben respetar ese presupuesto y no añadir ciclos automáticos invisibles que lo
prolonguen. No es un nuevo límite de duración de la partida.

## Estado y seguridad de los reintentos

- Reintentar automáticamente solo errores transitorios de red, timeout, indisponibilidad temporal
  o límites temporales de frecuencia. En escrituras, la idempotencia debe estar garantizada.
- Conservar exactamente la misma operación, intento/interacción, payload, versión y clave
  idempotente cuando una escritura tenga resultado incierto. No cambiar la respuesta ni crear un
  intento nuevo para reintentar.
- Un timeout o cancelación de fetch no demuestra que el servidor no haya escrito. Mantener el
  comando pendiente y bloquear acciones incompatibles hasta confirmar o reconciliar los hechos.
- Una recepción ya aceptada se conserva aunque la confirmación llegue tarde o haya vencido el
  plazo. Los reintentos no permiten presentar como nueva una respuesta fuera de plazo.
- Los plazos server-side siguen corriendo; ni la espera ni el reintento reinician el reloj del juego.
- Credenciales incorrectas, sesión inválida, permisos denegados y datos inválidos requieren
  intervención del usuario, sin repetir automáticamente la misma petición rechazada.
- Una versión obsoleta requiere reconciliación autorizada, sin reemplazar la versión del comando
  rechazado para forzar su aceptación. Una sesión revocada no recupera control automáticamente.
- Cancelar los reintentos al desmontar/cambiar de partida, cambiar de cuenta, perder permisos,
  detectar revocación o confirmar que la operación/intento es terminal.

## Comportamiento al agotar el ciclo automático

Conservar el estado y mostrar **«Reintentar»** para fallos recuperables. En juego, explicar que la
operación sigue sin confirmarse; en finalización, mantener la intención de cierre y comprobar el
resultado persistido. Si el terminal ya está confirmado, reintentar su consulta, no el gameplay.

El reintento manual abre un nuevo ciclo explícito de la misma operación recuperable. No sustituye
la corrección de credenciales/datos ni la concesión de permisos. Durante una caída persistente,
aplicar la [política de incidencias](service-incidents.md) cuando se confirme el fallo del servicio.

## Estado observado y trabajo pendiente

Auth ya tiene un presupuesto compartido de 5 segundos y el cierre de Alfabeto dispone de tres
reintentos adicionales. El transporte competitivo general todavía no configura un timeout total
explícito. Estos mecanismos parciales no acreditan la aplicación completa de la tabla aprobada.

Antes de implementar, concretar:

- Mapeo de los comandos de inicio, preparación, activación, recuperación y cierre a cada categoría,
  evitando que una reconciliación encadene ciclos ilimitados.
- Presupuestos de APIs administrativas, logout, subida/lectura de assets, diccionario y tareas
  operativas: esta aprobación no fija valores para ellos.
- Integración de timeout y cancelación entre navegador, transporte y backend; verificación de
  idempotencia y resultado recuperable de cada escritura que se reintente.
- Sincronización visual de reloj/latencia, métricas y revisión de estos valores con datos reales;
  los SLA y la política de compensación por incidencia siguen siendo decisiones distintas.

## Casos de aceptación

1. Login sin respuesta: salir del estado pendiente a los 5 s; cero reintentos automáticos;
   conservar los campos en memoria y permitir acción manual.
2. Consulta siempre fallida: tres peticiones como máximo, timeout de 10 s por petición y esperas
   de 1/2 s; al agotar, conservar la última vista segura y mostrar reintento manual.
3. Respuesta guardada con HTTP perdido: hasta dos peticiones, misma clave/payload/versión,
   una recepción/evaluación y ninguna acción incompatible mientras exista incertidumbre.
4. Finalización siempre fallida: hasta cuatro peticiones, timeout de 10 s por petición y esperas
   de 1/2/4 s. Agotar el ciclo mantiene estado/intención de cierre sin inventar un resultado.
5. `Retry-After: 8`: ninguna petición antes de 8 s; la espera respeta el límite de reintentos.
6. Credenciales inválidas, permisos revocados o datos inválidos: ninguna repetición automática;
   el usuario recibe la acción correctiva correspondiente.
7. Cambiar cuenta/partida durante la espera: ninguna petición programada posterior ni aplicación
   de una respuesta tardía a la nueva sesión.
8. Vencer el reloj competitivo durante un retry: conservar el deadline; reconciliar una respuesta
   recibida o aplicar el contrato temporal del modo, sin nuevo intento ni tiempo adicional.

## Referencias

- [Decisiones generales](decisions.md): sección 18.
- [Matriz de resiliencia](../current/resilience-matrix.md): R02, R03, R05, R09, R10 y R24.
- [Transferencia de control](adr/0006-explicit-attempt-control-transfer.md): revocación y recuperación.

Los valores quedan documentados y aprobados; esta actualización no modifica código ni ejecuta los
casos de aceptación de la futura implementación.
