# Arquitectura de Server y Client Components

## Propósito

Este documento define cómo separar Server Components y Client Components en The Flash. Su objetivo es mantener una arquitectura clara y escalable sin perjudicar la experiencia de juego.

La regla principal es:

> El contenido, la navegación y la carga de datos se resuelven en el servidor. Las experiencias interactivas, inmediatas y coordinadas se ejecutan en el cliente.

No se busca maximizar el número de Server Components. Se busca colocar cada frontera donde mejore el rendimiento, la claridad del código y la experiencia del jugador.

## Principios

1. **Servidor por defecto.** Todo componente nuevo será Server Component salvo que necesite capacidades exclusivas del cliente.
2. **Cliente por una razón concreta.** Estado, eventos, efectos, APIs del navegador o una experiencia interactiva cohesionada justifican una frontera cliente.
3. **Fronteras bajas y explícitas.** Una animación o botón interactivo no debe convertir innecesariamente una página completa en Client Component.
4. **El juego es una unidad interactiva.** La sesión jugable puede mantener una frontera cliente amplia cuando sus pantallas comparten estado y requieren respuesta inmediata.
5. **Datos mínimos entre servidor y cliente.** Solo se serializará la información que la interfaz cliente necesite realmente.
6. **CSS antes que JavaScript para decoración.** Hover, foco y animaciones sencillas deben resolverse preferentemente con CSS.
7. **Motion se usa con intención.** Se reserva para transiciones coordinadas, presencia, gestos, arrastre y animaciones dependientes del estado.

## Categorías de componentes

### Server Components

Son la opción predeterminada en App Router. Se usarán para:

- páginas y layouts;
- lectura y composición de datos;
- resolución de parámetros de ruta;
- `generateMetadata` y `generateStaticParams`;
- validación y `notFound()`;
- contenido editorial;
- listados y fichas;
- navegación mediante `Link`;
- ejemplos no interactivos;
- estructuras que no necesitan estado ni eventos del navegador.

Un Server Component no añade su implementación al bundle JavaScript del navegador.

```tsx
// app/formatos/page.tsx
import { questionFormats } from "@/features/question-formats/catalog";
import { FormatList } from "@/features/format-library/FormatList";

export default function FormatsPage() {
  return <FormatList formats={questionFormats} />;
}
```

### Client Components

Se identificarán mediante `"use client"` y se usarán cuando el componente necesite:

- `useState`, `useReducer`, `useEffect` u otros hooks de ciclo de vida;
- manejadores como `onClick`, `onChange` u `onSubmit`;
- `window`, `document`, almacenamiento local u otras APIs del navegador;
- temporizadores que formen parte de la interacción;
- estado de partida;
- drag-and-drop, gestos o entrada de usuario;
- animaciones coordinadas con el estado;
- contextos cliente.

```tsx
// features/game/GameApp.client.tsx
"use client";

export function GameApp({ stage }: { stage: Stage }) {
  const session = useGameSession(stage);
  // Flujo interactivo completo de la partida.
}
```

Los Client Components también pueden generar HTML durante el renderizado inicial. La diferencia es que su código se envía e hidrata en el navegador.

### Componentes universales

Son componentes puros sin `"use client"`, acceso al servidor ni APIs del navegador. Pueden formar parte tanto del grafo servidor como del grafo cliente según quién los importe.

Ejemplos:

- `Badge`;
- `AppHeader`;
- `Logo`;
- funciones de clases y variantes;
- iconos SVG;
- primitivas HTML sin comportamiento interactivo propio.

Esta categoría permite reutilizar UI sin imponer hidratación a todas sus apariciones.

## Árbol de decisión

Antes de añadir `"use client"`, se responderán estas preguntas en orden:

1. **¿El componente usa estado, efectos, eventos o APIs del navegador?**
   - Sí: Client Component.
   - No: continuar.
2. **¿Forma parte de una experiencia cliente ya cohesionada, como la sesión de juego?**
   - Sí: puede permanecer dentro de esa frontera cliente.
   - No: continuar.
3. **¿Solo necesita una animación decorativa sencilla?**
   - Sí: usar CSS y mantenerlo en servidor.
   - No: continuar.
4. **¿Necesita Motion por presencia, layout, gestos o coordinación con estado?**
   - Sí: extraer una isla cliente pequeña o usar la frontera cliente existente.
   - No: Server Component.
5. **¿Los datos que recibe son mayores que los que muestra?**
   - Sí: crear un DTO específico antes de cruzar la frontera.

## Dirección de dependencias

Las dependencias deben seguir estas reglas:

```text
Server Component ──puede importar──▶ Client Component
Server Component ──puede importar──▶ componente universal
Client Component ──puede importar──▶ componente universal
Client Component ──no debe importar▶ Server Component
```

Un Server Component que renderiza un Client Component no se convierte en cliente. La frontera comienza en el archivo marcado con `"use client"`.

Un Client Component no importará directamente un Server Component. Si necesita mostrar contenido producido en el servidor, este se compondrá desde el padre servidor y se pasará como `children` u otra ranura de React.

```tsx
// Server Component
export function Page() {
  return (
    <InteractivePanel>
      <ServerRenderedContent />
    </InteractivePanel>
  );
}
```

## Datos que cruzan la frontera

Las propiedades enviadas de servidor a cliente deben ser serializables y mínimas.

Se permiten normalmente:

- cadenas, números y booleanos;
- arrays y objetos planos;
- valores `null`;
- estructuras de dominio serializables.

No se pasarán:

- funciones convencionales;
- instancias de clases;
- conexiones, clientes de base de datos o secretos;
- objetos grandes cuando la interfaz solo usa un resumen;
- módulos completos de contenido por comodidad.

### DTO de portada

La portada no necesita las preguntas de cada etapa. Debe recibir un resumen:

```ts
export type StageSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  questionCount: number;
};
```

La etapa completa solo cruza la frontera al entrar en la ruta jugable, donde `GameApp` sí la necesita.

```text
HomePage (server) ──StageSummary[]──▶ portada
StagePage (server) ──Stage──────────▶ GameApp (client)
```

## Uso de Motion

Motion es compatible con App Router de dos formas:

```tsx
// Client Component explícito
"use client";
import { motion } from "motion/react";
```

```tsx
// Uso desde React Server Components
import * as motion from "motion/react-client";
```

Ambas opciones necesitan código cliente para ejecutar la animación. `motion/react-client` permite que el archivo importador siga siendo Server Component, pero no elimina el coste de hidratación del elemento animado.

### Convención del proyecto

1. Para hover, foco, opacidad o desplazamientos sencillos se usará CSS.
2. Dentro del juego se usará `motion/react`, porque la sesión ya es una experiencia cliente.
3. En páginas de contenido se preferirá una isla con nombre explícito, por ejemplo `AnimatedHero.client.tsx`.
4. `motion/react-client` se reservará para elementos pequeños y autocontenidos cuando evite una frontera artificial.
5. No se convertirá una página completa en cliente únicamente para animar su entrada.
6. Se respetará `prefers-reduced-motion` y ninguna animación será imprescindible para comprender o completar una acción.

### Cuándo usar Motion

- `AnimatePresence` entre estados del juego;
- transiciones de preguntas;
- feedback inmediato después de responder;
- elementos reordenables o arrastrables;
- animaciones ligadas al temporizador o progreso;
- gestos táctiles;
- cambios de layout difíciles de mantener con CSS.

### Cuándo usar CSS

- hover y foco de tarjetas;
- cambios de borde o color;
- pulsaciones sencillas;
- entrada estática de una página;
- brillos, fondos, líneas y efectos ambientales;
- animaciones que no dependen del estado de React.

## Primitivas UI

Las primitivas básicas no deben imponer Motion a toda la aplicación.

La arquitectura preferida para botones es:

```text
Button.tsx                 universal, HTML y estilos
MotionButton.client.tsx    cliente, gestos y animaciones
buttonStyles.ts            variantes compartidas
```

`Button` podrá usarse desde servidor o cliente. Cuando un Client Component lo importe, podrá pasarle eventos. Desde un Server Component servirá como botón de formulario, para una Server Action o como estructura visual sin manejadores cliente.

`MotionButton` se usará cuando `whileHover`, `whileTap`, gestos u otras capacidades de Motion aporten valor real.

No se duplicarán colores, tamaños ni variantes entre ambas primitivas; compartirán la misma función de estilos.

Para navegación se usará `Link`, no un botón con `router.push`, salvo que exista una razón ligada al estado cliente.

## Arquitectura por áreas

### Portada

La portada es principalmente contenido y navegación.

```text
app/page.tsx                   Server Component
└── HomeView                   Server Component
    ├── Hero                   servidor o CSS
    ├── StageList              Server Component
    └── AnimatedAccent         Client Component opcional
```

Requisitos:

- recibir `StageSummary[]`, no etapas completas;
- usar `Link` para abrir etapas y formatos;
- mantener metadata y contenido en servidor;
- usar CSS para animaciones decorativas siempre que sea suficiente.

### Biblioteca de formatos

La biblioteca y sus fichas son contenido estático y navegación. Deben ser Server Components.

```text
app/formatos/page.tsx          Server Component
app/formatos/[slug]/page.tsx   Server Component
├── FormatList                 Server Component
├── FormatDetail               Server Component
└── FormatExample              Server Component
```

Solo se añadirá una isla cliente si aparece una interacción real, como búsqueda local, filtros dinámicos complejos o una demostración jugable.

Un filtro basado en parámetros de URL seguirá resolviéndose preferentemente en el servidor.

### Sesión de juego

La partida debe priorizar latencia mínima, continuidad y respuesta inmediata.

```text
app/etapas/[stageId]/page.tsx  Server Component
└── GameApp                    Client Component
    ├── useGameSession
    ├── QuestionScreen
    ├── Timer
    ├── renderizadores
    ├── transiciones
    ├── resultados
    └── revisión
```

La ruta servidor:

- valida `stageId`;
- carga la etapa;
- genera metadata;
- devuelve 404 cuando corresponde;
- entrega la configuración serializable a `GameApp`.

El árbol cliente:

- conserva la sesión en memoria;
- mide el tiempo;
- procesa respuestas;
- coordina transiciones;
- calcula y muestra resultados sin viajes de red.

No se separarán resultados o revisión como Server Components mientras dependan del reducer local. Hacerlo exigiría persistencia externa o navegación con datos serializados y rompería la continuidad de la partida.

## Organización y nombres

Cuando la naturaleza de un componente no resulte evidente, se usarán sufijos explícitos:

```text
GameApp.client.tsx
MotionButton.client.tsx
AnimatedHero.client.tsx
StagePage.tsx
FormatDetail.tsx
```

No es obligatorio añadir `.server.tsx` a todos los Server Components, porque ya son el valor predeterminado. Puede utilizarse en módulos sensibles para hacer visible una restricción importante.

Los barrels o archivos `index.ts` no mezclarán indiscriminadamente exports servidor y cliente. Una importación accidental desde un barrel cliente puede ampliar el bundle o invalidar la dirección de dependencias.

## Antipatrones

### Página completa cliente por una animación

```tsx
"use client";

export default function FormatsPage() {
  return <motion.main>{/* Todo el catálogo */}</motion.main>;
}
```

Solución: mantener la página en servidor y usar CSS o extraer únicamente el elemento animado.

### Enviar objetos completos a una tarjeta

```tsx
<StartScreen stages={stagesWithAllQuestions} />
```

Solución: mapear a `StageSummary[]` en el servidor.

### Crear una isla cliente por cada elemento del juego

Fragmentar artificialmente una experiencia que comparte reducer, temporizador y transiciones aumenta la complejidad sin reducir de forma útil el bundle.

Solución: mantener una frontera cliente cohesionada alrededor de `GameApp`.

### Duplicar UI de servidor y cliente

No se crearán dos sistemas visuales independientes. Las variantes, tokens y clases deben compartirse entre la primitiva universal y su mejora Motion.

### Navegar con eventos sin necesidad

```tsx
<button onClick={() => router.push("/formatos")}>Formatos</button>
```

Solución: usar `<Link href="/formatos">Formatos</Link>` para conservar semántica, prefetch y navegación accesible.

## Checklist para nuevos componentes

Antes de aprobar un componente nuevo:

- [ ] ¿Puede permanecer como Server Component?
- [ ] Si usa `"use client"`, ¿existe una necesidad concreta documentable?
- [ ] ¿La frontera cliente está situada lo más abajo posible sin fragmentar una experiencia cohesionada?
- [ ] ¿Las propiedades que cruzan la frontera son serializables?
- [ ] ¿Se está enviando solo la información necesaria?
- [ ] ¿Una animación CSS sería suficiente?
- [ ] Si usa Motion, ¿aporta interacción o feedback relevante?
- [ ] ¿Respeta reducción de movimiento?
- [ ] ¿La navegación usa `Link` cuando corresponde?
- [ ] ¿Evita importar código servidor desde el cliente?
- [ ] ¿Evita barrels que mezclen dependencias servidor y cliente?
- [ ] ¿La interacción conserva accesibilidad por teclado y foco visible?

## Criterio final

La decisión no se toma según si una pantalla es visualmente compleja, sino según dónde viven sus datos y su interacción:

- **Mostrar, explicar, listar y navegar:** servidor.
- **Jugar, responder, medir tiempo y reaccionar sin latencia:** cliente.
- **Decorar:** CSS primero; Motion cuando aporte valor.
- **Compartir UI:** primitivas universales con mejoras cliente explícitas.

Esta separación permite que la aplicación crezca en contenido sin aumentar innecesariamente su JavaScript, mientras mantiene el juego como una experiencia fluida, inmediata y rica en interacción.

## Referencias

- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js: App Router](https://nextjs.org/docs/app)
- [Motion: instalación con Next.js](https://motion.dev/docs/react-installation)
- [Motion: componente `motion`](https://motion.dev/docs/react-motion-component)
