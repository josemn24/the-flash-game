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
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import { readTerminalFlashReview } from "@/server/competitive/flashResult";
import type { AttemptId, AnswerReceiptId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const sessionToken = await readAttemptToken(attemptId);
    const commands = commandsFor(identity);
    const recovery = await commands.recover({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: `recovery:${attemptId}:${requireLockVersion(body)}`,
    });
    let resolved: unknown;
    let lockVersion = recovery.lockVersion;
    if (recovery.receiptId) {
      resolved = await commands.evaluateReceipt({
        attemptId,
        sessionToken,
        lockVersion,
        receiptId: recovery.receiptId as AnswerReceiptId,
        idempotencyKey: `recovery:evaluation:${recovery.receiptId}`,
      });
      lockVersion = (resolved as { lockVersion: number }).lockVersion;
    }
    const snapshot = await commands.readRecovery(attemptId, sessionToken);
    if (snapshot.allItemsResolved) {
      const completed = await commands.completeFromPersistedAnswers({
        attemptId,
        sessionToken,
        lockVersion: snapshot.lockVersion,
        idempotencyKey: `recovery:complete:${attemptId}`,
      });
      const review = await readTerminalFlashReview(attemptId);
      await clearAttemptToken(attemptId, identity.authUserId, snapshot.scheduledChallengeId);
      return responseFor({
        status: completed.status,
        lockVersion: completed.lockVersion,
        answers: snapshot.answers,
        phase: "results",
        ...(resolved ? { resolved } : {}),
        review,
        score: completed.score,
      });
    }
    return responseFor({
      status: snapshot.status,
      lockVersion: snapshot.lockVersion,
      answers: snapshot.answers,
      phase: snapshot.hasStartedInteraction ? "prepare" : "countdown",
      ...(resolved ? { resolved } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
