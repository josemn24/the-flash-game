const tags = {
  domains: ["mathematics"],
  topics: ["spatial_logic_puzzles"],
  cognitiveSkills: ["logical_reasoning", "problem_solving"],
  formatSkills: ["deduction", "planning"],
  lifeSkills: [],
};

const regions6 = [
  0, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 5, 2, 2, 1, 1, 3, 5, 5, 5, 4, 1, 5, 5, 5, 5, 5,
  5, 5, 5,
];
const solution6 = [0, 9, 13, 22, 26, 35];

function reflectRegions(regions, size) {
  return Array.from({ length: size * size }, (_, cell) => {
    const row = Math.floor(cell / size);
    const column = cell % size;
    return regions[row * size + (size - column - 1)];
  });
}

function reflectCells(cells, size) {
  return cells.map((cell) => {
    const row = Math.floor(cell / size);
    const column = cell % size;
    return row * size + (size - column - 1);
  });
}

const regions6Reflected = reflectRegions(regions6, 6);
const regions7 = [
  ...Array.from({ length: 6 }, (_, row) => [
    ...regions6Reflected.slice(row * 6, row * 6 + 6),
    regions6Reflected[row * 6 + 5],
  ]).flat(),
  ...regions6Reflected.slice(30, 36),
  6,
];
const solution6Reflected = reflectCells(solution6, 6);
const solution7 = solution6Reflected.map((cell) => {
  const row = Math.floor(cell / 6);
  const column = cell % 6;
  return row * 7 + column;
});

function question({ slug, size, points, solution, prefilledQueens, regions }, index, boards) {
  return {
    slug,
    type: "queens",
    points,
    timeLimitMs: 60_000,
    payloadSchemaVersion: 1,
    publicPayload: {
      category: "Escalera de coronas",
      tags,
      question: `Tablero ${index + 1} de ${boards.length} · ${size}×${size}. Coloca una corona por fila, columna y región; ninguna puede tocar a otra.`,
      grid: { rows: size, columns: size },
      regions,
      prefilledQueens,
    },
    solutionPayload: {
      solution,
      explanation: `El tablero ${size}×${size} tiene una solución que respeta filas, columnas, regiones y distancia entre coronas.`,
    },
  };
}

export const BETA_VIP_TIME_TRIAL = {
  slug: "betavip-escalera-de-coronas",
  title: "Escalera de coronas",
  subtitle: "Siete tableros, un único reloj",
  description:
    "Resuelve siete tableros Queens en orden con un único reloj compartido de dos minutos y medio. Empieza con un 4×4 fácil. La tercera validación incorrecta de cualquier tablero termina la partida.",
  globalTimeLimitMs: 150_000,
  modeConfig: {},
};

export const betaVipTimeTrialQuestions = [
  {
    slug: "betavip-escalera-coronas-intro-4x4",
    size: 4,
    points: 12,
    regions: [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 1, 2, 2, 3, 1],
    prefilledQueens: [1, 8],
    solution: [1, 7, 8, 14],
  },
  {
    slug: "betavip-escalera-coronas-4x4",
    size: 4,
    points: 13,
    regions: [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2, 3, 2, 3, 3, 3],
    prefilledQueens: [1],
    solution: [1, 7, 8, 14],
  },
  {
    slug: "betavip-escalera-coronas-5x5-a",
    size: 5,
    points: 13,
    regions: [1, 1, 0, 0, 2, 1, 0, 0, 2, 2, 1, 3, 0, 2, 4, 1, 3, 3, 2, 4, 3, 3, 4, 4, 4],
    prefilledQueens: [2, 5],
    solution: [2, 5, 13, 16, 24],
  },
  {
    slug: "betavip-escalera-coronas-5x5-b",
    size: 5,
    points: 14,
    regions: [0, 0, 0, 1, 1, 0, 1, 1, 1, 2, 0, 3, 2, 2, 2, 3, 3, 3, 2, 4, 3, 4, 4, 4, 4],
    prefilledQueens: [0],
    solution: [0, 7, 14, 16, 23],
  },
  {
    slug: "betavip-escalera-coronas-6x6-a",
    size: 6,
    points: 15,
    regions: regions6,
    prefilledQueens: [0, 13, 35],
    solution: solution6,
  },
  {
    slug: "betavip-escalera-coronas-6x6-b",
    size: 6,
    points: 16,
    regions: regions6Reflected,
    prefilledQueens: [5, 19],
    solution: solution6Reflected,
  },
  {
    slug: "betavip-escalera-coronas-7x7",
    size: 7,
    points: 17,
    regions: regions7,
    prefilledQueens: [5, 48],
    solution: [...solution7, 48],
  },
].map(question);
