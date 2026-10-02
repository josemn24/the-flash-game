import { sessionFixture } from "./competitive-session-fixture.mjs";
export default sessionFixture({
  id: "s05",
  mode: "alphabet",
  title: "Alfabeto competitivo S05",
  globalTimeLimitMs: 20000,
  questions: [
    {
      letter: "A",
      type: "short-text",
      publicPayload: { question: "Animal con placas óseas" },
      solution: {
        correctAnswer: "armadillo",
        acceptedAnswers: ["armadillo"],
        explanation: "El armadillo tiene placas óseas.",
      },
    },
    {
      letter: "B",
      type: "short-text",
      publicPayload: { question: "País más extenso de Sudamérica" },
      solution: { correctAnswer: "Brasil", acceptedAnswers: ["Brasil"], explanation: "Brasil." },
    },
    {
      letter: "C",
      type: "short-text",
      publicPayload: { question: "Capital de Australia" },
      solution: {
        correctAnswer: "Canberra",
        acceptedAnswers: ["Canberra"],
        explanation: "Canberra.",
      },
    },
  ],
});
