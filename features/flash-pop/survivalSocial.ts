import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export type FlashPopSurvivalSummary = {
  challengeId: string;
  score: number;
  questionsReached: number;
  totalQuestions: number;
  livesRemaining: number;
  totalTime: number;
  survived: boolean;
};

export type FlashPopSurvivalResult = {
  socialSource: "demo";
  score: number;
  questionsReached: number;
  livesRemaining: number;
  playerRank: number;
  totalPlayers: number;
  seasonXpEarned: number;
  seasonXpCurrent: number;
  nextLevelAt: number;
  peers: FlashPopRankRow[];
};

export function calculateSurvivalSeasonXp(
  summary: Pick<FlashPopSurvivalSummary, "questionsReached" | "totalQuestions" | "totalTime">,
  totalTimeLimit: number,
) {
  const progress = Math.min(
    1,
    Math.max(0, summary.questionsReached / Math.max(1, summary.totalQuestions)),
  );
  const speed = Math.min(1, Math.max(0, 1 - summary.totalTime / Math.max(1, totalTimeLimit)));
  return Math.min(120, Math.round(40 * progress + 60 * progress + 20 * speed));
}

export function getFlashPopSurvivalResult(
  summary: FlashPopSurvivalSummary,
  socialSnapshot: FlashPopSocialSnapshot,
  options: { totalTimeLimit?: number; seasonXpCurrent?: number; nextLevelAt?: number } = {},
): FlashPopSurvivalResult {
  const rows = [
    { player: socialSnapshot.currentPlayer, score: summary.score, timeUsed: summary.totalTime },
    ...socialSnapshot.peers.map(({ player, score, timeUsed }) => ({
      player,
      score,
      timeUsed,
    })),
  ]
    .sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const playerRank =
    rows.find((row) => row.player.id === socialSnapshot.currentPlayer.id)?.rank ?? rows.length;

  return {
    socialSource: "demo",
    score: summary.score,
    questionsReached: summary.questionsReached,
    livesRemaining: summary.livesRemaining,
    playerRank,
    totalPlayers: rows.length,
    seasonXpEarned: calculateSurvivalSeasonXp(summary, options.totalTimeLimit ?? summary.totalTime),
    seasonXpCurrent: options.seasonXpCurrent ?? 640,
    nextLevelAt: options.nextLevelAt ?? 1000,
    peers: rows,
  };
}
