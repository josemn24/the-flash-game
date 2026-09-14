import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import { normalizeFlashPoints } from "@/features/flash-pop/flashPoints";
import { rankChallengeEntries } from "@/lib/challengeRanking";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export type FlashPopSurvivalSummary = {
  challengeId: string;
  score: number;
  questionsReached: number;
  totalQuestions: number;
  livesRemaining: number;
  totalTime: number;
  survived: boolean;
  startedAt: string;
};

export type FlashPopSurvivalResult = {
  socialSource: "demo";
  questionsReached: number;
  livesRemaining: number;
  playerRank: number;
  totalPlayers: number;
  flashPointsEarned: number;
  seasonFlashPoints: number;
  peers: FlashPopRankRow[];
};

export function getFlashPopSurvivalResult(
  summary: FlashPopSurvivalSummary,
  socialSnapshot: FlashPopSocialSnapshot,
  options: { seasonFlashPoints?: number } = {},
): FlashPopSurvivalResult {
  const flashPointsEarned = normalizeFlashPoints(summary.score);
  const rows = [
    {
      player: socialSnapshot.currentPlayer,
      flashPoints: flashPointsEarned,
      timeUsed: summary.totalTime,
      startedAt: summary.startedAt,
      durationMs: summary.totalTime * 1_000,
    },
    ...socialSnapshot.peers.map(({ player, flashPoints, timeUsed, startedAt }) => ({
      player,
      flashPoints: normalizeFlashPoints(flashPoints),
      timeUsed,
      startedAt,
      durationMs: timeUsed * 1_000,
    })),
  ];
  const rankedRows = rankChallengeEntries(rows);
  const playerRank =
    rankedRows.find((row) => row.player.id === socialSnapshot.currentPlayer.id)?.rank ??
    rankedRows.length;
  return {
    socialSource: "demo",
    questionsReached: summary.questionsReached,
    livesRemaining: summary.livesRemaining,
    playerRank,
    totalPlayers: rankedRows.length,
    flashPointsEarned,
    seasonFlashPoints: (options.seasonFlashPoints ?? 640) + flashPointsEarned,
    peers: rankedRows,
  };
}
