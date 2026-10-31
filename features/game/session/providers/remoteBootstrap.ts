import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";

/** The competitive composition owns room-specific server projections, not the engine. */
export function remoteSessionBootstrap(
  context: GameRoomContext,
  review?: readonly ServerFlashTerminalReview[],
): GameSessionBootstrap {
  return {
    status: context.result
      ? "completed"
      : context.attemptStatus === "inProgress"
        ? "inProgress"
        : "new",
    results: (context.result?.attempt?.answers ?? []).map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
      status: answer.status,
      isCorrect: answer.isCorrect,
      points: answer.points ?? 0,
      timeUsed: answer.timeUsed ?? 0,
      ...(answer.details ? { details: answer.details } : {}),
      ...(answer.reviewState ? { reviewState: answer.reviewState } : {}),
    })),
    score: context.result?.flashPoints ?? 0,
    timeTrial: context.timeTrial,
    review,
  };
}
