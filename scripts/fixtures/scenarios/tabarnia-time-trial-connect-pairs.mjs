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

const introPaths = {
  a: [0, 1, 2, 3],
  b: [4, 5, 9, 8],
  c: [6, 7, 11, 10],
  d: [12, 13, 14, 15],
};
const boards = [
  {
    slug: "tabarnia-connect-pairs-time-trial-intro-4x4",
    size: 4,
    points: 12,
    paths: introPaths,
    pairs: Object.entries(introPaths).map(([id, cells]) => ({
      id,
      label: `Pareja ${id.toUpperCase()}`,
      symbol: id.toUpperCase(),
      endpoints: [cells[0], cells.at(-1)],
    })),
  },
  ...existingBoards,
];

export const TABARNIA_CONNECT_PAIRS_TIME_TRIAL = {
  challenge: {
    slug: "tabarnia-time-trial-connect-pairs",
    title: "Flow Free",
    subtitle: "Siete tableros. Un único reloj.",
    description:
      "Conecta siete tableros de 4×4 a 7×7 con un reloj compartido de dos minutos y medio, empezando con un 4×4 fácil. Borrar y rehacer rutas no consume puntos ni intentos.",
    mode: "time-trial",
    globalTimeLimitMs: 150_000,
    modeConfig: {},
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
