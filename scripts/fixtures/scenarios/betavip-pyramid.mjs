const logicTags = {
  domains: ["mathematics"],
  topics: ["logic_puzzles"],
  cognitiveSkills: ["logical_reasoning", "problem_solving"],
  formatSkills: ["deduction", "planning"],
  lifeSkills: [],
};

function question(slug, type, prompt, timeLimitMs, publicFields, solutionPayload) {
  return {
    slug,
    type,
    points: { "odd-one-out": 10, "logic-matrix": 12, zip: 13, "connect-pairs": 14, escape: 15, "logic-code": 17, queens: 19 }[type],
    timeLimitMs,
    payloadSchemaVersion: 1,
    publicPayload: {
      category: "Lógica",
      tags: logicTags,
      question: prompt,
      ...publicFields,
    },
    solutionPayload,
  };
}

export const BETA_VIP_PYRAMID = {
  slug: "betavip-cumbre-logica-ii",
  title: "Cumbre lógica II",
  subtitle: "Siete formatos, una cima",
  description: "Una ruta de lógica avanzada que combina clasificación, patrones, recorridos y restricciones.",
  modeConfig: {},
};

export const betaVipPyramidQuestions = [
  question(
    "betavip-cumbre-logica-ii-intruso",
    "odd-one-out",
    "¿Qué número rompe el patrón?",
    12000,
    {
      items: [
        { id: "cube-8", label: "8" },
        { id: "cube-27", label: "27" },
        { id: "cube-64", label: "64" },
        { id: "cube-81", label: "81" },
        { id: "cube-125", label: "125" },
      ],
    },
    { correctAnswer: "cube-81", explanation: "8, 27, 64 y 125 son cubos perfectos; 81 es la única excepción." },
  ),
  question(
    "betavip-cumbre-logica-ii-matriz",
    "logic-matrix",
    "¿Qué pieza completa la matriz?",
    35000,
    {
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
      cells: ["circle-up", "triangle-right", "square-down", "triangle-down", "square-up", "circle-right", "square-right", "circle-down", null],
      optionIds: ["triangle-up", "triangle-left", "circle-up", "square-left"],
      showPieceLabels: false,
    },
    { correctOptionId: "triangle-up", explanation: "La última celda necesita el triángulo con la flecha hacia arriba." },
  ),
  question(
    "betavip-cumbre-logica-ii-zip",
    "zip",
    "Une los checkpoints en orden y cubre todo el tablero.",
    45000,
    {
      grid: { rows: 5, columns: 5 },
      checkpoints: [
        { value: 1, cell: 0 },
        { value: 2, cell: 4 },
        { value: 3, cell: 5 },
        { value: 4, cell: 14 },
        { value: 5, cell: 15 },
        { value: 6, cell: 24 },
      ],
      instruction: "Completa un único recorrido ortogonal del 1 al 8.",
    },
    {
      solution: [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24],
      explanation: "El recorrido serpentea por las cinco filas sin repetir ninguna celda.",
    },
  ),
  question(
    "betavip-cumbre-logica-ii-conexiones",
    "connect-pairs",
    "Conecta cada pareja de símbolos y cubre toda la cuadrícula.",
    45000,
    {
      grid: { rows: 5, columns: 5 },
      pairs: [
        { id: "circle", label: "Círculo", symbol: "●", endpoints: [0, 9], color: "#35e8ff" },
        { id: "triangle", label: "Triángulo", symbol: "▲", endpoints: [8, 10], color: "#d7ff18" },
        { id: "diamond", label: "Rombo", symbol: "◆", endpoints: [11, 18], color: "#ff6d73" },
        { id: "star", label: "Estrella", symbol: "★", endpoints: [17, 24], color: "#b994ff" },
      ],
      requireFullCoverage: true,
    },
    {
      paths: {
        circle: [0, 1, 2, 3, 4, 9],
        triangle: [8, 7, 6, 5, 10],
        diamond: [11, 12, 13, 14, 19, 18],
        star: [17, 16, 15, 20, 21, 22, 23, 24],
      },
      explanation: "Las cuatro rutas cubren las 25 casillas sin cruces ni solapamientos.",
    },
  ),
  question(
    "betavip-cumbre-logica-ii-escape",
    "escape",
    "Mueve los obstáculos para liberar el bloque objetivo por la salida.",
    45000,
    {
      grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
      initialBlocks: [
        { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
        { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
        { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
        { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
        { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
      ],
      instruction: "Despeja la fila del bloque objetivo.",
    },
    {
      referenceSolution: [
        { blockId: "c", from: 1, to: 0 },
        { blockId: "a", from: 1, to: 0 },
        { blockId: "b", from: 0, to: 3 },
        { blockId: "target", from: 0, to: 4 },
      ],
      optimalMoves: 4,
      explanation: "Cuatro movimientos despejan la fila y permiten sacar el bloque objetivo.",
    },
  ),
  question(
    "betavip-cumbre-logica-ii-cerradura",
    "logic-code",
    "Deduce la cerradura de tres cifras.",
    45000,
    {
      codeLength: 3,
      clues: [
        { code: "427", hint: "Las tres cifras son correctas y están bien colocadas." },
        { code: "421", hint: "Dos cifras son correctas y están bien colocadas." },
        { code: "927", hint: "Dos cifras son correctas; una está desplazada." },
        { code: "560", hint: "Ninguna cifra aparece en la cerradura." },
      ],
    },
    { correctAnswer: "427", explanation: "Las pistas fijan el 4, el 2 y el 7 en ese orden." },
  ),
  question(
    "betavip-cumbre-logica-ii-cima",
    "queens",
    "Coloca cinco coronas sin repetir fila, columna o región.",
    60000,
    {
      grid: { rows: 5, columns: 5 },
      regions: [0, 1, 1, 1, 4, 0, 2, 1, 4, 4, 0, 2, 1, 4, 3, 0, 2, 4, 4, 3, 2, 2, 3, 3, 3],
      prefilledQueens: [2],
    },
    { solution: [2, 5, 13, 16, 24], explanation: "La solución respeta las cinco filas, columnas y regiones sin coronas adyacentes." },
  ),
];
