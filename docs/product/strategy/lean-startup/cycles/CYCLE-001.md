# CYCLE-001 — ¿Existe participación sostenida en la alpha diaria de Tabarnia?

## Estado del ciclo

- **Estado:** Preparación técnica verificada en local; staging y configuración real pendientes, sin ejecución ni resultados de usuarios.
- **Estado de máquina:** MVP_DESIGN
- **Siguiente puerta:** READY_TO_RUN
- **Condición de avance:** nueve desafíos seleccionados y probados, cohorte y calendario concretados, fuentes de medición verificadas y control de preparación completo.
- **Responsable:** Jose Moreno
- **Versión del protocolo:** `tabarnia-daily-v2`, definida el 2026-10-24; pendiente de congelar antes de ejecutar.
- **Fecha de inicio:** Pendiente; no se han enviado invitaciones ni recogido resultados según el registro disponible.
- **Fecha de revisión:** Tras el corte de datos y el seguimiento cualitativo de la temporada.

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

**Referencia:** HYP-001, en estado `Priorizada` hasta iniciar la recogida de datos.

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

- **Estado:** No superado. Contrato y vehículo contrastados en Supabase local y E2E aislado; staging, contenido, cohorte y calendario real siguen pendientes.
- **Versión a congelar:** `tabarnia-daily-v2`; fecha de congelación pendiente.
- **Responsable de aprobación:** Jose Moreno.
- **Inicio previsto, cohorte nominal y calendario absoluto:** Pendientes de registrar. Canal elegido: grupo privado de Telegram; referencia concreta pendiente de configurar.

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

**Estado:** Pendiente de ejecución

### Datos

Pendiente.

### Comportamientos observados

Pendiente.

### Opiniones declaradas

Pendiente.

### Métrica obtenida

Pendiente.

### Anomalías

Pendiente.

### Datos faltantes

Pendiente.

### Desviaciones del experimento

Pendiente.

## 13. Análisis del aprendizaje

**Estado:** Pendiente

### Comparación con los umbrales

Pendiente.

### Evidencia que apoya la hipótesis

Pendiente.

### Evidencia que debilita la hipótesis

Pendiente.

### Explicaciones alternativas

Pendiente.

### Sesgos y limitaciones

Pendiente.

### Clasificación de la hipótesis

Pendiente: Apoyada, Debilitada, Refutada o Inconclusa.

### Qué hemos aprendido

Pendiente.

### Qué no podemos afirmar

Pendiente.

### Nivel de confianza

Pendiente.

## 14. Calidad del experimento

Si el diseño no permite aprendizaje fiable, decidir explícitamente si hay que repetir, reparar, ampliar la muestra, modificar la medición o declarar el resultado inconcluso antes de valorar la estrategia.

## 15. Decisión estratégica

**Decisión estratégica:** Pendiente — seleccionar una única opción: PERSEVERAR, PIVOTAR o PARAR.

Un resultado defectuoso no implica por sí solo pivotar o parar. Si se recomienda PIVOTAR, documentar la señal suficiente, el elemento que cambia, la visión conservada, la nueva hipótesis, el siguiente experimento y el criterio para volver a pivotar o parar.

## 16. Próxima incertidumbre

Dependerá de los resultados: barreras de acceso o juego, pérdida de interés, contribución del ranking, contenido/cadencia o esfuerzo de operación. La preferencia entre formatos permanece como candidata exploratoria; no se presupone que sea el siguiente problema que resolver. Repetición entre temporadas, otros grupos y modelo de negocio requieren evidencia posterior.

Esta incertidumbre no abre un segundo ciclo activo. Se mantiene como candidata para priorización después de analizar la recurrencia de CYCLE-001.

## 17. Próxima acción

Seleccionar y registrar los nueve desafíos candidatos para la alpha de Tabarnia.

## 18. Documentos que deben actualizarse

Cuando el ciclo avance, actualiza:

- `../STATE.md`;
- `../STRATEGY.md` si cambian las apuestas vigentes;
- `../HYPOTHESES.md`;
- este documento.
