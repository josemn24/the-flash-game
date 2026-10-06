import {
  assertSameOrigin,
  clearAttemptToken,
  commandsFor,
  errorResponse,
  readAttemptToken,
  readJson,
  requireLockVersion,
  requirePathUuid,
  responseFor,
  requestIdFor,
  verifiedIdentity,
  AttemptApiError,
  mapAttemptError,
} from "@/server/competitive/attempt-api";
import type { AttemptId } from "@/types/domain/identifiers";
import { readAbandonedAttemptResult } from "@/server/competitive/flashResult";
import type { FinishAttemptUseCaseResult } from "@/application/ports/attempt-use-cases";

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
    if (body.confirm !== true) throw new AttemptApiError("abandon_confirmation_required", 400);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const lockVersion = requireLockVersion(body);
    let abandoned: FinishAttemptUseCaseResult;
    try {
      const sessionToken = await readAttemptToken(attemptId);
      abandoned = await commandsFor(identity, requestId).abandon({
        attemptId: attemptId as AttemptId,
        sessionToken,
        lockVersion,
        idempotencyKey: `abandon:${attemptId}`,
      });
    } catch (error) {
      if (
        ![
          "attempt_session_missing",
          "session_revoked",
          "not_authorized",
          "attempt_terminal",
        ].includes(mapAttemptError(error).code)
      )
        throw error;
      const saved = await readAbandonedAttemptResult(attemptId, identity);
      if (!saved) throw error;
      abandoned = saved;
    }
    await clearAttemptToken(attemptId, identity.authUserId, abandoned.scheduledChallengeId);
    return responseFor(abandoned.result, 200, requestId, "competitive.attempt.abandon", startedAt);
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.abandon", startedAt);
  }
}
