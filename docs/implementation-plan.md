# Plan de implementación mediante vertical slices

> Estado: backlog técnico vivo. S01–S15, S17a, S18b parcial, D08a, D08b, E01–E06, E10, S05-Alphabet, F01, F02, F03, F04, F06, F07, F08, F12, F16, F18 y F19 están implementadas y verificadas sobre el stack local;
> E10 y `multiple-choice` ya usan `question-assets` privado con contrato v2;
> las demás slices siguen pendientes hasta cumplir sus propios criterios de cierre.
> Fecha de análisis: 2026-09-23. Alcance: pasar del prototipo mock a competición persistida,
> ampliar después la cobertura de modos y permitir operar el producto sin editar la base a mano.
> En la beta cerrada, las operaciones de administración y bootstrap se realizarán desde un portal
> privado de superadmin; no forman parte de la UI pública.

## 1. Fuentes y punto de partida

Se han contrastado los [requisitos](current/domain/domain-requirements.md), el
[modelo de dominio](current/domain/domain-model.md), los [casos de uso](current/use-cases.md), la
[arquitectura](current/architecture.md), el [modelo de persistencia](current/data-model.md) y los
archivos SQL declarativos de [schemas](../supabase/schemas/README.md). Completan la lectura las
[decisiones](decisions/decisions.md), los [ADR](decisions/adr/README.md), los
[contratos de modo](current/domain/mode-contracts.md), las
[cuestiones abiertas](decisions/open-questions.md) y la documentación de
[acceso a datos](current/domain/data-access.md), [tipos](current/domain/type-model.md),
[mocks](current/domain/mock-data.md) y [QA](current/qa.md).

La documentación histórica explica el prototipo, pero no añade requisitos a este backlog.
Este plan propone orden y alcance de entrega; no aprueba por sí mismo políticas de producto abiertas.

### Evidencia del código actual

| Área      | Existe y conviene conservar                                                                                                                                                                                                             | Falta para un recorrido real                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI        | Next.js 16.2.10, React 19, Flash Pop, 31 formatos y cinco modos; páginas de salas, desafíos, resultados e historial.                                                                                                                    | Estados de red, portal privado de operación y otros modos aún no migrados. La UI pública no gestiona salas, invitaciones ni temporadas en la beta. |
| Lecturas  | `server/data-access.ts`, `roomQueries.ts`, `flashQueries.ts` y `survivalQueries.ts`; home, salas, introducción, Flash/Supervivencia jugables, rankings e historial/revisión Flash, más portal y calendario.                             | Transferencia, bloqueo/desbloqueo, invitaciones y proyecciones pendientes de los otros modos.                                                      |
| Identidad | `Player` separado de Auth, provisioning, login/logout, nombre persistido y avatar global en S01/S13/D08a.                                                                                                                               | Moderación, purga y assets editoriales.                                                                                                            |
| Partidas  | Reducers/scoring para práctica; comandos, sesiones, tiempos, evaluación privada, puntos y recuperación server-side para Flash, Alphabet, Supervivencia y Pirámide.                                                                      | Sustituir autoridad cliente en Narrativa; Pirámide conserva `localStorage` solo en práctica.                                                       |
| Contratos | `types/domain`, `types/contracts`, `types/gameplay`, `types/view-models`; payload público, solución y revelación separados.                                                                                                             | Validación en ejecución de JSON y adaptación progresiva de la UI. Los tipos TypeScript no validan peticiones ni filas JSONB.                       |
| SQL       | 30 tablas, 45 archivos declarativos, restricciones, RLS/ACL, Storage, versiones congeladas, recepciones y tiempos privados, ledger, auditoría, rankings y migraciones versionadas.                                                      | Aplicación controlada a un proyecto remoto y operación completa de assets editoriales desde un portal privado.                                     |
| Comandos  | `application/ports/attempt-commands.ts`, comandos privados y transportes HTTP de start/prepare/answer/complete/abandon/recover para S03–S04, más comandos administrativos de sala y membresía parcial. El takeover queda deshabilitado. | Alta de jugador, transferencia, bloqueo/desbloqueo, invitaciones completas, edición y publicación adicional.                                       |
| Evaluador | `server/evaluation/evaluate-receipt.ts` reutiliza `lib/scoringCore`; Flash, Alphabet y Supervivencia persisten evaluación; el servidor deriva además vidas y final reglamentario de Survival.                                           | Contextos y reglas autoritativas de Pirámide, Narrativa y los demás modos.                                                                         |
| Pruebas   | Vitest, type tests, pgTAP, inventario de seguridad, carreras, integración Auth/HTTP/Storage y E2E local para S01–S14, D08a/D08b, E01–E06, F08, F16, F18, E10 y `multiple-choice` con assets privados.                                   | Verificación contra un entorno remoto.                                                                                                             |

> Actualización 2026-09-16: el flujo Flash competitivo ya incorpora estados de espera y error de red
> en la UI. La estandarización de este patrón para otros modos queda pendiente de sus respectivas
> migraciones a evaluación server-side.

Archivos de entrada útiles: [fachada de lecturas](../server/data-access.ts),
[composición mock](../infrastructure/mock/composition.ts),
[cliente competitivo](../components/game/RoomChallengeClient.client.tsx),
[registry de interacción](../features/question-formats/QuestionInput.tsx),
[motor de evaluación](../lib/scoringCore/engine.ts),
[puerto de comandos](../application/ports/attempt-commands.ts) y
[comandos SQL](../supabase/schemas/90_commands.sql).

### Diferencias que el plan debe respetar

- Algunas páginas de documentación general todavía describen una aplicación sin base de datos; son
  referencias históricas que deben actualizarse. Ya existe una integración real local en las slices
  persistidas actuales; la documentación de `current/` mantiene el detalle por slice.
  No hay que rediseñar el esquema ni sustituirlo por CRUD.
- `supabase/tests/support/bootstrap.sql` simula las funciones mínimas de Auth; sus fixtures no son
  un seed ni prueban un login GoTrue. La integración con Supabase completo se valida en S01.
- `service_role` carece de DML directo. Ejecuta comandos privados por conexión PostgreSQL; no se
  puede conectar la UI usando `.insert()`/`.update()` genéricos ni exponer `private` por Data API.
- Los rankings públicos tienen EXECUTE para `authenticated`, no para `service_role`. El adaptador
  debe respetar esa diferencia; el JWT de servicio no representa a un jugador.
- S03 valida los campos de versión técnica antes de componer el evaluador y mantiene la solución
  dentro del servidor.
- S04 ya dispone de lectura de recuperación y comandos estrechos para Flash. No hay todavía
  checkpoints/revelaciones/eventos específicos para los demás modos; E* los añadirá cuando su flujo
  los necesite.
- SQL exige publicación `open` y temporada `active` además de fechas válidas. La apertura no se
  consigue cambiando solo el texto de la UI o esperando a que avance el reloj: S12 integra las
  transiciones de calendario.
- La recuperación de una interacción iniciada ya está definida: no se reentrega contenido preparado
  y se aplica la consecuencia del modo. El abandono por inactividad sigue pendiente porque no hay
  heartbeat/lease: no se inventa una duración ni se trata `pagehide` como confirmación fiable;
  véase D04 y S21.
- La verificación actual se registra en `docs/current/status.md`; el stack local de Supabase pasa
  esquema/RLS, provisioning, S02–S04, S06–S08 y S10–S12, además de sus integraciones y carreras.
  No hay proyecto remoto vinculado.

## 2. Forma de trabajar y límites

Cada identificador S*, F* o E* es una unidad de backlog con resultado demostrable. Las secciones de
formatos contienen fichas comunes y filas específicas: **cada fila es una slice independiente**,
no una tarea para migrar una familia completa. Las dependencias son requisitos de cierre, no una
orden de crear capas vacías.

El recorrido normal será:

```text
UI → Server Action / Route Handler → sesión verificada → caso de uso
   → reglas puras + puerto → transacción PostgreSQL
   → DTO autorizado → UI actualizada → tests de dominio, integración y recorrido
```

En una consulta: Server Component → fachada → consulta autorizada → persistencia → view model.
No se crea un endpoint HTTP para cada lectura interna. Las acciones de formularios usan Server
Actions; el protocolo de juego usa Route Handlers cuando necesita JSON, reintentos y conflictos
explícitos. Los nombres de transportes futuros son orientativos hasta implementar cada slice.

Reglas de entrega:

1. Conservar rutas y componentes cuando sus contratos sean adecuados. No crear un segundo árbol
   `domain/`, repositorios por tabla, microservicios, colas, Realtime ni rankings materializados.
2. Cambiar un recorrido completo a persistencia real. No mezclar puntos mock con puntos reales ni
   caer silenciosamente al mock si falla la base. Las demos y `/formatos` quedan en un contexto
   explícito de práctica; no se eliminan sus fixtures de test.
3. Para competición, separar metadatos de introducción, interacción pública y revisión terminal.
   Eliminar soluciones de props, HTML/RSC, JSON, bundles, metadata y assets accesibles por rutas
   alternativas. Quitar `roomId` de la URL nunca debe convertir contenido competitivo en preview.
4. Activar solo combinaciones de modo/formato verificadas. La lista de capacidades se valida al
   publicar y antes de consumir un intento. Un formato pendiente no usa scoring local como fallback.
5. Introducir validadores, puertos, errores y migraciones junto con su primer consumidor real.
   La misma función pura puede seguir sirviendo a práctica y evaluación privada; la práctica no
   importa secretos ni contenido de publicaciones competitivas.
6. No renumerar ni reescribir migraciones aplicadas. La primera incorpora el esquema declarativo
   existente; después, cambios incrementales. No convertir los IDs de demo en identidad de usuarios
   reales ni importar sus resultados como historial auténtico.
7. Leer las guías de la versión instalada en `node_modules/next/dist/docs/` antes de implementar
   rutas, sesión, Server Actions o caché; lo exige `AGENTS.md`. Este plan no fija APIs de otra versión.

### Datos iniciales y migraciones

S01 establece el workflow de [Supabase](../supabase/README.md): generar y revisar la migración desde
`supabase/schemas/`, aplicar y comprobar reconstrucción en una base local vacía. Las ACL, propietarios,
default privileges y objetos adicionales se contrastan con `supabase/security-inventory.json`.
Los cambios no representables por el sincronizador llevan una migración explícita según ese workflow.

S02–S04 añaden y ejercitan un conjunto local mínimo: dos cuentas de prueba reales de Auth, una sala,
membresías competitivas/espectador, una temporada y un Flash de 2 a 20 preguntas con 100 puntos
totales
una. Los escenarios de fechas y UUID son deterministas; las pruebas usan un reloj controlado o
preparación explícita del escenario. El modo demo no modifica el reloj competitivo de producción.

El aprovisionamiento local puede usar privilegios de mantenimiento en una base desechable. Es un
fixture de integración, no un endpoint ni la credencial del proceso Next.js. No se copian `auth.users`
ni el bootstrap ficticio de pgTAP al stack real. Para un piloto remoto, el aprovisionamiento se hace
mediante un procedimiento explícito y reproducible separado del seed de pruebas; se retira su uso
ordinario al completar S08–S12. No hace falta esperar a un editor completo para validar S03.

### Alcance operativo de la beta cerrada

La primera versión pública no expondrá acciones para crear una sala privada, crear, aceptar o
revocar invitaciones, ni preparar o activar una temporada. Esas capacidades siguen formando parte
del producto, pero durante la beta se ejecutarán exclusivamente desde un portal privado para
superadministradores, con autorización server-side, comandos estrechos, revalidación y auditoría.

El superadmin podrá provisionar directamente a usuarios autenticados en una sala, creando o
reactivando su membresía con el rol permitido (`admin`, `member` o `spectator`) sin simular ni
requerir la aceptación de una invitación. Este alta directa será el mecanismo de reunir al grupo en
la beta; la UI pública no mostrará enlaces, formularios ni CTA de invitación. Las reglas de
invitaciones —un uso por defecto, multiuso explícito hasta 20 y caducidad de 7 días por defecto con
máximo de 30— siguen siendo la política futura si el flujo se habilita después.

El portal interno será también la superficie prevista para crear salas, configurar y activar
temporadas y operar membresías. La publicación mínima de contenido, la programación de desafíos y
la ejecución del calendario podrán incorporarse a ese portal según la priorización de la beta; en
ningún caso se convertirán en pantallas públicas de la aplicación. Los usuarios finales solo
consultarán y jugarán en salas ya provisionadas.

## 3. Decisiones previas a las slices afectadas

Estos tickets tienen responsable funcional/técnico a asignar. Su salida es una decisión documentada
y ejemplos de aceptación, no una capa nueva. No requieren detener la redacción de este backlog.

| ID  | Decisión o incertidumbre                                                                                                                                                                                                                                                                                                                                                                                     | Resolver antes de                                                             | Salida necesaria                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Método inicial de login, cookies, transporte seguro del token de intento y conexión SQL con pool. **Localmente resuelto en S01–S04; entorno objetivo pendiente.**                                                                                                                                                                                                                                            | S01; completar token en S03/S04.                                              | Un método Auth, política de expiración y reintento, rol SQL de ejecución limitado, prueba de aislamiento de claims entre conexiones reutilizadas y prueba en el entorno objetivo.                                                        |
| D02 | Identidad de rutas: hoy hay aliases mock para publicaciones/miembros; SQL solo tiene algunos slugs. **Resuelto para los recorridos S02–S04.**                                                                                                                                                                                                                                                                | S02/S03.                                                                      | Usar UUID de publicación/jugador o alias persistido si debe conservarse una URL. Evitar inventar slugs para todas las tablas; una publicación no es el slug de una definición reutilizable.                                              |
| D03 | Contrato ejecutable por modo y formato: feedback, timeout, borradores, revelaciones y tiempo de carga/presentación. **Acotado al Flash multiple-choice en S03–S04.**                                                                                                                                                                                                                                         | S03, S05, F*, E*, S14–S16.                                                    | Escenarios aprobados; milisegundos en contratos; tiempo privado inmutable. Decidir discrepancias del prototipo sin trasladar automáticamente todas sus reglas.                                                                           |
| D04 | Confirmación de abandono por inactividad, gracia, recuperación y cierre definitivo de publicaciones. **Recuperación y abandono explícito resueltos en S04; inactividad pendiente.**                                                                                                                                                                                                                          | S21; antes de declarar cumplido el objetivo completo de abandono.             | Política de actividad y `results_locked_at`; el piloto anterior solo promete reanudación y abandono explícito. Si se aplaza para usuarios reales, registrar expresamente esa limitación.                                                 |
| D05 | **Resuelto para owner/admin/superadmin (2026-09-16).** `owner` gestiona la sala y puede transferir propiedad, pero no invalida ni corrige puntos; `admin` gestiona cualquier membresía salvo owner, pero solo owner concede admin; member/spectator no administran; las acciones directas de superadmin sobre una sala se auditan. El editor no es rol de sala y su alcance editorial queda para sus slices. | S09–S12, S17–S20, S23.                                                        | Matriz por operación, actor y objetivo documentada; no se añade un rol editor persistido en esta fase.                                                                                                                                   |
| D06 | **Resuelto (2026-09-16).** Owner invita a admin/member/spectator; admin invita a member/spectator; un uso por defecto, multiuso explícito hasta 20, TTL por defecto de 7 días y máximo de 30; owner/admin revocan sin afectar membresías existentes.                                                                                                                                                         | S09.                                                                          | Token opaco almacenado como hash, mostrado una sola vez, sin correo; aceptación y errores no disponible auditables y sin filtración.                                                                                                     |
| D07 | Revisión de respuestas, contenido no alcanzado y resultados ajenos/invalidados. **Revisión propia terminal mínima resuelta en S03; ampliación Flash resuelta en S07.**                                                                                                                                                                                                                                       | Revisión mínima S03; revisión Flash S07; invalidación administrativa S20/S23. | Revisión propia terminal autorizada; revisión ajena completa solo para `owner`/`admin`/`member`; durante `in_progress` sin soluciones; invalidados fuera de la revisión de usuario. Precisar el contenido revisable tras abandono.       |
| D08 | **Resuelto e implementado en D08a/D08b + S13/E10/MC (2026-09-19).** `avatars` es público por enlace y `question-assets` privado; se persisten rutas/`assetId`, nunca URLs firmadas.                                                                                                                                                                                                                          | Thumbnails y purga operativa.                                                 | Registro `media_assets`, validación server-side de bytes/tipo/dimensiones/hash, subida confirmada, auditoría, compensación y URLs runtime autorizadas; la entrega no se presenta como protección contra copia.                           |
| D09 | Retención de respuestas, auditoría e idempotencia; anonimización y purga.                                                                                                                                                                                                                                                                                                                                    | S24 y apertura general S22.                                                   | Política y operación recuperable. Retener claves suficiente tiempo para impedir duplicados tras reintentos; no fijar caducidad por comodidad técnica.                                                                                    |
| D10 | Conflictos entre fuentes normativas antiguas y reglas actuales.                                                                                                                                                                                                                                                                                                                                              | Primera slice afectada.                                                       | Reconciliar referencias: ADR 0003 aún menciona intento «expirado»/varios intentos, pero el modelo vigente exige uno y `expired` sin intento. Registrar aclaración en las fuentes, no cambiar el dominio silenciosamente desde este plan. |

## 4. Orden, hitos y dependencias

| Orden sugerido   | Entregable verificable                                                                                                                                                                                   | Dependencias principales                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| S01 → S02        | Identidad real, perfil y sala persistida autorizada. **Implementado en local.**                                                                                                                          | D01, D02.                                                            |
| S03 → S04        | Flash completo guardado; recuperación en la misma sesión y bloqueo de una segunda sesión. **Implementado en local.**                                                                                     | S01/S02, D03/D07.                                                    |
| S05 y E01        | Alfabeto y Mini-Wordle de prueba: reloj global y feedback intermedio sin solución cliente.                                                                                                               | S04, D03. Reducen pronto dos riesgos distintos.                      |
| S06 → S07        | Dos rankings y consulta histórica real. **S06 y S07 implementados en local.**                                                                                                                            | S03; S04 para reconstrucción de estado.                              |
| Portal privado   | Acceso seguro al portal, contexto de operador y marco común de comandos administrativos. **Implementado en local.**                                                                                      | S01, Auth y rol global de plataforma.                                |
| S08              | Crear sala activa, asignar propietario, provisionar grupo inicial y auditar la operación desde el portal. **Implementado en local.**                                                                     | Portal privado, S02, D05/D06.                                        |
| S09 (posterior)  | Invitaciones de un solo/multiuso y aceptación mediante enlace.                                                                                                                                           | S08, S01, D05/D06; no bloquea la beta con provisioning directo.      |
| S10 → S11 → S12  | Preparar temporada, publicar contenido y programar competición desde el portal privado.                                                                                                                  | S08, S03, D05.                                                       |
| S13              | Avatar persistido.                                                                                                                                                                                       | S01, D08.                                                            |
| D08a             | Fundación Storage: buckets, `media_assets`, adaptador server-only, políticas, confirmación de subidas y limpieza compensatoria.                                                                          | S01, S11, S17a, D08.                                                 |
| D08b             | **Implementado localmente (2026-09-19).** Integrar `question-assets` privado con el editor superadmin, E10 y `multiple-choice`; publicar `assetId` v2 y resolver URL firmada tras `prepare_interaction`. | D08a, S17a, E10.                                                     |
| F* y resto de E* | Más formatos competitivos, uno por entrega según el contenido elegido.                                                                                                                                   | S03/S04 y D03; E01 ofrece el primer patrón de eventos.               |
| S14, S15, S16    | Supervivencia, Pirámide y Narrativa.                                                                                                                                                                     | S04 y las slices de formatos usadas por cada desafío.                |
| S17–S21          | Evolución editorial, membresías, cancelación, corrección e inactividad.                                                                                                                                  | Dependencias explícitas en cada ficha.                               |
| S22              | Apertura operativa y retirada de mocks del producto real.                                                                                                                                                | Capacidades elegidas y puertas de salida de este documento.          |
| S23–S24          | Pruebas fantasma y anonimización.                                                                                                                                                                        | Políticas de operación; pueden adelantarse si la salida lo requiere. |

**H1 — primera escritura real:** alcanzado con S01: login → editar nombre → recargar y conservarlo.

**H2 — primera competición E2E:** alcanzado localmente con S01–S03: dos jugadores en una sala
aprovisionada juegan un Flash; queda una respuesta por item y una acreditación por intento, incluso
con cero. Es validación interna, todavía no la V1 completa.

**H3 — piloto acotado:** pendiente del portal privado y de las capacidades elegidas, con decisiones
D03/D04 registradas. S04, S06 y S07 ya están implementadas localmente.
Antes de incorporar usuarios externos mediante el provisioning directo del portal privado, ejecutar
también los controles operativos de S22 para ese alcance.
S05/E01 son experimentos técnicos tempranos; no obligan a lanzar esos modos al piloto.

**H4 — V1 operable:** portal privado, S08, S10–S12, cierre/cancelación operativa y S22; todo el
alcance habilitado se opera desde ese portal, con recuperación, consultas y capacidades publicadas.
S09 no bloquea esta beta porque el grupo se provisiona directamente. S13 es una mejora opcional;
S21 debe cerrarse o dejar registrada explícitamente la restricción de no disponer de abandono
automático/consolidación avanzada. No declarar toda la especificación implementada mientras falten
comportamientos requeridos. CU-10 puede entregarse con editor mínimo.

**H5 — paridad del catálogo:** los cinco modos y las 31 filas del inventario de formatos cerradas.
No es requisito para obtener H2 ni para validar el producto con un catálogo menor.

## 5. Slices del recorrido principal

### S01 — Entrar y guardar el nombre del perfil

> Estado: implementada y verificada en local (`75707bd`).

- **Objetivo / CU:** primera lectura y escritura persistidas; CU-01 y CU-02 (nombre).
- **UI:** nueva entrada de autenticación y salida; `app/page.tsx`, `FlashPopHome`,
  `FlashPopProfileDialog`. Mostrar sesión caducada y errores de guardado reales. Hasta S02,
  el inicio real muestra el perfil y una lista vacía, sin mezclar las salas demo con esa identidad.
- **Mocks retirados:** `demoIdentity`/`MockCurrentViewerProvider` del recorrido real y el guardado
  exclusivamente local del nombre. El avatar persistido queda cubierto por S13/D08a.
- **Backend/dominio:** verificar Auth en servidor; resolver o crear un `Player` idempotentemente
  sin confiar en un `auth_user_id` enviado por UI. Action de nombre → caso de uso → validación
  compartida → persistencia → perfil actualizado. Sin membresías implícitas.
- **Persistencia:** primera migración existente y comando estrecho nuevo de provisión del jugador.
  Para nombre, usar el permiso actual de `authenticated` con RLS desde servidor, o un comando
  específico si se justifica; nunca habilitar DML global a `service_role`.
- **Tests:** login real local, altas simultáneas sin dos Players, nombre inválido, intento de editar
  otro jugador, sesión caducada, logout, recarga, claims falsos y aislamiento del pool. Añadir aquí
  el arnés E2E mínimo y CI para este recorrido, junto a las pruebas de integración.
- **Dependencias:** D01; workflow local reproducible y credencial de ejecución sin ownership.
- **Terminada:** una cuenta nueva entra, cambia su nombre y lo conserva tras reiniciar la app;
  otra cuenta no puede leer datos Auth ni editarla. Build, integración y E2E pasan en base limpia.

### Slice transversal previa — Portal privado mínimo

> Estado: implementada y verificada en local el 2026-09-16. `/admin` es una superficie server-side
> protegida; S08 añade la creación auditada de salas y su provisioning inicial.

- **Objetivo:** proporcionar la frontera común para operar la beta sin mezclar permisos de
  superadmin con la UI pública ni crear una pantalla administrativa genérica antes de tener casos
  de uso reales.
- **Superficie:** `/admin` usa un layout y una página dinámica server-side, sin enlaces desde la
  navegación pública. La página muestra el contexto del operador y todas las salas `active`, y
  contiene el wizard de S08 para crear una sala, owner y grupo inicial opcional.
- **Autenticación y autorización:** resolver la sesión en servidor y comprobar el rol global
  `superadmin` contra la asignación persistida. Un miembro normal no debe poder alcanzar las páginas
  ni invocar sus acciones modificando URL, formulario, claims del cliente o payloads.
- **Frontera de comandos:** `requireSuperadmin()` resuelve Auth, provisioning, asignación persistida,
  actor y `requestId` en servidor. Deja preparado el contexto de auditoría para Server Actions y
  Route Handlers futuros. No hay CRUD genérico ni DML directo con `service_role`.
- **Auditoría:** definir el contexto común de operador, sala afectada, operación, motivo cuando
  corresponda, timestamps y resultado para que S08–S12 y las operaciones posteriores sean trazables.
- **UI y estados:** incluir carga, ausencia de datos, error recuperable y acceso denegado sin filtrar
  si existe una sala que el operador no puede consultar.
- **Tests:** `get_superadmin_portal_context()` tiene 15 checks pgTAP de ACL, propietario,
  `search_path`, salas activas, ausencia de salas borradas, claims falsos y acceso privado directo.
  El adaptador cubre payloads válidos/vacíos, filas inválidas, errores y ausencia de fallback; el
  E2E cubre superadmin, miembro, sesión anónima y recarga. La auditoría de mutaciones comienza en
  S08; esta slice no inventa una operación de escritura de prueba.
- **Dependencias:** S01 para Auth/provisioning y las asignaciones globales existentes; guía instalada
  de Next.js para layouts, rutas y acciones server-side.
- **Terminada:** un superadmin entra en `/admin`, ve su contexto y salas activas tras recargar;
  cualquier otro actor recibe ausencia/denegación consistente y no puede ejecutar comandos. S08
  reutiliza la frontera sin crear su propia autorización o layout.

### S02 — Ver mis salas y la introducción autorizada

> Estado: implementada y verificada en local (`ab14d95`).

- **Objetivo / CU:** navegar por datos reales sin empezar una partida; CU-05, consulta de CU-08 y
  metadatos de CU-14.
- **UI:** inicio, `app/salas/[roomId]`, `FlashPopRoomDetail` e introducción. Tratar sala vacía,
  ausencia de temporada, ausencia de posición y rol espectador sin inventar valores.
- **Mocks retirados:** `MockRoomQueries.listCards/getDetail` y metadatos mock para este recorrido;
  quitar la superposición de resultados locales en salas reales.
- **Backend/dominio:** consultas de sala bajo membresía; misma ausencia para recurso inexistente
  o ajeno. Separar introducción de `getPlayable`; metadata usa la misma autorización. Mapear
  identidades de ruta según D02. No devolver `Challenge` completo ni empezar timers.
- **Persistencia:** leer salas, membresías, temporadas y publicaciones del fixture mínimo;
  proyectar metadatos privados autorizados sin entregar preguntas. Las proyecciones de puntos usan
  hechos reales, aunque aún estén vacías.
- **Tests:** contratos aplicables del mock ejecutados también sobre adaptador real; owner/admin/
  member/spectator, exmiembro y usuario de otra sala; metadata y acceso sin `roomId`; cero intentos
  después de abrir introducción. No mantener expectativas legacy de filtración de soluciones.
- **Dependencias:** S01, D02. Preparación de datos local de la sección 2.
- **Terminada:** cada usuario solo ve sus salas y el CTA correcto; consultar no consume intento y
  ninguna ruta alternativa devuelve contenido competitivo como preview.

### S03 — Completar un Flash con resultado persistido

> Estado: implementada y verificada en local (`689c3f5`).

- **Objetivo / CU:** primer loop competitivo entero; CU-14, CU-15, CU-17, CU-18, CU-20 y CU-21.
- **UI:** `RoomChallengeClient`, `FlashPopFlashGame`, `QuestionInput`, `QuestionScreen`, resultado
  y revisión propia mínima. Solo formato `multiple-choice`; los fixtures históricos usan dos
  preguntas de 50 puntos, pero el contrato Flash admite de 2 a 20 preguntas y 100 puntos totales.
- **Mocks retirados:** desafío completo mock, scoring oficial en `useGameSession`, reporter local
  y `recordCompletion` como autoridad para esta publicación. Conservar UI/transiciones reutilizables.
- **Backend/dominio:** casos de iniciar, preparar, enviar/evaluar y finalizar; validar versiones
  técnicas, payload y orden. Recomponer la pregunta privada para `evaluateReceipt` con puntos del
  item; sumar y cerrar Flash en servidor. No aceptar estado, puntos ni solución del navegador.
- **Persistencia:** adaptar `start_attempt`, `prepare_interaction`, `receive_answer`,
  `read_evaluation_context`, `record_evaluation`, `complete_attempt`. Confirmar preparación antes
  de entregar pregunta y recepción antes de evaluar. Completar/acreditar conserva su transacción
  SQL única. Añadir consulta autorizada de resultado/revisión terminal mínima, sin DML nuevo.
- **Respuesta:** DTO de interacción pública/feedback sin solución durante la partida; resultado
  terminal con puntos, tiempo y respuestas propias. Revalidar solo la sala/resultados afectados.
- **Tests:** E2E acierto/error/timeout/cero; doble click e inicio simultáneo; score y reloj cliente
  falsificados; fecha límite exacta; cierre de publicación tras inicio; finalización prematura;
  retry tras commit sin respuesta HTTP y evaluación lenta. Comprobar ausencia de secretos en
  HTML/RSC/JSON/bundle y que el resultado permanece tras recargar.
- **Dependencias:** S01, S02, D03 y D07 acotadas al Flash piloto.
- **Terminada:** dos cuentas completan el desafío real, cada item tiene una recepción y respuesta,
  cada intento una acreditación; cero también es `completed`; no hay replay competitivo ni
  solución accesible durante el intento. Validado en un entorno local aislado del piloto.

### S04 — Reanudar, recuperar fallos y abandonar explícitamente

> Estado: implementada y verificada en local (`1aa99f1`).

- **Objetivo / CU:** conservar el mismo intento ante recarga o fallo parcial y bloquear una segunda
  sesión/dispositivo; CU-16, CU-19 y recuperación de CU-17/CU-18.
- **UI:** `RoomChallengeClient`, `useRoomAttemptSnapshot`, `RoomSessionProvider`, aviso de sesión
  activa en otro dispositivo, acción explícita de abandono y estado «procesando respuesta»
  recuperable. No hay CTA de takeover.
- **Mocks retirados:** snapshot en memoria como fuente de progreso oficial del Flash migrado.
- **Backend/dominio:** lectura autorizada del estado aceptado, recepción pendiente y versión actual;
  recuperar no rehidrata a ciegas. Si existe recepción, evaluarla/reconciliarla idempotentemente;
  si queda un intervalo preparado sin recepción, consumirlo atómicamente con la consecuencia del
  modo antes de preparar contenido. Un retry conserva clave, operación, contenido y secreto;
  conflictos obsoletos requieren releer, no repetir a ciegas. Un token distinto recibe conflicto de
  sesión activa y nunca revoca la sesión original. Diferenciar SQLSTATE `40001` de negocio de fallos
  transitorios reintentables.
- **Persistencia:** usar `abandon_attempt` y añadir lectura y comando privado de recuperación con
  ACL mínima. El comando bloquea intento/intervalo, reconcilia recepción o cierra la interacción
  abierta, registra su efecto y solo después permite preparar la siguiente. El wrapper
  `take_over_attempt` queda deshabilitado. Reconstruir desde respuestas/intervalos/recepciones;
  checkpoint nuevo solo si hace falta, con esquema validado. No abrir SELECT genérico sobre tablas
  privadas nuevas ni guardar el token en texto plano en DB, auditoría o idempotencia.
- **Tests:** caída después de preparar, recibir, evaluar y acreditar; pérdida de HTTP tras preparar
  (no se repite la unidad) y tras recibir (se evalúa la recepción); misma cookie tras recarga;
  segunda pestaña/dispositivo bloqueado; versión/token antiguos; abandono repetido; terminal no
  reanudable; relojes originales; disputa abandono/evaluación con resultado definido.
- **Dependencias:** S03, D01 de token y D03 de checkpoint.
- **Terminada:** el jugador recupera el estado aceptado con la sesión original tras reiniciar el
  proceso; una interacción ya preparada se resuelve sin volver a mostrarse ni reiniciar su reloj.
  Una segunda sesión solo recibe un bloqueo y no puede transferir el control; abandonar conserva
  respuestas, consume intento y no suma puntos. Desconexión sola todavía no promete abandono
  automático: corresponde a S21.
- **Estado de implementación:** completado para Flash, Alphabet, Supervivencia y Pirámide. `recover_attempt`
  cierra un intervalo Alphabet abierto con `recovery_interrupted`, conserva el deadline global y
  permite resolver después los items pendientes sin reentregar contenido. En Supervivencia deriva
  vidas tras un timeout recuperado; en Pirámide un nivel temporizado interrumpido se evalúa como
  `unanswered` y termina reglamentariamente el ascenso. Narrativa mantiene esta política pendiente.

### S05 — Jugar Alfabeto con reloj global y vueltas reales

- **Objetivo / CU:** validar pronto el modelo temporal diferente; CU-15–CU-21 para Alfabeto.
- **UI:** `FlashPopAlphabetGame`, `useAlphabetSession`, `alphabetGame`, revisión por letra.
  Escenario mínimo de letras `short-text`; no migrar todas las preguntas temáticas a la vez.
- **Mocks retirados:** respuestas, tiempo, `lastCorrectAt` y resultado oficial calculados localmente
  para Alfabeto; peers inventados no se muestran en el recorrido real.
- **Backend/dominio:** validar respuesta corta/normalización y calcular puntos por item en servidor;
  pasar letra conserva intento y no crea respuesta final. Añadir vueltas/reconstrucción autorizada;
  tiempo total desde `global_time_limit_ms`, sin timer competitivo independiente por letra. Al
  recuperar antes del deadline, la letra visible se consume como pase por interrupción y se avanza.
- **Persistencia:** ampliar el motivo de cierre de `interaction_intervals` con
  `recovery_interrupted`, distinto de `pass`, sin añadir estado a `attempt_answers`. Al vencer:
  preparar cada pendiente sin nuevo payload, recibir timeout/evaluar y completar. Letras nunca
  visitadas aportan duración cero; visitas repetidas suman sus intervalos.
- **Tests:** pasar/volver, letra ya contestada, recuperación de letra visible antes del deadline con
  motivo auditable, cierre global durante evaluación o desconexión, timeout de todas las pendientes,
  `lastCorrectAt` fuera del desempate, checkpoint y bloqueo de segunda sesión.
- **Dependencias:** S04; D03 para Alfabeto y reconciliación `unanswered`/`timeout`.
- **Terminada:** implementada localmente. `public.get_my_alphabet_challenge` entrega solo letras,
  metadatos y payload público; `prepare_interaction` reconstruye el progreso y comparte el deadline;
  `pass_interaction` conserva las vueltas sin crear respuestas finales; timeout, evaluación y
  revisión terminal se resuelven por las rutas existentes. La solución solo aparece tras completar.

### S06 — Consultar los dos rankings reales

> Estado: implementada y verificada en local (2026-09-15).

- **Objetivo / CU:** comparar resultados guardados; CU-22 y CU-23.
- **UI:** ranking de sala, `RoomLeaderboard`, `FlashPopRoomRanking` y resumen de inicio/sala. Las
  filas Supabase son estáticas: no enlazan al detalle de miembro hasta S07.
- **Mocks retirados:** rankings de `MockRoomQueries`, peers sintéticos y fusiones de `localResults`
  para las vistas migradas; no borrar utilidades puras que sigan sirviendo a presentación/práctica.
- **Backend/dominio:** consultas mínimas por publicación/temporada. Ejecutar rankings con contexto
  `authenticated` autorizado o componer una lectura privada equivalente con autorización explícita;
  no ampliar EXECUTE para esquivar la identidad. Usar puntuación efectiva del libro de puntos.
- **Persistencia:** `get_challenge_ranking`, `get_season_ranking`, `effective_results`; no tabla
  de ranking ni saldo adicional.
- **Tests:** pgTAP para `1,1,3`, cero puntos, exmiembros con puntos, prueba fantasma,
  abandonados, invalidados y cancelados; duración sumada sin multiplicación por joins del ledger;
  aislamiento de salas y actualización tras finalizar en otro navegador.
- **Dependencias:** S03, S02. S05 amplía los escenarios, no bloquea esta slice.
- **Terminada:** SQL, integración Auth/PostgREST y E2E pasan; dos navegadores ven las mismas
  posiciones tras refrescar; temporada ordena solo por el total de puntos con posiciones
  compartidas y desafío usa puntos/duración/`startedAt`.

### S07 — Consultar historial, resultados y revisión después de volver

> Estado: implementada y verificada en local (2026-09-15).

- **Objetivo / CU:** reconstruir la competición Flash desde hechos persistidos; CU-20 y CU-24.
- **UI:** historial, detalle histórico, detalle de miembro y revisión de resultado; maneja ausencia
  de resultado propio y abandono. Las rutas reales usan UUIDs:
  `/salas/[roomId]/historial/[challengeId]` y
  `/salas/[roomId]/historial/[challengeId]/[memberId]`.
- **Mocks retirados:** `MockRoomQueries.listHistory/getHistoryDetail/getMemberDetail`, historial de
  fixtures y mezcla local de resultados para esos recorridos. La competición de Supervivencia y
  Pirámide usa persistencia S14/S15; Narrativa continúa mock.
- **Backend/dominio:** `RoomHistoryQueries` y `RoomMemberDetailQueries` delegan en
  `get_flash_history` y `get_flash_member_review`. El historial solo consolida publicaciones Flash
  `closed` sin intentos `in_progress`; conserva publicaciones sin participantes y excluye
  `test`, `invalidated` y `cancelled`. La revisión usa puntos y respuestas persistidos, sin
  recalcular resultados con el algoritmo actual.
- **Autorización:** el lector debe ser miembro activo, incluido `spectator`, para historial y
  rankings. La revisión propia terminal también está disponible para el jugador si ahora es
  `spectator`; revisar a otra persona, incluidas sus soluciones, exige `owner`, `admin` o `member`.
  Los intentos solo pueden ser `completed` o `abandoned`; los abandonos proyectan items sin respuesta
  como `unanswered`.
- **Persistencia:** reutiliza versiones enlazadas, intentos, respuestas, `effective_results` y los
  rankings existentes. No añade tablas de historial, rankings ni saldos materializados. Las nuevas
  funciones son `SECURITY DEFINER`, con `search_path = ''`, propiedad `postgres` y `EXECUTE` solo
  para `authenticated`.
- **Tests:** pgTAP para publicaciones elegibles/vacías/en curso/canceladas, conteos, `1,1,3`, cero
  puntos, antiguos miembros, versión archivada, revisión propia/ajena, abandonos parciales,
  aislamiento y ACL; Vitest para validación/agrupación; integración Auth/PostgREST y E2E tras
  refrescar con Alice, Bob spectator, Carol y Dave.
- **Dependencias:** S04 y S06; D04 sigue siendo necesario para abandono automático y consolidación
  futura, no para leer hechos ya cerrados.
- **Fuera de alcance:** no se añade `results_locked_at`, abandono automático ni takeover; tampoco
  revisión administrativa de `invalidated`. No se conecta ningún proyecto remoto de Supabase.
- **Terminada:** `npm run supabase:db:reset`, fixture/integración/E2E S07, `supabase:schema:test`,
  `npm test`, typecheck, lint, build y `docs:check` pasan; una sesión nueva reproduce historial,
  ranking y revisión desde DB sin memoria local.

### S08 — Crear una sala privada

- **Estado:** implementada y verificada sobre Supabase local el 2026-09-16. La slice cubre el
  primer comando de escritura del portal privado; no conecta ningún proyecto remoto.
- **Objetivo / CU:** dejar de aprovisionar salas y miembros beta a mano; CU-04 y provisioning
  directo de la beta.
- **Actor y superficie:** `superadmin` desde el portal privado de operación. No habrá acción «Crear
  sala» ni formulario de creación en la UI pública de la beta.
- **Mocks retirados:** listado fijo de salas como única vía de entrada. No se crea temporada demo.
- **Backend/dominio:** `SuperadminRoomCommands` separa el comando de las consultas. La Server
  Action vuelve a ejecutar `requireSuperadmin()`, resuelve emails exactos y delega en
  `public.create_superadmin_room(jsonb)`; la base vuelve a resolverlos dentro de una transacción.
  El título genera el slug server-side, con fallback `sala`, límite base de 64 caracteres y sufijos
  para colisiones. El portal asigna un `owner` inicial explícito y añade un grupo opcional de
  usuarios Auth activos con `admin`, `member` o `spectator`. El superadmin no se convierte por ello
  en miembro competitivo ni se simula una aceptación de invitación.
- **Persistencia:** `supabase/schemas/58_superadmin_room_commands.sql` y la migración incremental
  crean `lookup_superadmin_players`, `create_superadmin_room` y el comando privado transaccional.
  La sala nace `active`, con una única membresía `owner`, sin temporada, publicación ni invitación.
  La operación es idempotente por actor y clave: el mismo contenido devuelve el resultado original y
  otro contenido produce `idempotency_conflict`. Una única fila agregada de `private.audit_log`
  registra sala, propietario, roles, motivo y request id sin guardar emails.
- **Tests:** pgTAP cubre ACL, actor, validaciones, slug y colisiones, rollback, idempotencia,
  auditoría y ausencia de temporada/publicación/invitación; Vitest cubre adaptación estricta y
  errores; el escenario `s08` cubre Auth/PostgREST, grupo inicial, reintento y colisión; E2E cubre
  búsqueda exacta, creación, recarga y acceso denegado. La validación se ejecuta con la secuencia
  `db:reset`, fixture, integración, E2E, schema test y checks del proyecto.
- **Dependencias:** Portal privado, S02 y D02 para URLs; reglas confirmadas de CU-04 y membresías.
- **Fuera de alcance:** no hay gestión posterior de miembros, reactivación, cambio de roles,
  invitaciones, temporadas, publicaciones ni navegación administrativa en la UI pública.
- **Terminada:** un superadmin crea una sala, asigna propietario y provisiona al grupo desde el
  portal; tras recargar, los usuarios ven la sala según su rol, el alta no usa invitaciones y toda
  acción que afecta a la sala queda auditada.

### S09 — Crear, aceptar y revocar una invitación

- **Objetivo / CU:** conservar el flujo general de incorporación mediante invitación; CU-06 completo.
- **Alcance de beta:** esta slice no formará parte de la UI pública ni será necesaria para
  bootstrappear la beta. El superadmin añadirá o reactivará directamente usuarios autenticados desde
  el portal privado. La aceptación de invitación queda para una fase posterior o para una herramienta
  interna explícita.
- **UI futura:** gestión de invitaciones en una superficie privada; generar/copiar enlace, entrada de
  aceptación preservada durante login y estado de token no disponible. No requiere envío de correo.
- **Mocks retirados:** miembros predefinidos y botones de invitación deshabilitados para salas reales;
  el aprovisionamiento del escenario beta se hará mediante el portal privado.
- **Backend/dominio:** acciones separadas de emitir/revocar/aceptar. Autorizar rol concedible según
  D05/D06, generar secreto en servidor y evitar filtrarlo a logs/analytics/referrers. Redirigir a
  sala tras aceptación; miembro activo no consume otro uso, bloqueado no se reincorpora.
- **Persistencia:** reutilizar `accept_invitation`; nuevos comandos estrechos para emitir y revocar,
  hash y límites en `room_invitations`, membresía reactivable y auditoría.
- **Tests:** dos aceptaciones del último uso, expiración, revocación concurrente, reintento, rol
  `owner` rechazado, antiguo miembro conserva historial, `banned`, tercero que intenta administrar.
- **Dependencias:** S08, S01, D05 y D06.
- **Terminada:** fuera de la beta, un invitado inicia sesión, acepta y aparece en la sala; un enlace
  revocado/caducado no concede acceso. Las tres acciones tienen recorrido UI/backend/DB probado.

### S10 — Preparar y activar una temporada ✅ Implementada localmente

- **Objetivo / CU:** organizar un ciclo real en una sala nueva; CU-08 (configurar/consultar/activar).
- **Actor y superficie:** `superadmin` desde el portal privado de operación; no habrá formulario de
  preparación o activación en ajustes de la UI pública durante la beta. Las fechas se editarán en la
  zona de la sala.
- **Mocks retirados:** temporada activa única fija del store.
- **Backend/dominio:** comandos privados del portal para crear/editar borrador/activar; validar
  transiciones y UTC, devolver
  disponibilidad actualizada. Un miembro ordinario no recibe borradores por la consulta pública.
- **Persistencia:** comandos privados `create/update/activate` sobre `seasons` y auditoría; usa la
  unicidad de temporada activa. La activación explícita admite fechas futuras; la automatización
  temporal se conecta en S12.
- **Tests:** fechas inválidas, cambio horario de Madrid, dos activaciones concurrentes, permisos,
  edición de temporada terminal denegada y nuevo total de cero sin borrar la temporada anterior.
- **Dependencias:** S08 y D05.
- **Terminada:** implementada localmente. El superadmin crea/edita borradores y activa una temporada
  persistida desde el portal; la sala la muestra sin publicaciones ficticias, los borradores no se
  filtran a miembros y nunca hay dos temporadas activas.

### S11 — Publicar contenido mínimo desde una herramienta editorial ✅ Implementada localmente

- **Objetivo / CU:** producir un desafío jugable sin escribir SQL; CU-10 y preview editorial de CU-12.
- **Superficie:** si entra en la beta, será una pantalla interna exclusiva del portal de
  superadmin para cargar/editar una definición estructurada de Flash con los
  formatos ya migrados, validar, previsualizar y publicar. No construir un editor visual de 31 formatos.
- **Mocks retirados:** catálogo hardcodeado como única fuente publicable; fixtures permanecen como
  ejemplos de test, sin importar identidades ni intentos demo.
- **Backend/dominio:** autorizar al superadmin del portal (con futura delegación editorial si se
  habilita); validar JSON en ejecución, versiones técnicas,
  soluciones/revelaciones, orden, puntos y tiempos. Lista de capacidades evita publicar contenido
  no soportado. Preview editorial protegido, distinto de `/formatos` público.
- **Persistencia:** `supabase/schemas/59_superadmin_editorial_commands.sql` y su migración incremental
  implementan los comandos de borrador/publicación sobre las tablas versionadas existentes y
  auditoría; insertar primero borrador/soluciones/items y publicar con locks/validación atómica.
  No se crean tablas ni columnas nuevas.
- **Tests:** JSON inválido, versión técnica desconocida, secreto en payload público, suma distinta
  de 100, solución ausente, doble publicación, edición concurrente e inmutabilidad tras publicar.
- **Dependencias:** S03, D03 para contenido soportado y D05 editorial.
- **Terminada:** implementada localmente. Un superadmin crea, edita, previsualiza y publica desde
  `/admin` un Flash de 2 a 20 preguntas; el grafo versionado queda persistido e inmutable al
  publicar, el documento completo solo aparece en la lectura protegida y no se crean calendario,
  intentos, puntos ni actividad ficticia. La validación se ejecuta también en servidor y las
  mutaciones conservan idempotencia, concurrencia optimista, locks y auditoría segura. E01 amplía
  este contrato a desafíos mixtos `multiple-choice` + `mini-wordle` sin cambiar la regla de 50
  puntos por pregunta.

### S12 — Programar un desafío y ejecutar su calendario ✅ Implementada localmente

- **Objetivo / CU:** abrir/cerrar competición por fechas reales; CU-09 y transiciones temporales de CU-08.
- **Superficie:** calendario sencillo del portal privado de superadmin para versión/número/ventana;
  la sala pública solo muestra futuro, disponible y cerrado. Permitir reprogramación solo antes de
  abrir.
- **Mocks retirados:** la selección temporal del detalle real ya usa el calendario persistido; la ruta
  demo `/flash-pop` conserva explícitamente su recorrido mock.
- **Backend/dominio:** comandos de programación/reprogramación y transición temporal idempotente,
  con Route Handler protegido y `npm run calendar:tick`; las escrituras y `start_attempt` revalidan
  fechas aunque el tick se retrase. No se introduce una cola.
- **Persistencia:** tablas existentes, exclusión GiST, número único, estados y auditoría mediante
  comandos nuevos. Cerrar ventana no cancela intentos válidos ni fija prematuramente `results_locked_at`.
- **Tests:** instante exacto de apertura/cierre, dos publicaciones solapadas, transición repetida,
  proceso temporal caído/retrasado, edición después de abrir denegada, intento iniciado antes del
  cierre que finaliza después y nueva temporada sin mezcla de puntos.
- **Dependencias:** S10, S11, S03, D05 y decisión de mecanismo temporal; consolidación final en D04/S21.
- **Terminada:** implementada localmente. Un superadmin programa/reprograma Flash publicado desde
  `/admin`; el tick abre/cierra por reloj PostgreSQL, finaliza temporadas vencidas y el gameplay
  permite iniciar solo dentro de la ventana, preservando intentos ya iniciados.

### E01 — Mini-Wordle competitivo y persistido ✅ Implementada localmente

- **Objetivo / CU:** primer formato con eventos intermedios autoritativos dentro del Flash real;
  cada palabra válida recibe feedback del servidor y el intento final se evalúa desde los eventos.
- **Superficie:** Flash competitivo preparado por `/admin`; la biblioteca y el componente local de
  Mini-Wordle siguen siendo demos/práctica y no son fallback de una partida persistida.
- **Contrato:** payload público con prompt, pista, longitud 4/5 y máximo de intentos; solución
  privada con palabra normalizada, diccionario versionado y `additionalGuesses` específicos de la
  pregunta. Cada palabra válida pertenece al diccionario general o a esa lista privada; la propia
  solución también puede ser temática aunque no esté en el diccionario general. El portal admite
  mezclas de elección múltiple y Mini-Wordle, entre 2 y 20 preguntas con 100 puntos totales.
- **Persistencia:** `private.mini_wordle_guess_events` y
  `private.mini_wordle_dictionary_words`, RLS/grants/inventario explícitos, feedback SQL para
  letras repetidas y `private.submit_mini_wordle_guess(jsonb)` con lock, plazo, secuencia,
  idempotencia y una única recepción final.
- **Recuperación/UI:** `prepare`/`recover` devuelven solo progreso seguro; la UI competitiva no
  recibe solución ni carga el diccionario, conserva el tablero tras recarga y reusa la clave al
  reintentar una respuesta perdida.
- **Tests:** pgTAP para feedback, duplicados, unión diccionario/palabras específicas, conflictos,
  recepción única y versión; integración editorial/lectura, E2E de Auth real, recarga, error
  inválido, duplicado y reintento idempotente. `npm run verify:pilot` carga solo los diccionarios
  generales desde `public/dictionaries`; las palabras temáticas viajan únicamente en el payload
  privado del fixture.

### E02 — Logic-code competitivo y persistido ✅ Implementada localmente

- **Objetivo / CU:** segundo formato con eventos intermedios autoritativos; cada código numérico
  enviado se persiste y el cierre se produce únicamente al acertar o al resolver el timeout.
- **Contrato:** payload público con pregunta, entre 1 y 20 pistas `{ code, hint }` y `codeLength`
  entre 1 y 12; la solución y explicación permanecen privadas. Los ceros iniciales forman parte
  del valor y los códigos duplicados se rechazan sin penalización.
- **Persistencia:** `private.logic_code_attempt_events` y
  `private.submit_logic_code_attempt(jsonb)` con lock de intento, plazo, secuencia, idempotencia,
  unicidad por código y recepción terminal. `read_evaluation_context` reconstruye
  `submittedCodes` e `incorrectAttempts` desde los eventos, nunca desde el navegador.
- **Recuperación/UI:** `prepare` y recuperación devuelven solo códigos ya enviados y contador de
  incorrectos. La UI usa inputs numéricos por dígito, conserva el progreso tras recarga, informa
  únicamente código incorrecto/contador y reutiliza la misma clave tras una respuesta perdida.
- **Tests:** pgTAP para payload seguro, formato inválido, duplicados sin penalización, idempotencia,
  ceros iniciales y recepción única; integración editorial/lectura y E2E con Auth real, recarga,
  spectator y reintento idempotente.

### E03 — Progressive-clues competitivo y persistido ✅ Implementada localmente

- **Objetivo / CU:** entregar una primera pista gratuita y revelar las siguientes bajo demanda,
  conservando una única respuesta final y una puntuación dependiente de las pistas realmente
  concedidas.
- **Contrato:** el contenido editorial admite entre 1 y 20 pistas, penalización entera y
  `acceptedAnswers` normalizadas sin duplicados; la proyección jugable solo incluye metadatos y el
  prefijo de pistas ya revelado.
- **Persistencia:** `private.progressive_clue_reveal_events` registra índice, item, versión,
  penalización efectiva, puntos disponibles e idempotencia. `private.reveal_progressive_clue(jsonb)`
  usa locks de intento, versión optimista, plazo y solución congelada en PostgreSQL.
- **Recuperación/UI:** `prepare` registra la pista inicial de forma determinista; recarga y
  recuperación reconstruyen el prefijo desde eventos. La UI server-safe ofrece botón explícito,
  bloqueo, `aria-live`, contador N/M y reintento con la misma clave.
- **Evaluación:** `read_evaluation_context` obtiene `progressiveCluesRevealed` desde eventos y el
  evaluador aplica `max(0, item.points - penalty * (revealedClues - 1))` antes del multiplicador de
  velocidad; una respuesta incorrecta o timeout puntúa cero.
- **Tests:** pgTAP, unidad, integración editorial/lectura y E2E cubren secreto/pistas futuras,
  primera pista gratuita, escalado por puntos reales, recarga, idempotencia, versión obsoleta,
  spectator, cierre y revisión final.

### E04 — Matching competitivo y persistido ✅ Implementada localmente

- **Objetivo / CU:** validar una pareja por comando, devolver feedback inmediato y conservar crédito
  parcial aunque el tiempo termine.
- **Contrato:** el contenido admite 3–6 parejas con IDs y labels únicos, correspondencia uno a uno y
  solución exclusiva en `solutionPayload.matches`; el payload jugable nunca contiene `correctMatchId`.
- **Persistencia:** `private.matching_pair_events` guarda aciertos y fallos, secuencia, penalización,
  tiempos e idempotencia. `private.submit_matching_pair(jsonb)` serializa el intento, aplica locks y
  calcula el 10% de los puntos reales del item por fallo.
- **Recuperación/UI:** `prepare` entrega columnas públicas y progreso seguro; las parejas resueltas
  sobreviven a recargas, las tarjetas se bloquean y la UI ofrece feedback `aria-live` y reintento de
  solicitudes cuya respuesta se perdió.
- **Evaluación:** el contexto server-side reconstruye únicamente las parejas correctas y el contador
  de fallos persistidos; `evaluateMatching` conserva crédito parcial, aplica penalización acumulada
  y conserva ese progreso en timeout.
- **Tests:** pgTAP, unidad, integración y E2E cubren publicación mixta, secreto, fallos, duplicados,
  tarjetas resueltas, idempotencia, versión obsoleta, recarga, timeout, spectator y revisión final.

### S13 — Subir y sustituir el avatar global — implementada localmente

- **Objetivo / CU:** completar CU-02 con archivo persistido.
- **UI:** `FlashPopProfileDialog`, `Avatar`, perfiles sociales; progreso/error y confirmación de guardado.
- **Mocks retirados:** data URL de `FileReader` como avatar definitivo; preview local sigue siendo UX.
- **Backend/dominio:** validar archivo real, tamaño y tipo; autorizar subida y asignación de ruta al
  propio jugador. La firma de subida no permite elegir propietario. Devolver perfil/URL de lectura
  autorizada y revalidar proyecciones.
- **Persistencia:** bucket público de lectura/políticas Storage y comando limitado de
  `players.avatar_path`. Guardar ruta estable, no URL firmada. Subir primero, confirmar referencia y limpiar huérfanos con
  compensación/reintento; Storage y PostgreSQL no comparten transacción.
- **Tests:** subida/cambio/recarga, tipo falsificado, asset ajeno, Storage caído, fallo de DB tras
  subida, limpieza que no borra el avatar nuevo y permisos de lectura entre salas.
- **Dependencias:** S01 y D08.
- **Terminada:** el avatar aparece en las proyecciones autorizadas tras una nueva sesión y los fallos
  parciales no dejan una referencia rota ni permiten modificar archivos de terceros.

## 6. Slices de formatos: una entrega por fila

Los 31 formatos no se migran mediante una sustitución masiva de tipos. S03 cubre `multiple-choice`
y S05 cubre `short-text`. Las siguientes 29 slices completan el inventario. Seleccionar primero los
formatos necesarios para un desafío de validación; después ampliar el catálogo.

### F01–F19 — Formatos con una respuesta final verificable

Ficha común, obligatoria para **cada** F*:

- **Objetivo / CU:** jugar el formato indicado dentro de un Flash real; CU-17, CU-20 y conservación
  de CU-13. Un desafío pequeño con ese formato es la demostración vertical.
- **UI:** `components/questions/formats/<formato>`, `QuestionInput`, renderer/revisión y ficha de
  biblioteca. Adaptar props a `PublicQuestion`; no reconstruir una pregunta con solución en cliente.
- **Mocks retirados:** payload completo, evaluación y resultado local competitivos de ese formato;
  sus ejemplos públicos de práctica siguen siendo locales y repetibles.
- **Backend/dominio:** validador de contenido/respuesta y adaptador privado para el evaluador del
  registry. Verificar la solución o reproducir la secuencia enviada cuando corresponda. Si una
  penalización necesita eventos que una respuesta final no demuestra, extender esa slice con el
  protocolo E*; no confiar en contadores del navegador.
- **Persistencia:** versiones/items/recepciones/respuestas existentes. Sin nueva tabla por formato;
  declarar cambios JSON de forma versionada si hacen falta. Conservar solo el progreso necesario
  para reanudar, y derivar el resultado en servidor.
- **Tests:** validador, scoring real, respuesta manipulada, duplicado, timeout, recuperación,
  ausencia de solución y E2E de juego/resultado/revisión. Añadir los casos específicos de la fila.
- **Dependencias:** S03 y S04; D03 para ese formato. S11 si se usa el editor; antes basta fixture
  de integración. Ninguna F* depende de terminar todas las demás.
- **Terminada:** el formato se puede habilitar en la lista de capacidades y jugar tras recarga sin
  scoring cliente; pruebas de práctica existentes siguen pasando.

| Slice | Formato                | Adaptación y prueba específica que cierra la ficha                                                                                                                                                                                                                                     |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01   | `true-false`           | **Implementado localmente.** Booleano estricto; no interpretar cadenas arbitrarias como verdadero.                                                                                                                                                                                     |
| F02   | `odd-one-out`          | **Implementado localmente.** Selección perteneciente a los items publicados; preservar medios sin solución.                                                                                                                                                                            |
| F03   | `estimation`           | **Implementado localmente.** Número finito, rango/paso/unidad; tolerancia privada, crédito parcial y media privada opcional.                                                                                                                                                           |
| F04   | `heat-map`             | **Implementado en código.** Superficie privada v2, coordenadas normalizadas, radios privados y precisión espacial server-side; pgTAP/E2E quedan como puerta de cierre.                                                                                                                 |
| F05   | `image-labeling`       | Dos variantes `assign-all`/`identify-one`; asociaciones privadas, texto/elección y crédito parcial.                                                                                                                                                                                    |
| F06   | `ordering`             | **Implementado localmente.** Permutación válida sin omitir/duplicar items; timeout y revisión del orden.                                                                                                                                                                               |
| F07   | `classification`       | **Implementado localmente.** Labels/categorías válidos, asignaciones parciales y claves privadas excluidas.                                                                                                                                                                            |
| F08   | `logic-matrix`         | **Implementado localmente.** Matriz pública v1 sin solución, respuesta final server-side, penalización del 20 %, recuperación conservando la interacción abierta, revisión terminal protegida y E2E competitivo con idempotencia.                                                      |
| F09   | `mini-sudoku`          | Tablero consistente con pistas fijas y tamaño; validar solución/timeout privado.                                                                                                                                                                                                       |
| F10   | `mini-nonogram`        | Dimensiones y celdas; no incluir tablero resuelto en el cliente.                                                                                                                                                                                                                       |
| F11   | `sliding-puzzle`       | El componente actual recibe `solution`; sustituirlo. Validar movimientos alcanzables si cuentan para score.                                                                                                                                                                            |
| F12   | `anagram`              | **Implementado localmente.** Consumo válido de fichas, normalización de respuesta y solución privada.                                                                                                                                                                                  |
| F13   | `error-reconstruction` | Paso y corrección válidos, incluida variante sin corrección; borrador parcial persistido cuando aplique.                                                                                                                                                                               |
| F14   | `connect-pairs`        | Reproducir rutas ortogonales, símbolos, solapamientos/cobertura; parcial en timeout sin rutas solución.                                                                                                                                                                                |
| F15   | `time-maze`            | Reproducir recorrido legal hasta salida; no confiar en una bandera cliente de llegada.                                                                                                                                                                                                 |
| F16   | `zip`                  | **Implementado localmente.** Payload público v1 sin solución, recorrido local con checkpoints, respuesta final/draft de timeout, evaluación server-side, revisión protegida, validación de solución única e integración E2E sin fallback mock.                                         |
| F17   | `pipes`                | Rotaciones válidas y conectividad desde origen; no aceptar solo `completed: true`.                                                                                                                                                                                                     |
| F18   | `escape`               | **Implementado y verificado localmente.** Payload público v1 sin solución, movimientos locales, draft de timeout, replay server-side, revisión protegida, helper SQL inmutable y E2E 3/3 sobre fixture limpio; el cierre queda acotado al stack local hasta validar un entorno remoto. |
| F19   | `word-hashtag`         | **Implementado y verificado localmente.** Payload público v1 sin solución, swaps validados server-side, progreso en `attempts.progress_payload`, límite terminal, timeout recuperable, evaluación/scoring server-side, revisión protegida e E2E 3/3 sobre fixture limpio.              |

### E01–E10 — Formatos con eventos, penalizaciones o revelaciones

Ficha común, obligatoria para **cada** E*:

- **Objetivo / CU:** completar una interacción que necesita respuestas parciales del servidor sin
  revelar toda la solución; CU-16, CU-17, CU-20 y práctica CU-13 preservada.
- **UI:** componente del formato, `QuestionInput`, hooks de progreso/feedback y revisión. Mostrar
  latencia/reintento sin duplicar acciones aceptadas.
- **Mocks retirados:** secretos y contadores/historiales autodeclarados como autoridad; revelaciones
  locales ilimitadas o comprobaciones privadas en navegador para el formato migrado.
- **Backend/dominio:** operaciones tipadas de interacción (no un dispatcher SQL público), validación
  de estado/orden/plazo y feedback permitido. El servidor concede una revelación o registra un evento
  antes de devolverlo. No basta recibir al final una lista de errores que el jugador puede omitir.
- **Persistencia:** extender con el mínimo registro privado de eventos/checkpoint y comandos
  autorizados/idempotentes que necesite la primera slice; reutilizarlo solo si sirve a las siguientes.
  Mantener una recepción/respuesta final por item y vincular la evaluación a eventos aceptados.
  Cambios de esquema/ACL/inventario se entregan junto al formato, no en una fase horizontal previa.
- **Tests:** E2E evento → feedback → siguiente acción → cierre → revisión; replay/reordenación de
  eventos, contador falsificado, evento tardío, respuesta HTTP perdida y bloqueo de segunda sesión
  entre eventos.
  Probar también las particularidades de cada fila y el límite de tamaño/frecuencia.
- **Dependencias:** S04 y D03; D08 cuando hay assets privados. E01 es el experimento inicial sugerido;
  el resto no depende de terminar todos los formatos simples.
- **Terminada:** reiniciar navegador/proceso conserva revelaciones, penalizaciones y plazos;
  ningún resultado depende de secretos ni contadores confiados al cliente. Capacidad habilitada
  únicamente tras demostrar su recorrido completo con contenido real persistido.

| Slice   | Formato             | Backend/persistencia y criterio específico adicional                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01     | `mini-wordle`       | **Implementado localmente.** Primer patrón de eventos: registrar cada palabra válida y devolver colores sin solución; cada palabra procede del diccionario general o de `additionalGuesses` privados de la pregunta, con solución temática implícita permitida. Longitud 4–5 y máximo de intentos verificados en servidor. No aceptar una historia final fabricada ni consumir intentos duplicados. |
| E02     | `logic-code`        | **Implementado localmente.** Registrar cada código y su penalización; validar secreto privado, formato, plazo, secuencia e idempotencia; rechazar duplicados sin penalización, conservar intentos tras recarga y cerrar al acertar con evaluación server-side.                                                                                                                                      |
| E03     | `progressive-clues` | **Implementado localmente.** Entregar la primera pista gratis y las siguientes mediante comando transaccional; persistir eventos privados, no enviar pistas futuras ni confiar en `revealedClues`, ajustar penalización con los puntos reales del item y recuperar tras recarga.                                                                                                                    |
| E04     | `matching`          | **Implementado localmente.** Comprobar cada asociación con feedback inmediato; conservar fallos y parejas correctas en eventos privados, aplicar 10% por error, recuperar tras recarga y evaluar timeout con crédito parcial sin `correctMatchId` público.                                                                                                                                          |
| E05     | `queens`            | **Implementado localmente.** Persistir cada colocación/retirada como evento privado; calcular conflictos y penalización del 5% server-side, recuperar el tablero sin marcas X y cerrar automáticamente al resolver las cinco regiones. La solución solo aparece en la revisión autorizada.                                                                                                          |
| S05     | `alphabet`          | **Implementado localmente.** Publicar desafíos Alphabet con referencias `short-text`, reloj global, vueltas y pases; persistir intervalos y respuestas mediante los comandos existentes, reconstruir progreso/timeout server-side y exponer soluciones solo en revisión terminal autorizada.                                                                                                        |
| E06     | `word-search`       | **Implementado localmente.** Validar selecciones contra celdas/objetivos privados; registrar fallos y hallazgos, recuperar desde eventos, cerrar al encontrar todos los objetivos y evaluar crédito parcial sin penalización. La solución solo aparece en revisión terminal autorizada.                                                                                                             |
| E07     | `memory-pairs`      | Revelar solo losetas solicitadas, registrar selecciones/parejas/fallos y plazos; no entregar `pairId`, asociaciones ni contenido oculto completo.                                                                                                                                                                                                                                                   |
| E08     | `flash-memory`      | Presentación autorizada temporal y fase de respuesta separadas; checkpoint no vuelve a conceder una fase de memoria gratuita. Definir qué datos necesariamente vistos pueden conservarse.                                                                                                                                                                                                           |
| E09     | `simon-sequence`    | Secuencia visible solo en fase autorizada y registro de su entrega; impedir reiniciar presentación/reloj con recarga. Respuesta final evaluada en servidor.                                                                                                                                                                                                                                         |
| E10     | `progressive-image` | **Implementado localmente con D08b.** Flash competitivo mixto con `assetId` privado y solución separada; el editor confirma el objeto, `prepare` inicia el reloj y resuelve una URL firmada temporal, y la recuperación la reemite sin cambiar `presentedAt`/`deadlineAt`. El cliente sigue aplicando blur/scale CSS y no se promete ocultación criptográfica.                                      |
| D08b-MC | `multiple-choice`   | **Implementado localmente con D08b.** La biblioteca editorial guarda `publicPayload.media.assetId` en v2; el runtime competitivo lo autoriza por intento, emite `media.src` firmada y el cliente server-rendered muestra la imagen sin exponer el assetId.                                                                                                                                          |

Para E08–E09, el SQL actual inicia el reloj al preparar la interacción, mientras el prototipo espera
a presentación/carga en algunos formatos. D03 debe fijar fase preparatoria, presentación y respuesta;
si exige modificar el protocolo temporal, hacerlo solo en esa slice con migración y pruebas. Una vez
entregada legítimamente una imagen/secuencia no puede impedirse que el jugador la conserve; el
criterio es cumplir la política de entrega, no prometer que el navegador olvide información recibida.

E10 fija ese contrato para `progressive-image`: la carga/error nunca pausa ni reinicia el plazo,
no existe comando de revelación intermedia y la revisión terminal usa `solutionAlt` y el porcentaje
derivado de `timeUsed`. Con D08b, la imagen no será públicamente accesible antes de un contexto
autorizado, pero quedará accesible en el navegador después de la entrega.

## 7. Otros modos y operación del producto

### S14 — Supervivencia con vidas y finalización autoritativas ✅ Implementada localmente

- **Objetivo / CU:** CU-15–CU-21 para `survival`, incluyendo eliminación reglamentaria.
- **UI:** `FlashPopSurvivalGame`, `useSurvivalSession`, resultado de supervivencia.
- **Mocks retirados:** vidas, eliminación, score y ranking local como hechos oficiales.
- **Backend/dominio:** el editor acepta `survival` y `modeConfig.lives` de 1 a la cantidad de
  preguntas; el publicador limita las preguntas a los formatos con evaluador competitivo y bloquea
  `short-text`. El servidor deriva vidas desde evaluaciones persistidas, incluidos errores de
  Matching/Queens, elimina o completa al alcanzar el terminal reglamentario y calcula los puntos.
- **Persistencia:** lecturas competitivas entregan metadatos y posiciones sin soluciones. La
  recuperación convierte una interacción abierta sin respuesta en `unanswered`; `complete_attempt`
  rechaza cierres prematuros y deriva `eliminated`/`survived`, score y acreditación desde respuestas.
  Las lecturas de resultado y revisión exigen al miembro dueño del intento terminal.
- **Tests:** reglas puras, PgTAP de publicación/ACL, evaluación, vidas, recuperación, cierres e
  idempotencia; integración Auth de portal/calendario/proyecciones; E2E de recarga, eliminación,
  revisión y ranking. Checks focalizados ejecutados sin `verify:pilot`.
- **Dependencias:** S04 y D03; únicamente las F*/E* del desafío seleccionado.
- **Terminada:** sobrevivir o ser eliminado produce `completed`; dejar la partida produce abandono
  solo mediante la operación explícita. No quedan vidas, eliminación ni resultados oficiales en
  estado cliente. Verificación local/CI únicamente; no hay proyecto remoto enlazado.

### S15 — Pirámide con niveles persistidos

**Estado 2026-09-23:** implementada y verificada en Supabase local. Pasan schema/pgTAP con 45
archivos declarativos, integración Auth/PostgREST/RLS, migración incremental y E2E focal. No hay
proyecto remoto vinculado, así que no se declara despliegue ni validación remota.

- **Objetivo / CU:** CU-15–CU-21 para `pyramid`.
- **UI:** cliente competitivo server-backed de Pirámide, `useServerFlashSession`, briefing, nivel y revisión.
- **Mocks retirados:** `PyramidAttemptRecord`/`localStorage` como autoridad competitiva y resultado
  social local. Conservar el almacenamiento de práctica si sigue teniendo utilidad explícita.
- **Backend/dominio:** reutilizar reglas puras competitivas de Pirámide; validar nivel esperado,
  transición briefing/pregunta y final temprano; `summit`/`failed` son outcome, ambos `completed`.
- **Persistencia:** unidades de scope `level`, respuestas por item y checkpoint de fase, comandos
  de preparación/evaluación/cierre. No inventar un deadline global ni cortar por `closes_at` un
  intento ya válido. Respuesta con nivel/estado/resultado confirmado.
- **Tests:** siete niveles, fallo/timeout en primero e intermedio, recuperación durante briefing
  (reanuda) y durante un nivel iniciado (lo falla y completa), manipulación del nivel, recarga y
  revisión de niveles realmente alcanzados según D07.
- **Dependencias:** S04, D03 y formatos usados; no requiere migrar todo el catálogo.
- **Terminada:** el ascenso se reanuda solo desde la sesión original antes de comenzar un nivel; una
  interrupción de nivel lo falla reglamentariamente, nunca se muestra como abandono ni concede otra
  oportunidad.

### S16 — Narrativa con escenas y epílogo persistidos

- **Objetivo / CU:** CU-15–CU-21 para `narrative`.
- **UI:** `NarrativeGameApp`, `useNarrativeSession`, escenas, reacciones y epílogo.
- **Mocks retirados:** índice/fase narrativa y finalización local como fuente de verdad.
- **Backend/dominio:** validar avance de escena con checkpoint específico; preparar pregunta solo
  en su paso, excluir lectura de escenas del tiempo de respuesta y no revelar soluciones mediante
  reacciones. Reconciliar el final en epílogo con el guard SQL que comprueba respuestas, no escenas.
- **Persistencia:** configuración narrativa versionada, checkpoint validado y comando de avance
  si es necesario; respuestas y cierre existentes. DTO con siguiente paso permitido.
- **Tests:** recarga en escena/pregunta/epílogo, recuperación de pregunta activa como `unanswered`
  con reacción aplicable, salto de pasos, timeout, evaluación pendiente, escena sin consumo de
  tiempo de pregunta y cierre prematuro denegado.
- **Dependencias:** S04, D03 y formatos elegidos.
- **Terminada:** la historia retoma escenas y epílogo aceptados, pero no vuelve a presentar una
  pregunta temporizada abierta; termina tras su secuencia reglamentaria y conserva una revisión
  reproducible de la versión jugada.

### S17a — Biblioteca editorial y reutilización de preguntas ✅ Implementada y verificada localmente

- **Objetivo / CU:** CU-10 y CU-11; separar documento standalone de pregunta, versión publicada e
  inclusión contextual en un desafío.
- **Superficie:** sección «Preguntas» en `/admin`, filtros por texto/formato/tags/estado, historial,
  preview protegido, editor JSON y selector de versiones publicadas desde el editor Flash.
- **Backend/dominio:** comandos auditados e idempotentes `get/create/update/publish/archive`; solo
  superadmin; editar una publicada crea otra versión; publicar un desafío exige preguntas publicadas
  y no publica preguntas implícitamente.
- **Persistencia:** se conservan `question_definitions`, `question_versions`,
  `question_version_solutions` y `challenge_items`; solo se añade el índice único
  `(challenge_version_id, question_version_id)`.
- **Compatibilidad:** los documentos inline históricos se siguen leyendo; las nuevas inclusiones usan
  `{ source: "library", questionVersionId, points, modeConfig, challengeItemId? }`.
- **Verificación:** typecheck, Vitest, reset local, migración incremental, PgTAP y concurrencia están
  ejecutados sobre el stack Supabase/Docker local.

### S17 — Corregir contenido creando otra versión y archivar

- **Objetivo / CU:** CU-11 y ampliación editorial de CU-10.
- **Superficie:** herramienta privada del portal de superadmin, integrada con S11, para duplicar
  versión, comparar, publicar y archivar.
- **Mocks retirados:** edición directa del fixture como única vía para corregir contenido real.
- **Backend/dominio:** conservar versión usada, crear borrador nuevo, validar y publicar; archivo
  autorizado sin permitir borrar referencias históricas. Responder con nueva versión seleccionable.
- **Persistencia:** comandos sobre definiciones/versiones existentes; no mutar items/soluciones
  publicados. Archivado permitido por guards actuales, auditoría y nuevas publicaciones separadas.
- **Tests:** mismo desafío en dos salas, corrección posterior y revisión anterior intacta; edición
  in situ rechazada; versión archivada usada sigue resolviéndose; publicación concurrente.
- **Dependencias:** S11, S07 y D05.
- **Terminada:** una corrección afecta solo a publicaciones que eligen la nueva versión; los puntos
  y respuestas históricos no se recalculan.

### S18a — Salir de la sala y transferir propiedad

- **Objetivo / CU:** parte de CU-07: salida propia y transferencia.
- **Superficie:** portal privado de superadmin para transferencias y cambios administrativos; no
  habrá acciones públicas de gestión en ajustes durante la beta. La actualización de «Mis salas» sí
  se refleja en la UI pública después de la operación.
- **Mocks retirados:** acciones deshabilitadas y membresías fijas en estos flujos.
- **Backend/dominio:** salida normal; si sale owner, sucesor según antigüedad admin/member o exigir
  alternativa válida. Transferencia explícita autorizada; nunca dejar sala activa sin owner.
- **Persistencia:** comando transaccional sobre sala/membresías con orden de locks coherente con
  invitaciones, auditoría; no borrar intentos/puntos. Devolver navegación/acceso actualizado.
- **Tests:** transferencias concurrentes, salida del único elegible rechazada, nuevo propietario
  coherente, pérdida de acceso inmediata e historial/puntos preservados.
- **Dependencias:** S08, S09 y D05. El borrado lógico alternativo se entrega en S18c.
- **Terminada:** un miembro sale y deja de acceder; un owner transfiere/sale sin romper propiedad.

### S18b — Administrar roles, expulsión y bloqueo

> Estado: parcialmente implementada y verificada en local. La nomenclatura histórica del test SQL es
> `s17_room_membership_commands.test.sql`; conceptualmente pertenece a S18b.

- **Objetivo / CU:** resto de membresías de CU-07 según matriz aprobada.
- **Superficie:** ajustes de sala con acciones del owner y errores de conflicto. La UI permite
  conceder/quitar admin y eliminar lógicamente miembros; el resto de operaciones sigue pendiente.
- **Mocks retirados:** roles/estados inmutables de demo y controles deshabilitados correspondientes.
- **Backend/dominio:** operaciones explícitas `grant_admin`, `revoke_admin` y `remove`, solo para el
  owner activo; revalidar permisos al escribir. No permitir actuar sobre el owner, sobre uno mismo ni
  autoconcederse owner/superadmin. Transferencia, bloqueo/desbloqueo e invitaciones completas quedan
  para slices posteriores.
- **Persistencia:** `public.manage_room_member(jsonb)` delega en el comando privado, con locks,
  idempotencia y auditoría; la eliminación es lógica y conserva el histórico. DTO de miembro
  actualizado y revalidación de accesos.
- **Tests:** matriz actor/objetivo, idempotencia, auditoría, owner/admin, eliminación lógica y
  actualización de `member_previews` en las tarjetas de sala.
- **Dependencias:** S08 y D05. S18a, bloqueo/desbloqueo e invitaciones completas siguen pendientes.
- **Terminada parcialmente:** cada acción habilitada tiene autorización de servidor y sus efectos se
  reflejan en la siguiente lectura; no se declara cerrada la matriz completa de CU-07.

### S18c — Eliminar lógicamente una sala y recuperarla

- **Objetivo / CU:** ciclo de sala asociado a CU-07, incluida alternativa del único owner.
- **Superficie:** portal privado de superadmin con confirmación de eliminación y herramienta
  autorizada de recuperación; no se expone en ajustes públicos.
- **Mocks retirados:** ausencia de transición real de sala y entradas permanentes del listado demo.
- **Backend/dominio:** autorizar borrado lógico/recuperación con D05/D09; definir efecto en intentos
  activos y conflictos con calendario antes de habilitar. No ejecutar purga irreversible aquí.
- **Persistencia:** `rooms.status/deleted_at`, propiedad coherente y auditoría mediante comandos
  nuevos; referencias históricas conservadas. Respuesta sin acceso ordinario a la sala eliminada.
- **Tests:** denegación posterior de lectura/escritura, reintento, recuperación dentro de política,
  ownership válido y carreras con salida/inicio.
- **Dependencias:** S18a, D05 y D09.
- **Terminada:** sala eliminada deja de ser accesible y puede recuperarse por la vía prevista sin
  perder resultados. La purga queda como operación futura separada bajo D09.

### S19 — Cancelar competición y cerrar temporadas de forma controlada

- **Objetivo / CU:** cancelación administrativa de CU-08/CU-09.
- **Superficie:** calendario privado del portal de superadmin con motivo; la UI pública solo muestra
  estados de cancelación separados del historial ordinario.
- **Mocks retirados:** estados cancelados solo representados por fixtures.
- **Backend/dominio:** cancelar publicación o temporada según D05, conservar intentos y detener
  nuevos envíos/inicios según política. El cierre normal no es cancelación. Precisar cómo terminar
  intentos activos afectados y cómo una temporada cancelada afecta sus publicaciones/resultados.
- **Persistencia:** comandos transaccionales y auditoría sobre estados existentes. SQL filtra
  publicaciones canceladas; validar expresamente la semántica de temporada cancelada, que no se
  resuelve solo cambiando `seasons.status`. No reescribir respuestas ni score original.
- **Tests:** cancelación concurrente con inicio/recepción/acreditación, exclusión de ambos rankings,
  conservación del ledger e historial auditable; reintento y cierre normal con intentos válidos.
- **Dependencias:** S12, S06, S07 y D05.
- **Terminada:** cancelar desde UI produce el estado y exclusión competitiva acordados de forma
  consistente; un cierre normal mantiene los resultados legítimos.

### S20 — Inspeccionar y corregir un resultado con auditoría

- **Objetivo / CU:** CU-25.
- **Superficie:** pantalla interna del portal privado de superadmin para inspección por intento y
  acción de ajuste/invalidación con motivo.
- **Mocks retirados:** correcciones simuladas o modificación manual de fixtures/resultados.
- **Backend/dominio:** comprobar superadmin real; consulta de inspección mínima auditada; conectar
  `adjust_result`/`invalidate_attempt`. Separar score original de saldo efectivo y de revisión visible.
- **Persistencia:** comandos existentes de ajuste/reversión y auditoría; añadir lectura privilegiada
  limitada cuando haga falta. Nunca sobrescribir respuesta ni acreditación original.
- **Tests:** rol falsificado, motivo vacío, cero puntos, ajuste repetido, corrección concurrente con
  invalidación, rollback de auditoría, originales intactos y rankings actualizados.
- **Dependencias:** S06, S07, D05 y D07 para inspección/invalidados.
- **Terminada:** un operador corrige/invalida con trazabilidad; jugadores ordinarios no pueden
  invocar esa operación y las proyecciones muestran el saldo efectivo correcto.

### S21 — Resolver inactividad y consolidar publicaciones

- **Objetivo / CU:** abandono automático de CU-19 y cierre definitivo de CU-09/CU-24.
- **UI:** estado de conexión/recuperación y terminal confirmado por servidor; señales del navegador
  como ayuda. No mostrar abandono definitivo solo por `offline`/`visibilitychange`.
- **Mocks retirados:** suposición de sesión indefinida/local como política de actividad.
- **Backend/dominio:** implementar exactamente D04: actividad, gracia y resolución de la carrera
  respuesta/timeout/abandono. Proceso protegido y reintentable con actor de sistema explícito;
  no fabricar claims de un usuario para llamar al comando de abandono actual.
- **Persistencia:** ampliar con lease/actividad solo si la decisión lo requiere; comando de sistema
  con permisos mínimos y auditoría; conservar recepciones pendientes. Consolidar `results_locked_at`
  cuando ya no queda intento válido que pueda modificar la clasificación ordinaria.
- **Tests:** pestaña cerrada sin beacon, partición de red, reloj cliente cambiado, heartbeat tardío,
  doble ejecución del proceso, evaluación ya recibida antes del corte, intento sin deadline global,
  cero participantes y publicación cerrada con intento aún válido.
- **Dependencias:** S04, S07, S12 y D04 aprobada. No es requisito técnico para probar S03 localmente.
- **Terminada:** el servidor confirma terminales/consolidación de forma reproducible sin depender
  de un navegador abierto; no queda ambigüedad entre timeout, `expired` y `abandoned`.

### S22 — Operar el alcance elegido y retirar mocks de producción

- **Objetivo / CU:** validar el recorrido completo de la versión que se va a ofrecer, incluidos
  fallos de servicios. Es una slice de salida operativa; sus controles se ejecutan también en H3.
- **UI:** errores útiles/reintento, estados sin datos y navegación de todas las capacidades activadas.
- **Mocks retirados:** composición mock de rutas de producto, overlays de `RoomSessionProvider` y
  `localResults`, aliases de fixtures y demos competitivas accesibles por bypass. Tests, biblioteca
  pública y demos explícitas pueden conservar mocks; no borrar algoritmos por su nombre `demoSocial`.
- **Backend/dominio:** selección de entorno inequívoca, límites de petición/frecuencia, errores
  estables, correlación de request/intento/receipt sin secretos, recuperación operativa y health check
  privado. Revisar que no exista transporte genérico de evaluación/claims del cliente.
- **Persistencia:** aplicar migraciones/inventario en entorno objetivo con rol creador correcto;
  comprobar pool, backup/restauración ensayada, compatibilidad de despliegue y procedimiento de
  rollback de app que no destruya datos. Retención según D09; scheduler solo para tareas usadas.
- **Tests:** E2E desde cuenta nueva a resultado/ranking/historial, dos usuarios/salas, CSRF/origen en
  mutaciones con cookies, límites, Auth/DB/Storage caídos, despliegue con intento activo, restauración,
  inventario de permisos real y ausencia de secretos en red/assets. CI prueba el stack real además
  de pgTAP con Auth simulado; medir consultas con datos representativos antes de optimizar.
- **Dependencias:** para piloto, portal privado, S01–S04/S06/S07, S08, S10–S12 y decisiones de
  alcance; para V1 operable, S19 y S21 o restricciones expresamente aceptadas. S09, S13 y F*/E*/modos
  solo son necesarios si se ofrecen.
- **Terminada:** el entorno reconstruido ejecuta todo el alcance declarado con persistencia real,
  pruebas repetibles y recuperación documentada; ninguna ruta activada vuelve a mock al fallar.

**Implementación S22 en este repositorio:** el scope `pilot` es fail-closed y se selecciona mediante
`FLASH_RUNTIME_SCOPE`; `/desafios` roomless y aliases mock no atraviesan la frontera persistida. Las
mutaciones competitivas tienen request IDs, errores estables, límite de cuerpo, Origin obligatorio,
rate limit y respuestas `no-store`. Existe health privado en `/api/internal/health`, logs JSON
redactados y `npm run verify:pilot` para reconstruir Supabase local, probar escenarios por separado,
ejecutar E2E y ensayar backup/restore. El alcance sigue siendo local/CI: no declara staging o
producción remota, integración de `question-assets` en otros formatos, otros modos, abandono automático,
takeover ni `results_locked_at`. El 2026-09-22, `npm run verify:pilot` completó correctamente
la matriz local de portal, S02, S03, E01–E06, F08, S04, S06, S07 y S10–S12, incluidos sus fixtures,
integraciones y E2E, además de layout, diccionario y backup/restore.

### S23 — Ejecutar una prueba fantasma interna

- **Objetivo / CU:** CU-26 y parte privilegiada de CU-12; separado del preview público.
- **UI:** herramienta interna para lanzar/ver una prueba de contenido identificado.
- **Mocks retirados:** simulación de superadmin como demostración suficiente de no contaminación.
- **Backend/dominio:** autorización/auditoría explícita según D05; flujo de prueba distinto del
  competitivo. No añadir `kind: test` aceptado libremente a `start` de jugadores.
- **Persistencia:** SQL permite estructuralmente `test`, pero los comandos actuales exigen
  competición; crear las operaciones mínimas para este recorrido sobre entidades existentes.
- **Tests:** mismo operador prueba varias veces sin consumir intento oficial; ninguna acreditación,
  ranking, participación ni actividad ordinaria; jugador normal denegado.
- **Dependencias:** S11, S20 y D05.
- **Terminada:** una prueba produce evidencia recuperable y auditable, sin efectos competitivos.

### S24 — Anonimizar cuenta preservando resultados

- **Objetivo / CU:** CU-03 (futuro en la especificación); adelantar si la salida operativa lo exige.
- **UI:** solicitud/confirmación explícita, resultado del proceso y cierre de sesión.
- **Mocks retirados:** estado anonimizado solo simulado en fixtures.
- **Backend/dominio:** coordinar identidad, ownership pendiente, intentos activos, perfil y avatar
  según D09; operación propia o administrativa autorizada. Proceso idempotente y recuperación de
  fallos entre Auth, PostgreSQL y Storage.
- **Persistencia:** reutilizar guard de `players` y referencias históricas; comandos mínimos y
  compensaciones para servicios externos. No borrar en cascada respuestas/ledger ni purgar sin política.
- **Tests:** reintento, fallo entre servicios, propietario único, datos personales inaccesibles,
  antiguo token, avatar retirado y ranking histórico con participante anonimizado.
- **Dependencias:** S13, S18a, D09 y decisiones explícitas de recuperación/purga.
- **Terminada:** la identidad personal deja de dar acceso y los resultados permanecen coherentes,
  sin assets personales accesibles ni operaciones parciales sin vía de recuperación.

## 8. Contrato técnico del primer loop y recuperación

S03/S04 deben implementar esta secuencia; no concentrar todo el juego en una transacción larga:

1. **Inicio:** tras confirmación/cuenta atrás, verificar actor, crear/recuperar intento y establecer
   control. La clave pública no permite elegir identidad; el secreto se genera en servidor.
2. **Preparación:** comando con sesión/versión; commit de unidad temporal e intervalo, después
   entregar exclusivamente el payload público del item autorizado.
3. **Recepción:** validar la forma y tamaño de la respuesta; comando que captura tiempo PostgreSQL
   y confirma recepción. Nunca corregir la duración usando un timestamp que envía el navegador.
4. **Evaluación:** cargar contexto privado y versiones técnicas, validar y ejecutar registry.
   El contexto incluye solución: no es el DTO de feedback. Persistir la respuesta asociada.
5. **Avance/cierre:** dominio decide siguiente item o final reglamentario; completar/acreditar en
   su transacción atómica. No exponer un endpoint que acepte `score`/`outcome` oficiales.
6. **Recuperación:** al volver con la sesión controladora, bloquear el intento y resolver antes el
   intervalo abierto. Una recepción ya confirmada se evalúa; sin recepción, la unidad preparada se
   consume con la consecuencia del modo. No se vuelve a entregar su payload ni se reinicia su reloj.
7. **Relectura:** responder con estado confirmado y versión vigente; revalidar vistas afectadas.
   No presentar como aceptado un score optimista que todavía no está persistido. Un resultado
   idempotente guardado puede describir un estado anterior: revalidar permisos, sesión y fase antes
   de volver a entregar contenido, sin reiniciar relojes ni resucitar una interacción terminal.

Puntos de fallo que deben tener salida explícita:

| Último hecho confirmado                           | Recuperación exigida                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio confirmado, token/respuesta HTTP perdidos  | Recuperar con la cookie original; otro token se bloquea y no inicia otro intento.                                                         |
| Preparación confirmada, contenido/HTTP perdidos   | Tratar la unidad como consumida: sin recepción, cerrar el intervalo y aplicar la consecuencia del modo; nunca reentregar payload o reloj. |
| Recepción confirmada, evaluación pendiente        | Leer recepción autorizada y evaluarla de nuevo idempotentemente; no pedir otra respuesta.                                                 |
| Evaluación confirmada, UI no recibió feedback     | Reconstruir resultado aceptado y siguiente versión; no registrar segunda respuesta.                                                       |
| Cierre/acreditación confirmados, UI sigue jugando | Leer terminal y mostrar resultado; no otorgar puntos otra vez.                                                                            |
| Segunda sesión durante procesamiento              | Se bloquea; la sesión original conserva el control y recupera los hechos pendientes.                                                      |

Un error técnico no se convierte automáticamente en `abandoned`. La resolución de una interacción
ya preparada sí es obligatoria al recuperar, pero sigue siendo una consecuencia de modo, no de
actividad. Heartbeat/lease y abandono automático son una política distinta. Los identificadores de
operación deben permitir rastrear cada commit sin guardar secretos ni duplicar soluciones en logs.

La aceptación de S04 debe demostrar, como mínimo, una recarga con la cookie original, pérdida de
HTTP después de preparar, pérdida de HTTP después de recibir, recuperación tras vencimiento del
deadline global de Alfabeto y bloqueo de un segundo dispositivo. En ningún caso se repite una unidad
preparada, se pierden respuestas ya recibidas ni se transfiere el control.

## 9. Cobertura de casos de uso y pendientes explícitos

| Casos de uso        | Slice(s)                     | Alcance / condición                                                               |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| CU-01               | S01                          | Auth real y Player estable.                                                       |
| CU-02               | S01, S13                     | Nombre primero; avatar después.                                                   |
| CU-03               | S24                          | Futuro, condicionado por D09.                                                     |
| CU-04, CU-05        | S08, S02                     | Creación y consulta de sala.                                                      |
| CU-06               | S09                          | Emisión, aceptación y revocación; sin correo obligatorio.                         |
| CU-07               | S18a–S18c                    | Salida/ownership, moderación y ciclo de sala separados.                           |
| CU-08               | S10, S12, S19                | Configuración, transiciones temporales y cancelación.                             |
| CU-09               | S12, S19, S21                | Programación, cancelación y consolidación definitiva.                             |
| CU-10, CU-11        | S11, S17, D08a               | Autoría/versionado y assets referenciados; ampliar formatos solo al habilitarlos. |
| CU-12, CU-13        | S11, S23; regresión en F*/E* | Preview editorial/fantasma protegido; biblioteca pública preservada.              |
| CU-14, CU-15        | S02, S03                     | Introducción autorizada e inicio único.                                           |
| CU-16               | S04, S05, E*, S14–S16        | Recuperación común y checkpoints por modo/formato.                                |
| CU-17, CU-18, CU-21 | S03, S05, F*, E*, S14–S16    | Evaluación, final reglamentario y acreditación.                                   |
| CU-19               | S04, S21                     | Abandono explícito primero; automático tras D04.                                  |
| CU-20               | S03, S07, cada modo/formato  | Resultado/revisión propios; política de invalidados en D07/S20.                   |
| CU-22, CU-23        | S06                          | Exactamente dos rankings.                                                         |
| CU-24               | S07, S21                     | Historial; feed completo y notificaciones fuera del alcance inicial.              |
| CU-25, CU-26        | S20, S23                     | Correcciones y pruebas internas separadas.                                        |

No se incluyen salas públicas, invitados competitivos, ranking global, moneda adicional, juego
sincronizado, monetización ni notificaciones. La purga definitiva y las materializaciones requieren
una necesidad y decisión posteriores. No son prerrequisitos implícitos para crear más capas ahora.

## 10. Cierre de una slice y uso como backlog

Al crear un ticket desde este documento, copiar su identificador y ficha completa. Para F*/E*,
incluir tanto la ficha común como la fila; registrar el modo y desafío de prueba concretos. S01–S13,
S17a, S18b parcial, D08a/D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16 y E01–E06/E10 están
**implementadas localmente**; el estado inicial de las slices restantes es **pendiente**. D* pendientes
bloquean solo los recorridos que los citan.

Una slice se cierra cuando:

- Su escenario puede demostrarse desde UI y comprobarse con una nueva lectura de persistencia.
- Tiene camino exitoso, error relevante y reintento/conflicto definidos; la autorización se comprueba
  en servidor, aunque la UI o el SDK sean invocados de otra forma.
- Los tests de reglas y caso de uso pasan; adaptador y SQL se prueban contra PostgreSQL real cuando
  hay persistencia. Mantener pgTAP/inventario y carreras existentes; ampliar solo lo afectado.
- Hay al menos un E2E del recorrido nuevo con backend real; usar fallos controlados para puntos de
  commit cuando corresponda. Un mock del transporte no demuestra la vertical completa.
- Pasan `npm run typecheck`, `npm run type-architecture`, lint/build y tests pertinentes. Si cambia
  SQL, también `npm run supabase:schema:test`, migración desde vacío e integración con Auth real.
  El arnés de integración/E2E local ya existe desde S01 y se amplía con cada slice.
- Se revisan payloads públicos y regresiones de práctica. Los formatos con assets prueban carga,
  timeout y accesibilidad; los cambios visuales conservan teclado y movimiento reducido.
- El mock del recorrido real ya no participa; una bandera puede ocultar una capacidad incompleta,
  pero no debe cambiar autoridad ni otorgar resultados locales oficiales.
- Migración, ACL/inventario, configuración de entorno y pasos de verificación están versionados;
  se actualizan estado actual/documentación afectada sin afirmar implementadas las demás slices.

El formato previo y el selector CSS duplicado documentados en QA no se arreglan mediante un barrido
de todo el repositorio. Cada PR mantiene limpios sus archivos y registra cualquier impedimento
preexistente, sin usarlo para omitir pruebas nuevas.

S01–S15, D08a/D08b, E01–E06, E10, F08, F16, F18, S05-Alphabet y la integración D08b-MC están cerradas localmente: su entrega cubre login, perfil persistido, lecturas de
sala, Flash y Supervivencia competitivos persistidos, recuperación, rankings, historial Flash y
revisión propia de Survival, además de la creación auditada de salas, la activación de temporadas,
la publicación editorial mixta, Pirámide competitiva y la programación/ejecución temporal local del calendario. E07–E09
y Narrativa siguen fuera de alcance. El piloto sigue acotado a las rutas reales documentadas
en S22.
