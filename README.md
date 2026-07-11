# The Flash PoC

The Flash es un juego de preguntas en solitario diseñado como un sprint contra el reloj. Esta prueba de concepto permite jugar una etapa completa de diez preguntas, consultar el resultado detallado y volver a intentarlo.

## Qué incluye

- Una etapa demo con diez preguntas de cultura general.
- Elección múltiple, verdadero o falso, respuesta corta y preguntas visuales.
- Temporizador individual y avance automático al agotarse el tiempo.
- Puntuación que premia las respuestas rápidas y aplica penalizaciones según el formato.
- Resultados con precisión, aciertos, fallos, preguntas sin contestar y tiempo total.
- Revisión completa de respuestas y opción de repetición.
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

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run lint` | Comprueba la calidad estática del código. |
| `npm run build` | Genera la compilación optimizada de producción. |
| `npm run start` | Sirve localmente una compilación de producción. |

## Estructura principal

```text
app/          Página, layout y estilos globales
components/   Pantallas y componentes interactivos
data/         Etapa demo y preguntas locales
lib/          Puntuación, validación y utilidades
types/        Tipos del juego
docs/         Especificación funcional del PoC
```

## Alcance

Esta versión está centrada exclusivamente en validar la experiencia de una etapa individual. No incluye usuarios, salas, multijugador, rankings, panel de administración, persistencia ni gestión de imágenes.
