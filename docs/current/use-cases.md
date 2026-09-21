# Casos de uso

> Estado: vigente. Especificación funcional derivada de [`domain-requirements.md`](domain/domain-requirements.md),
> [`domain-model.md`](domain/domain-model.md), las decisiones aprobadas y las slices implementadas/mock
> actual. No prescribe endpoints ni una correspondencia uno-a-uno entre casos de uso y operaciones
> técnicas.

## Alcance y prioridades

La clasificación indica prioridad para una primera versión productiva del loop de salas privadas,
temporadas y desafíos asíncronos. No equivale al estado actual de implementación: hoy la aplicación
usa mocks en los recorridos aún no migrados; las slices persistidas actuales ya cubren identidad, salas, competición Flash,
rankings, historial, portal y temporadas reales sobre Supabase local.

- **V1**: esencial para que exista una competición productiva usable.
- **Importante**: aporta operación, confianza o completitud, pero puede llegar después del loop
  competitivo básico.
- **Futuro**: secundario, administrativo o dependiente de decisiones todavía abiertas.

Las reglas comunes de permisos son: la competición requiere cuenta; `owner`, `admin` y `member`
pueden competir; `spectator` puede consultar sala, historial y rankings, pero no jugar; el
superadministrador opera fuera de la competición ordinaria; y una persona sin cuenta solo puede
usar previews. En la beta cerrada, la UI pública se limita a consultar y jugar en salas ya
provisionadas: la gestión operativa se realiza desde un portal privado de superadmin.

El portal interno provisiona salas, añade o reactiva directamente usuarios autenticados, configura
temporadas y, si se habilita para la beta, publica contenido mínimo y opera el calendario. El alta
directa de miembros no simula ni requiere aceptar una invitación; la emisión, aceptación y
revocación de invitaciones quedan fuera de la UI pública en esta fase.

## 1. Identidad y perfil

### CU-01 — Autenticar y resolver el jugador [V1]

- **Actor:** persona que quiere acceder a la competición; sistema de autenticación.
- **Objetivo:** establecer una sesión autenticada y asociarla con un `Player` estable.
- **Precondiciones:** existe una identidad válida del proveedor; el jugador no está anonimizado ni bloqueado para acceder.
- **Entrada relevante:** credenciales o sesión del proveedor y, si procede, consentimiento de alta.
- **Flujo principal:** autenticar; localizar o crear la relación con `Player`; cargar nombre, avatar y salas activas; crear el contexto de consulta.
- **Reglas de negocio:** la identidad del proveedor y el perfil de jugador son conceptos distintos; no hay invitados competitivos inicialmente.
- **Resultado:** sesión autenticada con un jugador de dominio.
- **Efectos secundarios:** creación o actualización auditada de identidad y perfil; no crea
  membresías automáticamente. El provisioning directo de una sala es una operación separada del
  portal privado de superadmin.
- **Errores o impedimentos:** credenciales inválidas, sesión caducada, jugador anonimizado sin proceso de recuperación o proveedor no disponible.
- **Permisos necesarios:** el propio proveedor y el jugador sobre su sesión; el sistema valida la correspondencia.

### CU-02 — Consultar y actualizar el perfil [V1]

- **Actor:** jugador autenticado.
- **Objetivo:** consultar o cambiar su nombre visible y avatar global.
- **Precondiciones:** sesión válida y jugador activo.
- **Entrada relevante:** `displayName` y archivo de avatar validado; la ruta la genera el servidor.
- **Flujo principal:** leer perfil; validar nombre y asset; guardar el cambio; reflejarlo en salas, rankings e historial donde corresponda.
- **Reglas de negocio:** el perfil es global, el nombre no tiene que ser único y los datos privados de autenticación no forman parte del perfil social. El avatar se lee desde un bucket público, pero solo el propio jugador puede solicitar su sustitución.
- **Resultado:** perfil actualizado y disponible en nuevas proyecciones.
- **Efectos secundarios:** actualización de avatar en almacenamiento y de marcas temporales; no se alteran resultados históricos.
- **Errores o impedimentos:** nombre vacío o inválido, asset no permitido, jugador inexistente o intento de modificar datos de otro jugador.
- **Permisos necesarios:** el propio jugador; superadministrador solo mediante operación auditada.

### CU-03 — Anonimizar una cuenta [Futuro]

- **Actor:** jugador propietario de la cuenta o superadministrador autorizado.
- **Objetivo:** retirar datos personales sin destruir la trazabilidad mínima de resultados históricos.
- **Precondiciones:** confirmación explícita y comprobación de operaciones pendientes; para un superadministrador, motivo auditado.
- **Entrada relevante:** confirmación de eliminación y, si procede, identificador del jugador.
- **Flujo principal:** desvincular identidad de autenticación; eliminar datos personales y avatar; conservar el identificador de dominio y resultados; proyectar el jugador como anonimizado.
- **Reglas de negocio:** la anonimización no borra resultados ni reescribe la historia; el perfil pasa a estado `anonymized`.
- **Resultado:** cuenta no recuperable como perfil personal salvo un proceso externo definido.
- **Efectos secundarios:** borrado de datos personales y asset, auditoría de la operación y actualización de proyecciones sociales.
- **Errores o impedimentos:** falta de confirmación, cuenta ya anonimizada o datos que no puedan eliminarse de forma consistente.
- **Permisos necesarios:** propietario de la cuenta o superadministrador con auditoría; nunca un cliente que modifique el rol por sí mismo.

## 2. Salas, membresías e invitaciones

### CU-04 — Crear una sala privada [V1]

- **Actor:** superadmin desde el portal privado de operación durante la beta; jugador autenticado en
  el producto general cuando se habilite la creación pública.
- **Objetivo:** crear el límite social y competitivo de un grupo.
- **Precondiciones:** sesión autenticada con capacidad operativa; durante la beta, privilegio global
  de superadmin y un propietario inicial explícito.
- **Entrada relevante:** título, descripción y zona horaria.
- **Flujo principal:** validar datos; crear la sala privada; crear una membresía `owner`; dejar la sala lista para una temporada.
- **Reglas de negocio:** la sala es privada; la propiedad vive en la membresía `owner`; una sala puede tener varias temporadas, pero solo una activa.
- **Resultado:** sala activa con su propietario como miembro.
- **Efectos secundarios:** creación de `Room`, membresía y auditoría; inicialmente no crea temporada ni publicaciones implícitas.
- **Errores o impedimentos:** datos inválidos, zona horaria no soportada, duplicación de operación o creación sin propietario.
- **Permisos necesarios:** superadmin en la beta; en una fase pública posterior, jugador autenticado
  si se habilita la creación. El sistema asigna el rol `owner` al propietario inicial, no al
  superadmin por defecto.

### CU-05 — Consultar una sala accesible [V1]

- **Actor:** miembro activo de la sala.
- **Objetivo:** ver identidad de la sala, temporada activa, desafío disponible, posición y resumen social.
- **Precondiciones:** membresía `active`; puede no existir temporada activa o desafío abierto.
- **Entrada relevante:** alias de sala y instante actual del servidor.
- **Flujo principal:** comprobar membresía; resolver sala y temporada; calcular disponibilidad; proyectar desafío, total, ranking resumido y miembros visibles.
- **Reglas de negocio:** una sala inaccesible y una inexistente no deben diferenciarse en la consulta; `spectator` puede leer, pero no recibe contenido jugable.
- **Resultado:** vista de sala o ausencia indistinguible si no hay acceso.
- **Efectos secundarios:** ninguno funcional; pueden registrarse métricas de consulta.
- **Errores o impedimentos:** alias inválido, sala eliminada, membresía terminada o relaciones canónicas incoherentes.
- **Permisos necesarios:** cualquier membresía activa; el acceso competitivo requiere además rol no espectador.

### CU-06 — Invitar y aceptar una incorporación [V1]

- **Actor:** `owner`/`admin` que invita; persona invitada que acepta; sistema que valida la invitación.
- **Objetivo:** incorporar un jugador a una sala privada con un rol permitido.
- **Alcance de beta:** no se ofrece en la UI pública ni se necesita para bootstrappear una sala. El
  superadmin incorpora directamente al usuario autenticado o reactiva su membresía desde el portal
  privado, sin crear ni consumir una invitación. Este caso de uso queda reservado para una fase
  posterior o una herramienta interna explícita.
- **Precondiciones:** invitación creada por un responsable; token válido, no revocado, no caducado y dentro de su límite de usos.
- **Entrada relevante:** sala, rol solicitado, token de invitación y jugador autenticado que acepta.
- **Flujo principal:** responsable crea invitación; sistema genera representación no reversible del token; invitado abre y acepta; se crea o reactiva la membresía.
- **Reglas de negocio:** `owner` puede invitar a `admin`, `member` o `spectator`; `admin` solo a
  `member` o `spectator`; una invitación usa una aceptación por defecto, admite hasta 20 usos si se
  configura explícitamente y caduca por defecto en 7 días, con máximo de 30. `owner` y `admin`
  pueden revocarla sin afectar membresías ya creadas; reincorporarse conserva historial y aplica el
  rol de la nueva invitación salvo que la membresía esté `banned`.
- **Resultado:** membresía `active` con `admin`, `member` o `spectator`.
- **Efectos secundarios:** incremento de uso, auditoría y actualización de miembros y rankings proyectados.
- **Errores o impedimentos:** token inválido, expirado, revocado o agotado; sala eliminada; rol no permitido; jugador ya bloqueado o membresía incoherente.
- **Permisos necesarios:** crear: `owner` o `admin` cuando se habilite el flujo; aceptar: destinatario
  autenticado; el sistema impide autoasignar propiedad. En la beta, el provisioning directo requiere
  superadmin y se autoriza/audita server-side.

### CU-07 — Gestionar membresías y propiedad [Importante]

- **Actor:** `owner`, `admin` y, en algunos cambios, el propio miembro; superadmin desde el portal
  privado para la operación de la beta; sistema de autorización.
- **Objetivo:** cambiar roles, expulsar, bloquear, reactivar, transferir propiedad o abandonar una sala.
- **Precondiciones:** membresía y sala activas; el actor tiene autoridad para la operación.
- **Entrada relevante:** jugador objetivo, nuevo rol o estado, y confirmación de salida/transferencia.
- **Flujo principal:** autorizar; aplicar transición `active`, `left`, `removed` o `banned`; si cambia la propiedad, actualizar la membresía `owner`; conservar contexto histórico.
- **Reglas de negocio:** solo existe un propietario; `spectator` no compite; salir o expulsar no borra resultados; si el propietario abandona debe transferir o eliminar la sala según las reglas de sucesión.
- **Resultado:** membresía y ownership coherentes.
- **Efectos secundarios:** auditoría, actualización de accesos y proyecciones; no se recalculan silenciosamente resultados pasados.
- **Errores o impedimentos:** actor sin autoridad, transición inválida, dejar la sala sin propietario elegible o cambiar el rol global desde el cliente.
- **Permisos necesarios:** `owner` para ownership y decisiones finales; `admin` para gestionar
  cualquier membresía salvo `owner`; miembro para su propia salida. Solo `owner` concede `admin` y
  la transferencia de propiedad es exclusiva de `owner`. El superadmin opera desde el portal
  privado con auditoría, sin convertirse en miembro competitivo.

## 3. Temporadas y calendario

### CU-08 — Configurar y consultar una temporada [V1]

- **Actor:** superadmin desde el portal privado para configurar durante la beta; cualquier miembro
  activo para consultar.
- **Objetivo:** definir el ciclo competitivo de una sala y su estado temporal.
- **Precondiciones:** sala activa y, para editar, permisos de gestión.
- **Entrada relevante:** título, `startsAt`, `endsAt` y transición solicitada (`draft`, `scheduled`, `active`, `finished` o `cancelled`).
- **Flujo principal:** desde el portal local de superadmin, validar fechas y estado; crear o modificar un borrador; activar explícitamente cuando corresponda; consultar total y ranking propios.
- **Reglas de negocio:** S10 implementa `draft → active` y S12 añade la finalización `active → finished` desde el tick local; como máximo existe una temporada `active`; las fechas se editan en la zona de la sala y se almacenan en UTC; una temporada empieza con cero Flash Points. `scheduled` y cancelación siguen siendo responsabilidades posteriores (S19).
- **Resultado:** temporada en estado coherente y visible dentro de la sala.
- **Efectos secundarios:** auditoría y actualización de disponibilidad; al finalizar se cierran nuevas entradas, pero intentos válidos pueden terminar dentro de su plazo.
- **Errores o impedimentos:** fechas invertidas, solapamiento de temporada activa, transición no permitida o edición de temporada finalizada sin corrección auditada.
- **Permisos necesarios:** superadmin desde el portal privado durante la beta; en el producto general,
  `owner` para editar la temporada; membresía activa para consultar.

### CU-09 — Preparar y publicar el calendario de desafíos [V1]

- **Actor:** superadmin desde el portal privado durante la beta; responsable de sala o editor
  autorizado en una fase posterior; sistema de calendario.
- **Objetivo:** publicar una versión de desafío dentro de una temporada con una ventana competitiva.
- **Precondiciones:** temporada adecuada y `ChallengeVersion` publicada; número libre y fechas válidas.
- **Entrada relevante:** versión, número, `opensAt`, `closesAt` y, si procede, zona horaria de edición.
- **Flujo principal:** desde el calendario privado, comprobar que la versión Flash está publicada y es compatible; validar orden, fechas y ausencia de solapamiento; crear o reprogramar `ScheduledChallenge`; el tick local abre y cierra por la ventana efectiva.
- **Reglas de negocio:** apertura inclusiva y cierre exclusivo; las fechas se almacenan en UTC; los placeholders no son publicaciones; solo se reprograma antes de abrir; S12 no cancela, fija `results_locked_at` ni modifica intentos.
- **Resultado:** publicación `scheduled`, `open`, `closed` o `cancelled`.
- **Efectos secundarios:** disponibilidad en sala, historial posterior y rankings derivados; cada escritura administrativa y transición del tick queda auditada.
- **Errores o impedimentos:** versión no publicada, número duplicado, ventana solapada, fecha inválida o intento de modificar una publicación abierta sin cancelar.
- **Permisos necesarios:** superadmin desde el portal privado durante la beta; responsable/editor
  autorizado cuando se habilite esa superficie. Miembros y espectadores solo consultan.

## 4. Contenido y práctica

### CU-10 — Preparar, versionar y publicar contenido [V1]

- **Actor:** superadministrador desde el portal privado durante la beta; editor/autor autorizado en
  una fase posterior.
- **Objetivo:** crear preguntas y desafíos reutilizables que puedan publicarse sin ambigüedad histórica.
- **Precondiciones:** superadmin autenticado; el editor S11 soporta `flash` con entre 2 y 20
  preguntas, schema técnico `v1`, puntos enteros positivos y 100 puntos totales.
- **Entrada relevante:** documento JSON estructurado con payload público, solución privada, orden,
  configuración, puntos, tiempos y motivo obligatorio de auditoría.
- **Flujo principal:** crear borrador; validar y previsualizar sin competición; guardar; editar solo
  mientras siga en `draft`; publicar explícitamente el snapshot.
- Cuando el documento contiene imágenes, el portal solicita una subida de asset, confirma su
  validación y guarda `assetId` junto a alt, dimensiones y configuración visual. La preview recibe
  una URL resuelta temporalmente; la versión publicada conserva solo la referencia estable.
- **Reglas de negocio:** una versión publicada es inmutable; cada desafío suma exactamente 100
  puntos; las soluciones quedan separadas del payload público; la publicación no crea calendario,
  intentos, puntos ni actividad ficticia.
- Una pregunta publicada puede seleccionarse en varios desafíos con puntos y `mode_config`
  diferentes; el mismo `question_version` no puede repetirse dentro de un único desafío.
- **Resultado:** `QuestionVersion` y `ChallengeVersion` publicada y reutilizable para futuras
  selecciones de calendario.
- **Efectos secundarios:** autoría, timestamps, auditoría segura, idempotencia y disponibilidad
  editorial posterior.
- **Errores o impedimentos:** JSON o formato desconocido, schema no soportado, solución ausente,
  relación inválida, asset inexistente o no validado, puntos distintos de 100, secreto en payload
  público, conflicto optimista o publicación incompleta.
- **Permisos necesarios:** exclusivamente superadmin desde el portal privado durante la beta; el
  miembro ordinario nunca recibe borradores ni soluciones.

### CU-11 — Sustituir o archivar contenido publicado [Importante]

- **Actor:** editor autorizado o superadministrador.
- **Objetivo:** corregir o retirar contenido sin modificar partidas históricas.
- **Precondiciones:** existe una definición o versión; el cambio está justificado y auditado.
- **Entrada relevante:** versión a corregir/archivar y nuevo contenido si aplica.
- **Flujo principal:** conservar la versión usada; crear una nueva versión para la corrección; publicar o archivar según corresponda; mantener las publicaciones antiguas apuntando a su snapshot.
- **Reglas de negocio:** nunca se modifica silenciosamente una versión publicada ni se elimina una versión usada.
- Un asset asociado a una versión publicada tampoco se sustituye in situ ni se borra mientras pueda
  ser necesario para una revisión histórica.
- **Resultado:** contenido futuro actualizado y contenido histórico reconstruible.
- Editar una versión publicada crea una nueva versión draft; los desafíos existentes conservan la
  versión que seleccionaron.
- **Efectos secundarios:** auditoría y posible actualización del catálogo de publicación; no se recalculan resultados anteriores automáticamente.
- **Errores o impedimentos:** intentar editar una versión publicada in situ, archivar contenido aún necesario sin reemplazo o romper una publicación histórica.
- **Permisos necesarios:** editor autorizado o superadministrador con auditoría.

### CU-12 — Ejecutar preview o prueba fantasma [Importante]

- **Actor:** persona sin sala para preview; superadministrador/editor para prueba interna.
- **Objetivo:** explorar formatos o verificar contenido sin contaminar la competición.
- **Precondiciones:** contenido disponible para práctica; para el preview editorial de S11, privilegio
  global y un borrador JSON válido.
- **Entrada relevante:** documento editorial Flash y configuración de preview.
- **Flujo principal:** validar el documento; renderizar las preguntas con el renderer existente;
  mostrar feedback de solución dentro del portal protegido, sin iniciar un intento.
- **Reglas de negocio:** el preview editorial no llama a `start_attempt` ni `prepare_interaction` y
  no crea Flash Points, historial, ranking, actividad social o filas de calendario.
- **Resultado:** previsualización interna no competitiva; la prueba fantasma interactiva completa
  queda reservada a una slice posterior.
- **Efectos secundarios:** ninguno en la competición ni en la temporada.
- **Errores o impedimentos:** JSON inválido, formato/schema no soportado, solución no perteneciente a
  las opciones o intento de acceder al editor fuera de superadmin.
- **Permisos necesarios:** preview público de ejemplos: ninguno; preview editorial S11: únicamente
  superadmin desde `/admin`.

### CU-13 — Explorar la biblioteca y practicar un formato [Importante]

- **Actor:** persona con o sin cuenta.
- **Objetivo:** entender y probar una mecánica aislada antes de competir.
- **Precondiciones:** formato y ejemplo disponibles en la biblioteca.
- **Entrada relevante:** slug de formato, ejemplo y respuestas locales.
- **Flujo principal:** consultar ficha; iniciar ejemplo; interactuar; recibir evaluación; cerrar o repetir.
- **Reglas de negocio:** la práctica no produce puntos competitivos ni historial; el ejemplo puede contener solución porque no tiene valor privado ni competitivo.
- **Resultado:** feedback y aprendizaje local del formato.
- **Efectos secundarios:** estado local de preview y, como máximo, métricas no competitivas.
- **Errores o impedimentos:** slug inexistente, ejemplo inválido o tratar el resultado como intento de sala.
- **Permisos necesarios:** ninguno; el contenido editorial público debe ser accesible.

## 5. Competición e intentos

### CU-14 — Consultar un desafío programado [V1]

- **Actor:** miembro activo de una sala; espectador para metadatos, no para contenido jugable.
- **Objetivo:** saber si puede jugar y acceder a la introducción del desafío correcto.
- **Precondiciones:** publicación resoluble y sala/temporada coherentes.
- **Entrada relevante:** alias de sala, alias de publicación y instante del servidor.
- **Flujo principal:** validar acceso; resolver versión e items; calcular `available`, `locked` o `expired`; recuperar estado del intento del jugador; mostrar solo el contenido permitido por el contexto.
- **Reglas de negocio:** `expired` antes de iniciar no crea intento; el cierre de la publicación no cancela un intento iniciado válido dentro de su deadline individual; el espectador no recibe el desafío jugable.
- **Resultado:** desafío disponible, bloqueado, expirado, en progreso, completado o no completado.
- **Efectos secundarios:** ninguno funcional.
- **Errores o impedimentos:** alias inválido, publicación cancelada, sala inaccesible, versión ausente o consulta competitiva de un espectador.
- **Permisos necesarios:** miembro activo para jugar; cualquier miembro activo para metadatos; `owner`/`admin`/`member` para contenido competitivo.

### CU-15 — Iniciar un intento competitivo [V1]

- **Actor:** jugador con membresía competitiva activa; sistema de intentos.
- **Objetivo:** comenzar el único intento oficial de una publicación.
- **Precondiciones:** cuenta, membresía `active` con rol competitivo, publicación abierta y ausencia de intento oficial terminal.
- **Entrada relevante:** jugador, publicación, versión de contenido y señal de inicio tras introducción/cuenta atrás.
- **Flujo principal:** comprobar autorización y ventana del servidor; crear atómicamente el intento `in_progress`; fijar timestamps, deadline y sesión; entregar payload público inicial.
- **Reglas de negocio:** la introducción no consume intento; por defecto hay un intento por jugador/publicación; el servidor asigna estado, identificadores y plazo; no se revelan soluciones.
- **Resultado:** intento oficial `in_progress` controlado por una sesión.
- **Efectos secundarios:** `AttemptStarted`, consumo de la oportunidad y checkpoint inicial.
- **Errores o impedimentos:** publicación cerrada/cancelada, jugador espectador, membresía terminada, intento ya existente, sesión concurrente o datos del cliente manipulados.
- **Permisos necesarios:** `owner`, `admin` o `member` con membresía activa; el servidor autoriza y serializa la creación.

### CU-16 — Reanudar un intento con sesión vigente [V1]

- **Actor:** jugador propietario del intento; sistema de concurrencia.
- **Objetivo:** continuar el mismo intento `in_progress` sin crear una segunda oportunidad.
- **Precondiciones:** intento iniciado, no terminal, jugador autorizado y checkpoint compatible.
- **Entrada relevante:** identificador/alias de publicación, token de sesión, checkpoint y `lock_version`.
- **Flujo principal:** localizar el intento; comprobar deadline, versión y token de la sesión activa;
  reconciliar primero una recepción ya confirmada y evaluarla idempotentemente cuando falte su
  evaluación. Si queda un intervalo preparado sin recepción, cerrarlo atómicamente con la
  consecuencia de recuperación del modo; restaurar después el progreso confirmado y continuar.
- **Reglas de negocio:** reanudar no equivale a repetir; solo una sesión controla el intento; una
  segunda sesión se bloquea y no sustituye a la primera durante el MVP; actualizaciones obsoletas se
  rechazan; una interacción preparada se considera consumida aunque se haya perdido su respuesta
  HTTP y no se vuelve a entregar. Flash, Supervivencia, Narrativa, Pirámide y Alfabeto aplican la
  consecuencia definida en `mode-contracts.md`; `abandoned`, `completed` e `invalidated` no se
  reanudan.
- **Resultado:** misma ejecución en progreso, o estado terminal consultable.
- **Efectos secundarios:** `AttemptResumed` y renovación de actividad de la sesión vigente.
- **Errores o impedimentos:** intento inexistente, deadline vencido, checkpoint incompatible, token
  inválido, sesión activa en otro dispositivo, concurrencia obsoleta, intento terminal o una
  recuperación que complete reglamentariamente el modo.
- **Permisos necesarios:** jugador del intento con autorización competitiva y token de la sesión
  que controla el intento.

### CU-17 — Enviar y evaluar una respuesta [V1]

- **Actor:** jugador en sesión; servidor evaluador.
- **Objetivo:** registrar la respuesta final de un elemento y avanzar el desafío.
- **Precondiciones:** intento `in_progress`, sesión válida, elemento esperado y plazo vigente.
- **Entrada relevante:** payload de respuesta, elemento, timestamps/telemetría, `lock_version` y checkpoint opcional.
- **Flujo principal:** validar orden, identidad, plazo e idempotencia; evaluar con la solución privada del servidor; guardar respuesta y tiempo; conceder resultado provisional; persistir checkpoint; devolver feedback permitido.
- **Reglas de negocio:** una respuesta final pertenece al `ChallengeItem`; solo hay una respuesta final por elemento; se distinguen `correct`, `partial`, `incorrect`, `unanswered` y `timeout`; el cliente no es autoridad.
- **Resultado:** respuesta evaluada y siguiente estado del intento.
- **Efectos secundarios:** `AttemptAnswerSubmitted`, `AttemptAnswerEvaluated`, checkpoint y telemetría auditable.
- **Errores o impedimentos:** elemento equivocado, respuesta duplicada, plazo vencido, `lock_version` obsoleta, payload no válido, intento terminal o solución enviada por el cliente.
- **Permisos necesarios:** jugador propietario de la sesión; solo el servidor puede evaluar y escribir el resultado competitivo.

### CU-18 — Completar reglamentariamente un intento [V1]

- **Actor:** sistema de juego con colaboración del jugador.
- **Objetivo:** cerrar el intento cuando el modo llega a su final reglamentario.
- **Precondiciones:** todas las preguntas necesarias procesadas o condición final del modo alcanzada.
- **Entrada relevante:** respuestas aceptadas, estado del modo, tiempos y configuración de la versión.
- **Flujo principal:** determinar finalización; cerrar el intento como `completed`; calcular resultado entero; congelar respuestas y duración; solicitar acreditación idempotente.
- **Reglas de negocio:** completar con cero Flash Points es válido; los estados internos `summit`, `failed`, `survived` o `eliminated` no sustituyen al estado global; el resultado está entre 0 y 100.
- **Resultado:** intento terminal `completed` con resultado y revisión disponibles.
- **Efectos secundarios:** `AttemptCompleted`, acreditación de puntos y actualización de rankings derivados.
- **Errores o impedimentos:** intentar cerrar dos veces, puntuación negativa, respuestas de otra versión, finalización fuera de plazo sin autorización o estado inconsistente.
- **Permisos necesarios:** sistema; el jugador solo puede provocar la transición mediante acciones válidas.

### CU-19 — Abandonar un intento [V1]

- **Actor:** jugador; sistema de actividad para abandono automático posterior.
- **Objetivo:** terminar explícitamente un intento iniciado que no se va a completar.
- **Precondiciones:** intento `in_progress` y jugador autorizado.
- **Entrada relevante:** intento, sesión y confirmación de abandono.
- **Flujo principal:** comprobar idempotencia; conservar respuestas ya aceptadas; cambiar a `abandoned`; eliminar el checkpoint recuperable; bloquear reanudación y replay competitivo.
- **Reglas de negocio:** abandono no es timeout de pregunta ni expiración de publicación; se proyecta como `notCompleted`; no concede ranking ordinario; heartbeat, lease y periodo de gracia aún son decisiones operativas abiertas.
- **Resultado:** intento terminal `abandoned`.
- **Efectos secundarios:** `AttemptAbandoned`, auditoría y actualización del estado visible del desafío.
- **Errores o impedimentos:** intento inexistente, ya terminal, sesión no autorizada o doble abandono no idempotente.
- **Permisos necesarios:** jugador propietario; cierre automático futuro: sistema con reglas de actividad aprobadas.

### CU-20 — Consultar resultado y revisar respuestas [V1]

- **Actor:** jugador que inició el intento; miembros autorizados para proyecciones permitidas; administración según política.
- **Objetivo:** consultar puntuación, precisión, tiempos, respuestas y soluciones después de un intento terminal.
- **Precondiciones:** intento `completed` o `abandoned`; si la publicación expiró antes de iniciar, no existe resultado propio.
- **Entrada relevante:** jugador, sala, publicación e intento; estado terminal.
- **Flujo principal:** autorizar; cargar resultado y respuestas de la versión jugada; proyectar desglose, feedback y revisión; ocultar replay competitivo.
- **Reglas de negocio:** durante `inProgress` no se muestran soluciones; tras finalización o abandono iniciado puede mostrarse la respuesta propia y la correcta; intentos invalidados requieren política administrativa.
- **Resultado:** pantalla de resultado/revisión o ausencia de resultado si no hubo intento.
- **Efectos secundarios:** ninguno funcional; posible métrica de consulta.
- **Errores o impedimentos:** consultar solución durante la partida, mezclar versiones, mostrar un intento ajeno sin permiso o permitir repetir el competitivo.
- **Permisos necesarios:** propietario del intento y actores administrativos autorizados; espectadores solo reciben las proyecciones que la política permita.

## 6. Puntuación y proyecciones

### CU-21 — Acreditar Flash Points [V1]

- **Actor:** sistema de puntuación/acreditación.
- **Objetivo:** convertir una finalización válida en puntos competitivos una sola vez.
- **Precondiciones:** intento competitivo `completed`, no invalidado, asociado a publicación y temporada válidas.
- **Entrada relevante:** resultado autoritativo, jugador, publicación, temporada y clave idempotente.
- **Flujo principal:** verificar elegibilidad; fijar puntos enteros entre 0 y 100; registrar `FlashPointsAccredited`; sumar al total de temporada una sola vez.
- **Reglas de negocio:** intentos de prueba, abandonados, invalidados, fantasma y publicaciones canceladas quedan fuera; los resultados de cero puntos sí participan; no existe saldo separado de XP o energía.
- **Resultado:** puntos acreditados y disponibles para rankings.
- **Efectos secundarios:** actualización de ranking de desafío, total y ranking de temporada, con auditoría.
- **Errores o impedimentos:** duplicar acreditación, resultado negativo, intento no elegible, temporada incorrecta o recalcular silenciosamente un resultado histórico.
- **Permisos necesarios:** exclusivamente el sistema autorizado; correcciones posteriores requieren operación administrativa auditada.

### CU-22 — Consultar el ranking de un desafío [V1]

- **Actor:** miembro activo de la sala, incluido `spectator`.
- **Objetivo:** comparar resultados competitivos de una publicación.
- **Precondiciones:** acceso a la sala y publicación consultable.
- **Entrada relevante:** sala, publicación y resultados acreditados.
- **Flujo principal:** seleccionar intentos competitivos completados y no invalidados; excluir pruebas, abandonos y cancelaciones; ordenar y proyectar jugadores.
- **Reglas de negocio:** se incluyen resultados con cero puntos; el orden común es más Flash Points, menor duración efectiva y `startedAt` más antiguo; empates completos comparten posición.
- **Resultado:** ranking histórico o actual del desafío.
- **Efectos secundarios:** ninguno funcional.
- **Errores o impedimentos:** incluir espectador como competidor, mezclar publicaciones, contar intentos no completados o usar `completedAt` como desempate.
- **Permisos necesarios:** membresía activa de la sala; el sistema filtra resultados y datos sociales permitidos.

### CU-23 — Consultar el ranking de temporada [V1]

- **Actor:** miembro activo de la sala, incluido `spectator`.
- **Objetivo:** conocer la clasificación acumulada de la temporada.
- **Precondiciones:** sala accesible y temporada identificable.
- **Entrada relevante:** sala, temporada y puntos acreditados.
- **Flujo principal:** sumar puntos acreditados por jugador en la temporada; excluir pruebas, inválidos y cancelaciones; ordenar y mostrar miembros elegibles.
- **Reglas de negocio:** solo se ordena por Flash Points acumulados; un miembro activo sin puntos puede aparecer con cero; no existe ranking global ni niveles de temporada.
- **Resultado:** ranking de temporada y total del jugador.
- **Efectos secundarios:** ninguno funcional.
- **Errores o impedimentos:** duplicar puntos, usar duración como criterio, incluir otra temporada o mostrar una moneda paralela.
- **Permisos necesarios:** membresía activa; acceso administrativo adicional solo para datos no públicos.

### CU-24 — Consultar historial y actividad social resumida [V1 / Importante]

- **Actor:** miembro activo de la sala; sistema de proyecciones.
- **Objetivo:** consultar publicaciones cerradas, resultados históricos, participantes y actividad social acotada.
- **Precondiciones:** sala accesible; para historial, publicación definitivamente cerrada.
- **Entrada relevante:** sala, temporada, publicación y hechos de intentos/membresías.
- **Flujo principal:** seleccionar publicaciones cerradas; reconstruir título, contenido y ranking desde la versión inmutable; contar jugadores competitivos distintos; proyectar actividad estructurada si está habilitada.
- **Reglas de negocio:** una publicación cerrada aparece aunque nadie juegue; placeholders no cuentan; canceladas se consultan aparte; pruebas fantasma no cuentan; el contenido histórico no cambia.
- **Resultado:** lista o detalle de historial y, opcionalmente, resumen social.
- **Efectos secundarios:** ninguno funcional; las correcciones quedan auditadas.
- **Errores o impedimentos:** mostrar contenido de otra versión, contar espectadores/fantasmas, tratar un feed renderizado como fuente de verdad o leer una sala inaccesible.
- **Permisos necesarios:** membresía activa para sala/historial; el alcance exacto de actividad y notificaciones queda restringido a actores autorizados.

## 7. Operación interna y correcciones

### CU-25 — Inspeccionar, corregir o invalidar resultados [Importante]

- **Actor:** superadministrador u operador autorizado.
- **Objetivo:** resolver fraude, errores de evaluación o incidencias sin borrar la historia.
- **Precondiciones:** privilegio global, motivo y evidencia auditables.
- **Entrada relevante:** jugador, intento/respuesta, corrección propuesta o solicitud de invalidación.
- **Flujo principal:** inspeccionar hechos y versión jugada; conservar valores originales; aplicar ajuste o `invalidated`; recalcular únicamente proyecciones permitidas; registrar auditoría.
- **Reglas de negocio:** una invalidación excluye ranking y acreditación; una corrección no modifica silenciosamente respuestas ni resultados históricos; los intentos conservan su registro.
- **Resultado:** intento corregido o invalidado con trazabilidad.
- **Efectos secundarios:** cambios auditados en puntos y rankings derivados, notificación si la política lo exige.
- **Errores o impedimentos:** operador no autorizado, motivo ausente, modificación destructiva o corrección incompatible con la versión publicada.
- **Permisos necesarios:** superadministrador/operador con privilegio explícito; nunca el jugador desde la interfaz competitiva.

### CU-26 — Ejecutar pruebas de superadministración [Importante]

- **Actor:** superadministrador o equipo interno de QA.
- **Objetivo:** verificar contenido, estados, permisos y modos sin crear participación competitiva.
- **Precondiciones:** rol global válido y entorno/control de prueba identificado.
- **Entrada relevante:** sala, contenido, estado o escenario a probar.
- **Flujo principal:** ejecutar el escenario como prueba fantasma; observar resultado y proyecciones; guardar evidencia; limpiar o separar el estado de prueba.
- **Reglas de negocio:** la prueba no consume intentos, no concede Flash Points, no aparece en rankings ni actividad y no sustituye a un jugador miembro.
- **Resultado:** evidencia de QA o diagnóstico operativo no competitivo.
- **Efectos secundarios:** `TestAttemptExecuted`, logs y auditoría.
- **Errores o impedimentos:** usar credenciales de jugador para elevar privilegios, contaminar el store competitivo o exponer datos privados fuera del contexto autorizado.
- **Permisos necesarios:** superadministrador con operación auditada.

## Dependencias y límites transversales

- Los casos de uso de competición dependen de una identidad autenticada, membresía competitiva,
  publicación válida, versión inmutable y reloj autoritativo.
- Los casos de consulta deben devolver proyecciones mínimas; no deben exponer identidades de
  autenticación, soluciones privadas ni filas canónicas innecesarias.
- Los cambios de intento, respuesta, puntuación y membresía deben ser idempotentes cuando una
  repetición de petición pueda producir duplicados.
- La implementación actual cubre principalmente CU-05, CU-07 parcialmente, CU-08, CU-12, CU-13,
  CU-14, CU-15/CU-16 de forma local y las consultas de CU-20 a CU-24 mediante mocks. S12 cubre la
  programación y ejecución local del calendario Flash, pero la automatización temporal remota sigue
  pendiente. S11 cubre la publicación editorial mínima de Flash y su preview protegido; reemplazar/
  archivar versiones publicadas y la prueba fantasma interactiva siguen pendientes.
- Las decisiones sobre heartbeat, lease, gracia de desconexión, alcance del editor y revisión de
  intentos invalidados deben cerrarse antes de convertir los casos correspondientes en contratos
  técnicos. La matriz de permisos de sala y las reglas de invitaciones ya están fijadas.
