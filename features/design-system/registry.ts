export type PropertyDoc = readonly [
  name: string,
  values: string,
  defaultValue: string,
  usage: string,
];
export type ExampleDoc = { id: string; title: string; code: string; isolated?: boolean };
export type CatalogEntry = {
  slug: string;
  title: string;
  summary: string;
  when: readonly string[];
  properties: readonly PropertyDoc[];
  states: readonly string[];
  accessibility: readonly string[];
  examples: readonly ExampleDoc[];
};

export const componentEntries: readonly CatalogEntry[] = [
  {
    slug: "botones",
    title: "Botones",
    summary: "Acciones y enlaces con jerarquía explícita.",
    when: [
      "Primary para la acción principal; secondary para acciones complementarias.",
      "Button ejecuta una acción y ButtonLink navega. MotionButton añade animación sin añadir la API de carga de Button.",
      "IconButton sirve para acciones compactas con una etiqueta accesible obligatoria.",
    ],
    properties: [
      [
        "variant",
        "primary | secondary",
        "primary",
        "Compartida por Button, ButtonLink y MotionButton.",
      ],
      [
        "size",
        "sm | md | lg | default | hero",
        "md",
        "default equivale a md; hero resuelve lg y fuerza appearance=hero.",
      ],
      [
        "appearance",
        "default | hero",
        "default",
        "Preferir size=lg y appearance=hero para expresar ambas decisiones.",
      ],
      ["fullWidth", "boolean", "false", "Ocupa la anchura del contenedor."],
      [
        "ButtonLink.href",
        "destino de Next Link",
        "obligatorio",
        "Navega y muestra el indicador pendiente de Next.js; no implementa loading ni disabled de Button.",
      ],
      [
        "loading / disabled",
        "boolean",
        "false",
        "Button combina ambos para deshabilitar el control; loading añade aria-busy y spinner.",
      ],
      [
        "leadingIcon / trailingIcon",
        "ReactNode",
        "—",
        "En Button la carga sustituye el icono inicial y oculta el final.",
      ],
      [
        "IconButton.label / variant",
        "string / surface | social",
        "obligatoria / surface",
        "label se convierte en aria-label; el tono social usa selected.",
      ],
    ],
    states: [
      "Reposo, hover, active y foco visible",
      "Carga y deshabilitado",
      "Iconos, texto largo y anchura completa",
    ],
    accessibility: [
      "Usar texto que describa la acción. Los iconos que lo acompañan son decorativos.",
      "No usar un botón para navegar ni un enlace para enviar un formulario.",
      "MotionButton admite disabled, pero no implementa loading: ese estado debe resolverse en su consumidor.",
      "El texto no se parte automáticamente: elegir etiquetas que quepan en el contenedor. La muestra larga se incluye en una región desplazable sin modificar el botón.",
    ],
    examples: [
      {
        id: "botones",
        title: "Jerarquía y estados de acción",
        code: '<Button loading={busy} trailingIcon={<ArrowIcon />}>Guardar</Button>\n<ButtonLink href="/design-system/fundamentos" variant="secondary">Ver fundamentos</ButtonLink>\n<IconButton label="Notificaciones"><BellIcon /></IconButton>',
      },
    ],
  },
  {
    slug: "chips",
    title: "Chips",
    summary: "Etiquetas de estado y metadatos compactos; no son controles interactivos.",
    when: [
      "status comunica disponibilidad o resultado; data muestra metadatos; flashPoints representa puntos.",
      "Combinar color y texto; no utilizar el tono como única explicación.",
    ],
    properties: [
      ["variant", "status | data | flashPoints", "status", "tone solo se aplica a status."],
      [
        "tone",
        "neutral | social | info | success | danger",
        "neutral",
        "social y danger conservan su API; corresponden a los roles selected y error.",
      ],
      ["icon", "ReactNode", "—", "Refuerzo visual opcional."],
      ["ariaLabel", "string", "—", "Cuando se define, el chip toma role=img y el nombre indicado."],
    ],
    states: ["Cinco tonos de estado", "Datos y Flash Points"],
    accessibility: [
      "Los chips no deben aparentar que se pueden pulsar.",
      "ariaLabel debe explicar el dato completo cuando la representación es abreviada.",
    ],
    examples: [
      {
        id: "chips",
        title: "Estados y metadatos",
        code: '<Chip tone="success" icon={<CheckIcon />}>Completado</Chip>\n<Chip variant="flashPoints" ariaLabel="Hasta 100 Flash Points">+100 ⚡</Chip>',
      },
    ],
  },
  {
    slug: "avatares",
    title: "Avatares",
    summary: "Identidad de una persona y agrupaciones de participantes.",
    when: [
      "Avatar presenta una imagen, iniciales explícitas o iniciales derivadas del nombre.",
      "AvatarStack limita la cantidad visible y resume el resto con +N.",
    ],
    properties: [
      ["name", "string", "obligatoria", "Nombre accesible; también genera las iniciales."],
      [
        "src / initials",
        "string",
        "—",
        "src tiene prioridad; initials sustituye las iniciales calculadas cuando no hay imagen.",
      ],
      [
        "tone",
        "social | coral | blue | aqua | ink | reward",
        "social",
        "blue y aqua comparten actualmente el mismo fondo info.",
      ],
      ["size", "sm | md | lg", "md; sm en stack", "Escala existente."],
      [
        "items / label / maxVisible",
        "AvatarData[] / string / number",
        "obligatorios / 4",
        "Cada item tiene id único; label describe el grupo.",
      ],
    ],
    states: ["Seis tonos, tres tamaños", "Imagen local e iniciales", "Grupo corto y overflow"],
    accessibility: [
      "Avatar usa role=img y el nombre de la persona.",
      "AvatarStack oculta la lista visual a lectores de pantalla y expone la etiqueta del grupo.",
    ],
    examples: [
      {
        id: "avatares",
        title: "Personas y grupos",
        code: '<Avatar name="Ana Moreno" tone="coral" />\n<AvatarStack items={participants} maxVisible={3} label="6 participantes" />',
      },
    ],
  },
  {
    slug: "superficies",
    title: "Superficies",
    summary: "Card agrupa contenido y Canvas establece el fondo y la anchura de una vista.",
    when: [
      "Usar Card para contenido relacionado y Canvas como contenedor de página.",
      "La elevación expresa jerarquía. Evitar encadenar sombras sin necesidad.",
    ],
    properties: [
      ["Card.as", "div | section | article", "div", "Elegir la semántica según el contenido."],
      ["surface", "surface | soft", "surface", "Fondo estándar o suave."],
      ["elevation", "flat | card | hero", "card", "hero usa el radio y la sombra hero existentes."],
      [
        "padding / density",
        "none | compact | default",
        "padding=default; density=undefined",
        "density tiene prioridad sobre padding; compact también aplica el radio de control.",
      ],
      ["Canvas.as", "main | div | section", "main", "No anidar main dentro de otro main."],
      ["Canvas.maxWidth", "wide | content | none", "wide", "Límite de anchura del contenido."],
      [
        "contentClassName",
        "string",
        "—",
        "Clase del contenedor interno, diferente de className del Canvas.",
      ],
    ],
    states: ["Dos superficies y tres elevaciones", "Tres densidades", "Anchuras de Canvas"],
    accessibility: [
      "Las tarjetas no son botones: sus acciones deben ser controles semánticos.",
      "section y article deben tener un encabezado cuando el contenido lo requiera.",
    ],
    examples: [
      {
        id: "superficies",
        title: "Canvas y tarjetas reales",
        isolated: true,
        code: '<Canvas maxWidth="content">\n  <Card as="section" surface="soft" elevation="flat" density="compact">Contenido</Card>\n</Canvas>',
      },
    ],
  },
  {
    slug: "navegacion",
    title: "Navegación",
    summary: "Cabecera de juego y controles para volver.",
    when: [
      "GameHeader compone identidad, contexto y acciones sin gestionar sesiones.",
      "BackLink navega a un destino conocido; BackButton ejecuta un callback.",
    ],
    properties: [
      [
        "title / left",
        "string / ReactNode",
        "—",
        "El branding aparece con title si no se proporciona left.",
      ],
      [
        "right / timer / action",
        "ReactNode",
        "—",
        "right tiene prioridad; si no existe se muestran timer y action.",
      ],
      [
        "mobileLabel / mobileLabelAriaLabel",
        "ReactNode / string",
        "—",
        "Contexto compacto y su descripción accesible.",
      ],
      [
        "BackLink.href / label",
        "destino / string",
        "obligatorios",
        "label se convierte en aria-label.",
      ],
      [
        "BackButton.onClick / label",
        "callback / string",
        "callback opcional / label obligatoria",
        "No depende del historial del navegador.",
      ],
    ],
    states: [
      "Cabecera con marca o contenido propio",
      "Contexto compacto móvil",
      "Acción de volver y navegación local",
    ],
    accessibility: [
      "Toda acción con solo un icono necesita un nombre accesible.",
      "El indicador de navegación pendiente es decorativo y lo controla Next.js.",
    ],
    examples: [
      {
        id: "navegacion",
        title: "Cabecera adaptable",
        code: '<GameHeader title="La Pirámide" mobileLabel="Nivel 2" timer={<TimerDisplay duration={20} remaining={14} />} action={<BackLink href="/design-system" label="Volver al catálogo" />} />',
      },
    ],
  },
  {
    slug: "temporizadores",
    title: "Temporizadores",
    summary: "Separar la representación del tiempo de una cuenta atrás activa.",
    when: [
      "TimerDisplay muestra un valor recibido; Timer calcula el tiempo restante y notifica el final.",
      "Usar TimerDisplay para representar estados deterministas en ejemplos y revisiones.",
    ],
    properties: [
      [
        "duration / remaining",
        "number (segundos)",
        "obligatorios en display",
        "Valores del intervalo y del tiempo restante.",
      ],
      [
        "state",
        "auto | normal | urgent | finished",
        "auto",
        "Una selección explícita tiene prioridad sobre la urgencia calculada.",
      ],
      [
        "urgency",
        "seconds | ratio",
        "5 s; 25 % si duration ≤ 5",
        "Umbral opcional con type y value.",
      ],
      ["size", "default | compact", "default", "Dos tamaños disponibles."],
      [
        "active / onTimeUp",
        "boolean / callback",
        "obligatorios en Timer",
        "Solo cuenta con active=true; onTimeUp se notifica una vez por ciclo. active=false vuelve a mostrar duration; mantener active al finalizar conserva el cero.",
      ],
      [
        "resetKey / deadlineAt / onTick",
        "string o number / timestamp / callback",
        "—",
        "resetKey reinicia; deadlineAt usa milisegundos absolutos; onTick recibe segundos.",
      ],
    ],
    states: ["Normal, urgente y finalizado", "Compacto", "Iniciar y reiniciar una cuenta real"],
    accessibility: [
      "role=timer describe el tiempo restante sin convertir cada tick en un anuncio vivo.",
      "La urgencia se expresa también mediante el valor temporal.",
    ],
    examples: [
      {
        id: "temporizadores",
        title: "Tiempo determinista y cuenta real",
        code: "<TimerDisplay duration={20} remaining={4} />\n<Timer duration={20} active={active} resetKey={cycle} onTimeUp={finish} />",
      },
    ],
  },
  {
    slug: "iconos",
    title: "Iconos",
    summary:
      "Exports actuales del catálogo de iconos; heredan currentColor salvo ilustraciones propias.",
    when: [
      "Acompañar una etiqueta visible cuando el icono comunica información.",
      "QueensCrownIcon conserva su ilustración y gradientes propios para el formato Queens.",
    ],
    properties: [
      ["props", "SVGProps<SVGSVGElement>", "—", "Admiten tamaños, clases y atributos SVG."],
      [
        "aria-hidden",
        "boolean",
        "true",
        "Por defecto son decorativos; para un icono informativo usar role=img, aria-hidden=false y aria-label.",
      ],
    ],
    states: ["Todos los exports", "Icono decorativo e informativo"],
    accessibility: [
      "No duplicar el anuncio del texto con el icono que lo acompaña.",
      "Un SVG sin texto asociado requiere un nombre accesible si aporta información.",
    ],
    examples: [
      {
        id: "iconos",
        title: "Catálogo de exports y semántica",
        code: '<CheckIcon aria-hidden="true" /> Completado\n<WarningIcon role="img" aria-hidden={false} aria-label="Atención" />',
      },
    ],
  },
];

export const patternEntries: readonly CatalogEntry[] = [
  {
    slug: "formularios",
    title: "Formularios",
    summary: "Campos nativos y feedback existente, con validación local guiada.",
    when: [
      "Mantener label, ayuda y error asociados al campo.",
      "Todavía no existe un FormField compartido. Este ejemplo utiliza markup nativo y los estilos actuales de administración, sin su acción de servidor.",
    ],
    properties: [
      [
        "label / id",
        "atributos HTML",
        "obligatorios",
        "Asociar label y campo mediante htmlFor e id.",
      ],
      [
        "aria-describedby / aria-invalid",
        "IDs / boolean",
        "ayuda / false",
        "Incluir el error cuando exista.",
      ],
      [
        "AdminFormError.message",
        "string | null",
        "—",
        "No renderiza si el mensaje está vacío; usa role=alert.",
      ],
    ],
    states: [
      "Vacío, ayuda y placeholder",
      "Validación fallida",
      "Envío simulado, error recuperable y éxito",
    ],
    accessibility: [
      "Indicar el error por texto y asociarlo al campo.",
      "No retirar las etiquetas cuando existe placeholder. No enviar información fuera de la demo.",
    ],
    examples: [
      {
        id: "formularios",
        title: "Guardar un correo de ejemplo",
        code: '<label htmlFor="email">Correo</label>\n<input id="email" type="email" aria-describedby="email-help email-error" aria-invalid={!!error} />\n<small id="email-help">Solo se valida en esta demo.</small>\n<div id="email-error"><AdminFormError message={error} /></div>',
      },
    ],
  },
  {
    slug: "feedback",
    title: "Feedback",
    summary: "Resultado de una respuesta, avisos administrativos y operaciones en curso.",
    when: [
      "FlashPopFeedback representa resultados del juego; ServerOperationStatus representa envío y reintento.",
      "AdminNotice y AdminFormError pertenecen al contexto administrativo; no son todavía un sistema de avisos unificado.",
    ],
    properties: [
      [
        "FlashPopFeedback.status",
        "correct | partial | incorrect | unanswered",
        "obligatoria",
        "partial comparte el tratamiento visual de acierto; unanswered usa el icono de tiempo.",
      ],
      [
        "title / body / points / variant",
        "string / string / number / default | inline",
        "obligatorios / points opcional / default",
        "inline omite cuerpo, puntos y eyebrow.",
      ],
      ["eyebrow", "string", "—", "Texto de contexto opcional en FlashPopFeedback default."],
      [
        "ServerOperationStatus.state / visible",
        "idle | submitting | error / boolean",
        "obligatorios",
        "idle no renderiza; error siempre es visible.",
      ],
      [
        "pendingMessage / errorMessage / retryLabel / onRetry",
        "textos / callback",
        "error tiene fallback; callback opcional",
        "El reintento se muestra solo si hay callback.",
      ],
      [
        "AdminNotice.title / description",
        "string / string",
        "obligatoria / opcional",
        "Aviso con role=status y aria-live=polite.",
      ],
      [
        "AdminFormError.message",
        "string | null",
        "—",
        "Error con role=alert; no renderiza cuando el mensaje está vacío.",
      ],
    ],
    states: [
      "Acierto, parcial, error y tiempo agotado",
      "Variante inline",
      "Envío, error y reintento local",
    ],
    accessibility: [
      "Los resultados y avisos usan regiones vivas; evitar montar varias actualizaciones simultáneas.",
      "Respetar el movimiento reducido y no depender solo del color.",
    ],
    examples: [
      {
        id: "feedback",
        title: "Resultados y recuperación",
        isolated: true,
        code: '<FlashPopFeedback status="incorrect" title="Respuesta fallada" body="Puedes continuar." />\n<ServerOperationStatus state="error" visible pendingMessage="Guardando…" retryLabel="Reintentar" onRetry={retry} />',
      },
    ],
  },
  {
    slug: "rankings",
    title: "Rankings",
    summary: "Comparar participantes y reconocer al usuario actual sin perder legibilidad.",
    when: [
      "RoomLeaderboard soporta filas y tarjetas; elegir según la densidad del contexto.",
      "Usar emptyMessage para explicar por qué no hay participantes visibles.",
    ],
    properties: [
      [
        "entries / currentUserId / title",
        "entradas / string / string",
        "obligatorios",
        "Entradas con memberId, rank, name, initials y flashPoints.",
      ],
      [
        "variant / compact / bare",
        "rows | cards / boolean / boolean",
        "rows / false / false",
        "cards y bare renderizan section sin la Card envolvente.",
      ],
      [
        "daily / dailyAvailable / pendingCount",
        "boolean / boolean / number",
        "false / true / 0",
        "Configuran contexto diario y pendientes.",
      ],
      [
        "memberHrefBase / onEntrySelect",
        "string / callback",
        "—",
        "En tarjetas el enlace tiene prioridad; el callback permite alternar la selección.",
      ],
      [
        "headingLevel / emptyMessage",
        "h1 | h2 / string",
        "h2 / según contexto",
        "Ajustar el encabezado al documento.",
      ],
    ],
    states: [
      "Filas, tarjetas y usuario actual",
      "Selección y nombres largos",
      "Vacío y pendientes por jugar",
    ],
    accessibility: [
      "La clasificación es una lista ordenada; las tarjetas seleccionables usan aria-pressed.",
      "No mostrar dos rankings con el mismo contexto e IDs en un único documento.",
    ],
    examples: [
      {
        id: "rankings",
        title: "Clasificación con datos ficticios",
        isolated: true,
        code: '<RoomLeaderboard title="Clasificación" entries={entries} currentUserId="ana" variant="cards" onEntrySelect={selectMember} />',
      },
    ],
  },
  {
    slug: "revision",
    title: "Revisión",
    summary: "Historial desplegable con respuesta, explicación y metadatos.",
    when: [
      "ReviewAnswerPanel recibe entradas preparadas por el consumidor; no consulta ni evalúa partidas.",
      "Documentar estados bloqueados y sin responder junto a los resultados contestados.",
    ],
    properties: [
      [
        "entries / countLabel",
        "ReviewAnswerEntry[] / string",
        "obligatorios",
        "Cada entrada usa id y marker, más pregunta y resultado cuando existen.",
      ],
      [
        "title / description",
        "string / string",
        "Historial de respuestas / —",
        "Texto contextual del panel.",
      ],
      [
        "initialOpenId",
        "string",
        "—",
        "Abre inicialmente un detalle; la interacción posterior es nativa.",
      ],
      [
        "compactHeading / backAtTop",
        "boolean",
        "false / false",
        "Compacta la cabecera o coloca la acción de volver arriba.",
      ],
      [
        "backLabel / replayLabel",
        "string",
        "Volver al resultado / Jugar de nuevo",
        "Nombres visibles y accesibles de las acciones proporcionadas.",
      ],
      [
        "progress / progressLabel",
        "{value,max} / string",
        "— / Niveles superados",
        "Progreso accesible opcional.",
      ],
      [
        "onBack / onReplay / extraActions",
        "callbacks / ReactNode",
        "—",
        "Acciones proporcionadas por el consumidor.",
      ],
    ],
    states: [
      "Correcta, parcial, incorrecta, sin responder y bloqueada",
      "Detalles abiertos y cerrados",
      "Reinicio del ejemplo",
    ],
    accessibility: [
      "details y summary conservan su interacción de teclado nativa.",
      "El panel tiene IDs y encabezados propios: mostrarlo en un preview aislado.",
    ],
    examples: [
      {
        id: "revision",
        title: "Historial de ejemplo",
        isolated: true,
        code: '<ReviewAnswerPanel entries={reviewEntries} countLabel="5 respuestas" initialOpenId="correcta" onReplay={reset} />',
      },
    ],
  },
  {
    slug: "carga-vacio",
    title: "Carga y vacío",
    summary: "Representar contenido pendiente y ausencia de datos sin fingir una operación real.",
    when: [
      "Los skeletons existentes reproducen la estructura de salas y rankings.",
      "AdminEmptyState explica una ausencia de datos en su contexto; los rankings también tienen su estado vacío propio.",
    ],
    properties: [
      ["SkeletonBlock", "atributos de span", "aria-hidden=true", "Elemento puramente visual."],
      [
        "RoomRankingSkeleton / RoomDetailSkeleton",
        "sin propiedades",
        "—",
        "Vistas completas de carga existentes.",
      ],
      ["AdminEmptyState.children", "ReactNode", "obligatorio", "Mensaje de estado vacío."],
    ],
    states: ["Carga de ranking y detalle", "Lista vacía", "Contenido disponible simulado"],
    accessibility: [
      "Las vistas de carga exponen aria-busy y un anuncio Cargando…; los bloques son decorativos.",
      "Respetar el movimiento reducido para los skeletons.",
    ],
    examples: [
      {
        id: "carga-vacio",
        title: "Cambiar entre carga, vacío y contenido",
        isolated: true,
        code: "<RoomRankingSkeleton />\n<AdminEmptyState>Todavía no hay datos.</AdminEmptyState>",
      },
    ],
  },
];

export const catalogGroups = [
  {
    title: "Empezar",
    items: [
      { href: "/design-system", title: "Introducción" },
      { href: "/design-system/fundamentos", title: "Fundamentos" },
    ],
  },
  {
    title: "Componentes",
    items: componentEntries.map((entry) => ({
      href: `/design-system/componentes/${entry.slug}`,
      title: entry.title,
    })),
  },
  {
    title: "Patrones",
    items: patternEntries.map((entry) => ({
      href: `/design-system/patrones/${entry.slug}`,
      title: entry.title,
    })),
  },
  { title: "Criterios", items: [{ href: "/design-system/accesibilidad", title: "Accesibilidad" }] },
];
export const catalogExamples = [...componentEntries, ...patternEntries].flatMap(
  (entry) => entry.examples,
);
export function findCatalogEntry(category: "componentes" | "patrones", slug: string) {
  return (category === "componentes" ? componentEntries : patternEntries).find(
    (entry) => entry.slug === slug,
  );
}
export function findCatalogExample(id: string) {
  return catalogExamples.find((example) => example.id === id);
}
