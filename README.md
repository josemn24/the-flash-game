# The Flash

The Flash es un juego de preguntas diseñado como un sprint contra el reloj. La versión actual
permite jugar desafíos mock dentro de una sala simulada, consultar resultados detallados, revisar
respuestas y explorar una biblioteca interactiva de 31 formatos.

## Qué incluye

- Una sala demo local con temporada activa, siete definiciones de desafío y seis publicaciones mock.
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

La aplicación no utiliza todavía backend, base de datos, autenticación real ni servicios externos.
Sus Server Components leen una DAL asíncrona server-only respaldada por un store mock normalizado.

## Requisitos

- Node.js 20.9 o superior.
- npm.

## Instalación y ejecución

Instala las dependencias:

```bash
npm install
```

Inicia el entorno de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador. No es necesario configurar ninguna variable de entorno ni servicio adicional.

## Comandos disponibles

| Comando                       | Descripción                                               |
| ----------------------------- | --------------------------------------------------------- |
| `npm run dev`                 | Inicia el servidor de desarrollo.                         |
| `npm run lint`                | Comprueba la calidad estática del código.                 |
| `npm run typecheck`           | Valida todos los contratos TypeScript sin emitir código.  |
| `npm run type-architecture`   | Comprueba las dependencias entre las capas de tipos.      |
| `npm test`                    | Ejecuta los tests unitarios con Vitest.                   |
| `npm run build`               | Genera la compilación optimizada de producción.           |
| `npm run start`               | Sirve localmente una compilación de producción.           |
| `npm run dictionary:generate` | Regenera el vocabulario español de Mini-Wordle.           |
| `npm run dictionary:check`    | Comprueba que el vocabulario versionado esté actualizado. |
| `npm run format:check`        | Comprueba el formato con Prettier.                        |

## Estructura principal

```text
application/     Contratos de consultas y presentación independiente del framework
app/             Rutas, layout, metadata y estilos globales
components/      Pantallas, UI universal e islas interactivas
data/            Fixtures canónicos, store normalizado y proyecciones legacy
features/        Sesión de juego y catálogo de formatos
infrastructure/  Adaptadores mock de los contratos de aplicación
lib/             Puntuación, validación y utilidades puras
server/          Fachada server-only usada por las rutas de producto
types/           Dominio, contratos, gameplay y view models
docs/            Estado funcional, evolución y arquitectura
scripts/         Comprobaciones y generadores deterministas
```

## Modelo de dominio

Las reglas aprobadas para la futura persistencia con Supabase, incluidos usuarios, salas,
temporadas, publicaciones, intentos, rankings y límites de seguridad, se mantienen en
[`docs/current/domain/README.md`](docs/current/domain/README.md).

## Convenciones de estilos

- `app/globals.css` contiene únicamente Tailwind, tokens del tema, reset, estilos base y preferencias globales de accesibilidad.
- Tailwind se utiliza para layout, espaciado, responsive y ajustes visuales sencillos directamente en los componentes.
- El CSS personalizado de un componente se mantiene en su archivo `*.module.css` adyacente, especialmente para estados, pseudoelementos, ilustraciones y efectos complejos.
- Los módulos consumen variables globales, pero no dependen de otros módulos ni exponen selectores globales.
- Una nueva primitiva visual compartida solo se extrae cuando al menos dos componentes comparten también estructura y comportamiento.

## Alcance

Esta versión valida la experiencia individual y social simulada dentro de una sala local con
temporada, miembros, rankings e historial derivados de datos canónicos. La capa de acceso de la
fase 4 está cerrada, pero no incluye creación de salas, panel de administración, backend, base de
datos, autenticación real ni persistencia de nuevos intentos.

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
revisión manual se mantienen en [`docs/current/qa/qa-fase-4.md`](docs/current/qa/qa-fase-4.md).

## Rediseño Flash Pop

La evolución visual y de experiencia hacia un juego más alegre, social, casual y cercano se conserva como proceso histórico en [`docs/archive/redesign/README.md`](docs/archive/redesign/README.md). El estado actual de sus quality gates está documentado en [`docs/current/qa/qa-fase-4.md`](docs/current/qa/qa-fase-4.md).
