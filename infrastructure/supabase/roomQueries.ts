import "server-only";

import type { RoomLobbyQueries } from "@/application/queries";
import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
} from "@/application/presentation/room";
import { createClient } from "@/lib/supabase/server";
import type { GameMode } from "@/types/gameplay/challenge";
import type {
  RoomCardModel,
  RoomDetailModel,
  RoomIntroductionModel,
  RoomMembershipRole,
} from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";

type RoomReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  room_description: string | null;
  membership_role: RoomMembershipRole;
  season_title: string | null;
  season_status: "draft" | "scheduled" | "active" | "finished" | "cancelled" | null;
  season_starts_at: string | null;
  season_ends_at: string | null;
  publication_id: string | null;
  publication_status: "scheduled" | "open" | "closed" | "cancelled" | null;
  opens_at: string | null;
  closes_at: string | null;
  challenge_title: string | null;
  challenge_subtitle: string | null;
  challenge_mode: GameMode | null;
  challenge_max_score: number | null;
  question_count: number | null;
  competitive_playable: boolean;
  current_flash_points: number;
  current_position: number | null;
  member_previews: unknown;
  member_count: number;
};

type RoomIntroductionReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  membership_role: RoomMembershipRole;
  publication_id: string;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  opens_at: string;
  closes_at: string;
  challenge_title: string;
  challenge_subtitle: string | null;
  challenge_mode: GameMode;
  challenge_max_score: number;
  question_count: number;
  competitive_playable: boolean;
};

const roomRoles = new Set<RoomMembershipRole>(["owner", "admin", "member", "spectator"]);
const gameModes = new Set<GameMode>(["flash", "alphabet", "survival", "narrative", "pyramid"]);

function isRoomReadRow(value: unknown): value is RoomReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    (row.room_description === null || typeof row.room_description === "string") &&
    typeof row.membership_role === "string" &&
    roomRoles.has(row.membership_role as RoomMembershipRole) &&
    (row.season_title === null || typeof row.season_title === "string") &&
    (row.season_status === null || typeof row.season_status === "string") &&
    (row.season_starts_at === null || typeof row.season_starts_at === "string") &&
    (row.season_ends_at === null || typeof row.season_ends_at === "string") &&
    (row.publication_id === null || typeof row.publication_id === "string") &&
    (row.publication_status === null || typeof row.publication_status === "string") &&
    (row.opens_at === null || typeof row.opens_at === "string") &&
    (row.closes_at === null || typeof row.closes_at === "string") &&
    (row.challenge_title === null || typeof row.challenge_title === "string") &&
    (row.challenge_subtitle === null || typeof row.challenge_subtitle === "string") &&
    (row.challenge_mode === null || gameModes.has(row.challenge_mode as GameMode)) &&
    (row.challenge_max_score === null || typeof row.challenge_max_score === "number") &&
    (row.question_count === null || typeof row.question_count === "number") &&
    typeof row.competitive_playable === "boolean" &&
    typeof row.current_flash_points === "number" &&
    (row.current_position === null || typeof row.current_position === "number") &&
    Array.isArray(row.member_previews) &&
    typeof row.member_count === "number"
  );
}

function isRoomIntroductionReadRow(value: unknown): value is RoomIntroductionReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    typeof row.membership_role === "string" &&
    roomRoles.has(row.membership_role as RoomMembershipRole) &&
    typeof row.publication_id === "string" &&
    typeof row.publication_status === "string" &&
    typeof row.opens_at === "string" &&
    typeof row.closes_at === "string" &&
    typeof row.challenge_title === "string" &&
    (row.challenge_subtitle === null || typeof row.challenge_subtitle === "string") &&
    typeof row.challenge_mode === "string" &&
    gameModes.has(row.challenge_mode as GameMode) &&
    typeof row.challenge_max_score === "number" &&
    typeof row.question_count === "number" &&
    typeof row.competitive_playable === "boolean"
  );
}

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : displayName.slice(0, 2))
    .toUpperCase()
    .slice(0, 2);
}

function asMode(value: GameMode | null): GameMode | null {
  return value && gameModes.has(value) ? value : null;
}

function asMemberPreviews(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      (typeof row.avatarPath !== "string" && row.avatarPath !== null)
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        name: row.name,
        initials: initials(row.name),
        src: row.avatarPath ?? undefined,
      },
    ];
  });
}

function toLegacySeasonStatus(
  status: RoomReadRow["season_status"],
): RoomDetailModel["seasonStatus"] {
  if (status === "active" || status === "finished") return status;
  return status ? "finished" : null;
}

function toChallengeSummary(row: RoomReadRow, href: string) {
  const mode = asMode(row.challenge_mode);
  if (
    !row.publication_id ||
    !row.closes_at ||
    !row.challenge_title ||
    row.challenge_subtitle === null ||
    !mode ||
    row.challenge_max_score === null ||
    row.question_count === null
  ) {
    return null;
  }

  return {
    id: row.publication_id,
    title: getChallengeDisplayTitle(row.challenge_title, mode),
    formatLabel: getChallengeFormatLabel(mode),
    subtitle: row.challenge_subtitle,
    availableUntil: row.closes_at,
    questionCount: row.question_count,
    competitivePlayable: row.competitive_playable,
    imageSrc: getChallengeImage(mode),
    href,
  };
}

function toCard(row: RoomReadRow): RoomCardModel {
  return {
    roomId: row.room_slug,
    title: row.room_title,
    seasonTitle: row.season_title,
    seasonStatus: toLegacySeasonStatus(row.season_status),
    dailyChallenge: toChallengeSummary(
      row,
      `/salas/${row.room_slug}/introduccion/${row.publication_id ?? ""}`,
    ),
    currentUser: {
      totalFlashPoints: row.current_flash_points,
      roomRank: row.current_position,
      role: row.membership_role,
    },
    memberPreviews: asMemberPreviews(row.member_previews),
    memberCount: row.member_count,
    href: `/salas/${row.room_slug}`,
    source: "supabase",
  };
}

function toDetail(row: RoomReadRow, viewer: { id: string; name: string; avatarSrc?: string }) {
  const dailyChallenge = toChallengeSummary(
    row,
    `/salas/${row.room_slug}/introduccion/${row.publication_id ?? ""}`,
  );

  const detail: RoomDetailModel = {
    roomId: row.room_slug,
    title: row.room_title,
    seasonTitle: row.season_title,
    seasonStatus: toLegacySeasonStatus(row.season_status),
    currentUser: {
      id: viewer.id,
      name: viewer.name,
      initials: initials(viewer.name),
      avatarSrc: viewer.avatarSrc,
      totalFlashPoints: row.current_flash_points,
      roomRank: row.current_position,
      dailyFlashPoints: 0,
      dailyCompleted: false,
      dailyAttemptStatus: "available",
      role: row.membership_role,
    },
    dailyChallenge: dailyChallenge
      ? {
          ...dailyChallenge,
          endsAt: dailyChallenge.availableUntil,
        }
      : null,
    roomLeaderboard: [],
    dailyLeaderboard: [],
    source: "supabase",
  };
  return detail;
}

function toIntroduction(row: RoomIntroductionReadRow): RoomIntroductionModel {
  const mode = row.challenge_mode;
  return {
    roomId: row.room_slug,
    roomTitle: row.room_title,
    role: row.membership_role,
    publicationId: row.publication_id,
    publicationStatus: row.publication_status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    challengeTitle: getChallengeDisplayTitle(row.challenge_title, mode),
    challengeSubtitle: row.challenge_subtitle,
    mode,
    maxScore: row.challenge_max_score,
    questionCount: row.question_count,
    canStart: row.membership_role !== "spectator",
    competitivePlayable: row.competitive_playable,
    source: "supabase",
  };
}

async function callRoomRead(
  functionName: "get_my_room_cards" | "get_room_detail" | "get_room_introduction",
  args: Record<string, string> = {},
  guard: (value: unknown) => boolean = isRoomReadRow,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase room read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.filter(guard);
}

export class SupabaseRoomQueries implements RoomLobbyQueries {
  async listCards() {
    return (await callRoomRead("get_my_room_cards")).map(toCard);
  }

  async getDetail(roomKey: string) {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    return row ? toDetail(row, viewer) : null;
  }

  async getIntroduction(roomKey: string, challengeKey: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
    const rows = await callRoomRead(
      "get_room_introduction",
      {
        target_room_slug: roomKey,
        target_publication_id: challengeKey,
      },
      isRoomIntroductionReadRow,
    );
    return rows[0] ? toIntroduction(rows[0]) : null;
  }
}

export const supabaseRoomQueries = new SupabaseRoomQueries();
