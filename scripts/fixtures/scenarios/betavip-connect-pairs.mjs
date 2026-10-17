export const BETA_VIP_CONNECT_PAIRS = {
  slug: "betavip-circuito-de-parejas",
  title: "Circuito de parejas",
  subtitle: "Seis tableros de 4×4 a 7×7, un único reloj",
  description:
    "Conecta todas las parejas y cubre cada tablero completo, desde 4×4 hasta 7×7. Tienes dos minutos y medio para completar seis pruebas. Puedes borrar y rehacer caminos sin penalización.",
  globalTimeLimitMs: 150_000,
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
    points: 12,
    size: 4,
    paths: rowBandPaths(4, [1, 1, 2]),
  },
  {
    points: 14,
    size: 5,
    paths: {
      a: [0, 1, 2, 3, 4, 9, 14, 19, 24],
      b: [8, 7, 6, 5, 10],
      c: [11, 12, 13, 18, 23, 22],
      d: [15, 16, 17],
      e: [20, 21],
    },
    pairColors: {
      a: "#800080",
      b: "#ff7f50",
      c: "#008000",
      d: "#808000",
      e: "#ffc0cb",
    },
  },
  {
    points: 16,
    size: 5,
    paths: {
      a: [0, 1, 6, 7, 2, 3, 4, 9],
      b: [5, 10, 15, 20],
      c: [11, 12, 17, 16, 21, 22, 23, 24],
      d: [8, 13, 14, 19, 18],
    },
  },
  {
    points: 18,
    size: 6,
    paths: {
      a: [1, 0, 6, 12, 18, 24, 30, 31, 32, 33, 34, 35, 29],
      b: [2, 3, 4, 10, 16, 22, 23],
      c: [5, 11, 17],
      d: [15, 9, 8, 7, 13, 19, 25],
      e: [14, 20, 26],
      f: [21, 27, 28],
    },
    pairColors: {
      a: "#ff8800",
      b: "#0000ff",
      c: "#008000",
      d: "#ff0000",
      e: "#ffff00",
      f: "#00ffff",
    },
  },
  {
    points: 19,
    size: 6,
    paths: {
      a: [1, 0, 6, 7, 13, 12, 18],
      b: [19, 20, 14, 8, 2, 3, 9],
      c: [15, 21, 27, 26, 25, 24, 30, 31],
      d: [32, 33, 34, 35, 29, 28, 22],
      e: [23, 17, 16, 10, 11, 5, 4],
    },
  },
  {
    points: 21,
    size: 7,
    paths: {
      a: [1, 0, 7, 14, 21, 28, 35, 42, 43, 44],
      b: [2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 45],
      c: [9, 8, 15, 22, 29, 36, 37],
      d: [10, 11, 12],
      e: [16, 17, 18, 19, 26],
      f: [23, 30, 31, 38, 39, 40, 33],
      g: [24, 25, 32],
    },
    pairColors: {
      a: "#ff00ff",
      b: "#ff0000",
      c: "#ff8800",
      d: "#0000ff",
      e: "#008000",
      f: "#00ffff",
      g: "#ffff00",
    },
  },
];

export const betaVipConnectPairsQuestions = boards.map(
  ({ points, size, paths, pairColors }, index) => ({
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
        ...(pairColors?.[id] ? { color: pairColors[id] } : {}),
      })),
      requireFullCoverage: true,
    },
    solutionPayload: {
      paths,
      explanation: `Los caminos unen cada pareja mediante pasos ortogonales y cubren las ${size * size} casillas sin cruces. También se admite cualquier otra solución completa válida.`,
    },
  }),
);
