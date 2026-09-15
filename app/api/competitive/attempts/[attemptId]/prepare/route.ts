import {
  assertSameOrigin,
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
    const result = await commandsFor(identity).prepare({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
    });
    return responseFor(result);
  } catch (error) {
    return errorResponse(error);
  }
}
