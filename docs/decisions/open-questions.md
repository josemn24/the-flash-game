> Estado: abierto. Contiene reglas configurables y decisiones que aún requieren cierre.

# Decisiones configurables y cuestiones aplazadas

## Propósito

Las siguientes decisiones no bloquean el modelo base. Deben cerrarse antes de implementar el modo o
la funcionalidad correspondiente. Cuando una decisión se apruebe, debe trasladarse a la
documentación específica y, si afecta a todo el producto, a `decisions.md`.

## Contrato pendiente por modo

La propuesta de contrato común y el detalle recomendado para cada modo están en
[`mode-contracts.md`](../current/domain/mode-contracts.md). Las reglas marcadas allí como recomendación siguen siendo
configurables hasta trasladarse a `decisions.md`; esta lista conserva únicamente los puntos que aún
requieren cierre o implementación.

Cada modo debe declarar explícitamente:

1. Duración total, duración por pregunta y posibles periodos de gracia.
2. Condición exacta de finalización y cierre de cada modo. Para La Pirámide ya está confirmado que
   completar los siete niveles o fallar un nivel que termina el modo produce un intento
   `completed`; el feedback de “desafío superado” solo corresponde al primer caso. Para los demás
   modos, no se define un estado funcional global de éxito o fracaso; cualquier feedback de modo es
   específico de su interfaz.
3. Número máximo de intentos; el valor predeterminado es uno.
4. Si algún modo futuro permite reintentos y en qué condiciones; la competición inicial no permite
   repetir un intento terminal y los previews sin sala sí pueden repetirse.
5. Cómo distribuye el máximo de 100 puntos.
6. Cómo concede crédito parcial, trata el tiempo y aplica penalizaciones. Las penalizaciones pueden
   reducir la puntuación disponible de una pregunta o prueba, pero el resultado final de esa unidad
   y el total del desafío deben quedar limitados a cero.
7. Qué intento se acredita si admite varios; el valor predeterminado es el mejor.
8. Qué checkpoints adicionales necesita para reanudarse sin permitir repetir contenido; la regla
   ya cerrada consume toda interacción preparada y aplica la recuperación por modo documentada.
9. Qué checkpoints de progreso adicionales necesita cada modo. La sección 19 de
   [`decisions.md`](decisions.md) ya establece que respuestas aceptadas, puntos, progreso y tiempos
   se guardan en el servidor; las respuestas sin enviar no se persisten ni restauran.
10. Qué feedback puede mostrarse después de cada respuesta.
11. Cuándo puede mostrarse la solución completa.
12. Qué eventos intermedios deben conservarse para evaluación o auditoría.

## Operación y políticas pendientes

- Duración exacta y número de usos de las invitaciones.
- Periodo de recuperación antes de purgar una sala eliminada.
- Periodo de conservación de eventos técnicos y datos antifraude.
- Procedimiento concreto para conceder y retirar el rol global `superadmin`.
- Interfaz y flujo de auditoría para correcciones de puntuación.
- Límites de frecuencia por operación competitiva.
- Validación operativa del [bloqueo inmediato aprobado](decisions.md#20-pérdida-del-permiso-para-jugar):
  la implementación local ya cierra idempotentemente el intento como no completado, registra el
  motivo, coordina la membresía con respuestas/finalización, revoca la sesión y actualiza la UI.
  Quedan staging, la reconciliación de datos preexistentes y las carreras de despliegue; permitir
  terminar tras perder el permiso ya no es una cuestión abierta.
- Política de borradores de formularios administrativos y de perfil: alcance, duración, identidad
  y tratamiento de información sensible. El guardado de partidas ya está aprobado; no incluye
  guardar respuestas sin enviar ni aprobar autosave para estos formularios.
- Implementación de los [timeouts y reintentos aprobados](request-retries.md): mapear comandos a
  categorías, coordinar presupuestos/cancelación y garantizar idempotencia. Quedan por definir
  valores para logout, administración, assets, diccionario y tareas operativas; los cuatro límites
  aprobados no se mantienen como preguntas abiertas.
- Implementación de la [transferencia explícita aprobada](adr/0006-explicit-attempt-control-transfer.md):
  contrato, revocación y resultado idempotente, aviso en la sesión anterior, concurrencia entre
  transferencias, auditoría y límites. El runtime todavía bloquea la segunda sesión.
- Intervalo del heartbeat, duración del lease y periodo de gracia para confirmar un abandono por
  cierre de pestaña, pérdida de conexión o ausencia de actividad.
- Momento en que un antiguo miembro deja de aparecer en listados no históricos.
- Criterios para materializar rankings si el cálculo dinámico deja de ser suficiente.
- Política de moderación para nombres visibles y avatares.
- Requisitos legales definitivos de exportación, anonimización y eliminación de datos.

## Incidencias durante partidas: detalles pendientes

La política general está [aprobada desde el 2026-10-06](service-incidents.md). Antes de implementarla
deben concretarse los umbrales de duración/impacto, las evidencias para confirmar una incidencia,
la marca persistida y el tratamiento del intento mientras se revisa, las resoluciones individuales,
la cancelación de publicaciones ya abiertas y sus efectos auditados sobre puntos, y la programación
y comunicación del desafío de reemplazo. Estas cuestiones no reabren el acuerdo de recuperación,
revisión individual y cancelación general.

## Fuera del alcance inicial

- Invitados o jugadores sin cuenta.
- Perfiles distintos por sala.
- Salas públicas.
- Equipos y juego cooperativo.
- Partidas sincronizadas en tiempo real.
- Ranking global entre salas.
- Internacionalización del contenido.
- Monetización o recompensas distintas de Flash Points.
- Feed social completo y notificaciones.
