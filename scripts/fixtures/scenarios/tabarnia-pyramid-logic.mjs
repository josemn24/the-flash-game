// Seed-ready copy of data/mock/catalog/challenges.ts and questions/pyramid.ts.
const logicTags = (topics, cognitiveSkills, formatSkills) => ({
  domains: ["mathematics"],
  topics,
  cognitiveSkills,
  formatSkills,
  lifeSkills: [],
});

const question = ({
  slug,
  type,
  category,
  topics,
  cognitiveSkills,
  formatSkills,
  prompt,
  timeLimitMs,
  payload,
  solution,
  explanation,
}) => ({
  slug,
  practicePoints: 100,
  type,
  publicPayload: {
    category,
    tags: logicTags(topics, cognitiveSkills, formatSkills),
    prompt,
    context: null,
    timeLimitMs,
    payload,
  },
  privatePayload: {
    solution: { explanation, payload: solution },
    reveals: [],
  },
});

export const TABARNIA_PYRAMID_LOGIC_CONTENT = {
  challenge: {
    slug: "pyramid-logic-definition",
    mode: "pyramid",
    title: "Cumbre lógica",
    subtitle: "Siete niveles. Sube cuanto puedas.",
    description:
      "Empieza con un patrón sencillo y asciende por siete pruebas de lógica. Solo un acierto completo abre el siguiente nivel.",
    modeConfig: {
      connectPairsTimeoutPartialCredit: true,
      orderingPartialCredit: true,
      queensTimeoutPartialCredit: true,
    },
    items: [
      {
        questionSlug: "pyramid-square-intruder",
        points: 13,
        modeConfig: {
          levelId: "entrance",
          label: "Entrada",
          briefing: {
            title: "Encuentra el intruso",
            format: "Encontrar el intruso",
            description: "Selecciona el único número que rompe el patrón de cuadrados perfectos.",
          },
        },
      },
      {
        questionSlug: "pyramid-growing-products",
        points: 14,
        modeConfig: {
          levelId: "pattern",
          label: "Patrón",
          briefing: {
            title: "Completa la secuencia",
            format: "Secuencia numérica",
            description: "Identifica la regla que conecta los términos y elige el siguiente valor.",
          },
        },
      },
      {
        questionSlug: "pyramid-shape-direction-matrix",
        points: 14,
        modeConfig: {
          levelId: "chamber",
          label: "Cámara",
          briefing: {
            title: "Completa la matriz",
            format: "Matriz visual",
            description: "Observa la regla de figuras y flechas y elige la pieza que falta.",
          },
        },
      },
      {
        questionSlug: "pyramid-constraint-order",
        points: 14,
        modeConfig: {
          levelId: "order",
          label: "Orden",
          briefing: {
            title: "Construye el orden",
            format: "Ordenación lógica",
            description: "Coloca todos los elementos respetando simultáneamente las restricciones.",
          },
        },
      },
      {
        questionSlug: "pyramid-connect-pairs-trap",
        points: 15,
        modeConfig: {
          levelId: "trap",
          label: "Conexiones",
          briefing: {
            title: "Cubre la cuadrícula",
            format: "Conectar parejas",
            description:
              "Une cada pareja de símbolos con rutas ortogonales y cubre todas las casillas.",
          },
        },
      },
      {
        questionSlug: "pyramid-secret-code",
        points: 15,
        modeConfig: {
          levelId: "lock",
          label: "Cerradura",
          briefing: {
            title: "Descifra la cerradura",
            format: "Código secreto",
            description:
              "Deduce el código de tres cifras combinando las pistas de posición y presencia.",
          },
        },
      },
      {
        questionSlug: "pyramid-summit-queens",
        points: 15,
        modeConfig: {
          levelId: "summit",
          label: "Cima",
          briefing: {
            title: "Conquista la cima",
            format: "Queens",
            description:
              "Coloca cinco coronas sin repetir fila, columna o región y sin que se toquen.",
          },
        },
      },
    ],
  },
  questions: [
    question({
      slug: "pyramid-square-intruder",
      type: "odd-one-out",
      category: "Lógica",
      topics: ["logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
      formatSkills: ["classification", "deduction"],
      prompt: "¿Qué número rompe el patrón?",
      timeLimitMs: 25000,
      payload: {
        items: [
          { id: "square-9", label: "9" },
          { id: "square-16", label: "16" },
          { id: "square-25", label: "25" },
          { id: "square-29", label: "29" },
          { id: "square-36", label: "36" },
        ],
      },
      solution: { correctAnswer: "square-29" },
      explanation: "9, 16, 25 y 36 son cuadrados perfectos. 29 es el único que no lo es.",
    }),
    question({
      slug: "pyramid-growing-products",
      type: "multiple-choice",
      category: "Lógica",
      topics: ["number_sequences"],
      cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
      formatSkills: ["deduction", "calculation"],
      prompt: "Completa la secuencia.",
      timeLimitMs: 25000,
      payload: {
        options: ["26", "28", "30", "32"],
        media: null,
        promptVisual: {
          type: "number-sequence",
          sequence: ["2", "6", "12", "20", "?"],
        },
      },
      solution: { correctAnswer: "30" },
      explanation:
        "Cada término multiplica dos enteros consecutivos: 1×2, 2×3, 3×4, 4×5 y 5×6. El siguiente valor es 30.",
    }),
    question({
      slug: "pyramid-constraint-order",
      type: "ordering",
      category: "Lógica",
      topics: ["logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "problem_solving"],
      formatSkills: ["ordering", "deduction"],
      prompt:
        "Ordena de izquierda a derecha. Luna va inmediatamente después de Sol; Mar está antes que Sol; Nube está después de Luna; Río está antes que Mar.",
      timeLimitMs: 35000,
      payload: {
        items: ["Sol", "Río", "Nube", "Mar", "Luna"],
        directionLabels: { start: "Izquierda", end: "Derecha" },
      },
      solution: { correctOrder: ["Río", "Mar", "Sol", "Luna", "Nube"] },
      explanation:
        "Las restricciones forman una única cadena: Río debe preceder a Mar, Mar a Sol, Luna va justo después de Sol y Nube queda al final.",
    }),
    question({
      slug: "pyramid-shape-direction-matrix",
      type: "logic-matrix",
      category: "Lógica visual",
      topics: ["visual_patterns"],
      cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
      formatSkills: ["deduction"],
      prompt: "¿Qué pieza completa la matriz?",
      timeLimitMs: 35000,
      payload: {
        pieces: [
          { id: "circle-up", symbol: "●↑", label: "Círculo y flecha arriba" },
          { id: "triangle-right", symbol: "▲→", label: "Triángulo y flecha derecha" },
          { id: "square-down", symbol: "■↓", label: "Cuadrado y flecha abajo" },
          { id: "triangle-down", symbol: "▲↓", label: "Triángulo y flecha abajo" },
          { id: "square-up", symbol: "■↑", label: "Cuadrado y flecha arriba" },
          { id: "circle-right", symbol: "●→", label: "Círculo y flecha derecha" },
          { id: "square-right", symbol: "■→", label: "Cuadrado y flecha derecha" },
          { id: "circle-down", symbol: "●↓", label: "Círculo y flecha abajo" },
          { id: "triangle-up", symbol: "▲↑", label: "Triángulo y flecha arriba" },
          { id: "triangle-left", symbol: "▲←", label: "Triángulo y flecha izquierda" },
          { id: "square-left", symbol: "■←", label: "Cuadrado y flecha izquierda" },
        ],
        cells: [
          "circle-up",
          "triangle-right",
          "square-down",
          "triangle-down",
          "square-up",
          "circle-right",
          "square-right",
          "circle-down",
          null,
        ],
        optionIds: ["triangle-up", "triangle-left", "circle-up", "square-left"],
        showPieceLabels: false,
      },
      solution: { correctOptionId: "triangle-up" },
      explanation:
        "Las figuras y las flechas rotan de forma independiente en cada fila y columna. La casilla final necesita un triángulo con flecha hacia arriba.",
    }),
    question({
      slug: "pyramid-connect-pairs-trap",
      type: "connect-pairs",
      category: "Lógica espacial",
      topics: ["spatial_logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "problem_solving"],
      formatSkills: ["planning", "deduction"],
      prompt: "Conecta cada pareja de símbolos y cubre toda la cuadrícula.",
      timeLimitMs: 35000,
      payload: {
        grid: { rows: 5, columns: 5 },
        pairs: [
          { id: "circle", label: "Círculo", symbol: "●", endpoints: [0, 9], color: "#35e8ff" },
          {
            id: "triangle",
            label: "Triángulo",
            symbol: "▲",
            endpoints: [8, 10],
            color: "#d7ff18",
          },
          { id: "diamond", label: "Rombo", symbol: "◆", endpoints: [11, 18], color: "#ff6d73" },
          { id: "star", label: "Estrella", symbol: "★", endpoints: [17, 24], color: "#b994ff" },
        ],
        requireFullCoverage: true,
      },
      solution: {
        paths: {
          circle: [0, 1, 2, 3, 4, 9],
          triangle: [8, 7, 6, 5, 10],
          diamond: [11, 12, 13, 14, 19, 18],
          star: [17, 16, 15, 20, 21, 22, 23, 24],
        },
      },
      explanation:
        "Cada símbolo se une con su pareja mediante una ruta ortogonal. Las cuatro rutas cubren las 25 casillas sin cruzarse ni solaparse.",
    }),
    question({
      slug: "pyramid-secret-code",
      type: "logic-code",
      category: "Lógica deductiva",
      topics: ["logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "problem_solving"],
      formatSkills: ["deduction"],
      prompt: "Deduce el código secreto de tres cifras.",
      timeLimitMs: 45000,
      payload: {
        clues: [
          { code: "529", hint: "Una cifra es correcta y está bien colocada." },
          { code: "175", hint: "Dos cifras son correctas, pero están mal colocadas." },
          { code: "638", hint: "Ninguna cifra es correcta." },
          { code: "083", hint: "Una cifra es correcta, pero está mal colocada." },
          { code: "760", hint: "Dos cifras son correctas, pero están mal colocadas." },
        ],
        codeLength: 3,
      },
      solution: { correctAnswer: "507" },
      explanation:
        "638 descarta 6, 3 y 8. En 083, el 0 es correcto y no ocupa la primera posición. 529 fija el 5 al principio; 175 coloca el 7 al final. El código es 507.",
    }),
    question({
      slug: "pyramid-summit-queens",
      type: "queens",
      category: "Lógica espacial",
      topics: ["spatial_logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "problem_solving"],
      formatSkills: ["deduction", "planning"],
      prompt: "Coloca cinco coronas sin repetir fila, columna o región.",
      timeLimitMs: 45000,
      payload: {
        grid: { rows: 5, columns: 5 },
        regions: [0, 1, 1, 1, 4, 0, 2, 1, 4, 4, 0, 2, 1, 4, 3, 0, 2, 4, 4, 3, 2, 2, 3, 3, 3],
        prefilledQueens: [2],
      },
      solution: { solution: [2, 5, 13, 16, 24] },
      explanation:
        "La solución sitúa las coronas en las columnas 3, 1, 4, 2 y 5. Cada fila, columna y región contiene una sola corona y ninguna toca a otra.",
    }),
  ],
};
