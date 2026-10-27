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

const boards = betaVipConnectPairsQuestions.map((question, index) => {
  const size = question.publicPayload.grid.rows;
  const transformation = transformations[index];
  const paths = Object.fromEntries(
    Object.entries(question.solutionPayload.paths).map(([id, cells]) => [
      id,
      cells.map((cell) => transformCell(cell, size, transformation)),
    ]),
  );

  return {
    size,
    points: question.points,
    paths,
    pairs: question.publicPayload.pairs.map((pair) => ({
      ...pair,
      endpoints: pair.endpoints.map((cell) => transformCell(cell, size, transformation)),
    })),
  };
});

export const TABARNIA_CONNECT_PAIRS_TIME_TRIAL = {
  challenge: {
    slug: "tabarnia-time-trial-connect-pairs",
    title: "Contrarreloj Conectar parejas",
    subtitle: "Seis tableros. Un único reloj.",
    description:
      "Conecta seis tableros de 4×4 a 7×7 con un reloj compartido de dos minutos y medio. Borrar y rehacer rutas no consume puntos ni intentos.",
    mode: "time-trial",
    globalTimeLimitMs: 150_000,
    modeConfig: {},
    items: boards.map((board, index) => ({
      questionSlug: `tabarnia-connect-pairs-time-trial-${index + 1}`,
      points: board.points,
      modeConfig: {},
    })),
  },
  questions: boards.map((board, index) => ({
    slug: `tabarnia-connect-pairs-time-trial-${index + 1}`,
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
