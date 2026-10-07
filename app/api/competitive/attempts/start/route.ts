import {
  assertSameOrigin,
  AttemptApiError,
  commandsFor,
  errorResponse,
  readStartAttemptToken,
  readJson,
  requireKey,
  requireUuid,
  responseFor,
  requestIdFor,
  setAttemptToken,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { ScheduledChallengeId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const identity = await verifiedIdentity();
    const scheduledChallengeId = requireUuid(body, "scheduledChallengeId") as ScheduledChallengeId;
    const sessionToken = await readStartAttemptToken(identity.authUserId, scheduledChallengeId);
    if (!sessionToken) throw new AttemptApiError("attempt_session_missing", 409);
    const started = await commandsFor(identity, requestId).start({
      scheduledChallengeId,
      idempotencyKey: requireKey(body),
      sessionToken,
    });
    if (started.result.controlRequired) {
      return responseFor(
        {
          error: { code: "attempt_control_required", requestId },
          attempt: {
            attemptId: started.result.attemptId,
            lockVersion: started.result.lockVersion,
            deadlineAt: started.result.deadlineAt,
          },
        },
        409,
        requestId,
        "competitive.attempt.start",
        startedAt,
      );
    }
    // The token is intentionally absent from the JSON response and the HTML/RSC tree.
    await setAttemptToken(
      started.result.attemptId,
      identity.authUserId,
      scheduledChallengeId,
      started.sessionToken,
    );
    return responseFor(
      {
        attemptId: started.result.attemptId,
        resumed: started.result.resumed,
        deadlineAt: started.result.deadlineAt,
        lockVersion: started.result.lockVersion,
      },
      200,
      requestId,
      "competitive.attempt.start",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.start", startedAt);
  }
}
