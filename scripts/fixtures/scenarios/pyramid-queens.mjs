import { sessionFixture } from "./competitive-session-fixture.mjs";

export default sessionFixture({
  id: "pyramid-queens",
  mode: "pyramid",
  title: "Pirámide Queens: tres intentos",
  questions: Array.from({ length: 7 }, (_, index) => ({
    type: index === 1 ? "queens" : "multiple-choice",
    timeLimitMs: index === 1 ? 120000 : 30000,
    publicPayload:
      index === 1
        ? {
            question: "Coloca las cinco coronas",
            grid: { rows: 5, columns: 5 },
            regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
            prefilledQueens: [2],
          }
        : { question: `Capital de Portugal ${index + 1}`, options: ["Lisboa", "Oporto"] },
    solution:
      index === 1
        ? {
            solution: [2, 9, 10, 18, 21],
            explanation: "Una corona por fila, columna y región.",
          }
        : { correctAnswer: "Lisboa" },
    modeConfig: {
      levelId: `level-${index + 1}`,
      label: `Nivel ${index + 1}`,
      briefing: {
        title: `Briefing ${index + 1}`,
        format: index === 1 ? "Queens" : "Elección múltiple",
        description:
          index === 1 ? "Completa el tablero antes de agotar tres intentos." : "Elige una ciudad.",
      },
    },
  })),
});
