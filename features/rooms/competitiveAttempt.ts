import type { Attempt } from "@/types/domain";
import type { CompetitiveAttemptStatus } from "@/types/view-models/room";

type AttemptProjection = Pick<Attempt, "status" | "outcome">;

export function getCompetitiveAttemptStatus(
  attempts: readonly AttemptProjection[],
): CompetitiveAttemptStatus {
  if (attempts.some(({ status }) => status === "in_progress")) return "inProgress";

  const terminalAttempt = attempts.find(({ status }) => status !== "in_progress");
  if (!terminalAttempt) return "available";

  return terminalAttempt.status === "completed" && terminalAttempt.outcome !== "failed"
    ? "completed"
    : "notCompleted";
}

export function isTerminalCompetitiveAttemptStatus(status: CompetitiveAttemptStatus) {
  return status === "completed" || status === "notCompleted";
}
