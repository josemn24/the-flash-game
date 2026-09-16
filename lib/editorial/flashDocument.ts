import type {
  FlashEditorialDocument,
  FlashEditorialPublicPayload,
  FlashEditorialQuestion,
  FlashEditorialSolutionPayload,
  EditorialJsonObject,
  EditorialJsonValue,
} from "@/types/view-models/editorial";

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
const publicPayloadKeys = ["category", "tags", "question", "options", "media", "promptVisual"];
const solutionKeys = ["correctAnswer", "explanation"];

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
  if (!hasOnlyKeys(publicPayload, publicPayloadKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}].publicPayload es inválido.`]);
  }
  if (!isRecord(solutionPayload) || !("correctAnswer" in solutionPayload)) {
    throw new FlashEditorialValidationError([`questions[${index}].solutionPayload es inválido.`]);
  }
  if (!hasOnlyKeys(solutionPayload, solutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}].solutionPayload es inválido.`]);
  }

  const options = publicPayload.options;
  const correctAnswer = isRecord(solutionPayload) ? solutionPayload.correctAnswer : undefined;
  if (
    value.type !== "multiple-choice" ||
    value.payloadSchemaVersion !== 1 ||
    value.points !== 50 ||
    !nonEmptyString(value.slug, 120) ||
    !Number.isSafeInteger(value.timeLimitMs) ||
    (value.timeLimitMs as number) <= 0 ||
    !nonEmptyString(publicPayload.question, 2000) ||
    !Array.isArray(options) ||
    options.length < 2 ||
    !options.every((option) => nonEmptyString(option, 500)) ||
    new Set(options).size !== options.length ||
    typeof correctAnswer !== "string" ||
    !options.includes(correctAnswer) ||
    (publicPayload.category !== undefined && !nonEmptyString(publicPayload.category, 160)) ||
    (publicPayload.tags !== undefined &&
      (!isRecord(publicPayload.tags) || !Object.values(publicPayload.tags).every(isJsonValue))) ||
    !isMedia(publicPayload.media) ||
    !isPromptVisual(publicPayload.promptVisual) ||
    (isRecord(solutionPayload) &&
      solutionPayload.explanation !== undefined &&
      typeof solutionPayload.explanation !== "string")
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }

  return {
    slug: value.slug,
    type: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: 50,
    publicPayload: publicPayload as FlashEditorialPublicPayload,
    solutionPayload: solutionPayload as FlashEditorialSolutionPayload,
  };
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
  if (!Array.isArray(questions) || questions.length !== 2) {
    throw new FlashEditorialValidationError(["Flash requiere exactamente dos preguntas."]);
  }

  const parsedQuestions = questions.map(parseQuestion) as [FlashEditorialQuestion, FlashEditorialQuestion];
  if (new Set(parsedQuestions.map((question) => question.slug)).size !== parsedQuestions.length) {
    throw new FlashEditorialValidationError(["Las preguntas deben tener slugs distintos."]);
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
