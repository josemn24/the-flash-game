import { sessionFixture } from "./competitive-session-fixture.mjs";
export default sessionFixture({
  id: "format-contracts-pyramid",
  mode: "pyramid",
  title: "Pirámide contratos de texto",
  questions: Array.from({ length: 7 }, (_, index) => ({
    type: "short-text",
    publicPayload: {
      question: `Capital de Portugal ${index + 1}`,
      answerPlaceholder: "Una ciudad",
    },
    solution: {
      correctAnswer: "Lisboa",
      acceptedAnswers: ["Lisboa"],
      explanation: "Lisboa es la capital.",
    },
    modeConfig: {
      levelId: `level-${index + 1}`,
      label: `Nivel ${index + 1}`,
      briefing: {
        title: `Briefing ${index + 1}`,
        format: "Respuesta de texto",
        description: "Escribe una ciudad.",
      },
    },
  })),
});
