import {
  assertSameOrigin,
  commandsFor,
  errorResponse,
  newAttemptToken,
  readJson,
  readStartAttemptToken,
  readAttemptToken,
  AttemptApiError,
  requireUuid,
  responseFor,
  requestIdFor,
  setPreparationToken,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { ScheduledChallengeId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No attempt or timer exists until a subsequent start request echoes this cookie. */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = requestIdFor(request);
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const scheduledChallengeId = requireUuid(body, "scheduledChallengeId") as ScheduledChallengeId;
    const identity = await verifiedIdentity();
    const expectedAttemptId =
      body.expectedAttemptId === undefined ? undefined : requireUuid(body, "expectedAttemptId");
    let previousToken = await readStartAttemptToken(identity.authUserId, scheduledChallengeId);
    if (expectedAttemptId) {
      try {
        previousToken = await readAttemptToken(expectedAttemptId);
      } catch (error) {
        if (!(error instanceof AttemptApiError) || error.code !== "attempt_session_missing")
          throw error;
      }
    }
    const freshToken = newAttemptToken();
    const result = await commandsFor(identity, requestId).prepareSession({
      scheduledChallengeId,
      expectedAttemptId,
      freshToken,
      previousToken,
    });
    if (!result.preparationId) throw new AttemptApiError("invalid_backend_response", 500);
    await setPreparationToken(
      result.preparationId,
      result.usePreviousToken && previousToken ? previousToken : freshToken,
    );
    return responseFor(
      { ready: true, preparationId: result.preparationId },
      200,
      requestId,
      "competitive.attempt.session",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.session", startedAt);
  }
}
