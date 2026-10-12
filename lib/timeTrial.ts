import type { TimeTrialProgress, TimeTrialResult } from "@/types/domain/time-trial";

export const TIME_TRIAL_MAX_INCORRECT_VALIDATIONS = 3;
export const TIME_TRIAL_END_LABELS = {
  all_solved: "Todas las pruebas resueltas",
  validation_limit: "Tres validaciones incorrectas",
  time_limit: "Tiempo agotado",
  recovery_interrupted: "Prueba interrumpida sin respuesta recibida",
} as const;

export function readTimeTrialProgress(value: unknown): TimeTrialProgress {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_time_trial_progress");
  const p = value as Record<string, unknown>;
  const nonnegative = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
  if (
    p.kind !== "time-trial" ||
    !nonnegative(p.currentIndex) ||
    !nonnegative(p.solvedCount) ||
    !nonnegative(p.totalCount) ||
    Number(p.totalCount) < 2 ||
    Number(p.totalCount) > 20 ||
    Number(p.solvedCount) > Number(p.totalCount) ||
    !nonnegative(p.points) ||
    Number(p.points) > 100 ||
    !(p.clockStartedAt === null || date(p.clockStartedAt)) ||
    !(p.deadlineAt === null || date(p.deadlineAt)) ||
    !nonnegative(p.elapsedTimeMs) ||
    !date(p.serverNow) ||
    !(p.lastCorrectElapsedMs === null || nonnegative(p.lastCorrectElapsedMs)) ||
    !(
      p.endReason === null ||
      (typeof p.endReason === "string" && Object.hasOwn(TIME_TRIAL_END_LABELS, p.endReason))
    )
  ) {
    throw new Error("invalid_time_trial_progress");
  }
  return value as TimeTrialProgress;
}

export function readTimeTrialResult(value: unknown): TimeTrialResult {
  const progress = readTimeTrialProgress(value);
  if (
    progress.endReason === null ||
    progress.clockStartedAt === null ||
    progress.deadlineAt === null
  )
    throw new Error("invalid_time_trial_result");
  return progress as TimeTrialResult;
}
