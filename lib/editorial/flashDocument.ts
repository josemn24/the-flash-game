import { parseEditorialQuestion as parseQuestion } from "@/lib/question-formats/editorialRegistry";
import {
  challengeKeys,
  documentKeys,
  FLASH_MAX_QUESTIONS,
  FLASH_MIN_QUESTIONS,
  FLASH_TOTAL_POINTS,
  FlashEditorialValidationError,
  hasExactKeys,
  hasOnlyKeys,
  isJsonValue,
  isRecord,
  nonEmptyString,
  questionDocumentKeys,
} from "@/lib/question-formats/stored-common";
import type {
  EditorialJsonObject,
  FlashEditorialDocument,
  FlashEditorialQuestion,
  FlashEditorialQuestionDocument,
  FlashEditorialQuestionReference,
} from "@/types/view-models/editorial";
export {
  FLASH_MAX_QUESTIONS,
  FLASH_MIN_QUESTIONS,
  FLASH_TOTAL_POINTS,
  FlashEditorialValidationError,
} from "@/lib/question-formats/stored-common";

function parseQuestionReference(value: unknown, index: number): FlashEditorialQuestionReference {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "source",
      "questionVersionId",
      "points",
      "modeConfig",
      "challengeItemId",
    ]) ||
    !["source", "questionVersionId", "points", "modeConfig"].every((key) => key in value)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] tiene una referencia de biblioteca inválida.`,
    ]);
  }
  if (
    value.source !== "library" ||
    typeof value.questionVersionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.questionVersionId,
    ) ||
    !Number.isSafeInteger(value.points) ||
    (value.points as number) <= 0 ||
    (value.points as number) > FLASH_TOTAL_POINTS ||
    !isRecord(value.modeConfig) ||
    !Object.values(value.modeConfig).every(isJsonValue) ||
    (value.challengeItemId !== undefined &&
      (typeof value.challengeItemId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value.challengeItemId,
        )))
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] tiene una referencia de biblioteca inválida.`,
    ]);
  }
  return {
    source: "library",
    questionVersionId: value.questionVersionId,
    points: value.points as number,
    modeConfig: value.modeConfig as EditorialJsonObject,
    ...(value.challengeItemId ? { challengeItemId: value.challengeItemId } : {}),
  };
}

export function parseFlashEditorialQuestionDocument(
  value: unknown,
): FlashEditorialQuestionDocument {
  if (!isRecord(value) || !hasExactKeys(value, questionDocumentKeys)) {
    throw new FlashEditorialValidationError([
      "La pregunta debe contener un documento Flash válido sin points.",
    ]);
  }
  const parsed = parseQuestion({ ...value, points: 1 }, 0);
  const document = { ...parsed } as unknown as Record<string, unknown>;
  delete document.points;
  return document as FlashEditorialQuestionDocument;
}

export function parseFlashEditorialQuestionJson(source: string): FlashEditorialQuestionDocument {
  try {
    return parseFlashEditorialQuestionDocument(JSON.parse(source));
  } catch (error) {
    if (error instanceof FlashEditorialValidationError) throw error;
    throw new FlashEditorialValidationError(["El documento de pregunta no contiene JSON válido."]);
  }
}

export function formatFlashEditorialQuestionDocument(document: FlashEditorialQuestionDocument) {
  return JSON.stringify(document, null, 2);
}

export function parseFlashEditorialDocument(value: unknown): FlashEditorialDocument {
  if (!isRecord(value) || !hasExactKeys(value, documentKeys)) {
    throw new FlashEditorialValidationError([
      "El documento debe contener solo challenge y questions.",
    ]);
  }
  const challenge = value.challenge;
  const questions = value.questions;
  if (
    !isRecord(challenge) ||
    !challengeKeys.filter((key) => key !== "mode").every((key) => key in challenge) ||
    !hasOnlyKeys(challenge, [...challengeKeys, "globalTimeLimitMs"])
  ) {
    throw new FlashEditorialValidationError(["challenge tiene una estructura inválida."]);
  }
  if (
    !nonEmptyString(challenge.slug, 120) ||
    !nonEmptyString(challenge.title, 200) ||
    typeof challenge.subtitle !== "string" ||
    challenge.subtitle.length > 300 ||
    typeof challenge.description !== "string" ||
    challenge.description.length > 2000 ||
    (challenge.mode !== "flash" &&
      challenge.mode !== "alphabet" &&
      challenge.mode !== "survival" &&
      challenge.mode !== "narrative" &&
      challenge.mode !== "pyramid") ||
    challenge.configSchemaVersion !== 1 ||
    !isRecord(challenge.modeConfig) ||
    !Object.values(challenge.modeConfig).every(isJsonValue) ||
    (challenge.mode === "alphabet" &&
      (!Number.isSafeInteger(challenge.globalTimeLimitMs) ||
        (challenge.globalTimeLimitMs as number) <= 0)) ||
    (challenge.mode !== "alphabet" && challenge.globalTimeLimitMs !== undefined) ||
    (challenge.mode === "survival" &&
      (!hasExactKeys(challenge.modeConfig, ["lives"]) ||
        !Number.isSafeInteger(challenge.modeConfig.lives) ||
        (challenge.modeConfig.lives as number) < 1 ||
        (challenge.modeConfig.lives as number) > FLASH_MAX_QUESTIONS)) ||
    (challenge.mode === "narrative" &&
      (Object.keys(challenge.modeConfig).length < 2 ||
        !isRecord(challenge.modeConfig.prologue) ||
        !Array.isArray(challenge.modeConfig.beats))) ||
    (challenge.mode === "pyramid" && Object.keys(challenge.modeConfig).length !== 0)
  ) {
    throw new FlashEditorialValidationError(["challenge no cumple el contrato Flash."]);
  }
  const validQuestionCount =
    Array.isArray(questions) &&
    (challenge.mode === "pyramid"
      ? questions.length === 7
      : questions.length >= FLASH_MIN_QUESTIONS && questions.length <= FLASH_MAX_QUESTIONS);
  if (!validQuestionCount) {
    throw new FlashEditorialValidationError([
      challenge.mode === "pyramid"
        ? "La Pirámide requiere exactamente siete niveles."
        : `Flash requiere entre ${FLASH_MIN_QUESTIONS} y ${FLASH_MAX_QUESTIONS} preguntas.`,
    ]);
  }

  if (challenge.mode === "survival" && (challenge.modeConfig.lives as number) > questions.length) {
    throw new FlashEditorialValidationError([
      "Supervivencia requiere vidas entre 1 y el número de preguntas.",
    ]);
  }

  const parsedQuestions = questions.map((question, index) => {
    if (isRecord(question) && question.source === "library") {
      return parseQuestionReference(question, index);
    }
    if (isRecord(question) && "modeConfig" in question) {
      if (
        !isRecord(question.modeConfig) ||
        !Object.values(question.modeConfig).every(isJsonValue)
      ) {
        throw new FlashEditorialValidationError([
          `questions[${index}] tiene una configuración de nivel inválida.`,
        ]);
      }
      const { modeConfig, ...questionDocument } = question;
      return {
        ...parseQuestion(questionDocument, index),
        modeConfig: modeConfig as EditorialJsonObject,
      };
    }
    return parseQuestion(question, index);
  });
  if (
    challenge.mode === "survival" &&
    parsedQuestions.some((question) => !("source" in question) && question.type === "short-text")
  ) {
    throw new FlashEditorialValidationError([
      "Supervivencia requiere formatos con evaluación competitiva de Flash.",
    ]);
  }
  if (challenge.mode === "pyramid") {
    const levelIds = parsedQuestions.map((question) =>
      "modeConfig" in question ? question.modeConfig?.levelId : undefined,
    );
    const validLevels = parsedQuestions.every((question) => {
      const modeConfig = "modeConfig" in question ? question.modeConfig : undefined;
      return (
        isRecord(modeConfig) &&
        hasExactKeys(modeConfig, ["levelId", "label", "briefing"]) &&
        nonEmptyString(modeConfig.levelId, 120) &&
        nonEmptyString(modeConfig.label, 120) &&
        isRecord(modeConfig.briefing) &&
        hasExactKeys(modeConfig.briefing, ["title", "format", "description"]) &&
        nonEmptyString(modeConfig.briefing.title, 200) &&
        nonEmptyString(modeConfig.briefing.format, 120) &&
        nonEmptyString(modeConfig.briefing.description, 1000)
      );
    });
    if (!validLevels || new Set(levelIds).size !== parsedQuestions.length) {
      throw new FlashEditorialValidationError([
        "La Pirámide requiere siete niveles con id, etiqueta y briefing válidos y únicos.",
      ]);
    }
  }
  if (challenge.mode === "alphabet") {
    const letters = parsedQuestions.map((question) =>
      "source" in question ? question.modeConfig.letter : undefined,
    );
    if (
      parsedQuestions.some(
        (question) =>
          !(
            "source" in question &&
            typeof question.modeConfig.letter === "string" &&
            Array.from(question.modeConfig.letter).length === 1
          ),
      ) ||
      letters.some((letter) => typeof letter !== "string" || letter.trim().length === 0) ||
      new Set(letters.map((letter) => (letter as string).toLocaleUpperCase("es-ES"))).size !==
        letters.length ||
      parsedQuestions.some((question) =>
        "source" in question ? false : question.type !== "short-text",
      )
    ) {
      throw new FlashEditorialValidationError([
        "Alphabet requiere referencias short-text y una letra única por elemento.",
      ]);
    }
  }
  const inlineSlugs = parsedQuestions
    .filter((question): question is FlashEditorialQuestion => !("source" in question))
    .map((question) => question.slug);
  const libraryVersions = parsedQuestions
    .filter((question): question is FlashEditorialQuestionReference => "source" in question)
    .map((question) => question.questionVersionId);
  if (new Set(inlineSlugs).size !== inlineSlugs.length) {
    throw new FlashEditorialValidationError(["Las preguntas deben tener slugs distintos."]);
  }
  if (new Set(libraryVersions).size !== libraryVersions.length) {
    throw new FlashEditorialValidationError([
      "Una misma versión de biblioteca no puede repetirse en el desafío.",
    ]);
  }
  if (
    parsedQuestions.reduce((total, question) => total + question.points, 0) !== FLASH_TOTAL_POINTS
  ) {
    throw new FlashEditorialValidationError([
      `Las preguntas deben sumar ${FLASH_TOTAL_POINTS} puntos.`,
    ]);
  }

  return {
    challenge: {
      slug: challenge.slug,
      title: challenge.title,
      subtitle: challenge.subtitle,
      description: challenge.description,
      mode: challenge.mode,
      configSchemaVersion: 1,
      modeConfig: challenge.modeConfig as EditorialJsonObject,
      ...(challenge.mode === "alphabet"
        ? { globalTimeLimitMs: challenge.globalTimeLimitMs as number }
        : {}),
    },
    questions: parsedQuestions,
  };
}

export function parseFlashEditorialJson(source: string): FlashEditorialDocument {
  try {
    return parseFlashEditorialDocument(JSON.parse(source));
  } catch (error) {
    if (error instanceof FlashEditorialValidationError) throw error;
    throw new FlashEditorialValidationError(["El documento no contiene JSON válido."]);
  }
}

export function isFlashEditorialDocument(value: unknown): value is FlashEditorialDocument {
  try {
    parseFlashEditorialDocument(value);
    return true;
  } catch {
    return false;
  }
}

export function formatFlashEditorialDocument(document: FlashEditorialDocument) {
  return JSON.stringify(document, null, 2);
}
