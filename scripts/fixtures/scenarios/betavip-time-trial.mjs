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

function question({ slug, size, points, solution, prefilledQueens, regions, position }) {
  return {
    slug,
    type: "queens",
    points,
    timeLimitMs: 60_000,
    payloadSchemaVersion: 1,
    publicPayload: {
      category: "Escalera de coronas",
      tags,
      question: `Tablero ${position} de 6 · ${size}×${size}. Coloca una corona por fila, columna y región; ninguna puede tocar a otra.`,
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
  subtitle: "Seis tableros, un único reloj",
  description:
    "Resuelve seis tableros Queens en orden con un único reloj compartido de tres minutos. La tercera validación incorrecta de cualquier tablero termina la partida.",
  globalTimeLimitMs: 180_000,
  modeConfig: {},
};

export const betaVipTimeTrialQuestions = [
  question({
    slug: "betavip-escalera-coronas-4x4",
    size: 4,
    position: 1,
    points: 10,
    regions: [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2, 3, 2, 3, 3, 3],
    prefilledQueens: [1],
    solution: [1, 7, 8, 14],
  }),
  question({
    slug: "betavip-escalera-coronas-5x5-a",
    size: 5,
    position: 2,
    points: 12,
    regions: [1, 1, 0, 0, 2, 1, 0, 0, 2, 2, 1, 3, 0, 2, 4, 1, 3, 3, 2, 4, 3, 3, 4, 4, 4],
    prefilledQueens: [2, 5],
    solution: [2, 5, 13, 16, 24],
  }),
  question({
    slug: "betavip-escalera-coronas-5x5-b",
    size: 5,
    position: 3,
    points: 14,
    regions: [0, 0, 0, 1, 1, 0, 1, 1, 1, 2, 0, 3, 2, 2, 2, 3, 3, 3, 2, 4, 3, 4, 4, 4, 4],
    prefilledQueens: [0, 16],
    solution: [0, 7, 14, 16, 23],
  }),
  question({
    slug: "betavip-escalera-coronas-6x6-a",
    size: 6,
    position: 4,
    points: 16,
    regions: regions6,
    prefilledQueens: [0, 13, 35],
    solution: solution6,
  }),
  question({
    slug: "betavip-escalera-coronas-6x6-b",
    size: 6,
    position: 5,
    points: 20,
    regions: regions6Reflected,
    prefilledQueens: [5, 19],
    solution: solution6Reflected,
  }),
  question({
    slug: "betavip-escalera-coronas-7x7",
    size: 7,
    position: 6,
    points: 28,
    regions: regions7,
    prefilledQueens: [5, 18, 48],
    solution: [...solution7, 48],
  }),
];
