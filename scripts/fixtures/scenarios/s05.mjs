import { sessionFixture } from "./competitive-session-fixture.mjs";
const questions = [
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
];

const regular = sessionFixture({
  id: "s05",
  mode: "alphabet",
  title: "Alfabeto competitivo S05",
  globalTimeLimitMs: 20000,
  questions,
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
const ui = sessionFixture({
  id: "s05-ui",
  mode: "alphabet",
  title: "Alfabeto: editor y teclado",
  globalTimeLimitMs: 120000,
  questions: questions.map((question, index) =>
    index === 0
      ? {
          ...question,
          publicPayload: { question: "Conjunto de islas próximas entre sí" },
          solution: {
            correctAnswer: "archipiélago",
            acceptedAnswers: ["archipiélago", "archipiélagos", "archipelago"],
          },
        }
      : question,
  ),
});
const scenario = {
  ...regular,
  buildDomainSql(context) {
    return (
      regular.buildDomainSql(context) +
      ui.buildDomainSql({ ...context, sqlUuid: (label) => context.sqlUuid(`ui-${label}`) }) +
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
