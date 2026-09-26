import {
  assertSameOrigin,
  commandsFor,
  errorResponse,
  readAttemptToken,
  readJson,
  requireKey,
  requireLockVersion,
  requirePathUuid,
  requireUuid,
  responseFor,
  requestIdFor,
  optionalClientTime,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import { AttemptApiError } from "@/server/competitive/attempt-api";
import { consumeAlphabetActionRateLimit } from "@/server/competitive/rate-limit";
import type { AttemptId, ChallengeItemId } from "@/types/domain/identifiers";
import type { DurationMs } from "@/types/domain/values";
import type { AnswerValue } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function isJsonAnswer(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonAnswer);
  if (typeof value === "object") return Object.values(value).every(isJsonAnswer);
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const sessionToken = await readAttemptToken(attemptId);
    const answer = body.answer as AnswerValue | null;
    if (!isJsonAnswer(answer)) {
      throw new AttemptApiError("invalid_answer", 400);
    }
    const commands = commandsFor(identity);
    const snapshot = await commands.readRecovery(attemptId, sessionToken);
    if (snapshot.challengeMode === "alphabet") {
      consumeAlphabetActionRateLimit(identity.authUserId, attemptId);
    }
    const { evaluated, received } = await commands.evaluateAndRecord({
      receive: {
        attemptId: attemptId as AttemptId,
        sessionToken,
        lockVersion: requireLockVersion(body),
        idempotencyKey: requireKey(body),
        challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
        answer,
        clientTimeUsedMs: optionalClientTime(body) as DurationMs | undefined,
      },
    });
    return responseFor(
      {
        attemptId: evaluated.attemptId,
        challengeItemId: body.challengeItemId,
        lockVersion: evaluated.lockVersion,
        status: evaluated.status,
        points: evaluated.points,
        ...(evaluated.details ? { details: evaluated.details } : {}),
        timedOut: received.timedOut,
        timeUsedMs: received.timeUsedMs,
      },
      200,
      requestId,
      "competitive.attempt.answer",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.answer", startedAt);
  }
}
