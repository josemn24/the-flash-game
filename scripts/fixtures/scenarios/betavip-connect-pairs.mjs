export const BETA_VIP_CONNECT_PAIRS = {
  slug: "betavip-circuito-de-parejas",
  title: "Circuito de parejas",
  subtitle: "Cinco tableros 5×5, un único reloj",
  description:
    "Conecta todas las parejas y cubre las 25 casillas de cada tablero. Tienes tres minutos para completar cinco pruebas. Puedes borrar y rehacer caminos sin penalización.",
  globalTimeLimitMs: 180_000,
};

// Recorridos curados: cada conjunto ocupa exactamente las 25 casillas.
const boards = [
  {
    points: 10,
    paths: {
      a: [0, 1, 2, 3, 4],
      b: [5, 10, 15, 20, 21, 22, 23, 24],
      c: [6, 7, 8, 9, 14, 13, 12, 11, 16, 17, 18, 19],
    },
  },
  {
    points: 15,
    paths: {
      a: [0, 1, 6, 7, 2, 3, 4, 9],
      b: [5, 10, 15, 20],
      c: [11, 12, 17, 16, 21, 22, 23, 24],
      d: [8, 13, 14, 19, 18],
    },
  },
  {
    points: 20,
    paths: {
      a: [0, 5, 10, 15, 20, 21, 16, 11, 6, 1],
      b: [2, 3, 4, 9, 8, 7, 12, 17],
      c: [14, 13, 18, 19, 24],
      d: [22, 23],
    },
  },
  {
    points: 25,
    paths: {
      a: [0, 1, 2, 7, 6],
      b: [3, 4, 9, 8, 13],
      c: [5, 10, 15, 20, 21, 22],
      d: [11, 16, 17, 12],
      e: [14, 19, 18, 23, 24],
    },
  },
  {
    points: 30,
    paths: {
      a: [0, 5, 10, 11, 6],
      b: [1, 2, 3, 4, 9, 14, 13, 8, 7],
      c: [12, 17, 16, 15, 20],
      d: [21, 22],
      e: [18, 19, 24, 23],
    },
  },
];

export const betaVipConnectPairsQuestions = boards.map(({ points, paths }, index) => ({
  slug: `${BETA_VIP_CONNECT_PAIRS.slug}-${index + 1}`,
  type: "connect-pairs",
  points,
  payloadSchemaVersion: 1,
  timeLimitMs: 60_000,
  publicPayload: {
    category: "Lógica espacial",
    tags: {
      domains: ["mathematics"],
      topics: ["spatial_logic_puzzles"],
      cognitiveSkills: ["logical_reasoning", "problem_solving"],
      formatSkills: ["planning"],
      lifeSkills: [],
    },
    question: `Tablero ${index + 1} de 5 · Conecta las parejas y cubre toda la cuadrícula.`,
    grid: { rows: 5, columns: 5 },
    pairs: Object.entries(paths).map(([id, cells]) => ({
      id,
      label: `Pareja ${id.toUpperCase()}`,
      symbol: id.toUpperCase(),
      endpoints: [cells[0], cells.at(-1)],
    })),
    requireFullCoverage: true,
  },
  solutionPayload: {
    paths,
    explanation:
      "Los caminos unen cada pareja mediante pasos ortogonales y cubren las 25 casillas sin cruces. También se admite cualquier otra solución completa válida.",
  },
}));
