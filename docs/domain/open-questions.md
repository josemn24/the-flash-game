# Decisiones configurables y cuestiones aplazadas

## Propósito

Las siguientes decisiones no bloquean el modelo base. Deben cerrarse antes de implementar el modo o
la funcionalidad correspondiente. Cuando una decisión se apruebe, debe trasladarse a la
documentación específica y, si afecta a todo el producto, a `decisions.md`.

## Contrato pendiente por modo

La propuesta de contrato común y el detalle recomendado para cada modo están en
[`mode-contracts.md`](mode-contracts.md). Las reglas marcadas allí como recomendación siguen siendo
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
8. Comparador y desempate del ranking del desafío. En Alfabeto ya está confirmado: Flash Points,
   menor tiempo hasta el último acierto y, si persiste el empate, menor momento de finalización. Los
   demás modos deben consolidarse.
9. Qué checkpoints necesita para reanudarse sin permitir repetir contenido.
10. Qué estado parcial debe persistirse en el servidor.
11. Qué feedback puede mostrarse después de cada respuesta.
12. Cuándo puede mostrarse la solución completa.
13. Qué eventos intermedios deben conservarse para evaluación o auditoría.

## Operación y políticas pendientes

- Duración exacta y número de usos de las invitaciones.
- Periodo de recuperación antes de purgar una sala eliminada.
- Periodo de conservación de eventos técnicos y datos antifraude.
- Procedimiento concreto para conceder y retirar el rol global `superadmin`.
- Interfaz y flujo de auditoría para correcciones de puntuación.
- Límites de frecuencia por operación competitiva.
- Política de toma de control de un intento desde un segundo dispositivo.
- Intervalo del heartbeat, duración del lease y periodo de gracia para confirmar un abandono por
  cierre de pestaña, pérdida de conexión o ausencia de actividad.
- Momento en que un antiguo miembro deja de aparecer en listados no históricos.
- Criterios para materializar rankings si el cálculo dinámico deja de ser suficiente.
- Política de moderación para nombres visibles y avatares.
- Requisitos legales definitivos de exportación, anonimización y eliminación de datos.

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
