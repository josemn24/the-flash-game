export type ChallengeRankingMetrics = {
  flashPoints: number;
  durationMs: number;
  startedAt: string;
};

export function sumEffectiveDurationMs(answers: readonly unknown[]) {
  return answers.reduce<number>((total, answer) => {
    if (!answer || typeof answer !== "object") return total;
    const candidate = answer as { timeUsed?: unknown; timeUsedMs?: unknown };
    if (typeof candidate.timeUsedMs === "number") {
      return total + Math.max(0, candidate.timeUsedMs);
    }
    return (
      total + (typeof candidate.timeUsed === "number" ? Math.max(0, candidate.timeUsed) * 1_000 : 0)
    );
  }, 0);
}

export function compareChallengeRankingMetrics(
  left: ChallengeRankingMetrics,
  right: ChallengeRankingMetrics,
) {
  return (
    right.flashPoints - left.flashPoints ||
    left.durationMs - right.durationMs ||
    Date.parse(left.startedAt) - Date.parse(right.startedAt)
  );
}

export function rankChallengeEntries<Entry extends ChallengeRankingMetrics>(
  entries: readonly Entry[],
) {
  const ordered = [...entries].sort(compareChallengeRankingMetrics);
  return ordered.map((entry) => ({
    ...entry,
    rank:
      ordered.findIndex((candidate) => compareChallengeRankingMetrics(candidate, entry) === 0) + 1,
  }));
}
