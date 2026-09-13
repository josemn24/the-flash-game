import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import { normalizeFlashPoints } from "@/features/flash-pop/flashPoints";
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
    },
    ...socialSnapshot.peers.map(({ player, flashPoints, timeUsed }) => ({
      player,
      flashPoints: normalizeFlashPoints(flashPoints),
      timeUsed,
    })),
  ]
    .sort((left, right) => right.flashPoints - left.flashPoints || left.timeUsed - right.timeUsed)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const playerRank =
    rows.find((row) => row.player.id === socialSnapshot.currentPlayer.id)?.rank ?? rows.length;
  return {
    socialSource: "demo",
    questionsReached: summary.questionsReached,
    livesRemaining: summary.livesRemaining,
    playerRank,
    totalPlayers: rows.length,
    flashPointsEarned,
    seasonFlashPoints: (options.seasonFlashPoints ?? 640) + flashPointsEarned,
    peers: rows,
  };
}
