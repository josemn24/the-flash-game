/** Shared public boards and private solutions for local and persisted rehearsals. */
export const timeTrialQueensQuestions = [0, 1].map((index) => ({
  type: "queens",
  points: index === 0 ? 30 : 70,
  timeLimitMs: 1000,
  publicPayload: {
    question: `Prueba Queens ${index + 1}`,
    grid: { rows: 5, columns: 5 },
    regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
    prefilledQueens: index === 0 ? [2, 9] : [2],
  },
  solution: {
    solution: [2, 9, 10, 18, 21],
    explanation: "Una corona por fila, columna y región.",
  },
}));

function squareConnectPairsQuestion(size, points, question) {
  const pairs = Array.from({ length: size }, (_, row) => ({
    id: `pair-${row + 1}`,
    label: `Pareja ${row + 1}`,
    symbol: String(row + 1),
    endpoints: [row * size, row * size + size - 1],
  }));
  const paths = Object.fromEntries(
    pairs.map((pair, row) => [
      pair.id,
      Array.from({ length: size }, (_, column) => row * size + column),
    ]),
  );

  return {
    type: "connect-pairs",
    points,
    timeLimitMs: 1000,
    publicPayload: {
      question,
      grid: { rows: size, columns: size },
      pairs,
      requireFullCoverage: true,
    },
    solution: { paths },
  };
}

// Different board sizes ensure the shared global clock survives board changes.
export const timeTrialConnectPairsQuestions = [
  squareConnectPairsQuestion(4, 30, "Conecta las parejas y cubre el tablero. (4×4)"),
  squareConnectPairsQuestion(6, 70, "Encuentra otra distribución de caminos. (6×6)"),
];
