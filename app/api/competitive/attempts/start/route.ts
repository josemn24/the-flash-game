import {
  assertSameOrigin,
  AttemptApiError,
  commandsFor,
  errorResponse,
  newAttemptToken,
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
    const sessionToken =
      (await readStartAttemptToken(identity.authUserId, scheduledChallengeId)) ?? newAttemptToken();
    const result = await commandsFor(identity).start({
      scheduledChallengeId,
      idempotencyKey: requireKey(body),
      sessionToken,
    });
    if (result.controlRequired) {
      throw new AttemptApiError("attempt_control_required", 409);
    }
    // The token is intentionally absent from the JSON response and the HTML/RSC tree.
    await setAttemptToken(
      result.attemptId,
      identity.authUserId,
      scheduledChallengeId,
      sessionToken,
    );
    return responseFor(
      {
        attemptId: result.attemptId,
        resumed: result.resumed,
        deadlineAt: result.deadlineAt,
        lockVersion: result.lockVersion,
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
