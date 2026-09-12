# Decisiones configurables y cuestiones aplazadas

## Propósito

Las siguientes decisiones no bloquean el modelo base. Deben cerrarse antes de implementar el modo o
la funcionalidad correspondiente. Cuando una decisión se apruebe, debe trasladarse a la
documentación específica y, si afecta a todo el producto, a `decisions.md`.

## Contrato pendiente por modo

Cada modo debe declarar explícitamente:

1. Duración total, duración por pregunta y posibles periodos de gracia.
2. Condición exacta de finalización, éxito y fracaso.
3. Número máximo de intentos; el valor predeterminado es uno.
4. Si permite reintentos y en qué condiciones.
5. Cómo distribuye el máximo de 100 puntos.
6. Cómo concede crédito parcial y aplica penalizaciones.
7. Qué intento se acredita si admite varios; el valor predeterminado es el mejor.
8. Comparador y desempate del ranking del desafío.
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
- XP, niveles de cuenta, economía o recompensas.
- Feed social completo y notificaciones.
