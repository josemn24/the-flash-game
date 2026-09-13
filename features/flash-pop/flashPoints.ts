import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";

export const FLASH_POINTS_MAX = CHALLENGE_MAX_SCORE;

export function normalizeFlashPoints(value: number) {
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(FLASH_POINTS_MAX, Math.max(0, safeValue));
}
