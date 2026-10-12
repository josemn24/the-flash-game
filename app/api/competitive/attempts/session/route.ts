import {
  assertSameOrigin,
  commandsFor,
  errorResponse,
  newAttemptToken,
  readJson,
  readStartAttemptToken,
  requireUuid,
  responseFor,
  requestIdFor,
  setStartAttemptToken,
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
    const result = await commandsFor(identity, requestId).prepareSession({ scheduledChallengeId });
    const token =
      (await readStartAttemptToken(identity.authUserId, scheduledChallengeId)) || newAttemptToken();
    await setStartAttemptToken(identity.authUserId, scheduledChallengeId, token);
    return responseFor(result, 200, requestId, "competitive.attempt.session", startedAt);
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.session", startedAt);
  }
}
