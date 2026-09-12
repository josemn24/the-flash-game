import { compareAlphabetResults } from "@/features/alphabet/alphabetGame";
import { flashPopPlayers, type FlashPopRankRow } from "@/features/flash-pop/demoSocial";

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

type DemoPeerRow = {
  playerId: string;
  correctAnswers: number;
  score: number;
  lastCorrectAt: number | null;
  elapsedTime: number;
};

const DEFAULT_PEERS: DemoPeerRow[] = [
  { playerId: "ana", correctAnswers: 16, score: 89, lastCorrectAt: 108, elapsedTime: 118 },
  { playerId: "luis", correctAnswers: 15, score: 83, lastCorrectAt: 99, elapsedTime: 121 },
  { playerId: "rocio", correctAnswers: 14, score: 78, lastCorrectAt: 111, elapsedTime: 126 },
  { playerId: "joel", correctAnswers: 13, score: 72, lastCorrectAt: 116, elapsedTime: 129 },
  { playerId: "marta", correctAnswers: 12, score: 67, lastCorrectAt: 120, elapsedTime: 133 },
  { playerId: "ines", correctAnswers: 10, score: 56, lastCorrectAt: 124, elapsedTime: 135 },
];

const ALPHABET_FIXTURES: Record<string, DemoPeerRow[]> = {
  "tabarnia-challenge-02": [
    { playerId: "ana", correctAnswers: 17, score: 94, lastCorrectAt: 112, elapsedTime: 119 },
    { playerId: "luis", correctAnswers: 16, score: 89, lastCorrectAt: 105, elapsedTime: 123 },
    { playerId: "rocio", correctAnswers: 15, score: 83, lastCorrectAt: 118, elapsedTime: 127 },
    { playerId: "joel", correctAnswers: 14, score: 78, lastCorrectAt: 121, elapsedTime: 130 },
    { playerId: "marta", correctAnswers: 12, score: 67, lastCorrectAt: 124, elapsedTime: 134 },
    { playerId: "ines", correctAnswers: 10, score: 56, lastCorrectAt: 129, elapsedTime: 135 },
  ],
};

function getPlayer(playerId: string) {
  return flashPopPlayers.find((player) => player.id === playerId) ?? flashPopPlayers[0];
}

function getPeerRows(challengeId: string) {
  return ALPHABET_FIXTURES[challengeId] ?? DEFAULT_PEERS;
}

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
      playerId: "javi",
      correctAnswers: summary.correctAnswers,
      score: summary.score,
      lastCorrectAt: summary.lastCorrectAt,
      elapsedTime: summary.elapsedTime,
    },
    ...getPeerRows(summary.challengeId),
  ]
    .sort(compareAlphabetResults)
    .map((row, index) => ({
      player: getPlayer(row.playerId),
      score: row.score,
      rank: index + 1,
      timeUsed: row.elapsedTime,
    }));
  const current = rows.find((row) => row.player.id === "javi");
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
