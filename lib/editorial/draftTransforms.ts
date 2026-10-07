import type {
  FlashEditorialDocument,
  FlashEditorialQuestionReference,
  SuperadminQuestionLibraryEntry,
} from "@/types/view-models/editorial";

export function pyramidLevelModeConfig(index: number, format: string) {
  const label = `Nivel ${index + 1}`;
  return {
    levelId: `level-${index + 1}`,
    label,
    briefing: {
      title: label,
      format,
      description: "Resuelve la prueba para abrir el siguiente nivel.",
    },
  };
}

export function changeEditorialMode(
  document: FlashEditorialDocument,
  mode: FlashEditorialDocument["challenge"]["mode"],
): FlashEditorialDocument {
  const { globalTimeLimitMs: previousLimit, ...challenge } = document.challenge;
  return {
    ...document,
    challenge: {
      ...challenge,
      mode,
      modeConfig: mode === "survival" ? { lives: Math.min(3, document.questions.length) } : {},
      ...(mode === "alphabet" ? { globalTimeLimitMs: previousLimit ?? 300000 } : {}),
    },
    questions: document.questions.map((question, index) => {
      if (mode === "pyramid") {
        return {
          ...question,
          modeConfig:
            question.modeConfig && Object.keys(question.modeConfig).length > 0
              ? question.modeConfig
              : pyramidLevelModeConfig(index, "Prueba competitiva"),
        };
      }
      if ("source" in question) return { ...question, modeConfig: {} };
      const standaloneQuestion = { ...question };
      Reflect.deleteProperty(standaloneQuestion, "modeConfig");
      return standaloneQuestion;
    }),
  };
}

export function changeEditorialLives(
  document: FlashEditorialDocument,
  lives: number,
): FlashEditorialDocument {
  if (document.challenge.mode !== "survival") return document;
  return { ...document, challenge: { ...document.challenge, modeConfig: { lives } } };
}

export function replaceEditorialLibraryQuestion(
  document: FlashEditorialDocument,
  index: number,
  entry: Pick<SuperadminQuestionLibraryEntry, "questionVersionId" | "type">,
): FlashEditorialDocument {
  const current = document.questions[index];
  const reference: FlashEditorialQuestionReference = {
    source: "library",
    questionVersionId: entry.questionVersionId,
    points: current?.points ?? 50,
    modeConfig:
      document.challenge.mode === "pyramid"
        ? (current?.modeConfig ?? pyramidLevelModeConfig(index, entry.type))
        : {},
    ...(current && "challengeItemId" in current && current.challengeItemId
      ? { challengeItemId: current.challengeItemId }
      : {}),
  };
  return {
    ...document,
    questions: document.questions.map((question, questionIndex) =>
      questionIndex === index ? reference : question,
    ),
  };
}
