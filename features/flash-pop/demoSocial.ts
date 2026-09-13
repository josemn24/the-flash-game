import type { AvatarTone } from "@/components/ui";
import type {
  PyramidAttemptRecord,
  PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";
import { FLASH_POINTS_MAX, normalizeFlashPoints } from "@/features/flash-pop/flashPoints";
import type { FlashPopSocialSnapshot } from "@/types/view-models";

export const FLASH_POP_FLASH_PILOT_ID = "tabarnia-flash-01";
export const FLASH_POP_CHALLENGE_ID = "tabarnia-challenge-05";
export const FLASH_POP_SECONDARY_CHALLENGE_ID = "tabarnia-challenge-06";
export const FLASH_POP_PREVIEW_CHALLENGE_IDS = [
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SECONDARY_CHALLENGE_ID,
] as const;
export const FLASH_POP_STORAGE_NAMESPACE = "flash-pop-pyramid-v2";

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
  playerFlashPoints?: number;
  playerRank?: number;
  totalPlayers: number;
  seasonFlashPoints: number;
  maxFlashPoints: number;
  activities: FlashPopActivity[];
};

export type FlashPopRankRow = {
  player: FlashPopPlayer;
  flashPoints: number;
  rank: number;
  timeUsed: number;
};

export type FlashPopResult = {
  socialSource: "demo";
  levelsCleared: number;
  playerRank: number;
  totalPlayers: number;
  flashPointsEarned: number;
  seasonFlashPoints: number;
  peers: FlashPopRankRow[];
};

export type FlashPopScoringConfig = {
  seasonFlashPoints?: number;
};

export function isFlashPopPreviewChallenge(id: string): id is FlashPopChallengeId {
  return (FLASH_POP_PREVIEW_CHALLENGE_IDS as readonly string[]).includes(id);
}

function activitiesFor(snapshot: FlashPopSocialSnapshot): FlashPopActivity[] {
  return [...snapshot.peers]
    .sort((left, right) => right.flashPoints - left.flashPoints || left.timeUsed - right.timeUsed)
    .slice(0, 2)
    .map((row, index) => ({
      id: `${row.player.id}:${row.completedAt}:activity`,
      playerId: row.player.id,
      text: index === 0 ? "lidera el desafío" : "terminó el desafío",
      meta: `${row.flashPoints} ⚡`,
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

export function getFlashPopResult(
  summary: PyramidAttemptSummary,
  socialSnapshot: FlashPopSocialSnapshot,
  config: FlashPopScoringConfig = {},
): FlashPopResult {
  const seasonFlashPoints = config.seasonFlashPoints ?? 680;
  const flashPointsEarned = normalizeFlashPoints(summary.score);
  const rows = [
    {
      player: socialSnapshot.currentPlayer,
      flashPoints: flashPointsEarned,
      timeUsed: summary.timeUsed,
    },
    ...socialSnapshot.peers.map(({ player, flashPoints, timeUsed }) => ({
      player,
      flashPoints: normalizeFlashPoints(flashPoints),
      timeUsed,
    })),
  ]
    .sort((left, right) => right.flashPoints - left.flashPoints || left.timeUsed - right.timeUsed)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const current = rows.find(({ player }) => player.id === socialSnapshot.currentPlayer.id)!;

  return {
    socialSource: "demo",
    levelsCleared: summary.levelsCleared,
    playerRank: current.rank,
    totalPlayers: rows.length,
    flashPointsEarned,
    seasonFlashPoints: seasonFlashPoints + flashPointsEarned,
    peers: rows,
  };
}

export function getFlashPopLobbyChallenge(
  record:
    | (Pick<PyramidAttemptRecord, "status" | "summary"> & { currentLevelIndex?: number })
    | null
    | undefined,
  challengeId: FlashPopChallengeId,
  socialSnapshot: FlashPopSocialSnapshot,
  content: { title: string; subtitle: string },
): FlashPopLobbyChallenge {
  const status = getFlashPopAttemptStatus(record);
  const result = record?.summary
    ? getFlashPopResult({ ...record.summary, challengeId }, socialSnapshot)
    : null;

  return {
    id: challengeId,
    title: content.title,
    subtitle: content.subtitle,
    status,
    currentLevelIndex: record?.currentLevelIndex,
    participants: socialSnapshot.players.filter(({ id }) => id !== socialSnapshot.currentPlayer.id),
    playerFlashPoints: result?.flashPointsEarned,
    playerRank: result?.playerRank,
    totalPlayers: result?.totalPlayers ?? socialSnapshot.players.length,
    seasonFlashPoints: result?.seasonFlashPoints ?? 680,
    maxFlashPoints: FLASH_POINTS_MAX,
    activities: activitiesFor(socialSnapshot),
  };
}
