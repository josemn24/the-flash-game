import type { QuestionIllustrationId, QuestionMedia } from "@/types/contracts";
import type { GameMode } from "@/types/domain/content";
import type { ServerProgressiveImageQuestion } from "@/types/gameplay/challenge";
import type { FormatCapabilities } from "./metadata";
export class ServerFlashQuestionError extends Error {
  constructor() {
    super("invalid_question_payload");
  }
}
export function imageSurface(
  payload: Record<string, unknown>,
): ServerProgressiveImageQuestion["surface"] {
  const surface = payload.surface;
  if (!surface || typeof surface !== "object" || Array.isArray(surface)) {
    throw new ServerFlashQuestionError();
  }
  const value = surface as Record<string, unknown>;
  if (
    typeof value.src !== "string" ||
    typeof value.alt !== "string" ||
    !Number.isSafeInteger(value.width) ||
    Number(value.width) <= 0 ||
    !Number.isSafeInteger(value.height) ||
    Number(value.height) <= 0 ||
    (value.fit !== undefined && value.fit !== "cover" && value.fit !== "contain") ||
    (value.position !== undefined && typeof value.position !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    src: value.src,
    alt: value.alt,
    width: value.width,
    height: value.height,
    ...(value.fit ? { fit: value.fit } : {}),
    ...(typeof value.position === "string" ? { position: value.position } : {}),
  } as ServerProgressiveImageQuestion["surface"];
}
/** Assets are already authorized by infrastructure; this validates their runtime shape. */
export function isAuthorizedImageSurface(surface: unknown): boolean {
  try {
    imageSurface({ surface });
    return true;
  } catch (error) {
    if (error instanceof ServerFlashQuestionError) return false;
    throw error;
  }
}

export function questionMedia(payload: Record<string, unknown>): QuestionMedia | undefined {
  const media = payload.media;
  if (media === undefined || media === null) return undefined;
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    throw new ServerFlashQuestionError();
  }
  const value = media as Record<string, unknown>;
  if (value.type === "illustration") {
    const illustrations: readonly QuestionIllustrationId[] = [
      "japan-flag",
      "saturn",
      "italy-flag",
      "france-flag",
    ];
    if (
      !illustrations.includes(value.id as QuestionIllustrationId) ||
      typeof value.alt !== "string" ||
      value.alt.trim().length === 0
    ) {
      throw new ServerFlashQuestionError();
    }
    return { type: "illustration", id: value.id as QuestionIllustrationId, alt: value.alt };
  }
  if (
    value.type !== "image" ||
    typeof value.src !== "string" ||
    value.src.trim().length === 0 ||
    typeof value.alt !== "string" ||
    value.alt.trim().length === 0 ||
    (value.fit !== undefined && value.fit !== "cover" && value.fit !== "contain") ||
    (value.position !== undefined && typeof value.position !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    type: "image",
    src: value.src,
    alt: value.alt,
    ...(value.fit ? { fit: value.fit } : {}),
    ...(typeof value.position === "string" ? { position: value.position } : {}),
  };
}
export function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ServerFlashQuestionError();
  }
  return payload as Record<string, unknown>;
}
export type PublicReadContext = {
  id: string;
  payload: unknown;
  timeLimitMs: number;
  points: number;
  progress?: unknown;
  allowCompleteProgress?: boolean;
  payloadSchemaVersion?: number;
  mode?: GameMode;
};
export function publicEnvelope(
  { id, payload, timeLimitMs, points, payloadSchemaVersion, mode }: PublicReadContext,
  definition?: FormatCapabilities,
) {
  if (definition && (mode !== undefined || payloadSchemaVersion !== undefined)) {
    const capabilities = mode
      ? [definition.competitive[mode]]
      : Object.values(definition.competitive);
    if (
      !capabilities.some(
        (capability) =>
          capability &&
          (payloadSchemaVersion === undefined ||
            capability.payloadSchemaVersions.includes(payloadSchemaVersion)),
      )
    )
      throw new ServerFlashQuestionError();
  }
  const value = payloadRecord(payload);
  const prompt = value.question ?? value.prompt;
  if (typeof prompt !== "string") throw new ServerFlashQuestionError();
  return {
    value,
    base: {
      id,
      category: typeof value.category === "string" ? value.category : "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: prompt,
      timeLimit: timeLimitMs / 1000,
      points,
    },
  };
}
