import {
  assertSameOrigin,
  AttemptApiError,
  commandsFor,
  errorResponse,
  readJson,
  readStartAttemptToken,
  requireKey,
  requireLockVersion,
  requirePathUuid,
  requireUuid,
  responseFor,
  requestIdFor,
  setAttemptToken,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { ScheduledChallengeId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ attemptId: string }> };

/**
 * Confirms the explicit transfer using the HttpOnly candidate token prepared
 * by /session. The token is deliberately never part of the response body.
 */
export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  try {
    assertSameOrigin(request);
    const identity = await verifiedIdentity();
    const { attemptId: rawAttemptId } = await context.params;
    const attemptId = requirePathUuid(rawAttemptId) as Parameters<
      ReturnType<typeof commandsFor>["takeOver"]
    >[0]["attemptId"];
    const body = await readJson(request);
    const scheduledChallengeId = requireUuid(body, "scheduledChallengeId") as ScheduledChallengeId;
    const sessionToken = await readStartAttemptToken(identity.authUserId, scheduledChallengeId);
    if (!sessionToken) throw new AttemptApiError("takeover_not_prepared", 409);

    const transferred = await commandsFor(identity, requestId).takeOver({
      attemptId,
      scheduledChallengeId,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      sessionToken,
    });
    await setAttemptToken(
      transferred.result.attemptId,
      identity.authUserId,
      scheduledChallengeId,
      transferred.sessionToken,
    );
    return responseFor(
      {
        attemptId: transferred.result.attemptId,
        sessionId: transferred.result.sessionId,
        lockVersion: transferred.result.lockVersion,
        deadlineAt: transferred.result.deadlineAt,
        transferred: transferred.result.transferred,
      },
      200,
      requestId,
      "competitive.attempt.takeover",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.takeover", startedAt);
  }
}
