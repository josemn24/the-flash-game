# ADR 0006: Transferencia explícita de control de un intento

- Estado: aceptado como política de producto; implementación pendiente.
- Fecha: 2026-10-06.
- Sustituye: el aplazamiento y bloqueo de transferencia entre dispositivos del ADR-0003 de
  2026-09-15. Conserva sus reglas de intento único, recuperación y concurrencia.

## Contexto

El jugador puede perder las cookies o cambiar de dispositivo mientras su intento sigue activo.
Exigir que la sesión anterior desaparezca puede bloquearlo por una pestaña olvidada o un dispositivo
sin conexión. La garantía necesaria es que solo una sesión tenga permiso de control sobre el intento.

## Decisión

1. El jugador autenticado con la misma cuenta y con acceso competitivo vigente puede recuperar el
   mismo intento en otro dispositivo mediante la acción explícita **«Continuar aquí»**.
2. La transferencia se permite aunque la sesión controladora anterior siga abierta. No exige
   comprobar que la pestaña anterior se cerró ni esperar un heartbeat o lease.
3. El servidor transfiere el control y revoca la sesión anterior en una única operación atómica.
   En ningún momento dos sesiones distintas quedan autorizadas para actuar sobre el intento.
4. La sesión anterior queda bloqueada en servidor. Su interfaz muestra
   **«Has continuado esta partida en otro dispositivo»** cuando detecta la transferencia; si está
   offline, el aviso puede aparecer al reconectar, pero sus acciones ya no están autorizadas.
5. La nueva sesión continúa el mismo intento, conservando respuestas, puntos y progreso aceptados.
   No se crea otro intento, no se reinician los plazos ni se repiten preguntas vistas.
6. Antes de entregar nuevo contenido, el servidor reconcilia cualquier recepción aceptada y aplica
   la recuperación vigente por modo del [ADR-0003](0003-attempt-lifecycle-and-concurrency.md).
   Los borradores exclusivamente locales no se consideran progreso guardado.
7. Un intento terminal solo permite consultar su resultado autorizado. La transferencia no lo
   reabre, no recupera un plazo vencido ni habilita replay.
8. El inicio de sesión, la apertura de una URL o un refresh no transfieren el control automáticamente.
   El usuario debe confirmar «Continuar aquí»; perder cookies por sí solo no concede control.

## Concurrencia y fallos parciales

- La transferencia es idempotente: perder la confirmación y repetir la misma operación no crea
  otra sesión controladora ni ejecuta otra revocación.
- Dos transferencias concurrentes deben resolverse con control de versión y un único resultado
  autorizado. La petición perdedora no recupera el control automáticamente; requiere consultar
  el estado y una nueva decisión explícita del jugador.
- Una acción de la sesión anterior y una transferencia se ordenan en servidor. Si la acción ya
  fue aceptada, se conserva y reconcilia; si la revocación se confirmó antes, se rechaza sin efecto.
- La UI antigua cancela reintentos y nuevas escrituras al detectar revocación. No intenta recuperar
  control por su cuenta ni trata la revocación como un error de red transitorio.
- Un fallo antes de confirmar la transferencia conserva la autoridad anterior; un resultado
  incierto se resuelve mediante reintento idempotente o consulta autorizada.

## Consecuencias

La recuperación deja de depender de conservar una cookie concreta, sin debilitar la exclusión de
sesiones concurrentes. El backend sigue decidiendo identidad, permisos, plazo y progreso; los tokens
revocados no pueden usarse para escribir aunque la pantalla anterior permanezca abierta.

Esta decisión cambia el objetivo de producto, no el comportamiento del runtime actual. El comando
de transferencia permanece deshabilitado hasta implementar y verificar las garantías anteriores.

## Detalles pendientes de implementación

- Contrato del comando, renovación del token controlador y consulta del resultado de transferencia.
- Presentación de la confirmación y mecanismo para que la UI anterior detecte revocación, incluidas
  pestañas que compartan cookies. La exclusión real siempre se valida en servidor.
- Mensajes para permisos perdidos, intento terminal, conflicto concurrente y resultado incierto.
- Límites de frecuencia, auditoría y conservación de claves idempotentes de transferencia.

## Criterios de aceptación

1. Iniciar en A y confirmar «Continuar aquí» en B con la misma cuenta: mismo ID de intento,
   respuestas/puntos guardados intactos, plazos conservados y un solo controlador.
2. Mantener A abierto y enviar desde ambos: tras la transferencia, A recibe revocación y no escribe;
   B puede continuar. Reconectar A después de estar offline mantiene el bloqueo y muestra el aviso.
3. B sin confirmación, una cuenta distinta, permisos revocados o un spectator: ninguna transferencia
   ni acceso competitivo concedido.
4. B y C transfieren sobre la misma versión: un ganador; el perdedor no ejecuta takeover automático.
5. Transferir mientras A envía una respuesta: la respuesta aceptada se conserva una vez o se rechaza
   tras revocación; nunca se pierde ni se evalúa/acredita dos veces.
6. Perder la respuesta HTTP de una transferencia confirmada y repetirla: misma transferencia lógica,
   sin nueva rotación/revocación ni intento duplicado.
7. Borrar cookies en A y volver a autenticar: recuperación mediante confirmación explícita, sin
   otorgar control solo por login.
8. Transferir durante una interacción temporizada o después del deadline: aplicar el contrato del
   modo sin reiniciar reloj ni reentregar contenido consumido. Un intento terminal no se reabre.

## Referencias

- [Decisiones generales](../decisions.md): sección 17.
- [Cuestiones operativas pendientes](../open-questions.md): implementación de la transferencia.
- [Matriz de resiliencia](../../current/resilience-matrix.md): R04, R12 y R21.
