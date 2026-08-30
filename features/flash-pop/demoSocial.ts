import type { PopAvatarTone } from "@/components/flash-pop/ui";
import type {
  PyramidAttemptRecord,
  PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";

export const FLASH_POP_CHALLENGE_ID = "tabarnia-challenge-05";
export const FLASH_POP_SECONDARY_CHALLENGE_ID = "tabarnia-challenge-06";
export const FLASH_POP_PREVIEW_CHALLENGE_IDS = [
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SECONDARY_CHALLENGE_ID,
] as const;
export const FLASH_POP_STORAGE_NAMESPACE = "flash-pop-pyramid-v2";
export const FLASH_POP_LEVEL_COUNT = 7;
export const FLASH_POP_TOTAL_TIME_LIMIT = 235;

export type FlashPopAttemptStatus = "available" | "inProgress" | "completed" | "notCompleted";
export type FlashPopChallengeId = (typeof FLASH_POP_PREVIEW_CHALLENGE_IDS)[number];

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
  currentLevelIndex?: number;
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
  levelsCleared: number;
  playerRank: number;
  totalPlayers: number;
  seasonXpEarned: number;
  seasonXpCurrent: number;
  nextLevelAt: number;
  peers: FlashPopRankRow[];
};

export type FlashPopScoringConfig = {
  levelCount?: number;
  totalTimeLimit?: number;
  seasonXpCurrent?: number;
  nextLevelAt?: number;
};

type DemoPeerRow = { playerId: string; score: number; timeUsed: number };

type FlashPopSocialFixture = {
  title: string;
  subtitle: string;
  peerRows: DemoPeerRow[];
  activities: FlashPopActivity[];
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

const socialFixtures: Record<FlashPopChallengeId, FlashPopSocialFixture> = {
  [FLASH_POP_CHALLENGE_ID]: {
    title: "La Pirámide",
    subtitle: "Siete niveles. Un intento. Sube cuanto puedas.",
    peerRows: [
      { playerId: "ana", score: 92, timeUsed: 154 },
      { playerId: "luis", score: 84, timeUsed: 177 },
      { playerId: "rocio", score: 78, timeUsed: 185 },
      { playerId: "joel", score: 70, timeUsed: 201 },
      { playerId: "marta", score: 63, timeUsed: 212 },
      { playerId: "ines", score: 56, timeUsed: 226 },
      { playerId: "pablo", score: 48, timeUsed: 232 },
    ],
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
  },
  [FLASH_POP_SECONDARY_CHALLENGE_ID]: {
    title: "La Pirámide: Biblia y religiones abrahámicas",
    subtitle: "Siete niveles. Una herencia compartida.",
    peerRows: [
      { playerId: "ana", score: 96, timeUsed: 139 },
      { playerId: "luis", score: 88, timeUsed: 162 },
      { playerId: "rocio", score: 81, timeUsed: 173 },
      { playerId: "joel", score: 73, timeUsed: 190 },
      { playerId: "marta", score: 66, timeUsed: 207 },
      { playerId: "ines", score: 59, timeUsed: 218 },
      { playerId: "pablo", score: 51, timeUsed: 231 },
    ],
    activities: [
      {
        id: "rocio-abrahamic",
        playerId: "rocio",
        text: "llegó a Tradiciones",
        meta: "Hace 18 min · 5 niveles",
        icon: "bolt",
      },
      {
        id: "ana-abrahamic",
        playerId: "ana",
        text: "conquistó la cima",
        meta: "Hace 31 min · 96 puntos",
        icon: "trophy",
      },
    ],
  },
};

export function isFlashPopPreviewChallenge(id: string): id is FlashPopChallengeId {
  return (FLASH_POP_PREVIEW_CHALLENGE_IDS as readonly string[]).includes(id);
}

function getSocialFixture(id: string): FlashPopSocialFixture {
  return socialFixtures[isFlashPopPreviewChallenge(id) ? id : FLASH_POP_CHALLENGE_ID];
}

function getPlayer(id: string) {
  return flashPopPlayers.find((player) => player.id === id)!;
}

export function getFlashPopAttemptStatus(
  record:
    | Pick<PyramidAttemptRecord, "status" | "summary">
    | Pick<PyramidAttemptRecord, "status">
    | null
    | undefined,
): FlashPopAttemptStatus {
  if (!record) return "available";
  if (record.status !== "completed") return "inProgress";
  return "summary" in record && record.summary?.outcome === "failed" ? "notCompleted" : "completed";
}

export function calculateSeasonXp(
  summary: Pick<PyramidAttemptSummary, "levelsCleared" | "timeUsed">,
  levelCount = FLASH_POP_LEVEL_COUNT,
  timeLimit = FLASH_POP_TOTAL_TIME_LIMIT,
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
  config: FlashPopScoringConfig = {},
): FlashPopResult {
  const fixture = getSocialFixture(summary.challengeId);
  const seasonXpCurrent = config.seasonXpCurrent ?? 680;
  const nextLevelAt = config.nextLevelAt ?? 900;
  const rows = [
    { player: getPlayer("javi"), score: summary.score, timeUsed: summary.timeUsed },
    ...fixture.peerRows.map(({ playerId, score, timeUsed }) => ({
      player: getPlayer(playerId),
      score,
      timeUsed,
    })),
  ].sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed);

  const ranked = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const current = ranked.find((row) => row.player.id === "javi")!;
  const earned = calculateSeasonXp(
    summary,
    config.levelCount ?? FLASH_POP_LEVEL_COUNT,
    config.totalTimeLimit ?? FLASH_POP_TOTAL_TIME_LIMIT,
  );

  return {
    score: summary.score,
    levelsCleared: summary.levelsCleared,
    playerRank: current.rank,
    totalPlayers: ranked.length,
    seasonXpEarned: earned,
    seasonXpCurrent: Math.min(nextLevelAt, seasonXpCurrent + earned),
    nextLevelAt,
    peers: ranked,
  };
}

export function getFlashPopLobbyChallenge(
  record:
    | (Pick<PyramidAttemptRecord, "status" | "summary"> & { currentLevelIndex?: number })
    | null
    | undefined,
  challengeId: FlashPopChallengeId = FLASH_POP_CHALLENGE_ID,
): FlashPopLobbyChallenge {
  const fixture = getSocialFixture(challengeId);
  const status = getFlashPopAttemptStatus(record);
  const result = record?.summary ? getFlashPopResult({ ...record.summary, challengeId }) : null;

  return {
    id: challengeId,
    title: fixture.title,
    subtitle: fixture.subtitle,
    status,
    currentLevelIndex: record?.currentLevelIndex,
    participants: flashPopPlayers.slice(1),
    playerScore: result?.score,
    playerRank: result?.playerRank,
    totalPlayers: result?.totalPlayers ?? flashPopPlayers.length,
    seasonXp: {
      current: result?.seasonXpCurrent ?? 680,
      nextLevelAt: result?.nextLevelAt ?? 900,
      maxEarnable: 120,
    },
    activities: fixture.activities,
  };
}
