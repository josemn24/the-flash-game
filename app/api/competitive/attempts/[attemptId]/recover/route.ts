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
} from "@/server/competitive/attempt-api";
import { readTerminalFlashReview } from "@/server/competitive/flashResult";
import type { AttemptId } from "@/types/domain/identifiers";

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
    const recovered = await commands.recover({
      attemptId: attemptId as AttemptId,
      sessionToken,
      lockVersion: requireLockVersion(body),
      idempotencyKey: `recovery:${attemptId}:${requireLockVersion(body)}`,
    });
    const snapshot = recovered.snapshot;
    if (recovered.completed) {
      const review = await readTerminalFlashReview(attemptId);
      await clearAttemptToken(attemptId, identity.authUserId, snapshot.scheduledChallengeId);
      return responseFor(
        {
          status: recovered.completed.status,
          lockVersion: recovered.completed.lockVersion,
          answers: snapshot.answers,
          phase: "results",
          ...(recovered.evaluated ? { resolved: recovered.evaluated } : {}),
          review,
          score: recovered.completed.score,
          ...(snapshot.challengeMode === "survival"
            ? {
                livesRemaining: recovered.completed.livesRemaining ?? snapshot.livesRemaining,
                initialLives: snapshot.initialLives,
                outcome: recovered.completed.outcome ?? snapshot.terminalOutcome,
              }
            : {}),
          ...(snapshot.challengeMode === "pyramid"
            ? { outcome: recovered.completed.outcome ?? snapshot.terminalOutcome }
            : {}),
        },
        200,
        requestId,
        "competitive.attempt.recover",
        startedAt,
      );
    }
    return responseFor(
      {
        status: snapshot.status,
        lockVersion: snapshot.lockVersion,
        answers: snapshot.answers,
        phase:
          snapshot.challengeMode === "pyramid" && snapshot.hasOpenInteraction !== true
            ? "briefing"
            : snapshot.hasStartedInteraction
              ? "prepare"
              : "countdown",
        ...(snapshot.challengeMode === "survival"
          ? {
              livesRemaining: snapshot.livesRemaining,
              initialLives: snapshot.initialLives,
              outcome: snapshot.terminalOutcome,
            }
          : {}),
        ...(recovered.evaluated ? { resolved: recovered.evaluated } : {}),
      },
      200,
      requestId,
      "competitive.attempt.recover",
      startedAt,
    );
  } catch (error) {
    return errorResponse(error, requestId, "competitive.attempt.recover", startedAt);
  }
}
