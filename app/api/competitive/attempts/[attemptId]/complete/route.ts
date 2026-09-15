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
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const sessionToken = await readAttemptToken(attemptId);
    const result = await commandsFor(identity).completeFromPersistedAnswers({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
    });
    const review = await readTerminalFlashReview(attemptId);
    await clearAttemptToken(attemptId);
    return responseFor({ ...result, review });
  } catch (error) {
    return errorResponse(error);
  }
}
