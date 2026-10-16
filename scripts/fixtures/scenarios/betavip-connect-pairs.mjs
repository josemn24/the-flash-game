export const BETA_VIP_CONNECT_PAIRS = {
  slug: "betavip-circuito-de-parejas",
  title: "Circuito de parejas",
  subtitle: "Seis tableros de 4×4 a 7×7, un único reloj",
  description:
    "Conecta todas las parejas y cubre cada tablero completo, desde 4×4 hasta 7×7. Tienes tres minutos para completar seis pruebas. Puedes borrar y rehacer caminos sin penalización.",
  globalTimeLimitMs: 180_000,
};

function rowBandPaths(size, bandHeights) {
  let firstRow = 0;
  return Object.fromEntries(
    bandHeights.map((height, pairIndex) => {
      const cells = [];
      for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
        const row = firstRow + rowOffset;
        const columns = Array.from({ length: size }, (_, column) => column);
        if (rowOffset % 2 === 1) columns.reverse();
        cells.push(...columns.map((column) => row * size + column));
      }
      firstRow += height;
      return [String.fromCharCode(97 + pairIndex), cells];
    }),
  );
}

// Recorridos curados: cada conjunto ocupa exactamente todas las casillas.
const boards = [
  {
    points: 10,
    size: 4,
    paths: rowBandPaths(4, [1, 1, 2]),
  },
  {
    points: 12,
    size: 5,
    paths: {
      a: [0, 1, 2, 3, 4],
      b: [5, 10, 15, 20, 21, 22, 23, 24],
      c: [6, 7, 8, 9, 14, 13, 12, 11, 16, 17, 18, 19],
    },
  },
  {
    points: 14,
    size: 5,
    paths: {
      a: [0, 1, 6, 7, 2, 3, 4, 9],
      b: [5, 10, 15, 20],
      c: [11, 12, 17, 16, 21, 22, 23, 24],
      d: [8, 13, 14, 19, 18],
    },
  },
  {
    points: 16,
    size: 6,
    paths: rowBandPaths(6, [2, 2, 1, 1]),
  },
  {
    points: 20,
    size: 6,
    paths: rowBandPaths(6, [1, 1, 1, 1, 2]),
  },
  {
    points: 28,
    size: 7,
    paths: rowBandPaths(7, [1, 1, 1, 2, 2]),
  },
];

export const betaVipConnectPairsQuestions = boards.map(({ points, size, paths }, index) => ({
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
    question: `Tablero ${index + 1} de ${boards.length} · ${size}×${size}. Conecta las parejas y cubre toda la cuadrícula.`,
    grid: { rows: size, columns: size },
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
    explanation: `Los caminos unen cada pareja mediante pasos ortogonales y cubren las ${size * size} casillas sin cruces. También se admite cualquier otra solución completa válida.`,
  },
}));
