> Estado: vigente. Capacidades observables en el repositorio; la evidencia de ejecución se conserva por entrega.

# Estado actual del proyecto

Último contraste de código y esquema: 2026-11-05.

## Alcance y verificación

The Flash combina competición persistida sobre Supabase, ejemplos didácticos de formatos,
demos explícitas y pruebas locales antes del intento competitivo. Las rutas de producto no
recurren al mock cuando falla Supabase.

El historial activo parte de la inicial consolidada e incorpora la migración incremental de borrado de intentos terminales. La [entrega de consolidación](../archive/reports/migration-consolidation-2026-11-03.md) registra la evidencia aislada y no acredita reinstalación de local o staging.
La [reinstalación local posterior](../archive/reports/local-reinstallation-2026-11-03.md) acredita la adopción de esa inicial en el entorno habitual; staging sigue pendiente.

Revisión canónica del repositorio: `20261110213000_pyramid_queens_word_search_timeout_credit`.

El portal permite [reprogramar temporadas y desafíos](calendar-rescheduling.md) con vista previa, cambios conjuntos atómicos y protección de partidas ya iniciadas. Las temporadas publicadas futuras se muestran como programadas.

El valor se contrasta con la última migración, `.env.example`, health y los runners mediante
`npm run schema:revision:check`. Identifica el contrato esperado por la aplicación, no demuestra
que una base concreta lo tenga aplicado. La [guía de entornos](supabase-clean-installation.md)
describe instalación y operación.

Los [informes de QA](../archive/reports/qa-through-2026-10-21.md) acreditan ejecuciones locales.
La [verificación archivada de staging](../archive/reports/staging-measurement-verification.md) del
2026-10-24 acredita únicamente la implementación anterior, ya retirada del modelo vigente.
Los logs de cron y la calibración editorial siguen pendientes antes de abrir una temporada real.

## Medición de producto

Cada temporada tiene una única medición automática. La creación de temporadas y las nuevas
incorporaciones de miembros o desafíos actualizan su alcance sin configurar experimentos.
El superadmin dispone de selector de temporada, resumen de actividad, detalle por persona y
publicación, disfrute opcional y CSV de personas, participación, desafíos y resumen.

Tabarnia usa estas capacidades comunes como cualquier otra sala. Los criterios de éxito de
su estudio Lean se aplican posteriormente sobre los datos recogidos y el expediente privado de
invitaciones, incidencias y feedback. La aplicación muestra actividad descriptiva sin clasificar
hipótesis ni condicionar la activación de temporadas a estudios.

La [guía de medición](product-measurement.md) describe captura, valoración única 1–5 y los cuatro
CSV. La inicial consolidada crea directamente el modelo automático, sin el sistema experimental retirado. La aplicación de esta entrega en staging sigue
pendiente y no queda acreditada por las verificaciones archivadas.

La base local se reinstaló desde cero el 2026-11-03 con la revisión canónica y una única
entrada en el ledger. El bootstrap mínimo deja un superadmin, su jugador, la asignación y su
auditoría, más 11.207 palabras de los diccionarios. Las otras 33 tablas de dominio y ambos
buckets canónicos quedan vacíos. Auth, REST y health responden 200; se comprobaron el acceso
al portal, la persistencia de sesión y la protección del portal tras salir. Pasan las 71 suites SQL
desde migraciones y la equivalencia de catálogo con el esquema declarativo.
La [evidencia de reinstalación](../archive/reports/local-reinstallation-2026-11-03.md) detalla
los comandos, resultados y límites. Staging no se accedió ni modificó en esta operación.

## Modos y formatos

Hay 31 formatos jugables: 21 con capacidad competitiva y diez exclusivos de práctica.
El [registro de capacidades](../../lib/question-formats/definitions.ts) determina la admisión;
una ficha en la biblioteca no habilita competición.

| Modo          | Formatos competitivos                             | Tiempo y finalización                                                     | Ensayo con proveedor local                |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| Flash         | Los 21 competitivos                               | 2–20 preguntas, plazo por pregunta; continúa tras error o timeout         | Sí                                        |
| Alfabeto      | `short-text`                                      | Reloj global, vueltas y pases; termina al resolver letras o agotar tiempo | Sí                                        |
| Supervivencia | Los 21 competitivos                               | Plazo por pregunta; termina sin vidas o al llegar al final                | Sí                                        |
| Narrativa     | Los 21 competitivos                               | Escenas sin reloj de respuesta y preguntas temporizadas                   | No; conserva su práctica narrativa propia |
| Pirámide      | Los 21 competitivos                               | Siete niveles con briefing; solo un acierto completo permite avanzar      | Sí                                        |
| Contrarreloj  | Queens o Conectar parejas, un formato por desafío | 2–20 tableros de 4×4 a 8×8 con reloj global                               | Sí                                        |

Las reglas completas pertenecen a los [contratos por modo](domain/mode-contracts.md);
Contrarreloj tiene [contrato específico](domain/contrarreloj.md). Su ranking compara pruebas
resueltas y tiempo hasta el último acierto; los otros cinco modos comparan puntos, duración
efectiva y comienzo del intento. La temporada acumula Flash Points.

Los diez formatos exclusivos de práctica son etiquetar imagen, memoria relámpago, memoria de
parejas, Simon, mini-sudoku, mini-nonograma, laberinto, Tuberías, rompecabezas deslizante y
reconstrucción del error. Sus capacidades están en
[practiceDefinitions.ts](../../lib/question-formats/practiceDefinitions.ts).

## Sesiones y revisión

- Un intento competitivo tiene una única sesión controladora. La transferencia explícita
  «Continuar aquí» está implementada en cliente, API y PostgreSQL.
- Respuestas, recepciones, eventos y plazos aceptados se conservan en servidor. Recuperar aplica
  la consecuencia del modo; no concede otro reloj ni repite contenido consumido.
- Queens y Conectar parejas guardan checkpoints sin bloquear la edición. La validación y el
  cierre pueden adelantarlos; la revisión conserva el último tablero aceptado también cuando
  hay una evaluación pendiente. Un tablero mostrado como parcial puede mantener cero puntos
  y estado oficial sin contestar, según las reglas del modo.
- La pérdida del permiso competitivo cierra el intento activo sin acreditar puntos y conserva
  los hechos aceptados para auditoría.
- La reconciliación de inactividad cierra tras 15 minutos sin actividad cuando la publicación
  está cerrada o ha vencido el deadline; no necesita heartbeat del navegador.
- Historial y revisión autorizada contemplan los seis modos. Spectators pueden consultar
  historial y rankings, pero no respuestas ni soluciones. Pirámide y Contrarreloj ocultan el
  contenido no alcanzado.
- No hay replay competitivo de un intento terminal. La biblioteca y los ensayos tienen sus
  propios ciclos locales, sin acreditación oficial.

El [ciclo de vida](attempt-lifecycle.md), la [recuperación](competitive-command-recovery.md) y
la [matriz de resiliencia](resilience-matrix.md) detallan garantías y casos de fallo.

## Práctica y contenido

La biblioteca `/formatos` ofrece ejemplos de los 31 formatos. **Probar primero** genera
ejercicios alternativos desde un banco versionado conservando estructura, tiempos, puntos y
reglas de Flash, Supervivencia, Pirámide, Alfabeto o Contrarreloj. Narrativa no participa en
esa generación. Los resultados permanecen en memoria, no consumen el intento oficial y no
cuentan para ranking. Las recetas permiten reproducir la selección.

La dificultad editorial no modifica por sí misma la puntuación. La descripción del banco,
cobertura y autorización está en [rehearsals.md](rehearsals.md).

Conectar parejas se envía automáticamente al completar todas las parejas y casillas. La
interfaz no ofrece envío manual; su evaluación parcial y su timeout conservan las reglas
existentes de cada modo.

## Superficies operativas

| Superficie                                                       | Responsabilidad                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`, `/salas/[roomId]`                                           | Auth, perfil, salas y disponibilidad competitiva reales          |
| Ranking e historial de sala                                      | Rankings y publicaciones históricas autorizadas                  |
| `/salas/[roomId]/ajustes`                                        | El owner concede/quita admin y elimina lógicamente miembros      |
| `/desafios/[challengeId]?roomId=...`                             | Introducción, intento y resultado competitivo                    |
| `/desafios/[challengeId]/prueba?roomId=...`                      | Ensayo alternativo autorizado antes de competir                  |
| `/admin/rooms` y detalle de sala                                 | Salas, miembros, temporadas, calendario e inspección de intentos |
| `/admin/challenges`, `/admin/questions`, `/admin/rehearsals/...` | Versiones editoriales, biblioteca y previews de ensayos          |
| `/formatos` y `/demo/**`                                         | Práctica didáctica y demos explícitas                            |
| Tick y health internos                                           | Operación protegida y comprobaciones de servicios/esquema        |

El portal privado exige superadmin. El contenido publicado es inmutable: las correcciones crean
versiones y los ajustes de resultados conservan el original, el ledger y la auditoría. En los seis
modos, el superadmin puede eliminar definitivamente un intento completado, abandonado o invalidado
y sus datos vinculados. Si la publicación sigue abierta, el jugador puede volver a empezar.
La UI pública no crea salas ni gestiona invitaciones. El tick tiene ejecución manual y una
integración declarada de Vercel Cron; sus logs remotos requieren comprobación en staging.

## Límites y siguientes trabajos

Siguen pendientes las invitaciones completas, salida/transferencia de propiedad, bloqueo y
desbloqueo de miembros, recuperación de salas eliminadas, cancelación de competición ya abierta,
política de `results_locked_at`, anonimización y pruebas internas persistidas sin acreditación.
La edición narrativa avanzada, los diez formatos exclusivos de práctica y la extensión de assets
a otros formatos requieren su propio alcance. La validación multi-dispositivo en staging sigue
pendiente aunque takeover esté implementado.

El [backlog vigente](../implementation-plan.md) conserva esos pendientes y sus referencias.
[QA actual](qa.md) describe cómo verificarlos; el
[estado anterior archivado](../archive/reports/status-through-2026-10-21.md) conserva la
cronología y las cifras de entregas pasadas.
