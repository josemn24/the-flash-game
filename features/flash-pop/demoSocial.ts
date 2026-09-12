import type { AvatarTone } from "@/components/ui";
import {
  canonicalCurrentPlayer,
  canonicalSocialPlayers,
  getCanonicalChallengeTitle,
  getCanonicalSocialRows,
} from "@/features/flash-pop/canonicalSocial";
import type {
  PyramidAttemptRecord,
  PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";

export const FLASH_POP_FLASH_PILOT_ID = "tabarnia-flash-01";
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
  tone: AvatarTone;
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
  seasonXp: { current: number; nextLevelAt: number; maxEarnable: number };
  activities: FlashPopActivity[];
};

export type FlashPopRankRow = {
  player: FlashPopPlayer;
  score: number;
  rank: number;
  timeUsed: number;
};

export type FlashPopResult = {
  socialSource: "demo";
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

/** Configuración de avatar puramente presentacional proyectada sobre los jugadores canónicos. */
export const flashPopPlayers: FlashPopPlayer[] = canonicalSocialPlayers.map((player) => ({
  ...player,
}));

export function isFlashPopPreviewChallenge(id: string): id is FlashPopChallengeId {
  return (FLASH_POP_PREVIEW_CHALLENGE_IDS as readonly string[]).includes(id);
}

function activitiesFor(challengeId: string): FlashPopActivity[] {
  return getCanonicalSocialRows(challengeId)
    .sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed)
    .slice(0, 2)
    .map((row, index) => ({
      id: `${row.attempt.id}:activity`,
      playerId: row.player.id,
      text: index === 0 ? "lidera el desafío" : "terminó el desafío",
      meta: `${row.score} puntos`,
      icon: index === 0 ? "trophy" : "bolt",
    }));
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
  const seasonXpCurrent = config.seasonXpCurrent ?? 680;
  const nextLevelAt = config.nextLevelAt ?? 900;
  const rows = [
    { player: canonicalCurrentPlayer, score: summary.score, timeUsed: summary.timeUsed },
    ...getCanonicalSocialRows(summary.challengeId).map(({ player, score, timeUsed }) => ({
      player,
      score,
      timeUsed,
    })),
  ]
    .sort((left, right) => right.score - left.score || left.timeUsed - right.timeUsed)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const current = rows.find(({ player }) => player.id === canonicalCurrentPlayer.id)!;
  const earned = calculateSeasonXp(
    summary,
    config.levelCount ?? FLASH_POP_LEVEL_COUNT,
    config.totalTimeLimit ?? FLASH_POP_TOTAL_TIME_LIMIT,
  );

  return {
    socialSource: "demo",
    score: summary.score,
    levelsCleared: summary.levelsCleared,
    playerRank: current.rank,
    totalPlayers: rows.length,
    seasonXpEarned: earned,
    seasonXpCurrent: Math.min(nextLevelAt, seasonXpCurrent + earned),
    nextLevelAt,
    peers: rows,
  };
}

export function getFlashPopLobbyChallenge(
  record:
    | (Pick<PyramidAttemptRecord, "status" | "summary"> & { currentLevelIndex?: number })
    | null
    | undefined,
  challengeId: FlashPopChallengeId = FLASH_POP_CHALLENGE_ID,
): FlashPopLobbyChallenge {
  const { title, subtitle } = getCanonicalChallengeTitle(challengeId);
  const status = getFlashPopAttemptStatus(record);
  const result = record?.summary ? getFlashPopResult({ ...record.summary, challengeId }) : null;

  return {
    id: challengeId,
    title,
    subtitle,
    status,
    currentLevelIndex: record?.currentLevelIndex,
    participants: flashPopPlayers.filter(({ id }) => id !== canonicalCurrentPlayer.id),
    playerScore: result?.score,
    playerRank: result?.playerRank,
    totalPlayers: result?.totalPlayers ?? flashPopPlayers.length,
    seasonXp: {
      current: result?.seasonXpCurrent ?? 680,
      nextLevelAt: result?.nextLevelAt ?? 900,
      maxEarnable: 120,
    },
    activities: activitiesFor(challengeId),
  };
}
