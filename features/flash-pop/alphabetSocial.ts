import { compareAlphabetResults } from "@/features/alphabet/alphabetGame";
import {
  canonicalCurrentPlayer,
  getCanonicalSocialRows,
} from "@/features/flash-pop/canonicalSocial";
import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";

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
  score: number;
  correctAnswers: number;
  totalLetters: number;
  elapsedTime: number;
  lastCorrectAt: number | null;
  playerRank: number;
  totalPlayers: number;
  seasonXpEarned: number;
  seasonXpCurrent: number;
  nextLevelAt: number;
  peers: FlashPopRankRow[];
};

export function calculateAlphabetSeasonXp(
  summary: Pick<FlashPopAlphabetSummary, "correctAnswers" | "totalLetters" | "elapsedTime">,
  timeLimit: number,
) {
  const progress = Math.min(
    1,
    Math.max(0, summary.correctAnswers / Math.max(1, summary.totalLetters)),
  );
  const speed = Math.min(1, Math.max(0, 1 - summary.elapsedTime / Math.max(1, timeLimit)));
  return Math.min(120, Math.round(40 * progress + 60 * progress + 20 * speed));
}

export function getFlashPopAlphabetResult(
  summary: FlashPopAlphabetSummary,
  options: { timeLimit?: number; seasonXpCurrent?: number; nextLevelAt?: number } = {},
): FlashPopAlphabetResult {
  const rows = [
    {
      player: canonicalCurrentPlayer,
      correctAnswers: summary.correctAnswers,
      score: summary.score,
      lastCorrectAt: summary.lastCorrectAt,
      elapsedTime: summary.elapsedTime,
    },
    ...getCanonicalSocialRows(summary.challengeId).map((row) => ({
      player: row.player,
      correctAnswers: row.correctAnswers,
      score: row.score,
      lastCorrectAt: row.lastCorrectAt,
      elapsedTime: row.timeUsed,
    })),
  ]
    .sort(compareAlphabetResults)
    .map((row, index) => ({
      player: row.player,
      score: row.score,
      rank: index + 1,
      timeUsed: row.elapsedTime,
    }));
  const current = rows.find((row) => row.player.id === canonicalCurrentPlayer.id);
  const nextLevelAt = options.nextLevelAt ?? 1000;
  const earned = calculateAlphabetSeasonXp(summary, options.timeLimit ?? summary.elapsedTime);

  return {
    socialSource: "demo",
    score: summary.score,
    correctAnswers: summary.correctAnswers,
    totalLetters: summary.totalLetters,
    elapsedTime: summary.elapsedTime,
    lastCorrectAt: summary.lastCorrectAt,
    playerRank: current?.rank ?? rows.length,
    totalPlayers: rows.length,
    seasonXpEarned: earned,
    seasonXpCurrent: Math.min(nextLevelAt, (options.seasonXpCurrent ?? 640) + earned),
    nextLevelAt,
    peers: rows,
  };
}
