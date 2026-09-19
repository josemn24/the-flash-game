import type {
  FlashEditorialDocument,
  FlashEditorialMiniWordleQuestion,
  FlashEditorialMultipleChoiceQuestion,
  FlashEditorialLogicCodeQuestion,
  FlashEditorialProgressiveCluesQuestion,
  FlashEditorialMatchingQuestion,
  FlashEditorialTrueFalseQuestion,
  FlashEditorialOddOneOutQuestion,
  FlashEditorialOrderingQuestion,
  FlashEditorialProgressiveImageQuestion,
  FlashEditorialQuestion,
  FlashEditorialQuestionDocument,
  FlashEditorialQuestionReference,
  EditorialJsonObject,
  EditorialJsonValue,
} from "@/types/view-models/editorial";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import {
  isMiniWordleMaxAttempts,
  isMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";

const SECRET_KEYS = new Set([
  "answer",
  "correctAnswer",
  "explanation",
  "solution",
  "solutionPayload",
]);

const documentKeys = ["challenge", "questions"];
const challengeKeys = [
  "slug",
  "title",
  "subtitle",
  "description",
  "mode",
  "configSchemaVersion",
  "modeConfig",
];
const questionKeys = [
  "slug",
  "type",
  "payloadSchemaVersion",
  "timeLimitMs",
  "points",
  "publicPayload",
  "solutionPayload",
];
const questionDocumentKeys = questionKeys.filter((key) => key !== "points");
const multipleChoicePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "options",
  "media",
  "promptVisual",
];
const miniWordlePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "hint",
  "wordLength",
  "maxAttempts",
];
const logicCodePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "clues",
  "codeLength",
];
const progressiveCluesPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "clues",
  "cluePenalty",
];
const matchingPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "leftItems",
  "rightItems",
];
const trueFalsePublicPayloadKeys = ["category", "tags", "question"];
const oddOneOutPublicPayloadKeys = ["category", "tags", "question", "items"];
const orderingPublicPayloadKeys = ["category", "tags", "question", "items", "directionLabels"];
const progressiveImagePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "surface",
  "revealDurationMs",
  "answerLabel",
  "answerPlaceholder",
];
const multipleChoiceSolutionKeys = ["correctAnswer", "explanation"];
const miniWordleSolutionKeys = ["correctAnswer", "additionalGuesses", "dictionaryId", "explanation"];
const logicCodeSolutionKeys = ["correctAnswer", "explanation"];
const progressiveCluesSolutionKeys = ["correctAnswer", "acceptedAnswers", "explanation"];
const matchingSolutionKeys = ["matches", "explanation"];
const trueFalseSolutionKeys = ["correctAnswer", "explanation"];
const oddOneOutSolutionKeys = ["correctAnswer", "explanation"];
const orderingSolutionKeys = ["correctOrder", "explanation"];
const progressiveImageSolutionKeys = [
  "correctAnswer",
  "acceptedAnswers",
  "solutionAlt",
  "explanation",
];

export const FLASH_MIN_QUESTIONS = 2;
export const FLASH_MAX_QUESTIONS = 20;
export const FLASH_TOTAL_POINTS = 100;
const MINI_WORDLE_MAX_ADDITIONAL_GUESSES = 1000;
const LOGIC_CODE_MAX_CLUES = 20;
const LOGIC_CODE_MAX_LENGTH = 12;
const PROGRESSIVE_CLUES_MAX_CLUES = 20;
const PROGRESSIVE_CLUES_MAX_PENALTY = 50;
const MATCHING_MIN_PAIRS = 3;
const MATCHING_MAX_PAIRS = 6;
const ODD_ONE_OUT_MIN_ITEMS = 3;
const ODD_ONE_OUT_MAX_ITEMS = 8;
const ORDERING_MIN_ITEMS = 2;
const ORDERING_MAX_ITEMS = 8;
const PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH = 100;

export class FlashEditorialValidationError extends Error {
  readonly code = "invalid_content" as const;
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join(" "));
    this.name = "FlashEditorialValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is EditorialJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function nonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isMedia(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.alt !== "string") return false;
  if (value.type === "illustration") {
    return typeof value.id === "string" && value.alt.trim().length > 0;
  }
  if (value.type === "image") {
    return (
      typeof value.src === "string" &&
      value.src.trim().length > 0 &&
      (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
      (value.position === undefined || typeof value.position === "string")
    );
  }
  return false;
}

function isPrivateMultipleChoiceMedia(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "image") return false;
  if (!hasOnlyKeys(value, ["type", "assetId", "alt", "width", "height", "fit", "position"])) {
    return false;
  }
  return (
    typeof value.assetId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.assetId) &&
    nonEmptyString(value.alt, 500) &&
    Number.isSafeInteger(value.width) &&
    (value.width as number) > 0 &&
    (value.width as number) <= 8192 &&
    Number.isSafeInteger(value.height) &&
    (value.height as number) > 0 &&
    (value.height as number) <= 8192 &&
    (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
    (value.position === undefined ||
      (typeof value.position === "string" && value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
  );
}

function isPromptVisual(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value) || value.type !== "number-sequence" || !Array.isArray(value.sequence)) {
    return false;
  }
  return (
    value.sequence.length > 0 &&
    value.sequence.every((item) => typeof item === "string") &&
    (value.eyebrow === undefined || typeof value.eyebrow === "string") &&
    (value.differences === undefined ||
      (Array.isArray(value.differences) && value.differences.every((item) => typeof item === "string")))
  );
}

function isProgressiveImageSurface(value: unknown, payloadSchemaVersion: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["src", "alt", "width", "height", "fit", "position"])) {
    if (!isRecord(value) || !hasOnlyKeys(value, ["assetId", "alt", "width", "height", "fit", "position"])) {
      return false;
    }
    return (
      payloadSchemaVersion === 2 &&
      typeof value.assetId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.assetId) &&
      nonEmptyString(value.alt, 500) &&
      Number.isSafeInteger(value.width) &&
      (value.width as number) > 0 &&
      Number.isSafeInteger(value.height) &&
      (value.height as number) > 0 &&
      (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
      (value.position === undefined ||
        (typeof value.position === "string" && value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
    );
  }
  if (payloadSchemaVersion !== 1) return false;
  return (
    typeof value.src === "string" &&
    /^\/visuals\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(value.src) &&
    nonEmptyString(value.alt, 500) &&
    Number.isSafeInteger(value.width) &&
    (value.width as number) > 0 &&
    Number.isSafeInteger(value.height) &&
    (value.height as number) > 0 &&
    (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
    (value.position === undefined ||
      (typeof value.position === "string" && value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
  );
}

function isMatchingItem(value: unknown): value is {
  id: string;
  label: string;
  icon?: string;
  media?: NonNullable<FlashEditorialMatchingQuestion["publicPayload"]["leftItems"]>[number]["media"];
} {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "label", "icon", "media"])) return false;
  return (
    nonEmptyString(value.id, 120) &&
    nonEmptyString(value.label, 500) &&
    (value.icon === undefined || nonEmptyString(value.icon, 32)) &&
    isMedia(value.media)
  );
}

function containsSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => SECRET_KEYS.has(key) || containsSecretKey(nested),
  );
}

function parseQuestion(value: unknown, index: number): FlashEditorialQuestion {
  if (!isRecord(value) || !questionKeys.every((key) => key in value)) {
    const missing = isRecord(value) ? questionKeys.find((key) => !(key in value)) : undefined;
    throw new FlashEditorialValidationError([
      `questions[${index}].${missing ?? "value"} es obligatorio.`,
    ]);
  }
  if (!hasOnlyKeys(value, questionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] tiene campos no soportados.`]);
  }
  const publicPayload = value.publicPayload;
  const solutionPayload = value.solutionPayload;
  if (!isRecord(publicPayload)) {
    throw new FlashEditorialValidationError([`questions[${index}].publicPayload es inválido.`]);
  }
  if (containsSecretKey(publicPayload)) {
    throw new FlashEditorialValidationError([
      `questions[${index}].publicPayload no puede contener soluciones.`,
    ]);
  }
  if (
    !isRecord(solutionPayload) ||
    (!("correctAnswer" in solutionPayload) &&
      !("matches" in solutionPayload) &&
      !("correctOrder" in solutionPayload))
  ) {
    throw new FlashEditorialValidationError([`questions[${index}].solutionPayload es inválido.`]);
  }

  const commonValid =
    (value.payloadSchemaVersion === 1 ||
      ((value.type === "progressive-image" || value.type === "multiple-choice") &&
        value.payloadSchemaVersion === 2)) &&
    Number.isSafeInteger(value.points) &&
    (value.points as number) > 0 &&
    (value.points as number) <= FLASH_TOTAL_POINTS &&
    nonEmptyString(value.slug, 120) &&
    Number.isSafeInteger(value.timeLimitMs) &&
    (value.timeLimitMs as number) > 0 &&
    nonEmptyString(publicPayload.question, 2000) &&
    (publicPayload.category === undefined || nonEmptyString(publicPayload.category, 160)) &&
    (publicPayload.tags === undefined ||
      (isRecord(publicPayload.tags) && Object.values(publicPayload.tags).every(isJsonValue))) &&
    (isRecord(solutionPayload) &&
      (solutionPayload.explanation === undefined || typeof solutionPayload.explanation === "string"));

  if (!commonValid) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }

  if (value.type === "multiple-choice") {
    if (
      !hasOnlyKeys(publicPayload, multipleChoicePublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, multipleChoiceSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
    }
    const options = publicPayload.options;
    const correctAnswer = solutionPayload.correctAnswer;
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      !options.every((option) => nonEmptyString(option, 500)) ||
      new Set(options).size !== options.length ||
      typeof correctAnswer !== "string" ||
      !options.includes(correctAnswer) ||
      (value.payloadSchemaVersion === 2
        ? !isPrivateMultipleChoiceMedia(publicPayload.media)
        : !isMedia(publicPayload.media)) ||
      !isPromptVisual(publicPayload.promptVisual)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
    }
    return {
      slug: value.slug as string,
      type: "multiple-choice",
      payloadSchemaVersion: value.payloadSchemaVersion as 1 | 2,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialMultipleChoiceQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialMultipleChoiceQuestion["solutionPayload"],
    };
  }

  if (value.type === "mini-wordle") {
    if (
      !hasOnlyKeys(publicPayload, miniWordlePublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, miniWordleSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
    }
    const wordLength = publicPayload.wordLength;
    const maxAttempts = publicPayload.maxAttempts;
    const correctAnswer = solutionPayload.correctAnswer;
    const additionalGuesses = solutionPayload.additionalGuesses;
    const dictionaryId = solutionPayload.dictionaryId;
    const normalizedSolution = typeof correctAnswer === "string" ? normalizeMiniWordleWord(correctAnswer) : "";
    const normalizedGuesses = Array.isArray(additionalGuesses)
      ? additionalGuesses.map((guess) => (typeof guess === "string" ? normalizeMiniWordleWord(guess) : ""))
      : [];
    if (
      !isMiniWordleWordLength(wordLength) ||
      !isMiniWordleMaxAttempts(maxAttempts) ||
      (wordLength === 4 ? dictionaryId !== "es-general-4.v1" : dictionaryId !== "es-general-5.v1") ||
      typeof correctAnswer !== "string" ||
      !isValidMiniWordleWord(correctAnswer, wordLength) ||
      !Array.isArray(additionalGuesses) ||
      additionalGuesses.length > MINI_WORDLE_MAX_ADDITIONAL_GUESSES ||
      !additionalGuesses.every(
        (guess) => typeof guess === "string" && isValidMiniWordleWord(guess, wordLength),
      ) ||
      new Set(normalizedGuesses).size !== normalizedGuesses.length ||
      normalizedGuesses.includes(normalizedSolution) ||
      (publicPayload.hint !== undefined &&
        publicPayload.hint !== null &&
        typeof publicPayload.hint !== "string")
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Mini-Wordle.`]);
    }
    return {
      slug: value.slug as string,
      type: "mini-wordle",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialMiniWordleQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialMiniWordleQuestion["solutionPayload"],
    };
  }

  if (value.type === "logic-code") {
    if (
      !hasOnlyKeys(publicPayload, logicCodePublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, logicCodeSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
    }
    const clues = publicPayload.clues;
    const codeLength = publicPayload.codeLength;
    const correctAnswer = solutionPayload.correctAnswer;
    const validCodeLength =
      typeof codeLength === "number" &&
      Number.isSafeInteger(codeLength) &&
      codeLength >= 1 &&
      codeLength <= LOGIC_CODE_MAX_LENGTH;
    const validClues =
      Array.isArray(clues) &&
      clues.length > 0 &&
      clues.length <= LOGIC_CODE_MAX_CLUES &&
      clues.every((clue) => {
        if (!isRecord(clue) || !hasOnlyKeys(clue, ["code", "hint"])) return false;
        return (
          typeof clue.code === "string" &&
          typeof clue.hint === "string" &&
          nonEmptyString(clue.code, LOGIC_CODE_MAX_LENGTH) &&
          /^[0-9]+$/.test(clue.code) &&
          nonEmptyString(clue.hint, 500)
        );
      });
    if (
      !validCodeLength ||
      !validClues ||
      !Array.isArray(clues) ||
      !clues.every(
        (clue) => isRecord(clue) && typeof clue.code === "string" && clue.code.length === codeLength,
      ) ||
      new Set(clues.filter(isRecord).map((clue) => clue.code)).size !== clues.length ||
      typeof correctAnswer !== "string" ||
      correctAnswer.length !== codeLength ||
      !/^[0-9]+$/.test(correctAnswer)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato logic-code.`]);
    }
    return {
      slug: value.slug as string,
      type: "logic-code",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialLogicCodeQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialLogicCodeQuestion["solutionPayload"],
    };
  }

  if (value.type === "progressive-clues") {
    if (
      !hasOnlyKeys(publicPayload, progressiveCluesPublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, progressiveCluesSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato progressive-clues.`]);
    }
    const clues = publicPayload.clues;
    const cluePenalty = publicPayload.cluePenalty;
    const correctAnswer = solutionPayload.correctAnswer;
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    const normalizedAcceptedAnswers = Array.isArray(acceptedAnswers)
      ? acceptedAnswers.map((answer) => (typeof answer === "string" ? normalizeAnswer(answer) : ""))
      : [];
    if (
      !Array.isArray(clues) ||
      clues.length < 1 ||
      clues.length > PROGRESSIVE_CLUES_MAX_CLUES ||
      !clues.every((clue) => nonEmptyString(clue, 500)) ||
      typeof cluePenalty !== "number" ||
      !Number.isSafeInteger(cluePenalty) ||
      cluePenalty < 0 ||
      cluePenalty > PROGRESSIVE_CLUES_MAX_PENALTY ||
      typeof correctAnswer !== "string" ||
      !nonEmptyString(correctAnswer, 500) ||
      !Array.isArray(acceptedAnswers) ||
      acceptedAnswers.length < 1 ||
      acceptedAnswers.length > 100 ||
      !acceptedAnswers.every((answer) => nonEmptyString(answer, 500)) ||
      new Set(normalizedAcceptedAnswers).size !== normalizedAcceptedAnswers.length ||
      !normalizedAcceptedAnswers.includes(normalizeAnswer(correctAnswer))
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato progressive-clues.`]);
    }
    return {
      slug: value.slug as string,
      type: "progressive-clues",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialProgressiveCluesQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialProgressiveCluesQuestion["solutionPayload"],
    };
  }

  if (value.type === "matching") {
    if (
      !hasOnlyKeys(publicPayload, matchingPublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, matchingSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato matching.`]);
    }
    const leftItems = publicPayload.leftItems;
    const rightItems = publicPayload.rightItems;
    const matches = solutionPayload.matches;
    const validLeftItems =
      Array.isArray(leftItems) &&
      leftItems.length >= MATCHING_MIN_PAIRS &&
      leftItems.length <= MATCHING_MAX_PAIRS &&
      leftItems.every(isMatchingItem);
    const validRightItems =
      Array.isArray(rightItems) &&
      Array.isArray(leftItems) &&
      rightItems.length === leftItems.length &&
      rightItems.every(isMatchingItem);
    const leftIds = validLeftItems ? leftItems.map((item) => item.id) : [];
    const rightIds = validRightItems ? rightItems.map((item) => item.id) : [];
    const normalizedLeftLabels = validLeftItems
      ? leftItems.map((item) => normalizeAnswer(item.label))
      : [];
    const normalizedRightLabels = validRightItems
      ? rightItems.map((item) => normalizeAnswer(item.label))
      : [];
    const validMatches =
      isRecord(matches) &&
      Object.keys(matches).length === leftIds.length &&
      leftIds.every((leftId) => typeof matches[leftId] === "string" && rightIds.includes(matches[leftId] as string)) &&
      new Set(Object.values(matches)).size === rightIds.length &&
      new Set(leftIds).size === leftIds.length &&
      new Set(rightIds).size === rightIds.length;
    if (
      !validLeftItems ||
      !validRightItems ||
      !validMatches ||
      new Set(normalizedLeftLabels).size !== normalizedLeftLabels.length ||
      new Set(normalizedRightLabels).size !== normalizedRightLabels.length
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato matching.`]);
    }
    return {
      slug: value.slug as string,
      type: "matching",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialMatchingQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialMatchingQuestion["solutionPayload"],
    };
  }

  if (value.type === "true-false") {
    if (
      !hasOnlyKeys(publicPayload, trueFalsePublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, trueFalseSolutionKeys) ||
      typeof solutionPayload.correctAnswer !== "boolean"
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato true-false.`]);
    }
    return {
      slug: value.slug as string,
      type: "true-false",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialTrueFalseQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialTrueFalseQuestion["solutionPayload"],
    };
  }

  if (value.type === "odd-one-out") {
    if (
      !hasOnlyKeys(publicPayload, oddOneOutPublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, oddOneOutSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato odd-one-out.`]);
    }
    const items = publicPayload.items;
    const correctAnswer = solutionPayload.correctAnswer;
    const validItems =
      Array.isArray(items) &&
      items.length >= ODD_ONE_OUT_MIN_ITEMS &&
      items.length <= ODD_ONE_OUT_MAX_ITEMS &&
      items.every((item) => {
        if (!isRecord(item) || !hasOnlyKeys(item, ["id", "label", "media"])) return false;
        return (
          nonEmptyString(item.id, 120) &&
          nonEmptyString(item.label, 500) &&
          isMedia(item.media)
        );
      });
    const ids = validItems ? items.map((item) => (item as Record<string, unknown>).id as string) : [];
    if (
      !validItems ||
      new Set(ids).size !== ids.length ||
      typeof correctAnswer !== "string" ||
      !ids.includes(correctAnswer)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato odd-one-out.`]);
    }
    return {
      slug: value.slug as string,
      type: "odd-one-out",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialOddOneOutQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialOddOneOutQuestion["solutionPayload"],
    };
  }

  if (value.type === "ordering") {
    if (
      !hasOnlyKeys(publicPayload, orderingPublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, orderingSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato ordering.`]);
    }
    const items = publicPayload.items;
    const correctOrder = solutionPayload.correctOrder;
    const validItems =
      Array.isArray(items) &&
      items.length >= ORDERING_MIN_ITEMS &&
      items.length <= ORDERING_MAX_ITEMS &&
      items.every((item) => nonEmptyString(item, 500));
    const validDirectionLabels =
      publicPayload.directionLabels === undefined ||
      publicPayload.directionLabels === null ||
      (isRecord(publicPayload.directionLabels) &&
        hasExactKeys(publicPayload.directionLabels, ["start", "end"]) &&
        nonEmptyString(publicPayload.directionLabels.start, 120) &&
        nonEmptyString(publicPayload.directionLabels.end, 120));
    const validCorrectOrder =
      Array.isArray(correctOrder) &&
      validItems &&
      correctOrder.length === items.length &&
      correctOrder.every((item) => typeof item === "string" && items.includes(item));
    if (
      !validItems ||
      new Set(items).size !== items.length ||
      !validDirectionLabels ||
      !validCorrectOrder ||
      new Set(correctOrder).size !== correctOrder.length
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato ordering.`]);
    }
    return {
      slug: value.slug as string,
      type: "ordering",
      payloadSchemaVersion: 1,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialOrderingQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialOrderingQuestion["solutionPayload"],
    };
  }

  if (value.type === "progressive-image") {
    if (
      !hasOnlyKeys(publicPayload, progressiveImagePublicPayloadKeys) ||
      !hasOnlyKeys(solutionPayload, progressiveImageSolutionKeys)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato progressive-image.`]);
    }
    const acceptedAnswers = solutionPayload.acceptedAnswers;
    const normalizedAcceptedAnswers = Array.isArray(acceptedAnswers)
      ? acceptedAnswers.map((answer) => (typeof answer === "string" ? normalizeAnswer(answer) : ""))
      : [];
    const correctAnswer = solutionPayload.correctAnswer;
    const validRevealDuration =
      Number.isSafeInteger(publicPayload.revealDurationMs) &&
      (publicPayload.revealDurationMs as number) > 0 &&
      (publicPayload.revealDurationMs as number) < (value.timeLimitMs as number);
    if (
      !isProgressiveImageSurface(publicPayload.surface, value.payloadSchemaVersion) ||
      !validRevealDuration ||
      (publicPayload.answerLabel !== undefined &&
        publicPayload.answerLabel !== null &&
        !nonEmptyString(publicPayload.answerLabel, 200)) ||
      (publicPayload.answerPlaceholder !== undefined &&
        publicPayload.answerPlaceholder !== null &&
        !nonEmptyString(publicPayload.answerPlaceholder, 200)) ||
      typeof correctAnswer !== "string" ||
      !nonEmptyString(correctAnswer, 500) ||
      !Array.isArray(acceptedAnswers) ||
      acceptedAnswers.length < 1 ||
      acceptedAnswers.length > 100 ||
      !acceptedAnswers.every((answer) => nonEmptyString(answer, 500)) ||
      new Set(normalizedAcceptedAnswers).size !== normalizedAcceptedAnswers.length ||
      !normalizedAcceptedAnswers.includes(normalizeAnswer(correctAnswer)) ||
      normalizeAnswer((publicPayload.surface as Record<string, unknown>).alt as string).includes(
        normalizeAnswer(correctAnswer),
      ) ||
      !nonEmptyString(solutionPayload.solutionAlt, 500)
    ) {
      throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato progressive-image.`]);
    }
    return {
      slug: value.slug as string,
      type: "progressive-image",
      payloadSchemaVersion: value.payloadSchemaVersion as 1 | 2,
      timeLimitMs: value.timeLimitMs as number,
      points: value.points as number,
      publicPayload: publicPayload as FlashEditorialProgressiveImageQuestion["publicPayload"],
      solutionPayload: solutionPayload as FlashEditorialProgressiveImageQuestion["solutionPayload"],
    };
  }

  throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
}

function parseQuestionReference(value: unknown, index: number): FlashEditorialQuestionReference {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["source", "questionVersionId", "points", "modeConfig", "challengeItemId"]) ||
    !["source", "questionVersionId", "points", "modeConfig"].every((key) => key in value)
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] tiene una referencia de biblioteca inválida.`]);
  }
  if (
    value.source !== "library" ||
    typeof value.questionVersionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.questionVersionId) ||
    !Number.isSafeInteger(value.points) ||
    (value.points as number) <= 0 ||
    (value.points as number) > FLASH_TOTAL_POINTS ||
    !isRecord(value.modeConfig) ||
    !Object.values(value.modeConfig).every(isJsonValue) ||
    (value.challengeItemId !== undefined &&
      (typeof value.challengeItemId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.challengeItemId)))
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] tiene una referencia de biblioteca inválida.`]);
  }
  return {
    source: "library",
    questionVersionId: value.questionVersionId,
    points: value.points as number,
    modeConfig: value.modeConfig as EditorialJsonObject,
    ...(value.challengeItemId ? { challengeItemId: value.challengeItemId } : {}),
  };
}

export function parseFlashEditorialQuestionDocument(value: unknown): FlashEditorialQuestionDocument {
  if (!isRecord(value) || !hasExactKeys(value, questionDocumentKeys)) {
    throw new FlashEditorialValidationError(["La pregunta debe contener un documento Flash válido sin points."]);
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
    throw new FlashEditorialValidationError(["El documento debe contener solo challenge y questions."]);
  }
  const challenge = value.challenge;
  const questions = value.questions;
  if (!isRecord(challenge) || !hasExactKeys(challenge, challengeKeys)) {
    throw new FlashEditorialValidationError(["challenge tiene una estructura inválida."]);
  }
  if (
    !nonEmptyString(challenge.slug, 120) ||
    !nonEmptyString(challenge.title, 200) ||
    typeof challenge.subtitle !== "string" ||
    challenge.subtitle.length > 300 ||
    typeof challenge.description !== "string" ||
    challenge.description.length > 2000 ||
    challenge.mode !== "flash" ||
    challenge.configSchemaVersion !== 1 ||
    !isRecord(challenge.modeConfig) ||
    !Object.values(challenge.modeConfig).every(isJsonValue)
  ) {
    throw new FlashEditorialValidationError(["challenge no cumple el contrato Flash."]);
  }
  if (
    !Array.isArray(questions) ||
    questions.length < FLASH_MIN_QUESTIONS ||
    questions.length > FLASH_MAX_QUESTIONS
  ) {
    throw new FlashEditorialValidationError([
      `Flash requiere entre ${FLASH_MIN_QUESTIONS} y ${FLASH_MAX_QUESTIONS} preguntas.`,
    ]);
  }

  const parsedQuestions = questions.map((question, index) =>
    isRecord(question) && question.source === "library"
      ? parseQuestionReference(question, index)
      : parseQuestion(question, index),
  );
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
    throw new FlashEditorialValidationError(["Una misma versión de biblioteca no puede repetirse en el desafío."]);
  }
  if (parsedQuestions.reduce((total, question) => total + question.points, 0) !== FLASH_TOTAL_POINTS) {
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
      mode: "flash",
      configSchemaVersion: 1,
      modeConfig: challenge.modeConfig as EditorialJsonObject,
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
