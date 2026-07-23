# The Flash

The Flash es un juego de preguntas en solitario diseñado como un sprint contra el reloj. La versión actual permite elegir entre dos desafíos de diez preguntas, consultar resultados detallados, revisar respuestas y explorar una biblioteca interactiva de formatos.

## Qué incluye

- Una sala demo local con temporada activa y dos desafíos de diez preguntas.
- Veinticinco formatos: elección múltiple, encontrar el intruso, emparejar conceptos, conectar parejas, verdadero o falso, respuesta corta, ordenar, clasificar, código lógico, estimación, adivinanzas por pistas, mapa de calor, etiquetar imagen, memoria relámpago, memoria de parejas, Simon, matrices lógicas, mini-sudoku, mini-nonograma, rompecabezas deslizante, reconstrucción del error, anagramas, Mini-Wordle, imagen progresivamente revelada y laberinto contrarreloj.
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

La aplicación es 100 % frontend. No utiliza backend, base de datos, autenticación ni servicios externos.

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
| `npm test`                    | Ejecuta los tests unitarios con Vitest.                   |
| `npm run build`               | Genera la compilación optimizada de producción.           |
| `npm run start`               | Sirve localmente una compilación de producción.           |
| `npm run dictionary:generate` | Regenera el vocabulario español de Mini-Wordle.           |
| `npm run dictionary:check`    | Comprueba que el vocabulario versionado esté actualizado. |
| `npm run format:check`        | Comprueba el formato con Prettier.                        |

## Estructura principal

```text
app/          Rutas, layout, metadata y estilos globales
components/   Pantallas, UI universal e islas interactivas
data/         Sala demo, temporada activa, desafíos y tabla mock de preguntas
features/     Sesión de juego y catálogo de formatos
lib/          Puntuación, validación y utilidades
types/        Tipos del dominio
docs/         Estado funcional, evolución y arquitectura
scripts/      Generadores deterministas de recursos versionados
```

## Convenciones de estilos

- `app/globals.css` contiene únicamente Tailwind, tokens del tema, reset, estilos base y preferencias globales de accesibilidad.
- Tailwind se utiliza para layout, espaciado, responsive y ajustes visuales sencillos directamente en los componentes.
- El CSS personalizado de un componente se mantiene en su archivo `*.module.css` adyacente, especialmente para estados, pseudoelementos, ilustraciones y efectos complejos.
- Los módulos consumen variables globales, pero no dependen de otros módulos ni exponen selectores globales.
- Una nueva primitiva visual compartida solo se extrae cuando al menos dos componentes comparten también estructura y comportamiento.

## Alcance

Esta versión está centrada exclusivamente en validar la experiencia individual dentro de una sala demo local con temporada activa y ejemplos jugables. No incluye usuarios, creación de salas, multijugador, rankings, panel de administración, backend, base de datos ni persistencia.

Los dos desafíos conservan diez preguntas cada uno y resuelven su contenido desde una tabla mock `questionsById`. Los formatos que no aparecen en ellos, incluidos Conectar parejas, Memoria de parejas, Mini-Wordle, imagen progresivamente revelada y laberinto contrarreloj, siguen disponibles en el modelo nativo y en la biblioteca interactiva.

Mini-Wordle carga bajo demanda un vocabulario español de cuatro letras generado offline desde Hunspell. El recurso está versionado en el repositorio, no requiere backend y el cronómetro no comienza hasta que está disponible. Consulta [la documentación del diccionario](docs/mini-wordle-dictionary.md) para regeneración, métricas y licencia.

La imagen progresiva espera a que el activo visual esté listo antes de iniciar el cronómetro. El desenfoque desaparece automáticamente, se puede responder en cualquier momento y un único fallo termina la ronda.

El laberinto contrarreloj usa una cuadrícula ortogonal controlada mediante cruceta o flechas. Conserva el recorrido para la revisión, finaliza al alcanzar la salida y no penaliza los movimientos adicionales.

Conectar parejas usa una cuadrícula 5 × 5 con rutas ortogonales entre símbolos iguales. Conserva rutas parciales en timeout, concede crédito por parejas conectadas y cobertura, y exige cubrir todo el tablero para resolver.

Memoria de parejas usa losetas ocultas en una cuadrícula compacta con símbolos, emojis o imágenes y etiqueta accesible. Conserva el historial de intentos para la revisión, concede crédito por cada pareja encontrada y resta un 10 % de los puntos base por cada fallo.
