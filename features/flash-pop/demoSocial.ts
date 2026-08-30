import type { PopAvatarTone } from "@/components/flash-pop/ui";
import type {
  PyramidAttemptRecord,
  PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";

export const FLASH_POP_CHALLENGE_ID = "tabarnia-challenge-05";
export const FLASH_POP_STORAGE_NAMESPACE = "flash-pop-pyramid-slice";
export const FLASH_POP_SLICE_LEVEL_COUNT = 1;
export const FLASH_POP_SLICE_TIME_LIMIT = 12;

export type FlashPopAttemptStatus = "available" | "inProgress" | "completed" | "notCompleted";

export type FlashPopPlayer = {
  id: string;
  displayName: string;
  initials: string;
  tone: PopAvatarTone;
};

export type FlashPopActivity = {
  id: string;
  playerId: string;
  text: string;
  meta: string;
  icon: "trophy" | "bolt";
};

export type FlashPopLobbyChallenge = {
  id: string;
  title: string;
  subtitle: string;
  status: FlashPopAttemptStatus;
  participants: FlashPopPlayer[];
  playerScore?: number;
  playerRank?: number;
  totalPlayers: number;
  seasonXp: {
    current: number;
    nextLevelAt: number;
    maxEarnable: number;
  };
  activities: FlashPopActivity[];
};

export type FlashPopRankRow = {
  player: FlashPopPlayer;
  score: number;
  rank: number;
  timeUsed: number;
};

export type FlashPopResult = {
  score: number;
  playerRank: number;
  totalPlayers: number;
  seasonXpEarned: number;
  seasonXpCurrent: number;
  nextLevelAt: number;
  peers: FlashPopRankRow[];
};

export const flashPopPlayers: FlashPopPlayer[] = [
  { id: "javi", displayName: "Javi", initials: "JM", tone: "social" },
  { id: "ana", displayName: "Ana", initials: "AM", tone: "coral" },
  { id: "luis", displayName: "Luis", initials: "LU", tone: "blue" },
  { id: "rocio", displayName: "Rocío", initials: "RO", tone: "aqua" },
  { id: "joel", displayName: "Joel", initials: "JO", tone: "ink" },
  { id: "marta", displayName: "Marta", initials: "MA", tone: "reward" },
  { id: "ines", displayName: "Inés", initials: "IN", tone: "social" },
  { id: "pablo", displayName: "Pablo", initials: "PA", tone: "blue" },
];

const demoPeerRows = [
  { playerId: "ana", score: 9, timeUsed: 5.4 },
  { playerId: "luis", score: 8, timeUsed: 7.1 },
  { playerId: "rocio", score: 7, timeUsed: 6.2 },
  { playerId: "joel", score: 6, timeUsed: 8.8 },
  { playerId: "marta", score: 5, timeUsed: 9.4 },
  { playerId: "ines", score: 4, timeUsed: 10.2 },
  { playerId: "pablo", score: 3, timeUsed: 11.1 },
];

function getPlayer(id: string) {
  return flashPopPlayers.find((player) => player.id === id)!;
}

export function getFlashPopAttemptStatus(
  record: Pick<PyramidAttemptRecord, "status"> | null | undefined,
): FlashPopAttemptStatus {
  if (!record) return "available";
  return record.status === "completed" ? "completed" : "inProgress";
}

export function calculateSeasonXp(
  summary: Pick<PyramidAttemptSummary, "levelsCleared" | "timeUsed">,
  levelCount = FLASH_POP_SLICE_LEVEL_COUNT,
  timeLimit = FLASH_POP_SLICE_TIME_LIMIT,
) {
  const safeLevelCount = Math.max(1, levelCount);
  const performance = Math.round(
    60 * Math.min(1, Math.max(0, summary.levelsCleared / safeLevelCount)),
  );
  const speedRatio = Math.min(1, Math.max(0, 1 - summary.timeUsed / Math.max(1, timeLimit)));
  const speed = Math.round(20 * speedRatio);
  return Math.min(120, 40 + performance + speed);
}

export function getFlashPopResult(
  summary: PyramidAttemptSummary,
  seasonXpCurrent = 680,
  nextLevelAt = 900,
): FlashPopResult {
  const rows = [
    { player: getPlayer("javi"), score: summary.score, timeUsed: summary.timeUsed },
    ...demoPeerRows.map(({ playerId, score, timeUsed }) => ({
      player: getPlayer(playerId),
      score,
      timeUsed,
    })),
  ].sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed);

  const ranked = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const current = ranked.find((row) => row.player.id === "javi")!;
  const earned = calculateSeasonXp(summary);

  return {
    score: summary.score,
    playerRank: current.rank,
    totalPlayers: ranked.length,
    seasonXpEarned: earned,
    seasonXpCurrent: Math.min(nextLevelAt, seasonXpCurrent + earned),
    nextLevelAt,
    peers: ranked,
  };
}

export function getFlashPopLobbyChallenge(
  record: Pick<PyramidAttemptRecord, "status" | "summary"> | null | undefined,
): FlashPopLobbyChallenge {
  const status = getFlashPopAttemptStatus(record);
  const result = record?.summary ? getFlashPopResult(record.summary) : null;

  return {
    id: FLASH_POP_CHALLENGE_ID,
    title: "La Pirámide",
    subtitle: "Un nivel. Un intento. Sube cuanto puedas.",
    status,
    participants: flashPopPlayers.slice(1),
    playerScore: result?.score,
    playerRank: result?.playerRank,
    totalPlayers: result?.totalPlayers ?? flashPopPlayers.length,
    seasonXp: {
      current: result?.seasonXpCurrent ?? 680,
      nextLevelAt: result?.nextLevelAt ?? 900,
      maxEarnable: 120,
    },
    activities: [
      {
        id: "ana-position",
        playerId: "ana",
        text: "subió al 1.º puesto",
        meta: "Hace 12 min · 9 puntos",
        icon: "trophy",
      },
      {
        id: "luis-finished",
        playerId: "luis",
        text: "terminó La Pirámide",
        meta: "Hace 26 min · +82 ⚡",
        icon: "bolt",
      },
    ],
  };
}
