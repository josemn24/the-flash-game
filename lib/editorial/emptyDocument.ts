import type { FlashEditorialDocument } from "@/types/view-models/editorial";

export const emptyEditorialDocument: FlashEditorialDocument = {
  challenge: {
    slug: "flash-nuevo-001",
    title: "Nuevo Flash",
    subtitle: "Dos preguntas",
    description: "Desafío Flash preparado desde el portal.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [
    {
      slug: "pregunta-uno",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Cultura general",
        tags: {},
        question: "¿Cuál es la capital de Portugal?",
        options: ["Lisboa", "Oporto", "Braga"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Lisboa",
        explanation: "Lisboa es la capital de Portugal.",
      },
    },
    {
      slug: "pregunta-dos",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Ciencia",
        tags: {},
        question: "¿Qué planeta es conocido como el planeta rojo?",
        options: ["Marte", "Venus", "Júpiter"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: {
        correctAnswer: "Marte",
        explanation: "Marte recibe ese nombre por el color rojizo de su superficie.",
      },
    },
  ],
};
