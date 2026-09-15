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
  AttemptApiError,
} from "@/server/competitive/attempt-api";
import type { AttemptId } from "@/types/domain/identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    if (body.confirm !== true) throw new AttemptApiError("abandon_confirmation_required", 400);
    const { attemptId: rawAttemptId } = await params;
    const attemptId = requirePathUuid(rawAttemptId);
    const identity = await verifiedIdentity();
    const sessionToken = await readAttemptToken(attemptId);
    const commands = commandsFor(identity);
    const snapshot = await commands.readRecovery(attemptId, sessionToken);
    const result = await commands.abandon({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: `abandon:${attemptId}`,
    });
    await clearAttemptToken(attemptId, identity.authUserId, snapshot.scheduledChallengeId);
    return responseFor(result);
  } catch (error) {
    return errorResponse(error);
  }
}
