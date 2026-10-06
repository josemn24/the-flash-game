import {
  assertSameOrigin,
  clearAttemptToken,
  commandsFor,
  errorResponse,
  readAttemptToken,
  readJson,
  requireKey,
  requireLockVersion,
  requirePathUuid,
  responseFor,
  requestIdFor,
  verifiedIdentity,
  mapAttemptError,
} from "@/server/competitive/attempt-api";
import type { AttemptId } from "@/types/domain/identifiers";
import {
  readTerminalReviewSafely,
  readTerminalAttemptResult,
} from "@/server/competitive/flashResult";

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
    const lockVersion = requireLockVersion(body);
    const idempotencyKey = requireKey(body);
    const completed = await (async () => {
      try {
        const sessionToken = await readAttemptToken(attemptId);
        return await commandsFor(identity, requestId).complete({
          attemptId: attemptId as AttemptId,
          sessionToken,
          lockVersion,
          idempotencyKey,
        });
      } catch (error) {
        const code = mapAttemptError(error).code;
        if (
          [
            "attempt_session_missing",
            "session_revoked",
            "not_authorized",
            "attempt_terminal",
          ].includes(code)
        ) {
          const saved = await readTerminalAttemptResult(attemptId, identity);
          if (saved) return saved;
        }
        throw error;
      }
    })();
    const review = await readTerminalReviewSafely(attemptId);
    await clearAttemptToken(attemptId, identity.authUserId, completed.scheduledChallengeId);
    return responseFor(
      { ...completed.result, ...review },
      200,
      requestId,
      "competitive.attempt.complete",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.complete", startedAt);
  }
}
