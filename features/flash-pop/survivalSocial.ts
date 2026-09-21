import type { FlashPopRankRow } from "@/features/flash-pop/demoSocial";
import { flashPopPlayers } from "@/features/flash-pop/demoSocial";

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

type DemoPeerRow = { playerId: string; score: number; timeUsed: number };

const DEFAULT_PEERS: DemoPeerRow[] = [
  { playerId: "ana", score: 92, timeUsed: 176 },
  { playerId: "luis", score: 84, timeUsed: 192 },
  { playerId: "rocio", score: 77, timeUsed: 205 },
  { playerId: "joel", score: 69, timeUsed: 218 },
  { playerId: "marta", score: 61, timeUsed: 231 },
  { playerId: "ines", score: 54, timeUsed: 244 },
];

const SURVIVAL_FIXTURES: Record<string, DemoPeerRow[]> = {
  "tabarnia-challenge-03": [
    { playerId: "ana", score: 94, timeUsed: 302 },
    { playerId: "luis", score: 86, timeUsed: 328 },
    { playerId: "rocio", score: 79, timeUsed: 351 },
    { playerId: "joel", score: 68, timeUsed: 372 },
    { playerId: "marta", score: 60, timeUsed: 391 },
    { playerId: "ines", score: 51, timeUsed: 412 },
  ],
};

function getPlayer(playerId: string) {
  return flashPopPlayers.find((player) => player.id === playerId) ?? flashPopPlayers[0];
}

function getPeerRows(challengeId: string) {
  return SURVIVAL_FIXTURES[challengeId] ?? DEFAULT_PEERS;
}

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
  options: { totalTimeLimit?: number; seasonXpCurrent?: number; nextLevelAt?: number } = {},
): FlashPopSurvivalResult {
  const rows = [
    { playerId: "javi", score: summary.score, timeUsed: summary.totalTime },
    ...getPeerRows(summary.challengeId),
  ]
    .map((row) => ({ ...row, player: getPlayer(row.playerId) }))
    .sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const playerRank = rows.find((row) => row.player.id === "javi")?.rank ?? rows.length;

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
