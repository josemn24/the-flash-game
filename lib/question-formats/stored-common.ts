import type {
  EditorialJsonValue,
  FlashEditorialMatchingQuestion,
} from "@/types/contracts/stored-questions";
import {
  capabilityForQuestionType,
  competitivePayloadSchemaVersionsFor,
  isCompetitiveQuestionType,
} from "./definitions";
import type { FormatCapabilities } from "./metadata";
import { FormatValidationError } from "./types";
export const SECRET_KEYS = new Set([
  "answer",
  "correctAnswer",
  "explanation",
  "solution",
  "solutionPayload",
  "tolerance",
]);
export const documentKeys = ["challenge", "questions"];
export const challengeKeys = [
  "slug",
  "title",
  "subtitle",
  "description",
  "mode",
  "configSchemaVersion",
  "modeConfig",
];
export const questionKeys = [
  "slug",
  "type",
  "payloadSchemaVersion",
  "timeLimitMs",
  "points",
  "publicPayload",
  "solutionPayload",
];
export const questionDocumentKeys = questionKeys.filter((key) => key !== "points");
export const multipleChoicePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "options",
  "media",
  "promptVisual",
];
export const estimationPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "min",
  "max",
  "step",
  "initialValue",
  "unit",
  "media",
];
export const heatMapPublicPayloadKeys = ["category", "tags", "question", "surface", "targetLabel"];
export const miniWordlePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "hint",
  "wordLength",
  "maxAttempts",
];
export const logicCodePublicPayloadKeys = ["category", "tags", "question", "clues", "codeLength"];
export const logicMatrixPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "pieces",
  "cells",
  "optionIds",
  "showPieceLabels",
];
export const progressiveCluesPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "clues",
  "cluePenalty",
];
export const matchingPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "leftItems",
  "rightItems",
];
export const trueFalsePublicPayloadKeys = ["category", "tags", "question"];
export const oddOneOutPublicPayloadKeys = ["category", "tags", "question", "items"];
export const orderingPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "items",
  "directionLabels",
];
export const anagramPublicPayloadKeys = ["category", "tags", "question", "tiles", "hint"];
export const classificationPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "items",
  "categories",
];
export const progressiveImagePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "surface",
  "revealDurationMs",
  "answerLabel",
  "answerPlaceholder",
];
export const shortTextPublicPayloadKeys = ["category", "tags", "question", "answerPlaceholder"];
export const wordSearchPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "grid",
  "letters",
  "targets",
];
export const wordHashtagPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "grid",
  "initialLetters",
  "maxMoves",
];
export const zipPublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "grid",
  "checkpoints",
  "instruction",
  "mapNote",
  "boardLabel",
];
export const escapePublicPayloadKeys = [
  "category",
  "tags",
  "question",
  "grid",
  "initialBlocks",
  "instruction",
  "hideInstruction",
  "objectiveLabel",
  "hideObjectiveLabel",
  "completionMessage",
  "boardLabel",
];
export const shortTextSolutionKeys = ["correctAnswer", "acceptedAnswers", "explanation"];
export const multipleChoiceSolutionKeys = ["correctAnswer", "explanation"];
export const estimationSolutionKeys = ["correctAnswer", "tolerance", "explanation"];
export const heatMapSolutionKeys = ["target", "fullCreditRadius", "toleranceRadius", "explanation"];
export const miniWordleSolutionKeys = [
  "correctAnswer",
  "additionalGuesses",
  "dictionaryId",
  "explanation",
];
export const logicCodeSolutionKeys = ["correctAnswer", "explanation"];
export const logicMatrixSolutionKeys = ["correctOptionId", "explanation"];
export const progressiveCluesSolutionKeys = ["correctAnswer", "acceptedAnswers", "explanation"];
export const matchingSolutionKeys = ["matches", "explanation"];
export const trueFalseSolutionKeys = ["correctAnswer", "explanation"];
export const oddOneOutSolutionKeys = ["correctAnswer", "explanation"];
export const orderingSolutionKeys = ["correctOrder", "explanation"];
export const anagramSolutionKeys = ["correctAnswer", "explanation"];
export const classificationSolutionKeys = ["categoriesByItem", "explanation"];
export const progressiveImageSolutionKeys = [
  "correctAnswer",
  "acceptedAnswers",
  "solutionAlt",
  "explanation",
];
export const wordSearchSolutionKeys = ["positionsByTargetId", "explanation"];
export const wordHashtagSolutionKeys = ["words", "explanation"];
export const zipSolutionKeys = ["solution", "explanation"];
export const escapeSolutionKeys = ["referenceSolution", "optimalMoves", "explanation"];
export const FLASH_MIN_QUESTIONS = 2;
export const FLASH_MAX_QUESTIONS = 20;
export const FLASH_TOTAL_POINTS = 100;
export const MINI_WORDLE_MAX_ADDITIONAL_GUESSES = 1000;
export const LOGIC_CODE_MAX_CLUES = 20;
export const LOGIC_CODE_MAX_LENGTH = 12;
export const PROGRESSIVE_CLUES_MAX_CLUES = 20;
export const PROGRESSIVE_CLUES_MAX_PENALTY = 50;
export const MATCHING_MIN_PAIRS = 3;
export const MATCHING_MAX_PAIRS = 6;
export const ODD_ONE_OUT_MIN_ITEMS = 3;
export const ODD_ONE_OUT_MAX_ITEMS = 8;
export const ORDERING_MIN_ITEMS = 2;
export const ORDERING_MAX_ITEMS = 8;
export const ANAGRAM_MIN_TILES = 3;
export const ANAGRAM_MAX_TILES = 10;
export const CLASSIFICATION_MIN_ITEMS = 2;
export const CLASSIFICATION_MAX_ITEMS = 20;
export const CLASSIFICATION_MIN_CATEGORIES = 2;
export const CLASSIFICATION_MAX_CATEGORIES = 8;
export const PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH = 100;
export class FlashEditorialValidationError extends Error {
  readonly code = "invalid_content" as const;
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join(" "));
    this.name = "FlashEditorialValidationError";
    this.issues = issues;
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function isJsonValue(value: unknown): value is EditorialJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}
export function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}
export function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
export function nonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}
export function isMedia(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.alt !== "string")
    return false;
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
export function isPrivateMultipleChoiceMedia(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "image") return false;
  if (!hasOnlyKeys(value, ["type", "assetId", "alt", "width", "height", "fit", "position"])) {
    return false;
  }
  return (
    typeof value.assetId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.assetId) &&
    nonEmptyString(value.alt, 500) &&
    typeof value.width === "number" &&
    Number.isSafeInteger(value.width) &&
    (value.width as number) > 0 &&
    (value.width as number) <= 8192 &&
    typeof value.height === "number" &&
    Number.isSafeInteger(value.height) &&
    (value.height as number) > 0 &&
    (value.height as number) <= 8192 &&
    (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
    (value.position === undefined ||
      (typeof value.position === "string" &&
        value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
  );
}
export function isPrivateImageSurface(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["assetId", "alt", "width", "height", "fit", "position"])
  ) {
    return false;
  }
  const width = value.width;
  const height = value.height;
  return (
    typeof value.assetId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.assetId) &&
    nonEmptyString(value.alt, 500) &&
    typeof width === "number" &&
    Number.isSafeInteger(width) &&
    width > 0 &&
    width <= 8192 &&
    typeof height === "number" &&
    Number.isSafeInteger(height) &&
    height > 0 &&
    height <= 8192 &&
    (value.fit === undefined || value.fit === "cover" || value.fit === "contain") &&
    (value.position === undefined ||
      (typeof value.position === "string" && value.position.length <= 100))
  );
}
export function isPrivateOptionalMedia(value: unknown): boolean {
  return value === null || isPrivateMultipleChoiceMedia(value);
}
export function isPromptVisual(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value) || value.type !== "number-sequence" || !Array.isArray(value.sequence)) {
    return false;
  }
  return (
    value.sequence.length > 0 &&
    value.sequence.every((item) => typeof item === "string") &&
    (value.eyebrow === undefined || typeof value.eyebrow === "string") &&
    (value.differences === undefined ||
      (Array.isArray(value.differences) &&
        value.differences.every((item) => typeof item === "string")))
  );
}
export function isProgressiveImageSurface(value: unknown, payloadSchemaVersion: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["src", "alt", "width", "height", "fit", "position"])
  ) {
    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, ["assetId", "alt", "width", "height", "fit", "position"])
    ) {
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
        (typeof value.position === "string" &&
          value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
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
      (typeof value.position === "string" &&
        value.position.length <= PROGRESSIVE_IMAGE_MAX_POSITION_LENGTH))
  );
}
export function isMatchingItem(value: unknown): value is {
  id: string;
  label: string;
  icon?: string;
  media?: NonNullable<
    FlashEditorialMatchingQuestion["publicPayload"]["leftItems"]
  >[number]["media"];
} {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "label", "icon", "media"])) return false;
  return (
    nonEmptyString(value.id, 120) &&
    nonEmptyString(value.label, 500) &&
    (value.icon === undefined || nonEmptyString(value.icon, 32)) &&
    isMedia(value.media)
  );
}
export function containsSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => SECRET_KEYS.has(key) || containsSecretKey(nested),
  );
}
export function storedEnvelope(value: unknown, index: number) {
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
      !("correctOrder" in solutionPayload) &&
      !("categoriesByItem" in solutionPayload) &&
      !("target" in solutionPayload) &&
      !("correctOptionId" in solutionPayload) &&
      !("positionsByTargetId" in solutionPayload) &&
      !("solution" in solutionPayload) &&
      !("words" in solutionPayload) &&
      !("referenceSolution" in solutionPayload))
  ) {
    throw new FlashEditorialValidationError([`questions[${index}].solutionPayload es inválido.`]);
  }

  const commonValid =
    typeof value.type === "string" &&
    isCompetitiveQuestionType(value.type) &&
    typeof value.payloadSchemaVersion === "number" &&
    capabilityForQuestionType(value.type).validation.payloadSchemaVersions.includes(
      value.payloadSchemaVersion,
    ) &&
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
    isRecord(solutionPayload) &&
    (solutionPayload.explanation === undefined || typeof solutionPayload.explanation === "string");

  if (!commonValid) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }

  return { value, publicPayload, solutionPayload };
}

export type StoredPublicContext = {
  publicRepresentation?: "stored" | "authorized-runtime";
  payloadSchemaVersion: number;
  timeLimitMs: number;
  profile?: "publication" | "published";
};
export function storedPublicEnvelope(
  input: unknown,
  context: StoredPublicContext,
  definition: FormatCapabilities,
): Record<string, unknown> {
  const versions =
    context.profile === "published"
      ? competitivePayloadSchemaVersionsFor(definition.id)
      : definition.validation.payloadSchemaVersions;
  if (!versions.includes(context.payloadSchemaVersion))
    throw new FormatValidationError("unsupported_question");
  if (!isRecord(input) || containsSecretKey(input))
    throw new FormatValidationError("invalid_question_payload");
  // Earlier published projections embedded envelope fields alongside the format payload.
  // Strip only those known fields when reading; new editorial documents stay strict.
  const payload =
    context.profile === "published"
      ? { ...input, question: input.question ?? input.prompt }
      : input;
  if (context.profile === "published")
    for (const key of ["id", "prompt", "context", "timeLimitMs"]) delete payload[key];
  if (!nonEmptyString(payload.question, 2000))
    throw new FormatValidationError("invalid_question_payload");
  return payload;
}
