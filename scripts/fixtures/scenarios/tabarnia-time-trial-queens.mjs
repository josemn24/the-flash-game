const tags = {
  domains: ["mathematics"],
  topics: ["spatial_logic_puzzles"],
  cognitiveSkills: ["logical_reasoning", "problem_solving"],
  formatSkills: ["deduction", "planning"],
  lifeSkills: [],
};

const boards = [
  {
    size: 4,
    points: 12,
    regions: [1, 1, 0, 2, 1, 0, 0, 2, 1, 3, 2, 2, 3, 3, 3, 2],
    prefilledQueens: [11],
    solution: [2, 4, 11, 13],
  },
  {
    size: 5,
    points: 14,
    regions: [2, 0, 0, 0, 1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 2, 2, 3, 3, 3, 2, 4, 4, 3, 3],
    prefilledQueens: [2, 9],
    solution: [2, 9, 10, 18, 21],
  },
  {
    size: 5,
    points: 16,
    regions: [1, 1, 1, 1, 0, 1, 1, 1, 1, 3, 2, 2, 3, 3, 3, 2, 4, 3, 3, 3, 4, 4, 3, 3, 3],
    prefilledQueens: [4],
    solution: [4, 7, 10, 18, 21],
  },
  {
    size: 6,
    points: 18,
    regions: [0, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3, 3, 3, 5, 5, 5, 3, 4, 4, 5, 5, 5, 5, 5, 5],
    prefilledQueens: [0, 21, 32],
    solution: [0, 10, 13, 21, 29, 32],
  },
  {
    size: 6,
    points: 19,
    regions: [2, 2, 1, 1, 1, 0, 2, 2, 2, 1, 1, 1, 2, 2, 3, 3, 4, 4, 2, 2, 3, 4, 4, 4, 5, 5, 5, 4, 4, 4, 5, 5, 4, 4, 4, 4],
    prefilledQueens: [5, 12],
    solution: [5, 9, 12, 20, 28, 31],
  },
  {
    size: 7,
    points: 21,
    regions: [0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 2, 2, 1, 1, 1, 1, 2, 2, 4, 4, 4, 3, 1, 2, 2, 4, 4, 4, 3, 3, 2, 2, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 5, 5],
    prefilledQueens: [0, 41],
    solution: [0, 10, 15, 26, 30, 41, 46],
  },
];

export const TABARNIA_QUEENS_TIME_TRIAL = {
  challenge: {
    slug: "tabarnia-time-trial-queens",
    title: "Contrarreloj Queens",
    subtitle: "Seis tableros. Un único reloj.",
    description:
      "Resuelve seis tableros Queens en orden con un reloj compartido de dos minutos y medio. La tercera validación completa incorrecta termina la partida; al avanzar, el contador se reinicia.",
    mode: "time-trial",
    globalTimeLimitMs: 150_000,
    modeConfig: {},
    items: boards.map((board, index) => ({
      questionSlug: `tabarnia-queens-time-trial-${index + 1}`,
      points: board.points,
      modeConfig: {},
    })),
  },
  questions: boards.map((board, index) => ({
    slug: `tabarnia-queens-time-trial-${index + 1}`,
    type: "queens",
    payloadSchemaVersion: 1,
    timeLimitMs: 60_000,
    publicPayload: {
      category: "Escalera de coronas",
      tags,
      question: `Tablero ${index + 1} de ${boards.length} · ${board.size}×${board.size}. Coloca una corona por fila, columna y región; ninguna puede tocar a otra.`,
      grid: { rows: board.size, columns: board.size },
      regions: board.regions,
      prefilledQueens: board.prefilledQueens,
    },
    solutionPayload: {
      solution: board.solution,
      explanation: `El tablero ${board.size}×${board.size} tiene una única solución que respeta filas, columnas, regiones y distancia entre coronas.`,
    },
  })),
};
