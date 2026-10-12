import {
  readStoredReviewQuestion,
  type StoredReviewContext,
} from "@/lib/question-formats/storedReview";
import { FormatValidationError } from "@/lib/question-formats/types";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { PracticeQuestion } from "@/types/gameplay/practice";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";
import { isRecord } from "./roomReadGuards";

/** Unwraps published read projections; format validation belongs to lib/question-formats. */
export function toHistoricalFlashQuestion(row: RoomMemberReviewReadRow): PracticeQuestion {
  if (!isRecord(row.public_payload) || !isRecord(row.solution_payload)) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const publicEnvelope = row.public_payload;
  const publicData = isRecord(publicEnvelope.payload) ? publicEnvelope.payload : publicEnvelope;
  const solutionEnvelope = isRecord(row.solution_payload.solution)
    ? row.solution_payload.solution
    : row.solution_payload;
  const solutionData = isRecord(solutionEnvelope.payload)
    ? solutionEnvelope.payload
    : solutionEnvelope;
  const timeLimitMs =
    row.time_limit_ms ?? publicEnvelope.timeLimitMs ?? publicData.timeLimitMs ?? 0;
  if (typeof timeLimitMs !== "number" || !Number.isFinite(timeLimitMs)) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const publicPayload = {
    ...publicData,
    ...(publicEnvelope !== publicData
      ? {
          category: publicEnvelope.category,
          tags: publicEnvelope.tags,
          question: publicEnvelope.prompt,
          context: publicEnvelope.context,
        }
      : {}),
  };
  const solutionPayload = {
    ...solutionData,
    ...(typeof solutionEnvelope.explanation === "string"
      ? { explanation: solutionEnvelope.explanation }
      : {}),
  };
  const context: StoredReviewContext = {
    publicRepresentation: "authorized-runtime",
    questionType: row.question_type,
    payloadSchemaVersion: row.payload_schema_version,
    publicPayload: publicPayload as JsonValue,
    solutionPayload: solutionPayload as JsonValue,
    timeLimitMs: timeLimitMs as DurationMs,
    itemPoints: row.item_points,
    receiptId: row.challenge_item_id,
    mode: row.challenge_mode,
    itemConfigSchemaVersion: 1,
    modeConfigSchemaVersion: 1,
    itemConfig: {},
    modeConfig: {},
  };
  return readStoredReviewQuestion(context);
}
