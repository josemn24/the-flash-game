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

function requirePaths(body: Record<string, unknown>): Record<string, number[]> {
  const paths = body.paths;
  if (!paths || typeof paths !== "object" || Array.isArray(paths))
    throw new AttemptApiError("invalid_paths", 400);
  const entries = Object.entries(paths);
  if (entries.length > 8) throw new AttemptApiError("invalid_paths", 400);
  const result = Object.create(null) as Record<string, number[]>;
  for (const [pairId, path] of entries) {
    if (
      !pairId ||
      pairId.length > 100 ||
      !Array.isArray(path) ||
      path.length > 64 ||
      !path.every((cell) => Number.isSafeInteger(cell) && Number(cell) >= 0 && Number(cell) <= 63)
    )
      throw new AttemptApiError("invalid_paths", 400);
    result[pairId] = path as number[];
  }
  return result;
}

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
    const result = await commandsFor(identity, requestId).saveConnectPairsDraft({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: requireKey(body),
      challengeItemId: requireUuid(body, "challengeItemId") as ChallengeItemId,
      paths: requirePaths(body),
    });
    return responseFor(
      result,
      200,
      requestId,
      "competitive.attempt.connect_pairs_draft",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.connect_pairs_draft", startedAt);
  }
}
