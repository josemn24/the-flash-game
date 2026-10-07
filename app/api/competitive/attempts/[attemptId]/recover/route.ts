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
  mapAttemptError,
} from "@/server/competitive/attempt-api";
import {
  readTerminalReviewSafely,
  readTerminalAttemptResult,
  readAbandonedAttemptResult,
} from "@/server/competitive/flashResult";
import type { AttemptId } from "@/types/domain/identifiers";
import type { RecoveryUseCaseResult } from "@/application/ports/attempt-use-cases";

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
    let recovered: RecoveryUseCaseResult;
    try {
      const sessionToken = await readAttemptToken(attemptId);
      recovered = await commandsFor(identity, requestId).recover({
        attemptId: attemptId as AttemptId,
        sessionToken,
        lockVersion,
        idempotencyKey: `recovery:${attemptId}:${lockVersion}`,
      });
    } catch (error) {
      if (
        [
          "attempt_session_missing",
          "session_revoked",
          "not_authorized",
          "attempt_permission_revoked",
          "attempt_terminal",
        ].includes(mapAttemptError(error).code)
      ) {
        const saved = await readTerminalAttemptResult(attemptId, identity);
        if (saved) {
          await clearAttemptToken(attemptId, identity.authUserId, saved.scheduledChallengeId);
          return responseFor(
            { ...saved.result, ...(await readTerminalReviewSafely(attemptId)), phase: "results" },
            200,
            requestId,
            "competitive.attempt.recover",
            startedAt,
          );
        }
        const abandoned = await readAbandonedAttemptResult(attemptId, identity);
        if (abandoned) {
          await clearAttemptToken(attemptId, identity.authUserId, abandoned.scheduledChallengeId);
          return responseFor(
            { ...abandoned.result, phase: "results" },
            200,
            requestId,
            "competitive.attempt.recover",
            startedAt,
          );
        }
      }
      throw error;
    }
    const snapshot = recovered.snapshot;
    if (recovered.completed) {
      const review = await readTerminalReviewSafely(attemptId);
      await clearAttemptToken(attemptId, identity.authUserId, snapshot.scheduledChallengeId);
      return responseFor(
        {
          ...recovered.completed,
          terminalOutcome: snapshot.terminalOutcome ?? null,
          answers: recovered.completed.answers ?? snapshot.answers,
          phase: "results",
          ...(recovered.evaluated ? { resolved: recovered.evaluated } : {}),
          ...(snapshot.challengeMode === "narrative" && snapshot.narrativeCursor
            ? { narrativeCursor: snapshot.narrativeCursor }
            : {}),
          ...review,
          score: recovered.completed.score,
          ...(snapshot.challengeMode === "survival"
            ? {
                livesRemaining: recovered.completed.livesRemaining ?? snapshot.livesRemaining,
                initialLives: snapshot.initialLives,
              }
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
        attemptId: snapshot.attemptId,
        challengeMode: snapshot.challengeMode,
        status: snapshot.status,
        outcome: snapshot.outcome,
        terminalOutcome: snapshot.terminalOutcome ?? null,
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
            }
          : {}),
        ...(recovered.evaluated ? { resolved: recovered.evaluated } : {}),
        ...(snapshot.challengeMode === "narrative" && snapshot.narrativeCursor
          ? { narrativeCursor: snapshot.narrativeCursor }
          : {}),
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
