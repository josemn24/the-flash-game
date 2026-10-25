> Estado: vigente. Medición automática común a todas las salas; análisis de objetivos fuera de la aplicación.

# Medición de temporada

Cada temporada dispone de una única medición automática. El superadmin entra en
**Salas → una sala → Medición de temporada**, selecciona la temporada y consulta sus datos.
La aplicación recoge actividad y disfrute con definiciones comunes para todas las salas.
Los objetivos de aprendizaje, la cohorte de un estudio y sus criterios de éxito se definen antes
de observar resultados y se evalúan después, fuera del producto. No hay que introducir
participantes, identificadores de publicaciones ni umbrales para iniciar la captura.

## Fuentes y responsabilidades

| Fuente                         | Qué aporta                                                                      | Autoridad y límites                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Intentos persistidos           | Inicios, estados, finalizaciones y puntos competitivos; partidas de prueba      | Hechos del juego resueltos en servidor. Una pérdida de telemetría no elimina una partida del informe.                         |
| Seis eventos comunes           | Sala, introducción, ranking y revisión vistos; ensayo local iniciado/finalizado | Observaciones del navegador, con posible pérdida de captura. No certifican resultados competitivos.                           |
| Valoraciones                   | Disfrute opcional 1–5 por persona y publicación                                 | Opinión declarada tras completar; no acredita participación sostenida. Se conserva el historial y se informa el último valor. |
| Expediente externo del estudio | Invitaciones, comunicaciones, incidencias, feedback externo y costes            | Lo prepara el responsable del estudio; no se obtiene de la lista de miembros ni de las visitas.                               |

El flujo técnico es navegador → `/api/product/*` → casos de uso → RPC autorizadas de Supabase.
El informe consulta las fuentes privadas, calcula métricas descriptivas y genera los cuatro CSV.
El [cálculo común](../../lib/seasonMeasurement.ts) es la referencia ejecutable de las fórmulas;
el [esquema de temporada](../../supabase/schemas/s26_season_measurement.sql) define el alcance,
la atribución, las consultas y las valoraciones. El contrato de cada estudio define su análisis.

## Alcance automático

La creación de una temporada prepara su medición, incluso si todavía no tiene participantes
o desafíos. Se incorporan miembros activos owner/admin/member, excluyendo espectadores y
cuentas operativas. Los desafíos se incorporan al añadirse a la temporada. El ámbito conserva
las incorporaciones para que una baja posterior no borre la participación ya observada.

Para temporadas existentes, la migración recupera el alcance elegible y las partidas históricas
disponibles. No puede recuperar visitas o ensayos que no se registraron. El panel muestra desde
cuándo existe captura de navegación. Las incorporaciones posteriores conservan su propio inicio
de alcance; los desafíos ya cerrados antes de ese instante aparecen como «Sin oportunidad».

Los eventos con publicación se atribuyen a su temporada. Las visitas genéricas de sala y ranking
se atribuyen a la temporada activa o, si no hay ninguna, a la próxima programada. No se duplican
entre la temporada actual y todas las futuras. La captura deja de aceptar eventos al acabar la
temporada; los informes permanecen consultables al finalizar o cancelar.

## Lo que ve el superadmin

- Selector de temporadas, incluidas las anteriores, y fecha de actualización.
- Visitas a la sala, aperturas de desafíos, partidas iniciadas y finalizadas, personas que vuelven,
  consultas de ranking y revisión, prácticas iniciadas y finalizadas.
- Personas con algún inicio y finalizaciones sobre oportunidades abiertas hasta la consulta.
- Tabla de actividad por desafío y disfrute (mediana y número de respuestas).
- Detalle desplegable por persona: actividad, estado por desafío, puntos y disfrute.
- Enlace desde cada intento a su inspección administrativa existente.
- CSV de personas, participación por desafío, desafíos y resumen.

«Personas que vuelven» significa personas con inicios competitivos no invalidados en al menos dos
publicaciones distintas. Finalizar incluye derrotas reglamentarias y cero puntos. Las pruebas y
ensayos se cuentan por separado y no acreditan una finalización competitiva. El disfrute es
opcional, de 1 a 5, corregible hasta siete días después del fin de la temporada. Su ausencia no
se interpreta como cero. Solo se ofrece tras una finalización competitiva autorizada.

Las métricas describen el comportamiento. La aplicación no decide si una temporada tuvo éxito:
los objetivos de aprendizaje y la interpretación posterior pertenecen al análisis. No hace falta
fijar un objetivo para que se registren datos.

## Definiciones de las métricas comunes

| Métrica                                 | Cómputo vigente                                                                                                                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personas incluidas                      | Participantes incorporados automáticamente al alcance de la temporada, incluidas personas sin partidas. No equivale a invitaciones enviadas.                                                                                                 |
| Personas con algún inicio               | Personas distintas con al menos un intento competitivo no invalidado. El porcentaje usa personas incluidas como denominador.                                                                                                                 |
| Partidas iniciadas                      | Intentos competitivos no invalidados, incluidos los abandonados o todavía en curso.                                                                                                                                                          |
| Partidas finalizadas                    | Intentos competitivos con `status = completed`, con independencia de puntos o victoria.                                                                                                                                                      |
| Personas que vuelven                    | Personas con inicios competitivos no invalidados en al menos dos publicaciones distintas. No exige finalizarlas, jugar en días diferentes ni mantener una racha.                                                                             |
| Oportunidades                           | Parejas persona/publicación no cancelada cuya apertura ya ha llegado y cuyo cierre es posterior al inicio de alcance de ambos. Las futuras se muestran como pendientes y las cerradas antes de incorporarse como «Sin oportunidad».          |
| Porcentaje de oportunidades completadas | Partidas finalizadas / oportunidades. El denominador refleja el alcance disponible al consultar y puede crecer durante la temporada; no es una cohorte fija de estudio.                                                                      |
| Visitas y consultas                     | Observaciones capturadas, no personas únicas. Las visitas a sala deduplican por `visit_id` dentro de cada persona y contexto; las demás vistas cuentan eventos deduplicados por su identificador.                                            |
| Prácticas iniciadas/finalizadas         | Inicios: ejecuciones distintas con `rehearsal_started` más intentos `test` no invalidados. Finalizaciones: ejecuciones distintas con `rehearsal_completed` más intentos `test` con estado `completed`. Se mantienen fuera de la competición. |
| Disfrute                                | Última valoración por persona/publicación; mediana de valores presentes y número de respuestas. Ausencia conserva `null`, no cero.                                                                                                           |

Los porcentajes con denominador cero se muestran como «—». «Personas que vuelven» describe el
conjunto de la temporada y se exporta en personas y resumen. El CSV de desafíos omite esa columna:
una publicación aislada no permite medir retorno entre publicaciones.

## Captura, seguridad y exportación

Se conservan seis señales: sala, introducción, ranking y revisión vistos; ensayo iniciado y
finalizado. Las vistas requieren pestaña visible. SSR y prefetch no producen vistas. Cada
observación mantiene su identificador durante un reintento; la captura tiene cuota independiente
y no bloquea el juego. Hay como máximo un reintento en memoria, a los 500 ms, ante fallo de red
o respuesta 5xx. No hay cola persistente ni reintento de respuestas 4xx.

Las señales de ensayo mantienen su identificador y cuerpo durante toda la ejecución, también al
abrir la revisión y volver al resultado. El servidor deduplica cada inicio y finalización por
medición, persona, publicación, tipo y `visit_id` de ejecución, antes de comprobar la cuota. Una
ejecución nueva se cuenta por separado. Un índice único parcial garantiza una fila por esa
combinación para las dos señales de ensayo; el informe cuenta esas filas. Los intentos de prueba
persistidos se siguen sumando por separado.

La ventana se decide con el instante de recepción del servidor (`received_at`); el reloj del
navegador (`occurred_at`) no permite retroatribuir un evento a una temporada ya cerrada.
Se admiten fechas válidas y finitas adelantadas o atrasadas respecto al servidor, sin un margen
máximo de desfase. La hora original se conserva como diagnóstico y no decide la admisión.
Solo se captura mientras sala, membresía y contexto son elegibles y la temporada está programada
o activa, hasta su fecha de fin. No hay cobertura retroactiva de navegación ni de ensayos locales.
Las partidas de prueba persistidas sí pueden aportar historia anterior a la captura, igual que
las competitivas. La ausencia de eventos no demuestra ausencia de uso.

Los resultados oficiales proceden de los intentos persistidos. La identidad y el contexto se
resuelven en servidor; las tablas de medición siguen privadas. El detalle y los CSV exigen
superadmin. Las exportaciones usan UTF-8 con BOM, CRLF, escape de comillas, protección frente a
fórmulas y `Cache-Control: no-store`. Cada archivo identifica sala, temporada y fecha de generación.
Son extracciones del estado disponible en ese momento, no informes experimentales congelados.
Las métricas se agregan por persona, publicación y tipo de evento. Los CSV comunes no contienen
la cronología individual de eventos, las fechas de cada intento ni la auditoría completa;
`generated_at` identifica la consulta actual, no permite solicitar un corte histórico.

## Medición común y análisis posterior

Tabarnia utiliza el mismo modelo que cualquier otra sala. Sus 14 invitaciones, nueve desafíos,
regla de participación sostenida y umbrales están definidos en el
[contrato Lean](../product/strategy/lean-startup/cycles/CYCLE-001.md#7-contrato-de-medición).
Se aplican durante el análisis posterior, combinando los datos de temporada con la cohorte de
invitaciones y los registros complementarios del estudio. Definir los criterios antes de observar
resultados evita cambiarlos para ajustar una conclusión; no configura ni condiciona la captura.

El portal presenta métricas descriptivas. «Personas que vuelven» y el porcentaje de oportunidades
completadas mantienen sus definiciones comunes; no clasifican la hipótesis Lean. Los CSV son
extracciones actuales, no snapshots de un corte pasado. Las consultas de análisis deben conservar
sus fuentes, instante de corte, versión y limitaciones cuando necesiten reconstruir un estado anterior.
La cohorte, incidencias, comunicaciones y feedback externo se registran en el expediente privado
del estudio, fuera del portal. Los CSV contienen identidades y requieren acceso autorizado.

| Concepto       | Portal común                                                                       | Estudio de Tabarnia                                                       |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Población      | Alcance automático de miembros y desafíos de la temporada                          | 14 invitaciones fijadas, incluidas personas que no acceden                |
| Retorno        | Inicio en dos publicaciones distintas                                              | Al menos seis finalizaciones, incluidas dos de las tres últimas           |
| Denominador    | Personas incluidas u oportunidades disponibles, según la métrica                   | 14 personas para la métrica principal                                     |
| Corte          | Estado disponible al consultar                                                     | Corte principal fijado en el contrato; extracción y fuentes conservadas   |
| Navegación     | Desde el inicio efectivo de captura hasta el fin de temporada, con posible pérdida | Solo se informa el tramo con cobertura; fuera de él, uso desconocido      |
| Interpretación | Recuentos, porcentajes y mediana de disfrute                                       | Clasificación y decisión tras revisar calidad, datos faltantes y contexto |

Antes de ejecutar un estudio hay que preparar y ensayar las extracciones autorizadas que falten:
por ejemplo, fechas de intentos para el corte, cronología de navegación para conversiones o ventanas
y auditoría para reconstruir correcciones. Los agregados del portal no sustituyen esas fuentes.
Si una ventana requerida supera la cobertura disponible, se registra como limitación y se resuelve
en el control de preparación; no se interpreta ese tramo como cero actividad.

## API y conservación

`POST /api/product/events` acepta únicamente los seis eventos comunes y atribuye cada observación
a una única temporada elegible. Su `204` confirma que la solicitud se procesó sin error;
no garantiza almacenamiento: el RPC puede descartar una observación por contexto no elegible,
temporada cerrada o cuota agotada. La cuota de eventos es de 60 por persona y medición en el
último minuto, independiente de los comandos del juego. El transporte no interpreta el `204`
como evidencia de uso completo ni ofrece un recuento de observaciones perdidas.

`GET /api/product/ratings/[publicationId]` devuelve una valoración propia, con
`eligible`, `value` y, cuando corresponde, `seasonId` y `closesAt`.
`PUT` acepta exclusivamente `id`, `seasonId` y `value` entero entre 1 y 5; la publicación procede
de la ruta. La identidad siempre procede de la sesión autenticada.

La medición automática conserva su comportamiento vigente. No se incorpora una política nueva de
borrado periódico de sus datos. La conservación del expediente externo de cada estudio se gestiona
por su responsable y no debe confundirse con la persistencia de temporada.

## Instalación y verificación

La instalación desde cero aplica las migraciones hasta
`20261025140000_measurement_event_reliability.sql`, antes de publicar el cliente actualizado.
La corrección de fiabilidad admite el desfase del reloj y protege las señales de ensayo con
un índice único parcial. Local y staging utilizan instalación desde cero; esta definición no incluye
compatibilidad ni reparación de duplicados de versiones anteriores.

La migración previa `20261025120000_remove_product_experiments.sql` elimina exclusivamente el
almacenamiento y el comportamiento experimental anteriores y el inicio manual de medición.
Conserva usuarios, salas, temporadas, publicaciones, partidas y datos automáticos existentes.
Los datos experimentales se descartan sin trasladar sus valoraciones. Las rutas antiguas dejan de
existir y se retira su cron; el calendario mantiene su cron y `CRON_SECRET`.

El esquema declarativo instala directamente el modelo final. Antes de compilar, actualizar
`EXPECTED_SCHEMA_REVISION` y fijar `NEXT_PUBLIC_APP_VERSION`. Las comprobaciones SQL utilizan
bases desechables y el E2E un stack aislado. Preparar la migración y verificarla localmente no
acredita su aplicación en staging.

Las verificaciones de la implementación experimental anterior se conservan como
[evidencia local archivada](../archive/reports/tabarnia-measurement-verification.md) y
[evidencia de staging archivada](../archive/reports/staging-measurement-verification.md).

Verificación de la retirada del 2026-10-25: la actualización incremental en base desechable
conserva el contenido de 37 tablas actuales, incluidos alcance, límites de captura, eventos y
valoraciones automáticas; elimina todos los objetos experimentales y permite activar temporadas
independientemente de estudios. Pasan las 69 suites SQL tanto desde migraciones como desde el
esquema declarativo, el inventario de permisos y la reconciliación sin diferencias de definición
ni comportamiento. El contrato específico contrasta atribución entre temporadas, cuota,
reintentos y cierre del disfrute. Los tipos se generaron y comprobaron en una base desechable.
Pasan 279 archivos y 3.289 pruebas unitarias, los dos recorridos E2E de medición en un stack
aislado, tipos, lint, arquitectura y compilación de producción. La base habitual y staging
no se modificaron durante esta verificación.

Aplicación local anterior del 2026-10-25: migración `20261025120000` aplicada mediante
`supabase migration up --local`, sin reiniciar la base. Los recuentos y huellas de 38 tablas
(37 del dominio y usuarios de Auth) coinciden antes y después, excluyendo únicamente la columna
retirada del inicio manual. BetaVIP conserva 4 personas, 6 desafíos y 3 partidas completadas;
Tabarnia conserva 12 personas y 4 desafíos. Ambos informes y sus cuatro CSV se generan con
los datos actuales. Una prueba transaccional en la base local verifica creación automática,
altas, exclusiones, atribución y deduplicación de visitas, permisos y disfrute con reintento y
corrección; termina en rollback y vuelve a contrastar todas las huellas. Inventario de seguridad,
health de esquema, servicio Auth local y tipos generados pasan. Staging sigue sin modificar.

Las pruebas de fiabilidad cubren desfases de +30 segundos, +24 horas y −24 horas, fechas no
finitas, cierre por tiempo del servidor y deduplicación antes de cuota. Se comprueba el rechazo
de duplicados por el propio índice, la independencia entre ejecuciones, personas, publicaciones
y tipos, y la concurrencia con dos conexiones. Los E2E incluyen reloj adelantado y retorno de
revisión a resultado. Health exige que el índice de ensayo sea único y parcial. La instalación se
contrasta desde migraciones y esquema declarativo en bases desechables.

Reinstalación local del 2026-10-25: `supabase:environment:reset -- --target local` completado
con la revisión `20261025140000_measurement_event_reliability`. Auth, PostgreSQL y Storage quedan
vacíos de datos de aplicación, con dos buckets canónicos sin objetos. El historial de migraciones
y el inventario de permisos coinciden con el repositorio; el índice de ensayo es único y parcial.
Pasan el sondeo SQL de health y los endpoints locales de Auth y REST. No se ha ejecutado el
bootstrap. Los manifiestos de fixtures y credenciales anteriores se retiraron mediante el reset;
la verificación se conserva en `output/local/schema-reset-verification.json`. Staging sigue pendiente.
