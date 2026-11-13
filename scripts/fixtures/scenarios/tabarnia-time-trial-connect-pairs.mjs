import { betaVipConnectPairsQuestions } from "./betavip-connect-pairs.mjs";

const tags = {
  domains: ["mathematics"],
  topics: ["spatial_logic_puzzles"],
  cognitiveSkills: ["logical_reasoning", "problem_solving"],
  formatSkills: ["planning"],
  lifeSkills: [],
};

const transformations = [
  "rotate90",
  "reflectHorizontal",
  "reflectVertical",
  "rotate180",
  "transpose",
  "rotate270",
];

// Conserva la dificultad y los pesos de BetaVIP, pero cambia la orientación de cada tablero.
function transformCell(cell, size, transformation) {
  const row = Math.floor(cell / size);
  const column = cell % size;
  switch (transformation) {
    case "rotate90":
      return column * size + size - row - 1;
    case "reflectHorizontal":
      return row * size + size - column - 1;
    case "reflectVertical":
      return (size - row - 1) * size + column;
    case "rotate180":
      return (size - row - 1) * size + size - column - 1;
    case "transpose":
      return column * size + row;
    case "rotate270":
      return (size - column - 1) * size + row;
    default:
      throw new Error(`Transformación de tablero desconocida: ${transformation}`);
  }
}

const existingBoards = betaVipConnectPairsQuestions.slice(1).map((question, index) => {
  const size = question.publicPayload.grid.rows;
  const transformation = transformations[index];
  const paths = Object.fromEntries(
    Object.entries(question.solutionPayload.paths).map(([id, cells]) => [
      id,
      cells.map((cell) => transformCell(cell, size, transformation)),
    ]),
  );

  return {
    slug: `tabarnia-connect-pairs-time-trial-${index + 1}`,
    size,
    points: question.points,
    paths,
    pairs: question.publicPayload.pairs.map((pair) => ({
      ...pair,
      endpoints: pair.endpoints.map((cell) => transformCell(cell, size, transformation)),
    })),
  };
});

/** @param {Record<string, number[]>} paths */
function boardFromPaths(slug, size, paths) {
  return {
    slug,
    size,
    paths,
    pairs: Object.entries(paths).map(([id, cells]) => ({
      id,
      label: `Pareja ${id.toUpperCase()}`,
      symbol: id.toUpperCase(),
      endpoints: [cells[0], cells.at(-1)],
    })),
  };
}

const introBoard = boardFromPaths("tabarnia-connect-pairs-time-trial-intro-4x4", 4, {
  a: [0, 1, 2, 3],
  b: [4, 5, 9, 8],
  c: [6, 7, 11, 10],
  d: [12, 13, 14, 15],
});

// Tableros propios de Tabarnia, con solución única verificada.
const easyFiveBoard = boardFromPaths("tabarnia-connect-pairs-time-trial-5x5-easy", 5, {
  a: [1, 0, 5, 10, 15, 20, 21, 22, 23, 24],
  b: [2, 3, 8, 13, 12],
  c: [7, 6, 11, 16, 17, 18],
  d: [4, 9, 14, 19],
});
const hardSevenBoard = boardFromPaths("tabarnia-connect-pairs-time-trial-7x7-hard", 7, {
  a: [0, 7, 14, 21, 28, 35, 42, 43],
  b: [10, 3, 2, 1, 8, 15, 22, 23, 24, 25, 32],
  c: [11, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46],
  d: [9, 16, 17, 18],
  e: [12, 19, 26, 33, 40, 39],
  f: [29, 36, 37, 44],
  g: [30, 31, 38, 45],
});

// Orden de dificultad creciente; los pesos suman 100 y sustituyen a los de BetaVIP.
const boardSequence = [
  [introBoard, 8],
  [existingBoards[0], 9],
  [easyFiveBoard, 9],
  [existingBoards[1], 10],
  [existingBoards[2], 11],
  [existingBoards[3], 12],
  [existingBoards[4], 13],
  [existingBoards[5], 14],
  [hardSevenBoard, 14],
];
/** @type {Array<{ slug: string, size: number, points: number, paths: Record<string, number[]>, pairs: Array<{ id: string, label: string, symbol: string, endpoints: number[] }> }>} */
const boards = boardSequence.map(([board, points]) => ({ ...board, points }));

export const TABARNIA_CONNECT_PAIRS_TIME_TRIAL = {
  challenge: {
    slug: "tabarnia-time-trial-connect-pairs",
    title: "Flow Free",
    subtitle: "Nueve tableros. Un único reloj.",
    description:
      "Conecta nueve tableros de 4×4 a 7×7 con un reloj compartido de dos minutos y medio, empezando con un 4×4 fácil. Borrar y rehacer rutas no consume puntos ni intentos. Si se agota el tiempo, el tablero en curso suma puntos parciales por las parejas conectadas.",
    mode: "time-trial",
    globalTimeLimitMs: 150_000,
    // Al agotarse el reloj, el tablero en curso puntúa por parejas y casillas completas.
    modeConfig: { connectPairsTimeoutPartialCredit: true },
    items: boards.map((board) => ({
      questionSlug: board.slug,
      points: board.points,
      modeConfig: {},
    })),
  },
  questions: boards.map((board, index) => ({
    slug: board.slug,
    type: "connect-pairs",
    payloadSchemaVersion: 1,
    timeLimitMs: 60_000,
    publicPayload: {
      category: "Lógica espacial",
      tags,
      question: `Tablero ${index + 1} de ${boards.length} · ${board.size}×${board.size}. Conecta las parejas y cubre toda la cuadrícula.`,
      grid: { rows: board.size, columns: board.size },
      pairs: board.pairs,
      requireFullCoverage: true,
    },
    solutionPayload: {
      paths: board.paths,
      explanation: `Los caminos conectan todas las parejas y cubren las ${board.size * board.size} casillas mediante pasos ortogonales sin solaparse. Se admite cualquier otro recorrido completo válido.`,
    },
  })),
};
