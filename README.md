# The Flash

The Flash es un juego de preguntas en solitario diseñado como un sprint contra el reloj. La versión actual permite elegir entre dos etapas de diez preguntas, consultar resultados detallados, revisar respuestas y explorar una biblioteca interactiva de formatos.

## Qué incluye

- Dos etapas locales de diez preguntas: una demo de cultura general y otra de conexiones rápidas.
- Nueve formatos: elección múltiple, encontrar el intruso, emparejar conceptos, verdadero o falso, respuesta corta, ordenar, clasificar, código lógico y estimación.
- Preguntas con imágenes o ilustraciones integradas en elección múltiple, encontrar el intruso y estimación.
- Temporizador individual y avance automático al agotarse el tiempo.
- Puntuación que premia las respuestas rápidas y aplica penalizaciones según el formato.
- Resultados con precisión, aciertos, fallos, preguntas sin contestar y tiempo total.
- Revisión completa de respuestas y opción de repetición.
- Biblioteca con reglas, recomendaciones, accesibilidad y puntuación de cada formato.
- Un ejemplo jugable y cronometrado desde cada ficha de formato.
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

| Comando                | Descripción                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Inicia el servidor de desarrollo.               |
| `npm run lint`         | Comprueba la calidad estática del código.       |
| `npm test`             | Ejecuta los tests unitarios con Vitest.         |
| `npm run build`        | Genera la compilación optimizada de producción. |
| `npm run start`        | Sirve localmente una compilación de producción. |
| `npm run format:check` | Comprueba el formato con Prettier.              |

## Estructura principal

```text
app/          Rutas, layout, metadata y estilos globales
components/   Pantallas, UI universal e islas interactivas
data/         Etapas y preguntas locales
features/     Sesión de juego y catálogo de formatos
lib/          Puntuación, validación y utilidades
types/        Tipos del dominio
docs/         Estado funcional, evolución y arquitectura
```

## Convenciones de estilos

- `app/globals.css` contiene únicamente Tailwind, tokens del tema, reset, estilos base y preferencias globales de accesibilidad.
- Tailwind se utiliza para layout, espaciado, responsive y ajustes visuales sencillos directamente en los componentes.
- El CSS personalizado de un componente se mantiene en su archivo `*.module.css` adyacente, especialmente para estados, pseudoelementos, ilustraciones y efectos complejos.
- Los módulos consumen variables globales, pero no dependen de otros módulos ni exponen selectores globales.
- Una nueva primitiva visual compartida solo se extrae cuando al menos dos componentes comparten también estructura y comportamiento.

## Alcance

Esta versión está centrada exclusivamente en validar la experiencia individual con etapas locales y ejemplos jugables. No incluye usuarios, salas, multijugador, rankings, panel de administración, backend, base de datos ni persistencia.

Las dos etapas conservan diez preguntas cada una y todavía no incluyen «Encontrar el intruso» ni «Emparejar conceptos»; ambos formatos están disponibles en el modelo nativo y en la biblioteca interactiva.
