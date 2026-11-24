# CYCLE-002 — ¿Vuelve a jugar Tabarnia en una segunda temporada?

## Estado del ciclo

- **Estado:** Diseño. Único ciclo activo tras la decisión [PERSEVERAR de CYCLE-001](CYCLE-001.md#15-decisión-estratégica).
- **Estado de máquina:** EXPERIMENT_DESIGN
- **Siguiente puerta:** MVP_DESIGN
- **Condición de avance:** seleccionar las nueve versiones candidatas y confirmar un alcance técnico viable para publicarlas con la cadencia, las reglas de competición y la medición acordadas.
- **Responsable:** Jose Moreno
- **Protocolo:** `tabarnia-s2-v1`, borrador hasta la congelación.
- **Fecha de inicio:** pendiente de fijar. `T0` es la apertura del primer desafío.

## 1. Contexto

En Tabarnia 1, 12 de 14 invitados completaron al menos seis desafíos, incluidos dos de los tres últimos, y 11 completaron los nueve. La cadencia real se adaptó durante el juego y HYP-001 quedó `Inconclusa` respecto al protocolo diario. Telegram aportó señales favorables a los tableros y Alfabeto temático, además de opiniones contrapuestas sobre la Pirámide. El esfuerzo de organizar esa temporada sigue sin una línea base verificada. [Resultados de Tabarnia 1](CYCLE-001.md#12-resultados-observados).

## 2. Decisión que necesitamos tomar

Decidir si hay repetición suficiente para probar un paquete de temporada con otro anfitrión o si primero hay que investigar qué frena el regreso en Tabarnia. El registro de trabajo ayudará a decidir si la primera mejora operativa debe centrarse en el calendario, el contenido o el soporte.

## 3. Pregunta de aprendizaje

¿Cuántas de las 14 personas invitadas a Tabarnia 1 volverán a participar de forma sostenida en Tabarnia 2 durante nueve días consecutivos, con el calendario fijado antes de empezar?

## 4. Hipótesis crítica

**Referencia:** [HYP-010](../HYPOTHESES.md#hyp-010--repetición-entre-temporadas-en-tabarnia), `Priorizada`.

Al menos ocho de las 14 personas de la cohorte original completarán seis o más de los nueve desafíos de Tabarnia 2, incluidos al menos dos de los desafíos siete, ocho y nueve, con nueve ventanas consecutivas de 24 horas fijadas de antemano.

## 5. Por qué esta hipótesis es prioritaria

La primera temporada mostró recurrencia dentro de una temporada. Volver a otra es el comportamiento que falta observar antes de invertir en más salas o en generación de contenido a escala. Se medirá el esfuerzo de operación en paralelo como contexto de HYP-005.

## 6. Evidencia necesaria

La evidencia principal son las finalizaciones competitivas de la cohorte. Las prácticas, las opiniones y la intención declarada de volver aportan contexto. El comienzo de una partida en la segunda temporada permite observar retorno inicial. El criterio principal exige continuidad hasta el tramo final.

## 7. Métrica y umbrales

### Recurrencia entre temporadas

- **Denominador.** Las 14 personas invitadas a Tabarnia 1. La cuenta del organizador y las cuentas de prueba quedan fuera. Se invita a la misma cohorte y se mantienen en el denominador quienes declinen, se ausenten o dejen de jugar. La correspondencia entre invitación y jugador se guarda en el expediente privado.
- **Finalización válida.** Un intento oficial competitivo por persona y publicación, iniciado dentro de la ventana asignada y en estado `completed` a `Tdatos`. Incluye cero puntos y derrota reglamentaria. Se excluyen ensayo, prueba, abandono, invalidación e intentos abiertos al corte. Si el modo permite finalizar después del cierre de su ventana, el intento cuenta cuando termina a tiempo para `Tdatos`.
- **Cálculo.** `R2` es el número de integrantes con seis o más finalizaciones válidas y al menos dos entre las últimas tres publicaciones. La métrica principal es `R2 / 14`. Se usa persistencia de intentos con sus fechas y estados, contrastada con los CSV del portal y el registro de invitaciones. Las 126 parejas persona–desafío son observaciones repetidas de 14 personas.
- **Corte.** `Tdatos` es 24 horas después del cierre de la novena publicación. Se reconcilian los intentos al corte y se conserva la extracción privada con la consulta, fecha y versiones utilizadas.

| Resultado con medición interpretable | Lectura y consecuencia                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **8–14 personas**                    | HYP-010 apoyada en esta cohorte. Evaluar la prueba con otro anfitrión y priorizar la mejora operativa con los minutos medidos. |
| **5–7 personas**                     | Inconclusa. Revisar episodios de retorno y abandono y decidir si conviene repetir o ajustar el experimento.                    |
| **0–4 personas**                     | HYP-010 debilitada. Investigar las barreras para volver antes de invertir en expansión o automatización.                       |

Se reutilizan los umbrales de producto de CYCLE-001 para contrastar descriptivamente ambas temporadas. El `12/14` previo es una referencia observada. Si hay oportunidades no evaluables, se calcula un límite inferior con finalizaciones verificadas y un superior suponiendo que se completaron las oportunidades no evaluables. Si el intervalo cruza categorías, o si una desviación impide interpretar la cohorte, el calendario o el corte, el resultado se declara inconcluso.

**Medidas auxiliares.** Publicar cuántos de los 14 inician al menos un desafío oficial válido y cuántos de los 11 que completaron Tabarnia 1 inician alguno en Tabarnia 2. Informar también finalizaciones por publicación y distribución de 0 a 9 por persona. Si se recogen opiniones, registrar el número de respuestas y el contexto por separado.

### Esfuerzo de organizar la temporada

Jose llevará un registro al terminar cada tarea, desde la preparación hasta el cierre del seguimiento. Cada fila guarda fecha, persona responsable, publicación o temporada, categoría, minutos activos, si la tarea es recurrente o una inversión inicial, y si fue manual o reutilizó un material. Se registra también cada intervención manual sobre el calendario y su causa.

| Categoría        | Trabajo que se cronometra                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| Contenido        | Selección y autoría de preguntas, tableros y desafíos.                      |
| Revisión         | Validación de soluciones y variantes, pruebas y calibración.                |
| Programación     | Preparación de ventanas, publicación, ajuste y verificación del calendario. |
| Coordinación     | Invitaciones, avisos de Telegram y comunicaciones.                          |
| Soporte y cierre | Ayuda, incidencias y análisis de la temporada.                              |

Sumar los minutos activos por categoría y en total. Registrar una sola vez cada intervalo de trabajo y excluir esperas. Informar por separado el tiempo por publicación cuando sea atribuible y el tiempo compartido de la temporada. Mostrar el total recurrente, el total de preparación inicial y el número de intervenciones de calendario. Cualquier ayuda se registra en minutos por persona.

Comparar con Tabarnia 1 únicamente si se recupera un registro con cobertura y categorías equivalentes. Si falta esa línea base, informar el coste de Tabarnia 2 como referencia para el futuro. Una comparación puntual entre preparar dos desafíos equivalentes a mano y desde una plantilla puede orientar el ahorro de esa tarea. El esfuerzo es una medida auxiliar de CYCLE-002 y su medición no cambia el umbral de HYP-010.

## 8. Experimento

### Calendario y mezcla de modos

Cada ventana dura 24 horas. La siguiente abre en el momento en que cierra la anterior. Se propone fijar `T0` a las 15:00 en `Europe/Madrid`, la hora de apertura de la primera temporada. Antes de invitar se registrarán las nueve ventanas absolutas en UTC y su equivalente en Madrid, junto con sus versiones y los avisos previstos. Los desplazamientos se calculan en bloques de 24 horas desde `T0`.

| Día | Abre       | Cierra     | Modo              | Contenido                                                          |
| --- | ---------- | ---------- | ----------------- | ------------------------------------------------------------------ |
| 1   | `T0`       | `T0 + 1 d` | Flash             | Cultura general variada, con preguntas cortas                      |
| 2   | `T0 + 1 d` | `T0 + 2 d` | Contrarreloj      | Lógica · Queens                                                    |
| 3   | `T0 + 2 d` | `T0 + 3 d` | Alfabeto          | Cultura general, con pistas de varias categorías                    |
| 4   | `T0 + 3 d` | `T0 + 4 d` | Tablero único     | Lógica · Escape                                                    |
| 5   | `T0 + 4 d` | `T0 + 5 d` | Pirámide especial | Lógica · Mini-sudoku 4×4, Operaciones cruzadas y Conectar parejas    |
| 6   | `T0 + 5 d` | `T0 + 6 d` | Contrarreloj      | Lógica · Zip 5×5                                                   |
| 7   | `T0 + 6 d` | `T0 + 7 d` | Alfabeto          | Cultura general, con pistas nuevas y dificultad similar al primero |
| 8   | `T0 + 7 d` | `T0 + 8 d` | Tablero único     | Lógica · Regiones rectangulares                                    |
| 9   | `T0 + 8 d` | `T0 + 9 d` | Flash             | Cultura general, con formatos como ordenación y emparejamiento      |

Las nueve publicaciones son oficiales y cuentan para la recurrencia y el ranking. El tramo final de la métrica abarca Alfabeto, Tablero único y Flash. `Tdatos = T0 + 10 d` y el seguimiento cualitativo termina siete días después del último cierre, en `T0 + 16 d`.

### Operación y controles

- Usar la sala privada de Tabarnia en staging. Registrar el envío a las 14 personas de la cohorte original y que el acceso está disponible antes de abrir el primer desafío. Prever un aviso general en Telegram por apertura y registrar la ayuda y los contactos adicionales.
- Seleccionar contenido revisado y reutilizar plantillas donde encajen. Revisar variantes en las respuestas de texto corto, especialmente títulos traducidos y nombres alternativos. Para la Pirámide, ensayar el Mini-sudoku en el primer tramo, Operaciones cruzadas a media altura y Conectar parejas más adelante. Dar ejemplos jugables de los formatos nuevos con tableros distintos a los oficiales y calibrar el tiempo de cada nivel con pruebas en móvil.
- Congelar la cohorte, el calendario, versiones de contenido, aplicación y esquema, el protocolo de medición y las reglas de puntuación antes de invitar. Registrar las desviaciones al producirse. Ante un fallo bloqueante, detener la operación afectada y documentar la pérdida de comparabilidad antes de interpretar el resultado.
- Este diseño prueba la repetición de la experiencia completa con cadencia diaria. La mezcla de modos, la cadencia, la pausa entre temporadas, los avisos y la relación con el anfitrión pueden influir. Con un grupo y una temporada, las diferencias respecto a Tabarnia 1 y las comparaciones entre modos y formatos se interpretarán de forma descriptiva.

## 9. MVP o vehículo experimental

Usar el portal, el calendario, los intentos y las exportaciones existentes. Preparar los nueve desafíos juntos desde un calendario de referencia y usar plantillas o contenido reutilizable cuando esté disponible. El organizador revisa la propuesta y simula con el portal el flujo de elegir fecha, ritmo y paquete. La nueva interfaz de autoservicio y el generador competitivo quedan como opciones a evaluar con los datos de esfuerzo y recurrencia.

### Implementación pendiente para esta mezcla

| Publicación | Punto de partida | Pendiente para probarla en competición |
| ----------- | ---------------- | -------------------------------------- |
| Días 1, 2, 3, 7 y 9 | Flash, Alfabeto y Contrarreloj con Queens ya disponibles. | Preparar y validar contenido, incluida la corrección de variantes de texto en cultura general. |
| Día 4 · Tablero único de Escape | Escape ya admite competición en otros modos. [Propuesta de Tablero único](../../../roadmap/modos-de-juego-futuros.md#tablero-único). | Implementar el recorrido de un solo tablero, con un intento oficial, reloj que arranca con el tablero listo, validación y tiempos del servidor, límite y resultado al vencer, clasificación por tiempo de resolución y Flash Points para la temporada. |
| Día 5 · Pirámide especial | Pirámide y Conectar parejas ya disponibles. [Mini-sudoku](../../../roadmap/formatos-futuros.md#mini-sudoku--ampliación-a-6--6) solo en práctica. [Operaciones cruzadas](../../../roadmap/formatos-futuros.md#crucigrama-aritmético--propuesta) figura como propuesta. | Habilitar Mini-sudoku 4×4 en Pirámide e implementar Operaciones cruzadas con validación de soluciones. Comprobar las transiciones, la eliminación y la puntuación y calibrar el peso del tiempo. |
| Día 6 · Contrarreloj de Zip | Zip 5×5 existe. [Contrarreloj admite Queens y Conectar parejas](../../../../current/domain/contrarreloj.md#propósito-y-alcance). | Habilitar una secuencia de tableros Zip 5×5 en Contrarreloj, con configuración en el portal, validación de cada tablero, avance y cierre de la partida. |
| Día 8 · Tablero único de Regiones rectangulares | [Primer formato nuevo que se quiere prototipar](../../../roadmap/formatos-futuros.md#regiones-rectangulares--primer-formato-nuevo-a-probar). | Implementar el tablero 5×5 y su validador, comprobar unicidad de solución y probar la interacción en móvil. Integrarlo en el mismo recorrido de Tablero único que Escape. |

En staging, comprobar cada recorrido nuevo desde la publicación hasta la finalización y su reflejo en ranking y exportaciones. Ensayar un intento resuelto y otro que agote el tiempo, comprobar el reloj cerca del plazo y verificar el estado persistido que cuenta para la recurrencia. Registrar el trabajo de implementación como inversión inicial, por separado del esfuerzo recurrente de preparar y operar la temporada.

La preparación termina cuando quedan verificadas las nueve versiones, el calendario absoluto, el acceso de la cohorte y una extracción de prueba capaz de calcular la métrica. El expediente privado conserva invitaciones, extractos y registros de organización. Los informes usan recuentos agregados. Se eliminan las copias identificables del expediente a los 90 días del cierre del informe, según la política del estudio.

## 10. Control READY_TO_RUN

**Estado:** Pendiente. Responsable de aprobación: Jose Moreno. Ventanas absolutas, versiones candidatas y fecha de congelación pendientes.

- [ ] Nueve versiones seleccionadas y probadas, con variantes de respuesta y calibración de la Pirámide revisadas.
- [ ] Integraciones de Zip, Tablero único y niveles nuevos de Pirámide verificadas en staging, con intentos y puntuaciones reproducibles.
- [ ] Fecha `T0`, ventanas y avisos definidos con zona, y cohorte y acceso verificados.
- [ ] Extracción del corte y registro de minutos ensayados con datos de prueba.
- [ ] Protocolo, contenido, calendario y versiones técnicas congelados antes de invitar.

## 11. Plan de ejecución

1. Acotar las integraciones pendientes, seleccionar las versiones candidatas y verificar los nueve recorridos al preparar el calendario en el portal.
2. Verificar las fuentes de medición, congelar el diseño y registrar las 14 invitaciones.
3. Ejecutar las publicaciones con los avisos fijados y registrar minutos e incidencias.
4. Conciliar al corte, completar el seguimiento y comparar recurrencia y esfuerzo con sus criterios.

## 12. Resultados observados

Pendientes de ejecución. Se registrarán datos, comportamientos, opiniones, anomalías y desviaciones.

## 13. Análisis del aprendizaje

Pendiente. Se evaluarán HYP-010, los límites de la evidencia y el coste por fase.

## 14. Calidad del experimento

Pendiente de contrastar el cumplimiento del diseño, la cobertura de intentos y el registro operativo.

## 15. Decisión estratégica

Pendiente de los resultados de Tabarnia 2.

## 16. Próxima incertidumbre

Si se observa repetición, comprobar si otro anfitrión puede poner la experiencia en marcha con poca ayuda. La decisión se tomará al cerrar este ciclo.

## 17. Próxima acción

Confirmar el alcance mínimo de las integraciones pendientes para poder seleccionar las nueve versiones candidatas.

## 18. Documentos que deben actualizarse

Actualizar [STATE](../STATE.md), [HYPOTHESES](../HYPOTHESES.md) y este ciclo al avanzar. Actualizar [STRATEGY](../STRATEGY.md) cuando la evidencia cambie las apuestas vigentes.
