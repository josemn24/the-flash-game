# The Flash

The Flash es un juego de preguntas diseñado como un sprint contra el reloj. La versión actual
combina una experiencia de práctica local con seis modos competitivos persistidos sobre Supabase,
además de consultar resultados detallados, revisar respuestas y explorar una biblioteca interactiva
de 31 formatos.

Los únicos entornos de aplicación admitidos son **local** y **staging**. El aprovisionamiento y
el reset rechazan cualquier otro destino. `NODE_ENV=production`, las compilaciones optimizadas,
los archivos `production-*` y el perfil de calendario `production` son nombres técnicos: también
se utilizan en local o staging y no definen un entorno remoto adicional.

## Qué incluye

- Una sala demo mock y escenarios Supabase locales con temporada activa, desafíos y publicaciones.
- Contrarreloj con secuencias de Queens o Conectar parejas de 4×4 a 8×8, reloj global y puntos por tablero resuelto.
- Treinta y un formatos: elección múltiple, encontrar el intruso, emparejar conceptos, conectar parejas, verdadero o falso, respuesta corta, ordenar, clasificar, código lógico, estimación, adivinanzas por pistas, mapa de calor, etiquetar imagen, memoria relámpago, memoria de parejas, Simon, matrices lógicas, mini-sudoku, mini-nonograma, Queens, rompecabezas deslizante, Escape, reconstrucción del error, anagramas, Hashtag de palabras, Mini-Wordle, sopa de letras, imagen progresivamente revelada, laberinto contrarreloj, Zip y Tuberías.
- Mapa de calor con coordenadas normalizadas, marcador corregible, control por puntero o teclado, confirmación explícita y puntuación por precisión y velocidad.
- Etiquetado de imágenes en dos variantes: asociar varias etiquetas con crédito parcial o identificar una única zona mediante elección o texto libre.
- Preguntas con imágenes o ilustraciones integradas en elección múltiple, encontrar el intruso y estimación.
- Tiempo por pregunta o reloj global según el modo, con cierre temporal automático.
- Puntuación que premia las respuestas rápidas y aplica penalizaciones según el formato.
- Resultados con precisión, aciertos, fallos, preguntas sin contestar y tiempo total.
- Revisión de respuestas; repetición en práctica y ensayos, sin replay competitivo.
- Medición automática por temporada: actividad, participación, disfrute opcional y cuatro CSV
  privados para superadmin. Las definiciones y los límites están en la
  [guía de medición](docs/current/product-measurement.md); los objetivos de cada estudio se analizan
  fuera de la aplicación.
- Biblioteca con reglas, recomendaciones, accesibilidad y puntuación de cada formato.
- Uno o varios ejemplos jugables y cronometrados desde cada ficha de formato.
- Diseño responsive, accesible y completamente en español.

## Tecnologías

- Next.js 16 con App Router.
- React 19 y TypeScript.
- Tailwind CSS 4.
- Motion para transiciones y microinteracciones.
- Supabase Auth, RPCs autorizadas y PostgreSQL para los recorridos competitivos implementados.

La aplicación combina competición persistida en Supabase con práctica, demos y ensayos locales.
Las rutas competitivas no tienen fallback al mock. El [estado actual](docs/current/status.md)
centraliza las capacidades de los seis modos, los formatos, el portal y los límites por entorno;
el [backlog](docs/implementation-plan.md) distingue el trabajo todavía pendiente.

El historial de cambios por versión está disponible en [`CHANGELOG.md`](CHANGELOG.md).

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
`.env.local` y elige un recorrido en la
[guía de preparación de entornos](docs/current/supabase-clean-installation.md#qué-necesito-preparar).

Para probar desde un móvil u otro equipo de la red local, consulta la
[guía de pruebas desde dispositivos externos](docs/current/local-device-testing.md).

## Comandos disponibles

| Comando                              | Descripción                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Inicia el servidor de desarrollo.                                                                                            |
| `npm run lint`                       | Comprueba la calidad estática del código.                                                                                    |
| `npm run typecheck`                  | Valida todos los contratos TypeScript sin emitir código.                                                                     |
| `npm run type-architecture`          | Comprueba las dependencias entre las capas de tipos.                                                                         |
| `npm run mock-data:check`            | Valida fixtures, adaptadores y límites del almacén mock local.                                                               |
| `npm test`                           | Ejecuta los tests unitarios con Vitest.                                                                                      |
| `npm run build`                      | Genera la compilación optimizada de producción.                                                                              |
| `npm run start`                      | Sirve localmente una compilación de producción.                                                                              |
| `npm run supabase:start`             | Inicia el stack local de Supabase.                                                                                           |
| `npm run supabase:status`            | Muestra el estado del stack local de Supabase.                                                                               |
| `npm run supabase:browser:setup`     | Reinicia Supabase local y prepara cuentas y datos para pruebas manuales.                                                     |
| `npm run supabase:tabarnia:setup`    | Reinicia Supabase local y prepara el escenario técnico de Tabarnia con ocho desafíos y sus siete avatares.                   |
| `npm run supabase:betavip:setup`     | Reinicia Supabase local y crea Tabarnia y BetaVIP; abre primero «Circuito de parejas» salvo que se indique un inicio futuro. |
| `npm run supabase:local:bootstrap`   | Prepara el perfil mínimo local con superadmin, diccionarios y buckets vacíos; exige `--target local`.                        |
| `npm run supabase:staging:bootstrap` | Prepara el staging remoto con Xesmona, Ches, BetaVIP, buckets y el asset inicial.                                            |
| `npm run supabase:schema:test`       | Verifica esquema, RLS, comandos y concurrencia.                                                                              |
| `npm run schema:revision:check`      | Comprueba que migración, health check, `.env.example` y el piloto usan la misma revisión.                                    |
| `npm run dictionary:generate`        | Regenera el vocabulario español de Mini-Wordle.                                                                              |
| `npm run dictionary:check`           | Comprueba que el vocabulario versionado esté actualizado.                                                                    |
| `npm run format:check`               | Comprueba el formato con Prettier.                                                                                           |

La [guía de preparación](docs/current/supabase-clean-installation.md#qué-necesito-preparar) reúne
los requisitos, comandos, efectos destructivos y archivos de cada recorrido. El
[escenario conjunto Tabarnia y BetaVIP](docs/current/supabase-clean-installation.md#escenario-local-con-tabarnia-y-betavip)
incluye sus cuentas, publicaciones y la secuencia específica de integración y E2E.

El seed de Tabarnia es un escenario técnico de ocho desafíos. No prepara la cohorte de 14
invitaciones ni las nueve publicaciones del [estudio Lean](docs/product/strategy/lean-startup/cycles/CYCLE-001.md).
La preparación de ese estudio y su análisis siguen pendientes, según el contrato y el estado Lean.

Para recorrer las temporadas locales sin esperar un día entre publicaciones, ambos seeds admiten un
perfil rápido opcional:

```bash
npm run supabase:tabarnia:setup -- --schedule fast
npm run supabase:betavip:setup -- --schedule fast
npm run supabase:tabarnia:setup -- --schedule 10m
npm run supabase:betavip:setup -- --schedule 30m
npm run supabase:betavip:setup -- --schedule 1h
```

El perfil predeterminado `production` conserva las ventanas de 24 horas. `fast` usa ventanas reales
de cinco minutos: Tabarnia recorre sus ocho desafíos en 40 minutos y BetaVIP sus seis en 30 minutos. Se acorta
únicamente la ventana de publicación; los límites internos de preguntas,
vidas, puntuación y deadlines no cambian. El manifiesto generado incluye `scheduleProfile` y la
duración de la ventana para identificar el perfil utilizado.

También se admite un entero positivo seguido de `m` o `h`: `10m`, `30m`, `1h`, `90m`, etc.
Con duraciones personalizadas, cada desafío abre al cerrar el anterior y la temporada termina
con el último: ocho horas en Tabarnia y seis en BetaVIP para `1h`. `1h` y `60m` se normalizan
al mismo perfil `60m`. Consulta la [guía de duraciones](docs/current/supabase-clean-installation.md#duración-de-los-desafíos)
para ver ejemplos y los totales de cada sala. Esta opción se aplica a los setups locales;
el bootstrap de staging conserva su calendario actual.

| Dataset             | `production` | `fast`    |
| ------------------- | ------------ | --------- |
| Tabarnia, desafío 1 | 0–24 h       | 0–5 min   |
| Tabarnia, desafío 2 | 24–48 h      | 5–10 min  |
| Tabarnia, desafío 3 | 48–72 h      | 10–15 min |
| Tabarnia, desafío 4 | 72–96 h      | 15–20 min |
| Tabarnia, desafío 5 | 96–120 h     | 20–25 min |
| Tabarnia, desafío 6 | 120–144 h    | 25–30 min |
| Tabarnia, desafío 7 | 144–168 h    | 30–35 min |
| Tabarnia, desafío 8 | 168–192 h    | 35–40 min |
| BetaVIP, desafío 1  | 0–24 h       | 0–5 min   |
| BetaVIP, desafío 2  | 24–48 h      | 5–10 min  |
| BetaVIP, desafío 3  | 48–72 h      | 10–15 min |
| BetaVIP, desafío 4  | 72–96 h      | 15–20 min |
| BetaVIP, desafío 5  | 96–120 h     | 20–25 min |
| BetaVIP, desafío 6  | 120–144 h    | 25–30 min |

El seed no ejecuta automáticamente el calendario. Tras alcanzar cada límite temporal, ejecuta el
tick local con `npm run calendar:tick` mientras la aplicación y Supabase estén activos.

Los comandos independientes de tick cargan automáticamente `.env.local` cuando existe, incluida
la variable `CALENDAR_TICK_SECRET` del entorno local.

Los setups de Tabarnia y BetaVIP aceptan `--starts-at <fecha-hora-ISO-8601>` para programar el inicio
futuro de la temporada. Incluye la zona horaria, por ejemplo para las 19:00 en Madrid:

```bash
npm run supabase:betavip:setup -- --schedule 30m --starts-at "2030-10-20T19:00:00+02:00"
```

Elige una fecha futura. `--starts-at` funciona también con Tabarnia y el bootstrap de staging;
`--schedule` solo se aplica a los setups locales. Si se omite el inicio, sigue
siendo inmediato. En staging, una ejecución posterior conserva la temporada existente y rechaza
una fecha distinta; para reprogramarla hay que preparar una base vacía siguiendo el procedimiento
de reinstalación.

También puedes dejar un watcher local opcional ejecutando el tick automáticamente cada minuto:

```bash
npm run dev
npm run calendar:tick:watch
```

La frecuencia se puede cambiar, por ejemplo, a cinco minutos con
`npm run calendar:tick:watch -- --interval-seconds=300`. El watcher ejecuta un tick inmediatamente
al arrancar, espera el intervalo después de cada ejecución y no permite ticks solapados. Solo actúa
en el entorno local y se detiene con `Ctrl+C`; `npm run calendar:tick` sigue disponible para una
ejecución única. El ranking puede leerse sin tick cuando la ventana temporal está disponible, pero
el tick sigue siendo necesario para persistir aperturas, cierres, finalización de temporada y
expiración de intentos.

Para staging, elegir entre el
[bootstrap sobre una base migrada](docs/current/supabase-clean-installation.md#bootstrap-sobre-una-base-migrada)
y una [reinstalación completa](docs/current/supabase-clean-installation.md#reinstalación-completa).
La guía conserva las confirmaciones de reset y el manejo de credenciales. La ejecución registrada
es local; la preparación y validación remotas de staging siguen pendientes.

## Estructura principal

```text
app/             Entrada de Next.js: rutas, layouts, metadata y estilos globales
application/     Consultas, casos de uso y contratos independientes de Next.js
components/      Pantallas, UI compartida e islas interactivas
data/            Fixtures canónicos y store mock local, sin dependencia de rutas competitivas
features/        Comportamiento de producto: sesiones, juego y catálogo
infrastructure/  Adaptadores concretos mock/locales y Supabase
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
`data/` conserva los fixtures y el store mock local; sus adaptadores de compatibilidad solo pueden
alcanzarse desde la composición mock o desde tests.

Las superficies de demo y práctica viven bajo `/demo/**`. `/demo/flash-pop` es el lobby mock, y
`/demo/flash-pop/ui-kit`, `/demo/flash-pop-concepts` y `/demo/flash-pop-typography` son laboratorios
visuales. Las URLs históricas `/flash-pop/**`, `/flash-pop-concepts` y `/flash-pop-typography`
redirigen permanentemente a sus equivalentes bajo `/demo/**`. Las rutas competitivas `/salas/**`,
`/desafios/**` y `/admin/**` no usan la fachada demo ni los fixtures mock.

La arquitectura consolidada separa composición y datos: `server/composition/production.ts` es la
única entrada de producción competitiva; `server/composition/demo.ts` y `infrastructure/mock/` solo
sirven para demo, práctica y tests. Los barrels `components/game/demo`, `production` y `practice`
evitan mezclar esas superficies. La explicación completa de
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

Mini-Wordle carga bajo demanda vocabularios españoles de cuatro y cinco letras generados offline desde Hunspell. El recurso está versionado en el repositorio, no requiere backend y el cronómetro no comienza hasta que está disponible. Consulta [la documentación del diccionario](docs/content/guidelines/mini-wordle-dictionary.md) para regeneración, configuración y licencia.

La imagen progresiva espera a que el activo visual esté listo antes de iniciar el cronómetro. El desenfoque desaparece automáticamente, se puede responder en cualquier momento y un único fallo termina la ronda.

El laberinto contrarreloj usa una cuadrícula ortogonal controlada mediante cruceta o flechas. Conserva el recorrido para la revisión, finaliza al alcanzar la salida y no penaliza los movimientos adicionales.

Conectar parejas admite cuadrículas cuadradas de 4 × 4 a 8 × 8, con entre tres parejas y tantas como filas. Las rutas ortogonales unen símbolos iguales sin solapamientos y deben cubrir todo el tablero para resolver. Conserva rutas parciales en timeout y concede crédito por parejas conectadas y cobertura.

Memoria de parejas usa losetas ocultas en una cuadrícula compacta con símbolos, emojis o imágenes y etiqueta accesible. Conserva el historial de intentos para la revisión, concede crédito por cada pareja encontrada y resta un 10 % de los puntos base por cada fallo.

Todos los formatos de la biblioteca usan Flash Pop directamente mediante el registry único
`QuestionInput`. Las variantes que permanecen en los controles son semánticas (`primary`,
`secondary`, `reward`, etc.) y no representan temas. La cobertura automatizada y el estado de la
revisión manual se mantienen en [`docs/current/qa.md`](docs/current/qa.md). El informe manual de la
migración Flash Pop se conserva como [`documentación histórica`](docs/archive/redesign/qa-fase-4.md).

## Rediseño Flash Pop

La evolución visual y de experiencia hacia un juego más alegre, social, casual y cercano se conserva como proceso histórico en [`docs/archive/redesign/README.md`](docs/archive/redesign/README.md). El estado actual de sus comprobaciones está documentado en [`docs/current/qa.md`](docs/current/qa.md).
