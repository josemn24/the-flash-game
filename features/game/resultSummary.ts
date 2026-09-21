import type { AnswerResult, AnswerStatus } from "@/types/game";

export type ResultAccuracyUnit = {
  status: AnswerStatus;
  precision?: number;
};

export function formatResultTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

export function getResultAccuracyContribution(unit: ResultAccuracyUnit) {
  if (unit.status === "correct") return 1;
  if (unit.status !== "partial") return 0;
  return Number.isFinite(unit.precision) ? Math.min(1, Math.max(0, unit.precision ?? 0)) : 0;
}

export function calculateResultAccuracy(units: readonly ResultAccuracyUnit[]) {
  if (units.length === 0) return 0;
  const total = units.reduce((sum, unit) => sum + getResultAccuracyContribution(unit), 0);
  return Math.round((total / units.length) * 100);
}

export function getAnswerResultAccuracyUnit(
  result: Pick<AnswerResult, "status" | "details">,
): ResultAccuracyUnit {
  if (result.details?.type === "estimation") {
    return { status: result.status, precision: result.details.proximity };
  }
  if (result.details?.type === "heat-map") {
    return { status: result.status, precision: result.details.accuracy };
  }
  return { status: result.status };
}

export function normalizeResultScore(score: number, maxScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.min(maxScore, Math.max(0, score));
}

export function getResultProgress(score: number, maxScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}
