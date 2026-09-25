import {
  assertSameOrigin,
  commandsFor,
  errorResponse,
  optionalClientTime,
  readAttemptToken,
  readJson,
  requireKey,
  requireLockVersion,
  requirePathUuid,
  requireText,
  requireUuid,
  responseFor,
  requestIdFor,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { AttemptId, ChallengeItemId } from "@/types/domain/identifiers";
import type { DurationMs } from "@/types/domain/values";

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
    const result = await commandsFor(identity).submitMatchingPair({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
      leftItemId: requireText(body, "leftItemId"),
      rightItemId: requireText(body, "rightItemId"),
      clientTimeUsedMs: optionalClientTime(body) as DurationMs | undefined,
    });
    return responseFor(result, 200, requestId, "competitive.attempt.matching_pair", startedAt);
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.matching_pair", startedAt);
  }
}
