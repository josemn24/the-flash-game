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
  optionalClientTime,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import { AttemptApiError } from "@/server/competitive/attempt-api";
import type { AttemptId, ChallengeItemId } from "@/types/domain/identifiers";
import type { DurationMs } from "@/types/domain/values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const sessionToken = await readAttemptToken(attemptId);
    const answer = body.answer;
    if (answer !== null && typeof answer !== "string") {
      throw new AttemptApiError("invalid_answer", 400);
    }
    const { evaluated, received } = await commandsFor(identity).evaluateAndRecord({
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
    return responseFor({
      attemptId: evaluated.attemptId,
      challengeItemId: body.challengeItemId,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
      timedOut: received.timedOut,
      timeUsedMs: received.timeUsedMs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
