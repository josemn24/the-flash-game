# Server and Client Component Architecture

## Purpose

This document defines how Server Components and Client Components should be separated in The Flash. Its goal is to maintain a clear and scalable architecture without compromising the gameplay experience.

The main rule is:

> Content, navigation, and data loading are handled on the server. Interactive, immediate, and coordinated experiences run on the client.

The goal is not to maximize the number of Server Components. The goal is to place each boundary where it improves performance, code clarity, and the player experience.

## Principles

1. **Server by default.** Every new component will be a Server Component unless it requires client-only capabilities.
2. **Client for a specific reason.** State, events, effects, browser APIs, or a cohesive interactive experience justify a client boundary.
3. **Low and explicit boundaries.** An animation or interactive button should not unnecessarily turn an entire page into a Client Component.
4. **The game is an interactive unit.** The gameplay session may keep a broad client boundary when its screens share state and require immediate responses.
5. **Minimal data between server and client.** Only the information actually required by the client interface will be serialized.
6. **CSS before JavaScript for decoration.** Hover, focus, and simple animations should preferably be implemented with CSS.
7. **Motion is used intentionally.** It is reserved for coordinated transitions, presence, gestures, dragging, and state-dependent animations.

## Component categories

### Server Components

Server Components are the default in the App Router. They will be used for:

- pages and layouts;
- reading and composing data;
- resolving route parameters;
- `generateMetadata` and `generateStaticParams`;
- validation and `notFound()`;
- editorial content;
- lists and detail pages;
- navigation with `Link`;
- non-interactive examples;
- structures that do not require state or browser events.

A Server Component does not add its implementation to the browser's JavaScript bundle.

```tsx
// app/formatos/page.tsx
import { questionFormats } from "@/features/question-formats/catalog";
import { FormatList } from "@/features/format-library/FormatList";

export default function FormatsPage() {
  return <FormatList formats={questionFormats} />;
}
```

### Client Components

Client Components will be identified with `"use client"` and used when a component requires:

- `useState`, `useReducer`, `useEffect`, or other lifecycle hooks;
- handlers such as `onClick`, `onChange`, or `onSubmit`;
- `window`, `document`, local storage, or other browser APIs;
- timers that are part of the interaction;
- game session state;
- drag-and-drop, gestures, or user input;
- animations coordinated with state;
- client-side contexts.

```tsx
// components/GameApp.client.tsx
"use client";

export function GameApp({ stage }: { stage: Stage }) {
  const session = useGameSession(stage);
  // Complete interactive game flow.
}
```

Client Components can also generate HTML during the initial server render. The difference is that their code is sent to and hydrated in the browser.

### Universal components

Universal components are pure components without `"use client"`, server access, or browser APIs. They can become part of either the server or client graph depending on where they are imported.

Examples:

- `Badge`;
- `AppHeader`;
- `Logo`;
- class and variant functions;
- SVG icons;
- HTML primitives without their own interactive behavior.

This category allows UI to be reused without forcing hydration on every usage.

## Decision tree

Before adding `"use client"`, answer these questions in order:

1. **Does the component use state, effects, events, or browser APIs?**
   - Yes: Client Component.
   - No: continue.
2. **Is it part of an existing cohesive client experience, such as the gameplay session?**
   - Yes: it may remain inside that client boundary.
   - No: continue.
3. **Does it only need a simple decorative animation?**
   - Yes: use CSS and keep it on the server.
   - No: continue.
4. **Does it need Motion for presence, layout, gestures, or state coordination?**
   - Yes: extract a small client island or use the existing client boundary.
   - No: Server Component.
5. **Is the data it receives larger than the data it displays?**
   - Yes: create a specific DTO before crossing the boundary.

## Dependency direction

Dependencies must follow these rules:

```text
Server Component ──may import──▶ Client Component
Server Component ──may import──▶ universal component
Client Component ──may import──▶ universal component
Client Component ──must not import▶ Server Component
```

A Server Component that renders a Client Component does not become a Client Component. The boundary begins at the file marked with `"use client"`.

A Client Component must not directly import a Server Component. If it needs to display server-produced content, that content must be composed by the server parent and passed as `children` or another React slot.

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

## Data crossing the boundary

Props sent from server to client must be serializable and minimal.

Normally allowed:

- strings, numbers, and booleans;
- arrays and plain objects;
- `null` values;
- serializable domain structures.

Do not pass:

- regular functions;
- class instances;
- connections, database clients, or secrets;
- large objects when the interface only uses a summary;
- entire content modules for convenience.

### Home page view model

The home page does not need the questions from every stage. Although both the page and `StartScreen` are Server Components, the page maps each stage to a summary to keep the home view decoupled from playable question data:

```ts
export type StageSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  questionCount: number;
};
```

The complete stage only crosses a server-client boundary when entering the playable route, where `GameApp` actually needs it. A format detail sends each example question separately to its own playable-example island.

```text
HomePage (server) ──StageSummary[]──▶ StartScreen (server)
StagePage (server) ──Stage──────────▶ GameApp (client)
FormatDetailPage (server) ──Question──▶ PlayableFormatExample (client)
```

## Using Motion

Motion supports the App Router in two ways:

```tsx
// Explicit Client Component
"use client";
import { motion } from "motion/react";
```

```tsx
// Usage from React Server Components
import * as motion from "motion/react-client";
```

Both options require client-side code to run the animation. `motion/react-client` allows the importing file to remain a Server Component, but it does not remove the hydration cost of the animated element.

### Project convention

1. Use CSS for simple hover, focus, opacity, or movement effects.
2. Use `motion/react` inside the game because the session is already a client experience.
3. On content pages, prefer an explicitly named island such as `AnimatedHero.client.tsx`.
4. Reserve `motion/react-client` for small, self-contained elements when it avoids an artificial boundary.
5. Do not turn an entire page into a Client Component only to animate its entrance.
6. Respect `prefers-reduced-motion`, and never make an animation essential to understanding or completing an action.

### When to use Motion

- `AnimatePresence` between game states;
- question transitions;
- immediate feedback after answering;
- reorderable or draggable elements;
- animations connected to the timer or progress;
- touch gestures;
- layout changes that are difficult to maintain with CSS.

### When to use CSS

- card hover and focus states;
- border or color changes;
- simple press feedback;
- static page entrance animations;
- glows, backgrounds, lines, and ambient effects;
- animations that do not depend on React state.

## UI primitives

Basic primitives must not impose Motion on the whole application.

The preferred button architecture is:

```text
Button.tsx                 universal, HTML and styles
MotionButton.client.tsx    client, gestures and animations
buttonStyles.ts            shared variants
```

`Button` can be used from either server or client code. When imported by a Client Component, it can receive events. From a Server Component, it can serve as a form button, invoke a Server Action, or provide visual structure without client event handlers.

`MotionButton` should be used when `whileHover`, `whileTap`, gestures, or other Motion features provide meaningful value.

Colors, sizes, and variants must not be duplicated between the two primitives; both must share the same styling function.

Use `Link` for navigation rather than a button with `router.push`, unless there is a reason tied to client state.

## Architecture by area

### Home page

The home page primarily contains content and navigation.

```text
app/page.tsx                   Server Component
└── StartScreen                Server Component
    ├── Hero                   Server Component with CSS animation
    └── StageList              Server Component
```

Requirements:

- receive `StageSummary[]`, not complete stages;
- use `Link` to open stages and formats;
- keep metadata and content on the server;
- use CSS for decorative animations whenever it is sufficient.

### Format library

The format library and its detail pages contain server-rendered editorial content and navigation. Each detail page includes one explicit client island per playable example.

```text
app/formatos/page.tsx          Server Component
app/formatos/[slug]/page.tsx   Server Component
└── PlayableFormatExample      Client Component
    ├── dialog and attempt state
    ├── Timer and QuestionInput
    └── evaluation and feedback
```

`PlayableFormatExample.client.tsx` receives one serializable `Question`, opens a native dialog, and reuses the same input renderers and scoring functions as a stage. Its local phases are `ready`, `playing`, and `feedback`; closing or retrying resets the attempt without changing the route.

The correct answer is included in this client DTO because the example is evaluated locally and has no persistent or competitive value. It must never contain secrets or privileged server data.

Only add another client island when a real interaction appears, such as local search or complex dynamic filters.

A filter based on URL parameters should still preferably be resolved on the server.

### Gameplay session

Gameplay must prioritize minimal latency, continuity, and immediate responses.

```text
app/etapas/[stageId]/page.tsx  Server Component
└── GameApp.client             Client Component
    ├── useGameSession
    ├── QuestionScreen
    ├── Timer
    ├── renderers
    ├── transitions
    ├── results
    └── review
```

The server route:

- validates `stageId`;
- loads the stage;
- generates metadata;
- returns a 404 when appropriate;
- passes serializable configuration to `GameApp`.

The client tree:

- keeps the session in memory;
- measures time;
- processes answers;
- coordinates transitions;
- calculates and displays results without network round trips.

Results and review must not be split into Server Components while they depend on the local reducer. Doing so would require external persistence or navigation with serialized data and would break gameplay continuity.

## Organization and naming

When the nature of a component is not obvious, use explicit suffixes:

```text
GameApp.client.tsx
MotionButton.client.tsx
AnimatedHero.client.tsx
StagePage.tsx
FormatDetail.tsx
```

Adding `.server.tsx` to every Server Component is not required because server is already the default. It may be used in sensitive modules to make an important restriction visible.

Barrel files or `index.ts` files must not indiscriminately mix server and client exports. An accidental import from a client barrel can expand the bundle or violate the intended dependency direction.

## Anti-patterns

### Making a whole page client-side for one animation

```tsx
"use client";

export default function FormatsPage() {
  return <motion.main>{/* Entire catalog */}</motion.main>;
}
```

Solution: keep the page on the server and use CSS or extract only the animated element.

### Sending complete objects to a card

```tsx
<StartScreen stages={stagesWithAllQuestions} />
```

Solution: map the data to `StageSummary[]` on the server.

### Creating a client island for every game element

Artificially fragmenting an experience that shares a reducer, timer, and transitions increases complexity without meaningfully reducing the bundle.

Solution: keep a cohesive client boundary around `GameApp`.

### Duplicating server and client UI

Do not create two independent visual systems. Variants, tokens, and classes must be shared between the universal primitive and its Motion enhancement.

### Navigating with events unnecessarily

```tsx
<button onClick={() => router.push("/formatos")}>Formatos</button>
```

Solution: use `<Link href="/formatos">Formatos</Link>` to preserve semantics, prefetching, and accessible navigation.

## Checklist for new components

Before approving a new component:

- [ ] Can it remain a Server Component?
- [ ] If it uses `"use client"`, is there a specific, documentable need?
- [ ] Is the client boundary placed as low as possible without fragmenting a cohesive experience?
- [ ] Are props crossing the boundary serializable?
- [ ] Is only the required information being sent?
- [ ] Would a CSS animation be sufficient?
- [ ] If it uses Motion, does Motion provide meaningful interaction or feedback?
- [ ] Does it respect reduced-motion preferences?
- [ ] Does navigation use `Link` where appropriate?
- [ ] Does it avoid importing server code from the client?
- [ ] Does it avoid barrels that mix server and client dependencies?
- [ ] Does the interaction preserve keyboard accessibility and visible focus?

## Final criterion

The decision is not based on whether a screen is visually complex, but on where its data and interaction live:

- **Display, explain, list, and navigate:** server.
- **Play, answer, measure time, and react without latency:** client.
- **Decorate:** CSS first; Motion when it adds value.
- **Share UI:** universal primitives with explicit client enhancements.

This separation allows the application to grow in content without unnecessarily increasing its JavaScript while keeping gameplay fluid, immediate, and interaction-rich.

## References

- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js: App Router](https://nextjs.org/docs/app)
- [Motion: Installation with Next.js](https://motion.dev/docs/react-installation)
- [Motion: `motion` component](https://motion.dev/docs/react-motion-component)
