import { sessionFixture } from "./competitive-session-fixture.mjs";

export default sessionFixture({
  id: "time-trial",
  mode: "time-trial",
  title: "Contrarreloj Queens",
  globalTimeLimitMs: 120000,
  questions: [0, 1].map((index) => ({
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
  })),
});
