import { sessionFixture } from "./competitive-session-fixture.mjs";
export default sessionFixture({
  id: "format-contracts",
  mode: "flash",
  title: "Flash contratos de texto",
  questions: [1, 2].map((index) => ({
    type: "short-text",
    publicPayload: { question: `Capital de Portugal ${index}`, answerPlaceholder: "Una ciudad" },
    solution: {
      correctAnswer: "Lisboa",
      acceptedAnswers: ["Lisboa"],
      explanation: "Lisboa es la capital.",
    },
  })),
});
