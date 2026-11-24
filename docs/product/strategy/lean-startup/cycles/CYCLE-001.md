# CYCLE-001 — ¿Existe participación sostenida en la alpha diaria de Tabarnia?

## Estado del ciclo

- **Estado:** Cerrado el 2026-11-24 con decisión estratégica `PERSEVERAR`. HYP-001 queda `Inconclusa` para el protocolo diario.
- **Estado de máquina al cierre:** NEXT_CYCLE
- **Ciclo sucesor:** [CYCLE-002 — Tabarnia 2](CYCLE-002.md).
- **Responsable:** Jose Moreno
- **Versión del protocolo:** `tabarnia-daily-v2`, definida el 2026-10-24. No se registró su congelación antes de ejecutar (ver sección 10).
- **Fecha de inicio:** invitaciones enviadas el 2026-11-05; `T0` = 2026-11-06 14:00 UTC.
- **Corte principal:** `Tdatos` = 2026-11-22 14:00 UTC (cierre del desafío nueve + 24 h).
- **Seguimiento cualitativo:** hasta el 2026-11-28. Las aportaciones posteriores al cierre estratégico se pueden registrar con fecha y fuente en este expediente.

> Nota de registro (2026-11-24): las secciones 1 a 9 conservan el diseño previo a la ejecución sin
> reescribirlo. Lo ocurrido durante la temporada se registra en las secciones 10, 12, 13, 14 y 16.

## 1. Contexto

### Hechos observados

- El repositorio dispone de Auth, salas, temporadas, publicaciones, intentos, respuestas, rankings y portal privado, con evidencia principalmente local. La validación operativa de staging sigue pendiente. Fuente: [estado actual](../../../../current/status.md).
- Los [intentos y respuestas](../../../../../supabase/schemas/30_competition.sql) y los [hechos temporales](../../../../../supabase/schemas/35_authoritative_state.sql) aportan parte de los datos necesarios. La [verificación archivada](../../../../archive/reports/tabarnia-measurement-verification.md) corresponde a una implementación experimental anterior. La [guía de medición vigente](../../../../current/product-measurement.md) describe las fuentes comunes actuales; el análisis específico del estudio está pendiente. No hay datos de usuarios reales registrados.
- No hay resultados de comportamiento ni aprendizaje Lean registrados para esta alpha. La capacidad técnica no acredita recurrencia, disfrute ni sostenibilidad económica.

### Decisiones de diseño previas a la ejecución

El responsable solicita una cohorte de **14 personas invitadas**, **nueve desafíos diarios** y criterios de éxito definidos antes de observar resultados. Este contrato conserva la definición y los umbrales de participación sostenida del estudio de Tabarnia. Se aplicarán en el análisis posterior. Tabarnia usa la medición automática común a todas las salas; este contrato no configura la captura ni bloquea la operación del producto.

| Revisión                        | Cambio previo a observar resultados                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diseño anterior, sustituido     | Once invitaciones, nueve desafíos cada dos días durante 17 días; recurrencia con cinco desafíos y umbrales de seis/tres personas.                         |
| `tabarnia-daily-v2`, 2026-10-24 | Catorce invitaciones, nueve ventanas diarias de 24 horas; seis desafíos completados, incluidos dos de los tres últimos; umbrales de ocho/cuatro personas. |

Se conserva esta trazabilidad sin abrir un segundo ciclo ni presentar el diseño anterior como ejecutado.

### Inferencias y supuestos

- La incertidumbre principal es si el grupo vuelve voluntariamente a una competición breve y asíncrona.
- Se supone que variedad, calendario y ranking pueden contribuir a esa repetición; este ciclo no aislará sus efectos causales.
- La relación personal con el organizador y la novedad pueden generar participación temporal.

## 2. Decisión que necesitamos tomar

¿La evidencia justifica PERSEVERAR con una segunda temporada y qué fricción debe resolverse antes, o conviene reconsiderar la propuesta antes de ampliar The Flash?

El ciclo orienta esa decisión; no valida por sí solo retención a largo plazo, transferencia a otros grupos ni modelo de negocio.

## 3. Pregunta de aprendizaje

¿Una cohorte de 14 amistades invitadas a Tabarnia mantiene participación voluntaria hasta el final de una temporada de nueve desafíos diarios?

## 4. Hipótesis crítica

**Referencia:** HYP-001, en estado `Priorizada` hasta iniciar la recogida de datos. Tras la ejecución, clasificada como `Inconclusa` por calidad del experimento (sección 13).

Creemos que Tabarnia obtiene suficiente valor del loop de desafíos asíncronos y ranking acumulado para que al menos ocho de las 14 personas invitadas completen seis o más desafíos, incluidos al menos dos de los desafíos siete, ocho y nueve.

## 5. Por qué esta hipótesis es prioritaria

- Una base técnica sólida permite probar ahora el comportamiento recurrente.
- Ampliar formatos o funciones sociales sin observar repetición no resuelve la incertidumbre principal.
- Una única cohorte y temporada permiten aprender con operación e instrumentación acotadas.

## 6. Evidencia necesaria

- **Apoyo:** ocho o más personas cumplen la definición de participación sostenida de la sección 7.
- **Debilitamiento:** cuatro o menos personas la cumplen.
- **Inconclusión:** entre cinco y siete personas la cumplen, o la calidad del experimento impide interpretar el resultado según la sección 7.

Opiniones positivas, visitas, puntuaciones altas e intención declarada de volver son contexto; no sustituyen la métrica principal.

## 7. Contrato de medición

### 7.1 Población, calendario y corte de datos

- **Cohorte:** exactamente 14 personas distintas con invitación efectivamente enviada antes de abrir el primer desafío. El registro de cohorte fija un identificador de participante y su correspondencia con `player_id` cuando exista.
- **Inclusión:** permanecen en el denominador quienes rechazan la invitación, no acceden o dejan de jugar. No se sustituyen ni se añaden personas durante la temporada para mejorar resultados.
- **Exclusión:** cuentas de pruebas, servicios y organizador en su función operativa. La composición se revisa antes de congelar; no se presupone que las cuentas del seed local sean la cohorte real.
- **Calendario:** nueve publicaciones distintas, ordenadas del uno al nueve. Si `T0` es la apertura inicial, la ventana `i` es `[T0 + (i-1) × 24 h, T0 + i × 24 h)`. Son nueve días consecutivos sin solapamiento y un intento competitivo por persona y publicación.
- **Instantes:** se fijarán fecha inicial y nueve aperturas/cierres como instantes ISO 8601 con zona; se conservarán en UTC y se presentarán en `Europe/Madrid`. Los cambios de hora no alteran las ventanas de 24 horas.
- **Corte principal:** `Tdatos = cierre del desafío nueve + 24 h`. Antes de extraer se ejecutará la reconciliación autorizada de intentos. La hora del corte es fija aunque la consulta se ejecute después.
- **Seguimiento:** encuesta y entrevistas hasta siete días después del cierre del noveno desafío; no alteran el corte de participación. El informe se prepara después de esa ventana.

Las 126 oportunidades son observaciones repetidas de 14 personas, no 126 participantes independientes. Si no se pueden fijar 14 invitaciones y nueve ventanas, se revisa el diseño antes de ejecutar.

### 7.2 Unidad de cómputo y métrica principal

Una **finalización válida para el ciclo** es un intento de la cohorte y de una de las nueve publicaciones, con `kind = competitive`, inicio aceptado dentro de su ventana y `status = completed` a `Tdatos`. Se cuenta una sola vez por pareja participante/publicación.

- Finalizar incluye cero puntos, eliminación en Supervivencia o fallo reglamentario en Pirámide.
- No cuentan ensayos, demos, intentos de prueba, abandonados, invalidados ni todavía abiertos al corte.
- Un intento válidamente iniciado puede terminar después de cerrar su publicación si lo permiten las reglas del modo y termina antes del corte. Se atribuye a su publicación, no al día civil de finalización.
- Reintentos HTTP, recargas y transferencia de sesión no crean otra participación.
- Los finales íntegramente por timeout sin respuesta o acción voluntaria aceptada se etiquetan aparte, usando respuestas y eventos autoritativos del formato. Si no se puede determinar la interacción, se indica desconocida. Esta etiqueta no modifica el cómputo principal ni prueba disfrute.
- Una corrección de puntos no modifica la finalización; una invalidación anterior al corte sí afecta a su elegibilidad. Hechos y auditoría se conservan.

Para cada participante `p`, `C(p)` es el número de publicaciones completadas y `L(p)` el número completado entre las publicaciones siete, ocho y nueve.

```text
Sostenida(p) = C(p) >= 6 y L(p) >= 2
R = número de personas de la cohorte que cumplen Sostenida(p)
Métrica principal = R / 14
```

Se publicarán `R/14`, el porcentaje y la distribución de personas con cero a nueve desafíos completados. La aspiración de juego diario se observa también mediante quienes completan los nueve; no se exige una racha perfecta para cumplir la definición principal.

### 7.3 Umbrales y alcance de la decisión

| Resultado con medición interpretable | Clasificación de HYP-001            | Consecuencia para la decisión                                                       |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `R >= 8`                             | Apoyada en esta cohorte y temporada | Evaluar PERSEVERAR con una segunda temporada y corregir las fricciones observadas.  |
| `5 <= R <= 7`                        | Inconclusa                          | Investigar barreras y decidir si repetir o reparar el experimento antes de ampliar. |
| `R <= 4`                             | Debilitada                          | Revisar propuesta, cadencia o contexto antes de invertir en ampliación.             |

Los umbrales son decisiones de producto previas a observar datos: seis de nueve exige frecuencia y dos de los tres últimos exige continuidad. Ocho de 14 requiere mayoría sostenida; cuatro o menos indica una minoría reducida. No son benchmarks, significación estadística ni prueba de product-market fit. No se recalculan sobre quienes aceptan o se activan.

La clasificación no decide automáticamente PERSEVERAR, PIVOTAR o PARAR. Primero se revisan calidad, explicaciones alternativas y límites; después se documenta una única decisión estratégica.

### 7.4 Métricas auxiliares

Se informan recuentos, numerador, denominador, ventana y datos faltantes. Salvo ventana explícita distinta, las métricas de juego, navegación e incidencias abarcan desde `T0` hasta `Tdatos`; las vistas por publicación se restringen a su ventana de apertura. Un denominador cero produce «no calculable», nunca cero por ciento. No tienen umbrales propios de aprobación ni cambian retrospectivamente HYP-001.

| ID y pregunta                            | Cálculo y ventana                                                                                                                                                                                        | Fuente y uso                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M01 — ¿Se activan pronto?                | Personas que completan el desafío uno o dos antes de `T0 + 48 h` / 14. Añadir activación total: quienes completan alguno a `Tdatos` / 14.                                                                | Cohorte e intentos. Distinguir convocatoria/acceso de recurrencia posterior.                                                              |
| M02 — ¿Cómo evoluciona la participación? | Por publicación `i`, iniciadores únicos `S_i/14` y finalizadores únicos `C_i/14`; distribución individual cero a nueve.                                                                                  | Intentos, publicaciones y cohorte. Los finales tardíos válidos se atribuyen a su publicación.                                             |
| M03 — ¿La introducción lleva al inicio?  | `X_i` = personas con introducción visualizada durante la ventana `i`; conversión = personas presentes tanto en `X_i` como en `S_i` / `X_i`. Mostrar además todos los inicios sin evento de introducción. | Eventos de navegación e intentos. La telemetría perdida no puede producir una conversión superior al 100 % ni borrar un inicio oficial.   |
| M04 — ¿Terminan lo que empiezan?         | `C_i/S_i`, con estados terminales, motivo técnico y número de preguntas alcanzadas a `Tdatos`. La participación tardía se mantiene dentro de las reglas de 7.2.                                          | Intentos y respuestas. Perder reglamentariamente cuenta como completar.                                                                   |
| M05 — ¿Llegan al final de la temporada?  | Personas con al menos dos finalizaciones entre siete, ocho y nueve / 14; además, mismo numerador restringido a activados tempranos M01 / activados tempranos M01.                                        | Cohorte e intentos. Mostrar ambos denominadores, sin sustituir el principal.                                                              |
| M06 — ¿Cómo experimentan cada desafío?   | Disfrute de uno a cinco: distribución, mediana y número de personas que responden por desafío. Dificultad declarada y problemas codificados por separado.                                                | Feedback voluntario, una valoración vigente por persona/publicación al cierre del seguimiento. No responder no equivale a insatisfacción. |
| M07 — ¿Usan la parte social?             | Personas con al menos una vista visible del ranking / 14 y número de ventanas distintas con vistas por persona durante los nueve días.                                                                   | Eventos de navegación. Mide consulta, no motivación ni efecto causal del ranking.                                                         |
| M08 — ¿Cómo usan práctica y revisión?    | Personas con inicio/fin de ensayo y revisión visualizada, desglosadas por publicación; eventos desde la invitación hasta `Tdatos`.                                                                       | Eventos de navegación y sesión local. Terminar un ensayo no acredita competición.                                                         |
| M09 — ¿Hay fricción técnica?             | Personas afectadas por incidencia de acceso / 14; intentos afectados por error de juego / intentos iniciados. Separar errores recuperados, bloqueantes, interrupciones y timeout.                        | Logs, intentos, eventos y registro de incidencias. Anotar evidencia y posibilidad de atribución, sin asumir desinterés.                   |
| M10 — ¿Qué esfuerzo requiere operar?     | Minutos reales en contenido, configuración, soporte e incidencias; totales por temporada y por publicación. Costes de infraestructura asignados al periodo, distinguiendo compartidos y atribuibles.     | Registro manual y costes disponibles. Contexto para HYP-005/HYP-009, sin validarlas en este ciclo.                                        |

Puntos, aciertos, errores y tiempos efectivos de respuesta son diagnósticos adicionales por desafío, con mediana, rango y tamaño de muestra. El tiempo hasta el primer inicio se calcula como el primer `started_at` competitivo menos la fecha de envío de la invitación de esa persona; solo se resume entre quienes inician y se informa aparte cuántas personas no iniciaron. La duración competitiva usa tiempos persistidos; `completed_at - started_at` se identifica como duración de pared y no se confunde con tiempo efectivo. Mayor duración o puntuación no implica mayor disfrute.

M10 abarca desde el inicio de la preparación registrado hasta el cierre del seguimiento. Se consigna la ventana de facturación y el criterio de asignación de costes; los importes desconocidos se marcan pendientes en vez de inventarlos.

Las ventanas anteriores son requisitos del análisis, no una garantía de cobertura de la aplicación.
En M03, M07 y M08 se conserva la ventana efectiva de captura y se informa aparte cualquier tramo
sin cobertura. En particular, M08 no puede darse por observado desde la invitación hasta `Tdatos`
solo con la captura común, que termina al acabar la temporada. Sin una fuente complementaria
verificada, ese tramo se declara desconocido y no se publica un cero ni una tasa de uso para toda
la ventana como si estuviera completa. La resolución se documenta antes de congelar el protocolo;
esta limitación no modifica la métrica principal ni sus umbrales.

### 7.5 Fuentes de datos y disponibilidad

| Fuente                       | Contrato mínimo                                                                                                                          | Disponibilidad y preparación pendiente                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cohorte de invitaciones      | Código, invitación y fecha, respuesta, acceso y correspondencia con jugador cuando exista; incluir a quienes no entran en la aplicación. | Registro externo privado del estudio; lista nominal pendiente. No se sustituye por la lista dinámica de miembros del portal.                                   |
| Hechos competitivos          | Publicación/versiones, ventanas, persona, intento, tipo, estado, fechas, respuestas, tiempos y auditoría.                                | Persistencia y consultas autorizadas existentes. El portal ofrece estado actual y CSV comunes; preparar la extracción necesaria para el corte de este estudio. |
| Eventos de producto          | Sala, introducción, ranking y revisión vistos; ensayo iniciado/finalizado, con identidad y contexto autorizados.                         | Captura común por temporada; contrastar el entorno objetivo y sus límites temporales.                                                                          |
| Feedback                     | Disfrute 1–5 por persona/publicación; problemas y comentarios por separado.                                                              | Disfrute opcional en app. Telegram, encuesta e entrevistas se registran en el expediente externo.                                                              |
| Incidencias y comunicaciones | Fechas, personas/publicaciones afectadas, consecuencia, resolución, avisos y ayuda.                                                      | Registro externo privado a preparar; el portal no ofrece formularios de seguimiento experimental.                                                              |
| Operación y costes           | Fecha, tarea, minutos, importe, asignación y responsable.                                                                                | Registro externo del estudio; no hay formularios específicos en el producto.                                                                                   |

Los resultados oficiales se derivan de intentos y respuestas, no de un evento duplicado de «partida completada». El ledger mantiene los puntos oficiales; su suma no define participación.

El indicador del portal «Personas que vuelven» solo exige inicios en dos publicaciones distintas.
No sustituye a `Sostenida(p)` ni su denominador representa las 14 invitaciones. Tampoco el porcentaje
de oportunidades completadas clasifica HYP-001: utiliza parejas persona/publicación disponibles
dentro de un alcance automático que puede crecer.

Los CSV comunes son agregados y estados actuales: no incluyen las fechas de cada intento,
la cronología de eventos ni la auditoría necesaria para reconstruir un corte. El ensayo externo
debe preparar consultas autorizadas sobre esas fuentes, aplicar `Tdatos` y conservar la extracción,
la versión de consulta y las limitaciones. Para M06 se comprobará que el fin de temporada más siete
días coincide con el cierre de seguimiento previsto; cualquier diferencia se registra y resuelve
antes de congelar. No se considera preparada una métrica solo porque exista un CSV descargable.

**Contrato mínimo de eventos implementado:** `room_viewed`, `challenge_intro_viewed`, `ranking_viewed`, `review_viewed`, `rehearsal_started` y `rehearsal_completed`. La captura usa `/api/product/events` y tablas privadas de Supabase; el feedback tiene su registro propio. La implementación no acredita captura en staging.

Cada evento conserva `event_id`, tipo, jugador resuelto en servidor, medición de temporada, publicación cuando corresponda, identificador de visita o ejecución local, `occurred_at`, `received_at` del servidor y versión de app. Sala y temporada se resuelven mediante la medición; el protocolo Lean no es un atributo de captura. Modos y formatos se resolverán desde la versión de contenido. Se validarán pertenencia y contexto, sin aceptar identidad arbitraria del navegador.

- Una vista se registra al mostrar realmente la superficie; render servidor, prefetch o pestaña oculta no cuentan.
- Un evento se emite una vez por superficie y visita; un reintento conserva `event_id`. Las métricas de personas deduplican además por persona/publicación; las de días por ventana del experimento.
- Para las ventanas de eventos se usa `received_at`, con `occurred_at` solo como diagnóstico; eventos recibidos fuera de su ventana no se retroatribuyen por el reloj del navegador.
- Fallar la telemetría no bloquea jugar. La ausencia de evento no demuestra ausencia de visita. Se informa pérdida conocida de captura.
- No se envían respuestas, soluciones, contraseñas, tokens ni contenido libre a la telemetría de navegación. Los comentarios permanecen en el instrumento privado de feedback.

### 7.6 Calidad, datos faltantes y reproducibilidad

- Con cohorte y persistencia verificadas, la ausencia de intento es no participación observada. No se elimina del denominador a quien no juega o rechaza participar.
- Falta de telemetría se etiqueta como captura desconocida; no convierte una finalización persistida en abandono. Feedback ausente conserva su propio denominador de respuestas.
- Pérdida de hechos primarios o indisponibilidad técnica confirmada se marca por persona/publicación como no evaluable. Se conservan el resultado bruto y los motivos, sin imputar partidas al resultado oficial.
- Para evaluar impacto, se calcula un límite inferior de recurrentes con los completados confirmados y un límite superior permitiendo completar todas las oportunidades no evaluables. Si el intervalo cruza las categorías de 7.3, el resultado es inconcluso. Si no las cruza, se informa la clasificación con la limitación explícita. Una convocatoria que no cumple 14 invitaciones o un calendario distinto del congelado invalida la ejecución de este protocolo.
- Un `in_progress` residual a `Tdatos` no cuenta como finalización y exige revisar la reconciliación; si no se puede acreditar su resultado por fallo técnico, se aplica la regla anterior.
- La extracción conserva cohorte, publicaciones/versiones, fecha de corte, versión de consulta, versión de app, fuentes, incidencias, datos faltantes y resultados. Si el estado actual ya no permite reconstruir el corte, se declara la limitación en vez de usar silenciosamente el estado posterior.
- El recálculo sobre la misma extracción conservada del estudio debe reproducir numerador y denominador. Correcciones posteriores generan una revisión identificada; no sobrescriben el informe ni los hechos originales.

### 7.7 Feedback e interpretación exploratoria

Al finalizar cada desafío se ofrecerá una pregunta opcional: «¿Cuánto has disfrutado este desafío?», de uno (nada) a cinco (muchísimo). Los problemas y la dificultad se comunican en el grupo de Telegram durante o después de jugar: reglas confusas, contenido/respuesta discutible, dificultad, control incómodo, fallo técnico u otro. Jose registra en el expediente privado externo las observaciones de Telegram, encuesta e entrevistas, con fuente, tema, fecha y referencia opcional. La app recoge únicamente disfrute 1–5; permite revisarlo hasta el cierre del seguimiento y conserva las revisiones. Nunca se exige feedback para continuar o ver resultados. Los registros anónimos/agregados no se cruzan con historiales individuales.

La encuesta final se ofrecerá una sola vez a las 14 personas, incluidas las que no comenzaron. Recogerá experiencia general cuando sea aplicable, desafíos preferido/menos disfrutado entre los jugados, claridad y justicia percibida, cadencia deseada, valor del ranking, motivo de no participación o abandono y principal mejora propuesta. Para cada pregunta se informa su número de respuestas aplicables; no se obliga a valorar contenido no jugado.

Se intentarán hasta cinco conversaciones voluntarias: una persona sin activar, dos que dejan de participar y dos que llegan al final, cuando existan esos perfiles y acepten. Se preguntará por episodios reales y motivos concretos. La falta de perfiles o respuestas se registra; no se inventa muestra ni se presiona para completarla.

Se analizarán modos y formatos de forma exploratoria, considerando contenido, dificultad, orden, día y exposición. Los nueve desafíos no permiten aislar causalidad ni declarar un formato ganador. Las peticiones de funciones son opiniones sobre posibles soluciones; deben vincularse al problema observado. La intención de otra temporada o de pagar se registra como declaración, no como repetición o compra.

### 7.8 Canales, informes y conservación

- **Aplicación y Supabase:** intentos/respuestas oficiales, seis eventos de producto y disfrute opcional 1–5. La captura resuelve participante y contexto en servidor, tiene una cuota independiente y como máximo un reintento en memoria.
- **Telegram:** avisos generales, ayuda, problemas, conversación y encuesta final; entrevistas voluntarias externas. No se integra Telegram ni se envían mensajes automáticamente.
- **Portal superadmin:** resumen por temporada, actividad por desafío, detalle por persona y CSV de personas, participación, desafíos y resumen. El alcance se incorpora automáticamente y no representa por sí mismo las 14 invitaciones del estudio.
- **Expediente privado del estudio:** cohorte de invitaciones, comunicaciones, incidencias, feedback externo y costes, con códigos de participante y acceso del responsable. La comprobación de preparación y la congelación de criterios son organizativas; no son acciones ni restricciones del producto.
- **Informe de análisis:** el responsable conserva la extracción al corte y sus fuentes/consultas, añade los registros complementarios y aplica las secciones 7.2–7.4 en la fase posterior de análisis. Los CSV del portal muestran estado actual y no reconstruyen automáticamente un corte pasado. Una corrección genera una nueva revisión del informe externo.
- **Conservación:** el responsable elimina las copias identificables del expediente externo 90 días después del cierre del informe y conserva los resultados agregados. Los datos automáticos y las partidas de la aplicación siguen su política vigente; no existe un cron específico de estudios.

La [guía de medición](../../../../current/product-measurement.md) describe las capacidades comunes. La captura de navegación termina con la temporada: cualquier ventana más amplia prevista para el análisis se documenta con esa limitación, sin interpretar datos ausentes como falta de uso. Antes de ejecutar, comprobar que las fuentes y el procedimiento externo permiten aplicar el contrato; la preparación técnica no supera por sí sola READY_TO_RUN.

## 8. Experimento

### Método y comunicaciones

- Una sala privada real de Tabarnia, una temporada y nueve ventanas diarias de 24 horas según 7.1.
- Invitación directa de Jose a las 14 personas fijadas, con acceso provisionado antes de `T0`. Se registran envío y aceptación por separado; no se exige aceptación para permanecer en el denominador.
- Un aviso general por publicación al abrirla, en el canal del grupo acordado antes de iniciar. No se planifican recordatorios individuales para forzar participación. Ayuda solicitada y contactos adicionales se registran con fecha y motivo.
- Un intento oficial por publicación; ensayos y cuentas de prueba quedan separados.
- Antes de iniciar, dos amistades prueban individualmente los nueve desafíos en un recorrido distinto de la competición. Si pertenecen a la cohorte, probarán versiones alternativas que no revelen las respuestas oficiales; cualquier exposición accidental se documenta y se corrige antes de congelar contenido/cohorte.

Los avisos forman parte del protocolo; observar participación con ellos no demuestra uso espontáneo sin avisos. La fase de juego dura nueve días; corte principal y seguimiento se rigen por 7.1. El cierre se produce al alcanzar esos cortes y registrar desviaciones, no al lograr un resultado favorable.

### Condiciones de interrupción y cambios

Un fallo que impida competir o exponga contenido/datos privados exige detener la operación afectada y registrar duración, alcance y resolución. Si impide seguir el calendario congelado, se cierra la ejecución como no interpretable y se decide reparar/repetir antes de otra decisión estratégica. No se prolongan ventanas, sustituyen desafíos o participantes ni cambian umbrales para rescatar el resultado.

Las correcciones técnicas bloqueantes pueden aplicarse con registro de versión, personas y publicaciones afectadas. Las mejoras de preferencia o contenido no bloqueantes se reservan para después; el diseño no cambia silenciosamente durante la recogida de datos.

### Sesgos y límites

Muestra pequeña y de conveniencia, relación con el organizador, novedad, orden de desafíos, exposición previa, avisos y apoyo individual pueden influir. No se realizan A/B tests ni afirmaciones de retención a largo plazo, mercado general o sostenibilidad económica. Se informa quién responde al feedback y quién no.

## 9. MVP o vehículo experimental

### Imprescindible para ejecutar el contrato

- Acceso privado, temporada, contenido probado, un intento, resultado y ranking, reutilizando las capacidades persistidas actuales.
- Registro de cohorte y comunicaciones; consultas sobre hechos competitivos; captura de eventos, feedback e incidencias; registro de operación.
- Análisis privado de las 14 invitaciones y nueve publicaciones, aplicando las métricas de 7.4 a extracciones comunes y al expediente externo. El portal aporta detalle por persona/desafío y CSV; el cálculo Lean se prepara fuera de la aplicación.
- Información previa comprensible sobre la prueba y la medición, participación voluntaria y feedback opcional. Identidades, comentarios y exportaciones solo accesibles al responsable autorizado; el informe de aprendizaje usará identificadores de participante. Ubicación, acceso y conservación se fijan en 7.8; antes de congelar se comprobarán en el entorno objetivo.

### Fuera del alcance de preparación

Creación libre de salas, invitaciones completas como sistema de producto, chat, ranking global, notificaciones sofisticadas, nuevos formatos ajenos a los nueve desafíos y facturación. HYP-002 a HYP-009 no abren ciclos adicionales; costes y opiniones económicas son contexto.

### Criterio para detener la preparación

Detener cuando los nueve desafíos no presenten bloqueos de claridad/calidad y una prueba completa demuestre que se puede obtener el contrato de medición con fuentes trazables. No añadir instrumentación que no responda a una métrica definida.

## 10. Control READY_TO_RUN

- **Estado:** No superado formalmente. La temporada se ejecutó en staging sin registrar el cierre de este control ni la congelación del protocolo. Las casillas abiertas se conservan tal como estaban antes del inicio; no se marcan a posteriori.
- **Versión a congelar:** `tabarnia-daily-v2`; congelación no registrada.
- **Responsable de aprobación:** Jose Moreno.
- **Inicio previsto, cohorte nominal y calendario absoluto:** no se registraron aquí antes de iniciar. Lo ocurrido se documenta en la sección 12.

**Registro posterior a la ejecución (2026-11-24).** Según el responsable, las 14 invitaciones se enviaron por mensaje privado de Telegram el 2026-11-05, la víspera de `T0`, sin sustituciones. Las 14 cuentas de la cohorte quedaron provisionadas en la sala ese mismo día (2026-11-05 19:52 UTC). El control adicional previo a `T0` (catorce envíos, sin sustituciones y acceso provisionado) se considera cumplido según esa declaración. La aplicación no registra las invitaciones; la prueba de envío está en Telegram. No consta la prueba individual previa de los nueve desafíos ni el ensayo completo del análisis externo.

### Comprobaciones

- [x] Decisión, pregunta e hipótesis crítica definidas.
- [x] Cohorte de 14, nueve ventanas diarias, corte y seguimiento definidos como diseño.
- [x] Métrica principal, umbrales, denominadores, fuentes y reglas de datos faltantes definidos.
- [x] Métricas auxiliares y feedback separados de la clasificación principal.
- [ ] Nueve desafíos y versiones seleccionados; prueba individual previa registrada sin contaminación de respuestas.
- [ ] Cohorte nominal de 14 fijada, cuentas operativas excluidas y registro de invitaciones listo para usar.
- [ ] Fecha, nueve ventanas y canal de aviso fijados; acceso privado y entorno operativo comprobados.
- [x] Fuentes locales preparadas; captura, consultas y exportación contrastadas con hechos sintéticos conocidos en Supabase y E2E aislado.
- [ ] Ensayo completo del análisis externo: comprobar denominador de 14 invitaciones, ausencia de participación, corte, datos faltantes y cálculo reproducible usando las fuentes comunes y registros del estudio.
- [ ] Cobertura temporal documentada: consultas de fechas/eventos/auditoría preparadas, tramos sin captura identificados en M03/M07/M08 y cierre del disfrute contrastado con M06.
- [x] Canales y conservación definidos: disfrute en app, feedback externo por Telegram/encuesta/entrevista y registro privado; eliminación identificable a 90 días del cierre.
- [ ] Captura y exportación comunes, análisis y conservación del expediente externo contrastados con cuentas excluidas en el entorno objetivo.
- [ ] Criterios congelados y versión de app/esquema registrada antes de iniciar la recogida de datos reales.

### Alcance de la congelación

Primero se completa el ensayo de medición con cuentas excluidas y se fijan lista nominal, calendario, canal y manejo de registros. Jose registra la congelación del protocolo antes de enviar las invitaciones reales, cuyo registro ya es recogida de datos. HYP-001 pasa a `En prueba` y el ciclo a `RUNNING` al enviar la primera invitación bajo ese protocolo. Como control organizativo de este estudio, la apertura de la temporada requiere que las 14 estén registradas en el expediente externo y el acceso operativo; si no se cumple, no se abre y se conserva la desviación. El seguimiento de M01 comienza en `T0`, no con el envío de invitaciones.

La aplicación registra datos sin exigir este control Lean. El control distingue la preparación lista para invitar de la comprobación final de cohorte antes de abrir. No se considera cumplido por redactar este contrato.

**Control adicional antes de abrir `T0`, ya durante la ejecución de la convocatoria:** comprobar catorce envíos registrados, ausencia de sustituciones y acceso provisionado. Aceptar la invitación o jugar no son condiciones para abrir; son comportamientos que se observarán. Si el control falla, se registra una ejecución no interpretable de este protocolo, sin completar el cupo después de observar juego.

## 11. Plan de ejecución

1. Seleccionar y registrar las nueve versiones candidatas y su orden, dentro de las capacidades existentes.
2. Probar su claridad con dos amistades sin exponer respuestas oficiales a la cohorte; corregir únicamente bloqueos.
3. Preparar la alternativa mínima de fuentes, captura, consultas y exportación que satisfaga la sección 7 y comprobarla con cuentas excluidas.
4. Concretar cohorte nominal, calendario absoluto, canal, acceso, conservación y operación; registrar la preparación y congelar el protocolo.
5. Enviar y registrar las 14 invitaciones; iniciar la recogida de datos sin cambiar denominador ni criterios. Abrir `T0` solo si la cohorte y el acceso cumplen el control.
6. Ejecutar las nueve publicaciones y avisos; registrar uso, feedback, incidencias, ayuda, costes y cambios de app.
7. Reconciliar y extraer a `Tdatos`, completar seguimiento y analizar calidad, métrica principal y contexto por separado.
8. Registrar clasificación de HYP-001, una decisión estratégica y la siguiente incertidumbre, sin abrir otro ciclo antes de cerrar este.

## 12. Resultados observados

**Estado:** Registrados el 2026-11-24. Los datos de juego proceden de una extracción de solo lectura de staging y de su contraste con los CSV del portal del 2026-11-22. Se incluyen las encuestas de Telegram aportadas por el responsable. El resto del expediente externo sigue pendiente.

### Datos

- **Entorno:** staging. Sala `tabarnia`, temporada «Temporada Alpha de Tabarnia» (`798830d1-9a34-7031-62b4-5c75597a1157`). El último desafío cerró el 2026-11-21 a las 14:00 UTC y `season.ends_at` fue el 2026-11-23 a las 14:00 UTC. La medición se abrió el 2026-11-05 a las 19:52 UTC y se cerró administrativamente el 2026-11-23 a las 15:03 UTC, con la temporada en estado `finished`. El límite de admisión de eventos era `season.ends_at`.
- **Cohorte:** las 14 cuentas con rol `member` en la sala. Queda excluida la cuenta con rol `owner`, que actuó como cuenta operativa. Ninguna cuenta de superadministración pertenece a la sala.
- **Extracción:** estado de la base de datos consultado el 2026-11-24 con transacciones de solo lectura. A esa fecha no hay intentos `in_progress`, ni `invalidated`, ni finalizados después de `Tdatos`. Tampoco hay intentos iniciados fuera de la ventana de su publicación. Por eso el estado actual reproduce el corte sin necesidad de reconciliación adicional. Las consultas se conservan fuera del repositorio, junto con la correspondencia entre códigos y personas del expediente privado.
- **Publicaciones** (instantes en UTC; los modos y versiones proceden del contenido publicado):

| #   | Desafío           | Modo       | Versión                                            | Ventana                   |
| --- | ----------------- | ---------- | -------------------------------------------------- | ------------------------- |
| 1   | Steel Ball Run    | flash      | `tabarnia-flash-01` v1                             | 06-11 14:00 – 07-11 14:00 |
| 2   | Reino de animales | alphabet   | `tabarnia-reino-animales` v1                       | 08-11 14:00 – 09-11 14:00 |
| 3   | Queens            | time-trial | `tabarnia-contrarreloj-queens` v2                  | 09-11 14:00 – 10-11 14:00 |
| 4   | España            | survival   | `tabarnia-supervivencia-espana` v1                 | 10-11 14:00 – 11-11 14:00 |
| 5   | Cumbre lógica     | pyramid    | `tabarnia-piramide-cumbre-logica` v4               | 13-11 14:00 – 14-11 14:00 |
| 6   | Multiverso friki  | alphabet   | `tabarnia-el-multiverso-se-juega-letra-a-letra` v2 | 14-11 14:00 – 15-11 14:00 |
| 7   | Flow Free         | time-trial | `tabarnia-contrarreloj-conectar-parejas` v3        | 16-11 14:00 – 17-11 14:00 |
| 8   | La Biblia         | pyramid    | `tabarnia-piramide-biblia` v2                      | 17-11 14:00 – 18-11 14:00 |
| 9   | Tabarniaverso     | flash      | `tabarniaverso` v1                                 | 20-11 14:00 – 21-11 14:00 |

- **Intentos de la cohorte:** 112 competitivos iniciados, con 111 `completed` y 1 `abandoned`. No hay intentos de tipo `test`.

### Comportamientos observados

**Distribución de desafíos completados por persona (cohorte de 14):**

| Desafíos completados | 0   | 1–4 | 5   | 6   | 7   | 8   | 9   |
| -------------------- | --- | --- | --- | --- | --- | --- | --- |
| Personas             | 1   | 0   | 1   | 0   | 1   | 0   | 11  |

- Una persona quedó sin eventos ni intentos registrados. Con la captura disponible se desconoce si llegó a entrar en la aplicación.
- Una persona completó los desafíos 1 a 4 y 6, y ninguno de los tres últimos.
- Una persona completó siete desafíos (1, 2, 4, 5, 6, 7 y 9), incluidos dos de los tres últimos.
- Once personas completaron los nueve.

**M02 — evolución por publicación (cohorte de 14):**

| #               | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| --------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inician `S_i`   | 13  | 13  | 13  | 13  | 12  | 13  | 12  | 11  | 12  |
| Completan `C_i` | 13  | 13  | 12  | 13  | 12  | 13  | 12  | 11  | 12  |

**Métricas auxiliares** (ventana `T0`–`Tdatos` salvo indicación):

- **M01 — activación temprana:** 13/14 completaron el primer desafío antes de `T0 + 48 h`. El segundo abrió justo en ese límite. La activación total a `Tdatos` también es 13/14.
- **M03 — de la introducción al inicio:** conversión observada del 100 % en las nueve ventanas. La consulta cruza, por persona y publicación, las introducciones recibidas dentro de la ventana y los inicios competitivos de esa misma ventana. En cada publicación la intersección coincide con los recuentos de introducciones e inicios, con cero inicios sin evento de introducción.
- **M04 — terminan lo que empiezan:** 111/112 intentos iniciados terminan como `completed`.
- **M05 — llegan al final:** 12/14 completan al menos dos de los desafíos siete, ocho y nueve; restringido a activados tempranos, 12/13.
- **M07 — consulta del ranking:** 11/14 personas lo consultaron al menos una vez. Ventanas de publicación distintas con consulta por persona: mediana 8 (rango 1–9).
- **M08 — ensayos y revisión:** 12/14 iniciaron al menos un ensayo, 11/14 completaron alguno y 12/14 visualizaron alguna revisión. La captura cubre del 2026-11-05 al cierre de la temporada; el tramo posterior no tiene captura y no se interpreta como falta de uso.
- **Finales por tiempo:** entre los intentos de la temporada (incluida la cuenta operativa) constan 16 finales por `time_limit`, 1 por `inactivity_timeout` y 10 por `all_solved`. Falta etiquetar qué finales por tiempo no tuvieron ninguna respuesta o acción voluntaria aceptada, como exige 7.2. No modifica el cómputo principal.

**Análisis exploratorio por pregunta.** La extracción de staging del 2026-11-24 reunió 114 posiciones publicadas y 1.215 presentaciones en la cohorte. Se considera presentada una posición al activarse su reloj en servidor. Los aciertos incluyen recalificaciones y se dividen entre quienes llegaron a la posición.

- Los mismos 13 jugadores completaron ambos Alfabetos. En las posiciones alcanzadas, Emparejar obtuvo 66/70 aciertos y Conectar parejas en Contrarreloj, 95/100 tableros resueltos. Los mapas obtuvieron algún crédito en 4/25 presentaciones. Son resultados de resolución en el contenido jugado.
- En `Cumbre lógica`, cuatro de seis jugadores agotaron los 30 segundos de Queens en el nivel 5 y hubo una cima en 12 intentos. En `La Biblia`, nadie de los tres que llegaron a la sopa de letras del nivel 5 avanzó. Dos recibieron crédito parcial por palabras acertadas antes del vencimiento.
- En el ranking efectivo de la cohorte, retirar las dos Pirámides manteniendo fijos los demás resultados cambia la posición de nueve personas y el primer puesto. Retirar los dos Alfabetos también mueve a nueve personas, con el mismo líder. Es una comparación sobre los resultados existentes.

### Opiniones declaradas

**M06 — disfrute de 1 a 5 en la aplicación.** La consulta de staging del 2026-11-24 confirma 24 valoraciones vigentes de 10 de las 14 personas. El desglose por publicación coincide con el export del 2026-11-22.

| #                      | 1    | 2    | 3    | 4    | 5    | 6    | 7    | 8    | 9    |
| ---------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Personas que responden | 8    | 2    | 4    | 1    | 1    | 2    | 3    | 1    | 2    |
| Media                  | 3,88 | 5,00 | 4,25 | 5,00 | 2,00 | 5,00 | 4,67 | 4,00 | 4,00 |
| Mediana                | 4    | 5    | 4    | 5    | 2    | 5    | 5    | 4    | 4    |

Tras el primer desafío se recibieron entre una y cuatro valoraciones por publicación. La muestra por desafío es pequeña. El seguimiento cualitativo del ciclo cierra el 2026-11-28 a las 14:00 UTC, siete días después del último desafío. Las valoraciones en la app pueden revisarse hasta el 2026-11-30 a las 14:00 UTC, siete días después de `season.ends_at`. El análisis conserva el corte de la extracción.

**Encuestas de Telegram.** Recuentos de las capturas aportadas por el responsable, en agregado.

1. **14 de noviembre, comparación de los cinco primeros desafíos.** `Cumbre lógica` recibió 3/8 votos como favorita y 5/9 como la menos gustada. En el grupo que respondió a ambas preguntas, las ocho personas la situaron en uno de esos extremos. El cruce exploratorio con staging muestra que 2/3 de quienes la eligieron como favorita llegaron al nivel 5 o más, frente a 1/5 del otro grupo. Una correspondencia de nombre es probable. Al excluirla, el resultado es 1/2 frente a 1/5. Cada modo estaba representado por un único desafío y `Cumbre lógica` era el más reciente.
2. **20 de noviembre, preferencias generales de selección múltiple.** De seis personas, seis marcaron tableros de lógica, cuatro Alfabeto temático, tres cultura general sin eliminación y una preguntas hasta ser eliminada. La consigna pedía hasta dos opciones y una persona marcó las cuatro. Al retirar ese voto, el orden se mantiene (5/5, 3/5, 2/5 y 0/5). El voto por tableros agrupa mecánicas como Queens y Conectar parejas.

Ambas encuestas son voluntarias y aportan preferencias declaradas. El resto del seguimiento cualitativo y las entrevistas siguen pendientes.

### Métrica obtenida

```text
R = 12 personas cumplen Sostenida(p) = C(p) >= 6 y L(p) >= 2
Métrica principal = 12 / 14 = 85,7 %
```

No hay oportunidades no evaluables: el límite inferior y el superior coinciden en 12. Comparada solo numéricamente con 7.3, la cifra supera el umbral de apoyo (`R >= 8`). La clasificación final depende de la calidad del experimento (sección 14).

### Anomalías

- El único intento abandonado corresponde al desafío 3. Se inició a las 13:38 UTC, 22 minutos antes del cierre de la ventana, y terminó por `inactivity_timeout` a las 14:00:43 UTC. La persona afectada cumple igualmente `Sostenida(p)` con siete desafíos.
- Trece respuestas de texto corto pasaron de incorrectas a correctas tras recalificarse. Siete correspondían a «Interestelar» en `Multiverso friki` y seis a «Camberra» en `Tabarniaverso`.
- De las 1.214 recepciones de posiciones alcanzadas, 86 quedaron marcadas por vencimiento. Ninguna de las 1.214 guardó el tiempo del cliente. Los registros permiten consultar el resultado del servidor y dejan sin verificar el reloj que veía el jugador.
- `app_version` vale `0.1.0` en todos los eventos de la temporada. Durante esas fechas hubo cambios integrados en el repositorio, pero el campo carece de detalle para vincular un evento con un despliegue concreto.

### Datos faltantes

- **Resto del expediente externo:** registro de invitaciones con fechas, avisos por publicación, ayuda solicitada, incidencias, minutos de operación, costes y seguimiento cualitativo final. Los diagnósticos de staging aportan contexto para M09. Las tasas completas de incidencias y el esfuerzo operativo de M10 quedan pendientes.
- **Prueba individual previa** de los nueve desafíos: no consta.
- **Tiempo hasta el primer inicio:** no calculable sin la fecha de envío de cada invitación.
- **Etiquetado de finales por tiempo sin interacción** (7.2): pendiente.

### Desviaciones del experimento

1. **Calendario adaptativo no congelado.** El responsable espació las publicaciones durante la ejecución para evitar saturar al grupo y por su propia disponibilidad. Hubo huecos sin desafío entre las ventanas 1–2 (7–8 nov), 4–5 (11–13 nov), 6–7 (15–16 nov) y 8–9 (18–20 nov). El desafío 9, que el 2026-11-17 estaba programado para el 22–23 nov, se adelantó al 20–21 nov. La temporada duró 15 días en lugar de nueve ventanas consecutivas de 24 h. La decisión de espaciar se tomó mientras se observaba la participación.
2. **Protocolo sin congelar.** No se registró el cierre de `READY_TO_RUN`, ni la congelación de `tabarnia-daily-v2`, ni la versión de aplicación y esquema antes de iniciar.
3. **Cambios integrados durante la recogida.** El repositorio incorporó ajustes de crédito parcial y por vencimiento en Pirámide y Contrarreloj entre el 10 y el 14 de noviembre. Staging confirma configuraciones de crédito parcial en las versiones publicadas de esos modos y recalificaciones de respuestas. Queda por verificar cuándo se desplegó cada cambio de aplicación o esquema.
4. **Versiones de contenido publicadas poco antes de abrir.** Las versiones usadas en los desafíos 3, 5, 6 y 8 se publicaron entre el 2026-11-09 y el 2026-11-15, en todos los casos antes de abrir su ventana. La extracción identifica las versiones asignadas, con cobertura de auditoría durante cada ventana pendiente de contrastar.
5. **Invitaciones fuera de la aplicación.** Se enviaron por Telegram y las cuentas se provisionaron directamente; el producto no conserva rastro de los envíos.
6. **Entorno.** La ejecución se hizo en staging. El ciclo no había fijado de antemano el entorno objetivo.

## 13. Análisis del aprendizaje

**Estado:** Clasificación registrada el 2026-11-24. Incluye las encuestas de Telegram disponibles. El seguimiento cualitativo, que cierra el 2026-11-28, está en curso.

### Comparación con los umbrales

`R = 12/14`. Numéricamente supera el umbral de apoyo (`R >= 8`) por cuatro personas, y no hay datos no evaluables que abran un intervalo entre categorías. La comparación no es aplicable tal como se diseñó, porque la ejecución no siguió el calendario del protocolo (sección 14).

### Señales favorables en la temporada observada

- Once de las 14 personas invitadas completaron los nueve desafíos, y doce mantuvieron participación según la definición previa.
- La participación por publicación se mantuvo entre 11 y 13 de 14 durante toda la temporada, sin caída progresiva marcada.
- La conversión observada de introducción a inicio fue del 100 % en las nueve ventanas, y 111 de 112 intentos iniciados terminaron.
- Once personas consultaron el ranking, la mayoría en casi todas las ventanas.

### Límites de la recurrencia observada

- Una persona quedó sin intentos registrados y otra dejó de jugar antes de los tres últimos desafíos.

### Explicaciones alternativas

- **Cadencia flexible.** La alta participación puede deberse en parte a que el organizador ajustó el ritmo al grupo. Este resultado no evalúa una cadencia diaria estricta de nueve días consecutivos, que es la condición de HYP-001.
- **Relación personal y avisos.** La relación directa con el organizador y los avisos en Telegram pueden haber sostenido la participación con independencia del valor del juego.
- **Novedad.** Es la primera temporada; la novedad puede inflar la participación.

### Sesgos y limitaciones

Muestra pequeña y de conveniencia (14 personas), un solo grupo y una sola temporada. Las 126 oportunidades son observaciones repetidas de las mismas personas. El organizador decidió el calendario mientras observaba la participación. Las valoraciones por desafío son escasas y las encuestas de Telegram recogen respuestas voluntarias. Los datos de finalización tienen un corte distinto del disfrute. Además, la fecha de despliegue de los cambios de aplicación sigue sin verificarse y faltan avisos, incidencias y esfuerzo operativo del expediente.

### Clasificación de la hipótesis

**Inconclusa**, por calidad del experimento. Según 7.6, «un calendario distinto del congelado invalida la ejecución de este protocolo». El calendario real fue adaptativo, duró 15 días en lugar de nueve consecutivos y se ajustó viendo la participación. No se reinterpretan la hipótesis ni los umbrales después de observar el resultado.

### Qué hemos aprendido

En esta cohorte, una competición asíncrona con nueve desafíos variados y cadencia flexible decidida por el organizador obtuvo participación recurrente muy alta: 12 de 14 según la definición previa y 11 de 14 completando todos los desafíos. Es una señal fuerte de recurrencia en este grupo, aunque no valida la hipótesis tal como se formuló.

- **Modos y formatos (HYP-002, exploratoria).** Alfabeto temático reúne una preferencia declarada y una participación repetida. Los tableros de lógica concentraron el interés en la encuesta general y `Cumbre lógica` recibió votos en ambos extremos. Conviene probar cuánto pesan los tableros, la eliminación y el reloj por separado.
- **Fiabilidad (HYP-006, contexto).** Las variantes válidas rechazadas justifican revisar la corrección editorial de texto corto. Para diagnosticar la experiencia cerca del plazo hace falta recuperar un caso concreto o medir juntos el tiempo visible al enviar y la recepción en servidor.

### Qué no podemos afirmar

- Que el grupo sostenga una cadencia diaria estricta de nueve días consecutivos.
- Que el resultado se repita en una segunda temporada, sin novedad, o en otros grupos.
- Qué parte del efecto se debe al juego, al ranking, a la cadencia, a los avisos o a la relación con el organizador.
- Qué explica el disfrute declarado y cuánto se traduce en volver a jugar.
- Si las diferencias entre modos y formatos se deben a las reglas, al tema, a la dificultad o al orden de publicación.

### Nivel de confianza

Alto en la medición del comportamiento observado: hechos persistidos completos, sin datos no evaluables ni intentos pendientes. Bajo en la validez respecto al protocolo diario diseñado, por las desviaciones de la sección 12.

## 14. Calidad del experimento

**Decisión metodológica (2026-11-24): declarar el resultado inconcluso** para el protocolo diario. El calendario se adaptó durante la ejecución y el protocolo no estaba congelado. Las finalizaciones son reproducibles con la extracción contrastada. La calidad de la corrección, los cronómetros y la captura de navegación tienen las limitaciones documentadas en la sección 12.

La medición de finalización es fiable: no hay intentos en curso ni invalidados, ni finalizaciones posteriores al corte, y la cohorte está completa. Lo que no es válido es la condición experimental, porque la cadencia diaria no se aplicó. Si se quiere evaluar HYP-001 tal como está formulada, o una variante con cadencia flexible, habría que repetir con un calendario congelado antes de iniciar y con la versión de la aplicación registrada. Esa repetición se decide en la sección 15 y no se presupone aquí.

## 15. Decisión estratégica

**Decisión estratégica:** `PERSEVERAR`, registrada por Jose Moreno el 2026-11-24.

Se conserva la propuesta de competir entre amigos en una sala privada, con desafíos asíncronos y ranking de temporada. La inversión aprobada en este ciclo es preparar una segunda temporada de Tabarnia con la cohorte original. Primero se comprobará si vuelven a jugar y se medirá el esfuerzo de organizarla. La ampliación a otras salas se evaluará con ese resultado.

La decisión se apoya en la participación observada en staging. Doce de los 14 invitados cumplieron la regla de participación sostenida y once completaron los nueve desafíos. Hay confianza alta en ese recuento y evidencia limitada sobre la repetición entre temporadas y la transferencia a otros grupos. La clasificación metodológica de HYP-001 queda registrada en la sección 14.

El responsable tomó la decisión con la evidencia disponible el 2026-11-24. El seguimiento cualitativo sigue abierto hasta el 2026-11-28 y el expediente operativo está incompleto. El esfuerzo de Tabarnia 1 se comparará solo si se puede documentar con un alcance comparable.

## 16. Próxima incertidumbre

**¿Vuelve a jugar la cohorte en una segunda temporada con un calendario realista fijado antes de empezar?** La hipótesis de repetición entre temporadas se documenta como HYP-010 en el único ciclo activo, [CYCLE-002](CYCLE-002.md). El esfuerzo operativo será una medida auxiliar para orientar la reutilización de contenido y la programación automática. La cadencia diaria estricta queda como pregunta separada.

## 17. Próxima acción

Seleccionar y registrar las nueve versiones candidatas en el calendario de [CYCLE-002](CYCLE-002.md#calendario-y-mezcla-de-modos).

## 18. Documentos que deben actualizarse

Cuando el ciclo avance, actualiza:

- `../STATE.md`;
- `../STRATEGY.md` si cambian las apuestas vigentes;
- `../HYPOTHESES.md`;
- este documento.
