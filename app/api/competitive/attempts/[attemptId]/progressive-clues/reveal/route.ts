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
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { AttemptId, ChallengeItemId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = await commandsFor(identity).revealProgressiveClue({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
    });
    return responseFor(
      result,
      200,
      requestId,
      "competitive.attempt.progressive_clue_reveal",
      startedAt,
    );
  } catch (error) {
    return errorResponse(
      error,
      requestId,
      "competitive.attempt.progressive_clue_reveal",
      startedAt,
    );
  }
}
