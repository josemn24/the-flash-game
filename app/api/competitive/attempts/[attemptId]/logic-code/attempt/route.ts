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
    if (typeof body.code !== "string" || body.code.trim().length === 0 || body.code.length > 32) {
      throw new AttemptApiError("invalid_logic_code", 400);
    }
    const result = await commandsFor(identity).submitLogicCodeAttempt({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
      code: body.code,
      clientTimeUsedMs: optionalClientTime(body) as DurationMs | undefined,
    });
    return responseFor(result, 200, requestId, "competitive.attempt.logic_code_attempt", startedAt);
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.logic_code_attempt", startedAt);
  }
}
