import { sessionFixture } from "./competitive-session-fixture.mjs";
export default sessionFixture({
  id: "narrative-interactive",
  mode: "narrative",
  title: "El archivo interactivo",
  modeConfig: {
    prologue: {
      id: "intro",
      title: "El archivo interactivo",
      blocks: [{ type: "narration", text: "Resuelve los dos sellos del archivo." }],
    },
    beats: [
      {
        id: "beat",
        title: "Los sellos",
        steps: [
          { type: "question", questionSlug: "narrative-interactive-question-0" },
          {
            type: "scene",
            scene: {
              id: "between",
              title: "El segundo sello",
              blocks: [{ type: "narration", text: "Una pista conduce a la respuesta." }],
            },
          },
          { type: "question", questionSlug: "narrative-interactive-question-1" },
        ],
      },
    ],
  },
  questions: [
    {
      type: "queens",
      publicPayload: {
        question: "Coloca las cuatro coronas del archivo",
        grid: { rows: 4, columns: 4 },
        regions: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 3, 3, 3, 2],
        prefilledQueens: [2],
      },
      solution: { solution: [2, 4, 11, 13], explanation: "Una corona por fila, columna y región." },
    },
    {
      type: "progressive-clues",
      publicPayload: {
        question: "Identifica el acontecimiento del archivo",
        clues: ["Ocurrió en Europa.", "Está relacionado con un muro.", "Sucedió en 1989."],
        cluePenalty: 10,
      },
      solution: {
        correctAnswer: "Caída del muro de Berlín",
        acceptedAnswers: ["muro de berlin"],
        explanation: "El muro de Berlín.",
      },
    },
  ],
});
