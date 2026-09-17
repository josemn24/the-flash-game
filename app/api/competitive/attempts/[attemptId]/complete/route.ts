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
} from "@/server/competitive/attempt-api";
import type { AttemptId } from "@/types/domain/identifiers";
import { readTerminalFlashReview } from "@/server/competitive/flashResult";

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
    const commands = commandsFor(identity);
    const snapshot = await commands.readRecovery(attemptId, sessionToken);
    const result = await commands.completeFromPersistedAnswers({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
    });
    const review = await readTerminalFlashReview(attemptId);
    await clearAttemptToken(attemptId, identity.authUserId, snapshot.scheduledChallengeId);
    return responseFor(
      { ...result, review },
      200,
      requestId,
      "competitive.attempt.complete",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.complete", startedAt);
  }
}
