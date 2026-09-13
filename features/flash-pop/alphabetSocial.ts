import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import { normalizeFlashPoints } from "@/features/flash-pop/flashPoints";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export type FlashPopAlphabetSummary = {
  challengeId: string;
  score: number;
  correctAnswers: number;
  totalLetters: number;
  elapsedTime: number;
  lastCorrectAt: number | null;
};

export type FlashPopAlphabetResult = {
  socialSource: "demo";
  correctAnswers: number;
  totalLetters: number;
  elapsedTime: number;
  lastCorrectAt: number | null;
  playerRank: number;
  totalPlayers: number;
  flashPointsEarned: number;
  seasonFlashPoints: number;
  peers: FlashPopRankRow[];
};

export function getFlashPopAlphabetResult(
  summary: FlashPopAlphabetSummary,
  socialSnapshot: FlashPopSocialSnapshot,
  options: { seasonFlashPoints?: number } = {},
): FlashPopAlphabetResult {
  const flashPointsEarned = normalizeFlashPoints(summary.score);
  const rows = [
    {
      player: socialSnapshot.currentPlayer,
      flashPoints: flashPointsEarned,
      timeUsed: summary.elapsedTime,
    },
    ...socialSnapshot.peers.map((row) => ({
      player: row.player,
      flashPoints: normalizeFlashPoints(row.flashPoints),
      timeUsed: row.timeUsed,
    })),
  ]
    .sort((left, right) => right.flashPoints - left.flashPoints || left.timeUsed - right.timeUsed)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  const current = rows.find((row) => row.player.id === socialSnapshot.currentPlayer.id);
  return {
    socialSource: "demo",
    correctAnswers: summary.correctAnswers,
    totalLetters: summary.totalLetters,
    elapsedTime: summary.elapsedTime,
    lastCorrectAt: summary.lastCorrectAt,
    playerRank: current?.rank ?? rows.length,
    totalPlayers: rows.length,
    flashPointsEarned,
    seasonFlashPoints: (options.seasonFlashPoints ?? 640) + flashPointsEarned,
    peers: rows,
  };
}
