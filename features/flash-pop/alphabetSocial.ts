import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import { normalizeFlashPoints } from "@/features/flash-pop/flashPoints";
import { rankChallengeEntries } from "@/lib/challengeRanking";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export type FlashPopAlphabetSummary = {
  challengeId: string;
  score: number;
  correctAnswers: number;
  totalLetters: number;
  elapsedTime: number;
  lastCorrectAt: number | null;
  completedAt: string;
  startedAt: string;
};

type FlashPopAlphabetRankRow = FlashPopRankRow & {
  lastCorrectAt: number | null;
  completedAt: string;
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
  peers: FlashPopAlphabetRankRow[];
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
      durationMs: summary.elapsedTime * 1_000,
      lastCorrectAt: summary.lastCorrectAt,
      completedAt: summary.completedAt,
      startedAt: summary.startedAt,
    },
    ...socialSnapshot.peers.map((row) => ({
      player: row.player,
      flashPoints: normalizeFlashPoints(row.flashPoints),
      timeUsed: row.timeUsed,
      durationMs: row.timeUsed * 1_000,
      lastCorrectAt: row.lastCorrectAt,
      completedAt: row.completedAt,
      startedAt: row.startedAt,
    })),
  ];
  const rankedRows = rankChallengeEntries(rows);
  const current = rankedRows.find((row) => row.player.id === socialSnapshot.currentPlayer.id);
  return {
    socialSource: "demo",
    correctAnswers: summary.correctAnswers,
    totalLetters: summary.totalLetters,
    elapsedTime: summary.elapsedTime,
    lastCorrectAt: summary.lastCorrectAt,
    playerRank: current?.rank ?? rankedRows.length,
    totalPlayers: rankedRows.length,
    flashPointsEarned,
    seasonFlashPoints: (options.seasonFlashPoints ?? 640) + flashPointsEarned,
    peers: rankedRows,
  };
}
