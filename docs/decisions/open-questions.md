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

## Contrarreloj: decisiones pendientes

CT-01 a CT-05 están cerradas el 2026-10-11 para la primera versión Queens. Se conserva este
encabezado para los enlaces históricos. Las [decisiones normativas](decisions.md#21-contrarreloj-reglas-acordadas)
y la [especificación implementada](../current/domain/contrarreloj.md) contienen el detalle.

| ID    | Resolución vigente                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| CT-01 | Pesos editoriales enteros positivos con suma 100; acierto completo, sin parcial, bonus ni penalización.           |
| CT-02 | Queens: dos validaciones completas incorrectas permiten continuar; la tercera termina.                            |
| CT-03 | 2–20 pruebas, Queens 4×4–8×8; segundos enteros positivos obligatorios, sin default.                               |
| CT-04 | Primera preparación inicia reloj; esperas sin compensación; recuperación activa sin recepción termina sin replay. |
| CT-05 | Recepción BD después de bloqueos, estrictamente antes del deadline; conciliación previa a cierre.                 |

Sigue pendiente habilitar otros formatos y calibrar contenido real en staging. Los fixtures técnicos
no son una secuencia editorial validada para publicación real.
