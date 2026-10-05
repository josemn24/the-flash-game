> Estado: vigente. Catálogo del design system de The Flash. Revisado: 2026-10-05.

# Design system

`npm run dev` habilita `/design-system`: documentación navegable de Flash Pop con las APIs actuales,
componentes de presentación reales y datos ficticios. Los ejemplos solo modifican estado local;
no requieren Supabase, autenticación ni persistencia. Se conservan los tokens, fuentes, capas CSS y
comportamientos de los componentes existentes.

## Acceso y navegación

| Ruta                                 | Contenido                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `/design-system`                     | Introducción, inventario y mejoras pendientes                              |
| `/design-system/fundamentos`         | Color, contraste, tipografía, espaciado, radios, elevación y movimiento    |
| `/design-system/componentes/[slug]`  | Botones, chips, avatares, superficies, navegación, temporizadores e iconos |
| `/design-system/patrones/[slug]`     | Formularios, feedback, rankings, revisión y carga/vacío                    |
| `/design-system/accesibilidad`       | Teclado, foco, contraste, anuncios y movimiento reducido                   |
| `/design-system/preview/[exampleId]` | Ejemplos aislados con su propio documento y landmarks                      |

En escritorio se utiliza navegación lateral agrupada; en móvil, un select nativo. Las fichas
incluyen breadcrumbs, enlaces a secciones y un destino activo accesible. El enlace inicial permite
saltar directamente al contenido. Los slugs e IDs desconocidos devuelven HTTP 404. El proxy valida
los destinos con el registro antes de que empiece el streaming; las páginas también usan `notFound`.

Todas las páginas heredan `noindex, nofollow` del layout del catálogo. La disponibilidad depende
exclusivamente de `NODE_ENV === "development"`. El [proxy](../../proxy.ts) intercepta el catálogo y
el antiguo UI kit antes de actualizar la sesión; el [layout](../../app/design-system/layout.tsx)
comprueba de nuevo la disponibilidad. Un build de producción, incluido un despliegue de preview,
responde HTTP 404, `Cache-Control: no-store` y `X-Robots-Tag: noindex, nofollow`, sin contenido del catálogo.

`/demo/flash-pop/ui-kit` redirige temporalmente a `/design-system` en desarrollo. El alias histórico
`/flash-pop/ui-kit` conserva su primera redirección permanente y después obtiene el mismo resultado.
Estas rutas y el catálogo están excluidos del service worker; la caché de páginas v3 retira las
copias de las versiones anteriores al activarse. El archivo público `/sw.js` no requiere sesión.

## Organización y fuentes de verdad

- [`app/design-system`](../../app/design-system/layout.tsx) contiene rutas, metadatos y guards.
  El grupo `(docs)` utiliza el shell de documentación; los previews no lo incluyen.
- [`features/design-system/registry.ts`](../../features/design-system/registry.ts) define fichas
  tipadas, navegación, slugs válidos y ejemplos disponibles. Cada ficha recoge propósito, uso,
  propiedades y valores por defecto, estados, accesibilidad y código.
- [`examples/CatalogExample.tsx`](../../features/design-system/examples/CatalogExample.tsx) conecta
  IDs con renderizadores. Las demos interactivas y sus fixtures están junto a este registro, sin
  stores globales ni fachadas de datos. Su estado y datos se podrán reutilizar al añadir Storybook.
- [`app/globals.css`](../../app/globals.css) sigue siendo la fuente de verdad de tokens. Los
  fundamentos leen valores reales y estilos computados; no mantienen una segunda paleta o escala.
  Los 60 pares de color conservan sus comprobaciones de contraste.
- Los componentes de servidor construyen documentación; los componentes de cliente gestionan
  navegación activa, demos, medidas de iframes y lectura de estilos computados.
- Los estilos del catálogo permanecen en CSS Modules y `app-components`. Sus selectores de
  documentación no deben alcanzar controles o contenido de las demos. Los patrones de formulario
  reutilizan directamente los estilos administrativos actuales.

Las vistas completas se incluyen en iframes del mismo origen, con título accesible y altura medida
según el contenido. Esto conserva sus encabezados, landmarks e IDs originales sin cambiar sus APIs.
Solo se monta una variante de ranking por documento para evitar repetir sus identificadores.
En las vistas con altura mínima de viewport, los controles de simulación se montan mediante un
portal junto al iframe: el estado sigue siendo local al ejemplo, sin tapar contenido ni provocar
un ciclo de crecimiento al medir su altura. En el preview directo los controles permanecen en su
propio documento.

## Consultar las fichas y demos

Las fichas documentan los aliases y la precedencia existentes: `size=default` equivale a `md`,
`size=hero` fuerza la apariencia hero, `Card.density` tiene prioridad sobre `padding` y `GameHeader.right`
sustituye a `timer` y `action`. Los nombres `social` y `danger` siguen siendo las variantes actuales,
aunque sus colores correspondan a los roles `selected` y `error`.

Las acciones simuladas anuncian su resultado y ofrecen reinicio cuando procede. Formularios permite
provocar validación, envío, error, reintento y éxito; feedback permite elegir resultado o aviso;
rankings permite filas, tarjetas, selección y vacío; revisión conserva `details` nativo; carga/vacío
alterna skeletons y contenido. El temporizador inicia una cuenta real y puede reiniciarse.

Los criterios de color y transparencia están en [`design-tokens.md`](design-tokens.md). El contrato
de texto normal es 4,5:1 y el de foco e indicadores esenciales, 3:1. Los delimitadores decorativos y
controles inactivos tienen sus propios roles y no deben usarse para información legible.

La preferencia de movimiento reducido aplica las reglas CSS actuales. Las animaciones JavaScript
de MotionButton y feedback necesitan una revisión específica de su contrato; el catálogo documenta
este límite sin modificar componentes en esta fase. La cuenta atrás mantiene su dato temporal.

## Ampliar y verificar

1. Añadir o actualizar la ficha en el registro, usando la API implementada como referencia.
2. Crear un ejemplo local, determinista y con datos ficticios; registrar su renderizador.
3. Aislar vistas con landmarks o IDs propios mediante `isolated: true`.
4. Comprobar propósito, valores por defecto, precedencia, estados y accesibilidad.
5. Ejecutar las pruebas del registro y las pruebas de navegador del catálogo.

```sh
npm test -- features/design-system/registry.test.ts proxy.test.ts app/demo/flash-pop/ui-kit/page.test.tsx
npm run test:e2e:design-system
npm run test:e2e:design-system:production
npm run test:pwa:worker
```

Los comandos de navegador son independientes del stack Supabase y utilizan servidores dedicados,
directorios de build separados y claves vacías. El comando de producción ejecuta `build` y `start`
antes de comprobar los 404 y la exclusión PWA. El runner retira los includes generados por Next de
la configuración TypeScript, preservando cambios ajenos a la ejecución.

La suite de desarrollo recorre todas las fichas y previews a 390 y 1280 px; comprueba navegación,
foco, ausencia de desbordamiento, IDs únicos, reinicios y ausencia de llamadas al backend. Las
pruebas de tokens comprueban la cascada real, contraste y movimiento reducido en esos tamaños.

Las puertas del repositorio siguen siendo `type-architecture`, `style-architecture`, `stylelint`,
`typecheck`, `lint`, `format:check`, `docs:check`, las pruebas afectadas, el service worker y `build`.

## Trabajo posterior

| Hueco observado                                      | Propuesta para una siguiente fase                               |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| Campos nativos y estilos repetidos                   | Primitiva compartida de campo, label, ayuda, error y estados    |
| Avisos de juego y administración con APIs diferentes | Unificar intención, semántica y composición de avisos           |
| Aliases de tamaños y convivencia de density/padding  | Precisar la API canónica y estudiar una migración explícita     |
| Variantes social/danger y blue/aqua                  | Alinear nomenclatura con roles y revisar variantes equivalentes |
| Animaciones JavaScript                               | Definir y comprobar una alternativa con movimiento reducido     |
| Documentación interactiva adicional                  | Reutilizar ejemplos y fixtures como historias de Storybook      |

Estas propuestas no alteran las APIs ni migran pantallas en esta fase. Storybook, MDX, nuevas
dependencias y un editor genérico de propiedades quedan fuera del catálogo actual. Los documentos
de [`archive/`](../archive/README.md) mantienen su valor histórico.
