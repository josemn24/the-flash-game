# The Flash

The Flash es un juego de preguntas diseñado como un sprint contra el reloj. La versión actual
combina una experiencia de práctica mock con un recorrido competitivo real de Flash sobre Supabase,
además de consultar resultados detallados, revisar respuestas y explorar una biblioteca interactiva
de 31 formatos.

## Qué incluye

- Una sala demo mock y escenarios Supabase locales con temporada activa, desafíos y publicaciones.
- Treinta y un formatos: elección múltiple, encontrar el intruso, emparejar conceptos, conectar parejas, verdadero o falso, respuesta corta, ordenar, clasificar, código lógico, estimación, adivinanzas por pistas, mapa de calor, etiquetar imagen, memoria relámpago, memoria de parejas, Simon, matrices lógicas, mini-sudoku, mini-nonograma, Queens, rompecabezas deslizante, Escape, reconstrucción del error, anagramas, Hashtag de palabras, Mini-Wordle, sopa de letras, imagen progresivamente revelada, laberinto contrarreloj, Zip y Tuberías.
- Mapa de calor con coordenadas normalizadas, marcador corregible, control por puntero o teclado, confirmación explícita y puntuación por precisión y velocidad.
- Etiquetado de imágenes en dos variantes: asociar varias etiquetas con crédito parcial o identificar una única zona mediante elección o texto libre.
- Preguntas con imágenes o ilustraciones integradas en elección múltiple, encontrar el intruso y estimación.
- Temporizador individual y avance automático al agotarse el tiempo.
- Puntuación que premia las respuestas rápidas y aplica penalizaciones según el formato.
- Resultados con precisión, aciertos, fallos, preguntas sin contestar y tiempo total.
- Revisión completa de respuestas y opción de repetición.
- Biblioteca con reglas, recomendaciones, accesibilidad y puntuación de cada formato.
- Uno o varios ejemplos jugables y cronometrados desde cada ficha de formato.
- Diseño responsive, accesible y completamente en español.

## Tecnologías

- Next.js 16 con App Router.
- React 19 y TypeScript.
- Tailwind CSS 4.
- Motion para transiciones y microinteracciones.
- Supabase Auth, RPCs autorizadas y PostgreSQL para los recorridos competitivos implementados.

La aplicación combina dos contextos explícitos: práctica y previews respaldados por un store mock, y
recorridos competitivos persistidos en Supabase. S01–S13, S17a, S18b parcial, D08a/D08b, S05-Alphabet,
F01/F02/F03/F04/F06/F07/F12 y E01–E06/E10 conectan Auth, provisioning de jugador,
lecturas de salas, el intento Flash de 2 a 20 preguntas, su evaluación server-side, recuperación y
los rankings de temporada/publicación actual, el historial Flash y la revisión después de volver. El
portal privado `/admin` ya permite a superadmins consultar su contexto, crear salas activas con un
owner explícito y un grupo inicial opcional, y preparar/editar/activar temporadas. Estas operaciones
son transaccionales, idempotentes y auditadas.
La beta cerrada se operará mediante un portal privado de superadmin: la UI pública no crea salas,
gestiona invitaciones ni prepara temporadas. El superadmin añadirá directamente a los usuarios
autenticados a las salas; la publicación mínima de contenido, la programación y la ejecución del
calendario podrán formar parte de ese portal. La gestión posterior de miembros es parcial: el owner
puede conceder/quitar admin y eliminar lógicamente miembros; transferencia, bloqueo/desbloqueo e
invitaciones completas siguen pendientes. Los demás modos competitivos y parte del ciclo de Storage
siguen pendientes.

## Requisitos

- Node.js 20.9 o superior.
- npm.
- Docker, si se quiere ejecutar el stack local de Supabase.

## Instalación y ejecución

Instala las dependencias:

```bash
npm install
```

Inicia el entorno de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador. Para la experiencia mock no se
necesita configuración adicional. Para probar las slices persistidas actuales, copia `.env.example` a
`.env.local`, inicia Supabase local y sigue el workflow de [`supabase/README.md`](supabase/README.md).

## Comandos disponibles

| Comando                              | Descripción                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Inicia el servidor de desarrollo.                                                                        |
| `npm run lint`                       | Comprueba la calidad estática del código.                                                                |
| `npm run typecheck`                  | Valida todos los contratos TypeScript sin emitir código.                                                 |
| `npm run type-architecture`          | Comprueba las dependencias entre las capas de tipos.                                                     |
| `npm test`                           | Ejecuta los tests unitarios con Vitest.                                                                  |
| `npm run build`                      | Genera la compilación optimizada de producción.                                                          |
| `npm run start`                      | Sirve localmente una compilación de producción.                                                          |
| `npm run supabase:start`             | Inicia el stack local de Supabase.                                                                       |
| `npm run supabase:status`            | Muestra el estado del stack local de Supabase.                                                           |
| `npm run supabase:browser:setup`     | Reinicia Supabase local y prepara cuentas y datos para pruebas manuales.                                 |
| `npm run supabase:tabarnia:setup`    | Reinicia Supabase local y prepara la alpha jugable de Tabarnia con cuatro desafíos y sus siete avatares. |
| `npm run supabase:betavip:setup`     | Reinicia Supabase local y crea Tabarnia y BetaVIP; abre primero «Supervivencia: Cultura pop».            |
| `npm run supabase:staging:bootstrap` | Prepara el staging remoto con Xesmona, Ches, BetaVIP, buckets y el asset inicial.                        |
| `npm run supabase:schema:test`       | Verifica esquema, RLS, comandos y concurrencia.                                                          |
| `npm run schema:revision:check`      | Comprueba que migración, health check, `.env.example` y el piloto usan la misma revisión.                |
| `npm run dictionary:generate`        | Regenera el vocabulario español de Mini-Wordle.                                                          |
| `npm run dictionary:check`           | Comprueba que el vocabulario versionado esté actualizado.                                                |
| `npm run format:check`               | Comprueba el formato con Prettier.                                                                       |

Para comprobar el escenario conjunto, ejecuta `npm run supabase:betavip:setup` y después
`npm run test:integration:supabase -- --scenario betavip`. Vuelve a ejecutar el setup antes de
`npm run test:e2e -- e2e/betavip.spec.ts` para que las pruebas de navegador empiecen sin la partida
que crea la integración. Repite el setup al terminar: el E2E abre temporalmente el Alphabet y crea
una partida. Las credenciales locales generadas para Manuel y Genís quedan en
`output/fixtures/betavip.json`.

En BetaVIP, «Supervivencia: Cultura pop» está abierto durante las primeras 24 horas, «La vuelta al
mundo» queda programado para el segundo día y «Cumbre lógica II» para el tercero. La temporada dura
72 horas. El manifiesto lista las tres publicaciones en ese orden: `data.publicationId` apunta a
Supervivencia, mientras `data.survivalPublicationId`, `data.alphabetPublicationId` y
`data.pyramidPublicationId` identifican explícitamente cada publicación. `data.questionAssets`
contiene el recurso propio del casete.

Para preparar el staging remoto, aplica antes las migraciones con `supabase db push` y proporciona
las variables de bootstrap indicadas en `.env.example`. Comprueba el destino sin escribir nada y,
solo después, ejecuta:

```bash
npm run supabase:staging:bootstrap -- --dry-run
npm run supabase:staging:bootstrap
```

El script no cambia la configuración global de Auth. Escribe las credenciales generadas únicamente
en `output/staging/bootstrap-credentials.json` con permisos `0600` y el estado no sensible en
`output/staging/bootstrap-manifest.json`; copia las contraseñas a un gestor seguro y elimina el
archivo de credenciales después.

## Estructura principal

```text
app/             Entrada de Next.js: rutas, layouts, metadata y estilos globales
application/     Consultas, casos de uso y contratos independientes de Next.js
components/      Pantallas, UI compartida e islas interactivas
data/            Fixtures canónicos, store mock y proyecciones transitorias
features/        Comportamiento de producto: sesiones, juego y catálogo
infrastructure/  Adaptadores concretos mock y Supabase
lib/             Lógica pura reutilizable: scoring, validación y utilidades
server/          Composición server-only, sesión y fachadas para las rutas
types/           Tipos de dominio, contratos, gameplay y view models
docs/            Estado funcional, evolución y decisiones de arquitectura
scripts/         Comprobaciones y generadores deterministas
```

Estas carpetas no son capas equivalentes, sino responsabilidades distintas. La diferencia más
importante es la siguiente:

- `app/` pertenece al framework. Es donde Next.js descubre las URLs y compone cada pantalla. Una
  página de `app/` debería encargarse de recibir parámetros, cargar un modelo y renderizar la UI,
  no de implementar reglas de negocio.
- `application/` pertenece a la aplicación. Coordina consultas y casos de uso mediante contratos
  que no dependen de React, Next.js ni de una base de datos concreta. Por eso puede probarse y
  evolucionar sin cambiar las rutas.
- `server/` es el punto de composición server-only: obtiene el contexto de sesión, selecciona los
  adaptadores y expone fachadas cómodas para las rutas. No debería convertirse en un segundo lugar
  para las reglas de dominio.
- `infrastructure/` contiene las implementaciones concretas de esos contratos. Conviven los
  adaptadores `mock/` y `supabase/`; cada recorrido selecciona explícitamente el que corresponde,
  sin que la UI conozca sus detalles.

El recorrido típico de una lectura es:

```text
app/ → server/ → application/ → infrastructure/supabase/ → Supabase Auth/RPC/PostgreSQL
  └──────────────────────────────→ components/ y features/

Las rutas de práctica y preview siguen este recorrido:

app/ → server/ → application/ → infrastructure/mock/ → data/mock/
```

`lib/` y `types/` son piezas transversales: `lib/` concentra funciones puras y `types/` separa
entidades del dominio, contratos públicos, estado de gameplay y modelos preparados para la UI.
`data/` conserva el store y los fixtures del prototipo; parte de sus archivos antiguos es
transitoria y no debe tomarse como el destino final de la persistencia.

La estructura actual es deliberadamente una arquitectura de transición: las slices se migran por
recorridos completos y el mock se conserva solo donde aún no existe una slice real o para práctica.
No se pretende añadir más capas hasta que aporten una necesidad concreta. La explicación completa de
responsabilidades, dependencias y evolución está en [`docs/current/architecture.md`](docs/current/architecture.md).

## Modelo de dominio

Las reglas de dominio y persistencia con Supabase, incluidos usuarios, salas, temporadas,
publicaciones, intentos, rankings y límites de seguridad, se mantienen en
[`docs/current/domain/README.md`](docs/current/domain/README.md).

## Convenciones de estilos

- `app/globals.css` contiene únicamente Tailwind, tokens del tema, reset, estilos base y preferencias globales de accesibilidad.
- Tailwind se utiliza para layout, espaciado, responsive y ajustes visuales sencillos directamente en los componentes.
- El CSS personalizado de un componente se mantiene en su archivo `*.module.css` adyacente, especialmente para estados, pseudoelementos, ilustraciones y efectos complejos.
- Los módulos consumen variables globales, pero no dependen de otros módulos ni exponen selectores globales.
- Una nueva primitiva visual compartida solo se extrae cuando al menos dos componentes comparten también estructura y comportamiento.

## Alcance

Esta versión valida la experiencia individual y social mock dentro de una sala local y un recorrido
competitivo real acotado. Las slices persistidas actuales cubren autenticación, perfil, lecturas autorizadas de salas, un
Flash competitivo persistido con recuperación, rankings actuales, historial cerrado y revisión;
E01–E05/E10 y F* amplían ese Flash con eventos autoritativos y payloads versionados para los formatos habilitados.
histórica autorizada. Incluye el portal privado de `/admin` para consultar el contexto, crear salas
iniciales y preparar/activar temporadas; incluye una gestión parcial de miembros desde ajustes para
el owner (conceder/quitar admin y eliminación lógica), pero todavía no incluye la transferencia de propiedad,
bloqueo/desbloqueo ni invitaciones completas,
contenido, otros modos ni Storage. La
UI pública no incluye creación de salas, gestión de invitaciones ni configuración de temporadas;
durante la beta esas tareas, incluido el alta directa de miembros, corresponden al superadmin. La
revisión ajena completa se limita a `owner`, `admin` y `member`; `spectator` puede leer historial y
rankings, pero no soluciones ajenas.

Las publicaciones mock apuntan a versiones de definiciones reusables y cada definición resuelve su
contenido desde `questionsById`. Los formatos que todavía no aparecen en publicaciones, incluidos
Conectar parejas, Memoria de parejas, Mini-Wordle, imagen progresivamente revelada y laberinto
contrarreloj, siguen disponibles en el modelo nativo y en la biblioteca interactiva.

Mini-Wordle carga bajo demanda un vocabulario español de cuatro letras generado offline desde Hunspell. El recurso está versionado en el repositorio, no requiere backend y el cronómetro no comienza hasta que está disponible. Consulta [la documentación del diccionario](docs/content/guidelines/mini-wordle-dictionary.md) para regeneración, métricas y licencia.

La imagen progresiva espera a que el activo visual esté listo antes de iniciar el cronómetro. El desenfoque desaparece automáticamente, se puede responder en cualquier momento y un único fallo termina la ronda.

El laberinto contrarreloj usa una cuadrícula ortogonal controlada mediante cruceta o flechas. Conserva el recorrido para la revisión, finaliza al alcanzar la salida y no penaliza los movimientos adicionales.

Conectar parejas usa una cuadrícula 5 × 5 con rutas ortogonales entre símbolos iguales. Conserva rutas parciales en timeout, concede crédito por parejas conectadas y cobertura, y exige cubrir todo el tablero para resolver.

Memoria de parejas usa losetas ocultas en una cuadrícula compacta con símbolos, emojis o imágenes y etiqueta accesible. Conserva el historial de intentos para la revisión, concede crédito por cada pareja encontrada y resta un 10 % de los puntos base por cada fallo.

Todos los formatos de la biblioteca usan Flash Pop directamente mediante el registry único
`QuestionInput`. Las variantes que permanecen en los controles son semánticas (`primary`,
`secondary`, `reward`, etc.) y no representan temas. La cobertura automatizada y el estado de la
revisión manual se mantienen en [`docs/current/qa.md`](docs/current/qa.md). El informe manual de la
migración Flash Pop se conserva como [`documentación histórica`](docs/archive/redesign/qa-fase-4.md).

## Rediseño Flash Pop

La evolución visual y de experiencia hacia un juego más alegre, social, casual y cercano se conserva como proceso histórico en [`docs/archive/redesign/README.md`](docs/archive/redesign/README.md). El estado actual de sus comprobaciones está documentado en [`docs/current/qa.md`](docs/current/qa.md).
