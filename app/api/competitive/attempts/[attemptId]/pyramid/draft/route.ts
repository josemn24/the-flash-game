import { isPyramidDraftAnswer } from "@/lib/gameplay/pyramidPartialCredit";
import {
  AttemptApiError,
  assertSameOrigin,
  commandsFor,
  errorResponse,
  readAttemptToken,
  readJson,
  requireKey,
  requireLockVersion,
  requirePathUuid,
  requireUuid,
  responseFor,
  requestIdFor,
  verifiedIdentity,
} from "@/server/competitive/attempt-api";
import type { AttemptId, ChallengeItemId } from "@/types/domain/identifiers";

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
    if (!isPyramidDraftAnswer(body.answer)) throw new AttemptApiError("invalid_command", 400);
    const result = await commandsFor(identity, requestId).savePyramidDraft({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
      answer: body.answer,
    });
    return responseFor(result, 200, requestId, "competitive.attempt.pyramid_draft", startedAt);
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.pyramid_draft", startedAt);
  }
}
