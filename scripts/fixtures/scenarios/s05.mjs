import { sessionFixture } from "./competitive-session-fixture.mjs";
const regular = sessionFixture({
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

const timeout = sessionFixture({
  id: "s05-timeout",
  mode: "alphabet",
  title: "Alphabet de 18 letras",
  globalTimeLimitMs: 8000,
  questions: Array.from({ length: 18 }, (_, index) => ({
    letter: String.fromCharCode(65 + index),
    type: "short-text",
    publicPayload: { question: `Pregunta de la letra ${String.fromCharCode(65 + index)}` },
    solution: { correctAnswer: "respuesta", acceptedAnswers: ["respuesta"] },
  })),
});
const scenario = {
  ...regular,
  buildDomainSql(context) {
    return (
      regular.buildDomainSql(context) +
      timeout.buildDomainSql({
        ...context,
        sqlUuid: (label) => context.sqlUuid(`bulk-${label}`),
      })
    );
  },
  manifest(context) {
    return {
      ...regular.manifest(context),
      timeoutRoom: { id: context.stableId("bulk-room"), slug: "s05-timeout-main" },
      timeoutPublicationId: context.stableId("bulk-publication"),
    };
  },
};
export default scenario;
