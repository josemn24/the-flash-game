import "server-only";

import type { SuperadminPortalQueries, SuperadminRoomQueries } from "@/application/queries";
import type {
  SuperadminRoomCommands,
  CreateRoomInput,
} from "@/application/ports/superadmin-room-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminRoomCommandError,
} from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import { isValidTimeZone } from "@/lib/zonedDateTime";
import type {
  SuperadminPlayerCandidate,
  SuperadminPortalContext,
  SuperadminPortalRoom,
  SuperadminPortalSeason,
  SuperadminRoomDetailData,
  SuperadminRoomMember,
  SuperadminRoomCreationResult,
} from "@/types/view-models";

// The local fixtures deliberately derive stable UUID-shaped identifiers from
// hashes, so validate the wire shape without imposing RFC version bits.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPortalRoom(value: unknown): value is SuperadminPortalRoom {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.slug === "string" &&
    value.slug.trim().length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.timeZone === "string" &&
    value.timeZone.trim().length > 0 &&
    isValidTimeZone(value.timeZone) &&
    value.status === "active" &&
    Array.isArray(value.seasons) &&
    value.seasons.every(isPortalSeason)
  );
}

function isPortalSeason(value: unknown): value is SuperadminPortalSeason {
  if (!isRecord(value)) return false;
  return (
    typeof value.seasonId === "string" &&
    uuidPattern.test(value.seasonId) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    ["draft", "scheduled", "active", "finished", "cancelled"].includes(String(value.status)) &&
    typeof value.startsAt === "string" &&
    !Number.isNaN(Date.parse(value.startsAt)) &&
    typeof value.endsAt === "string" &&
    !Number.isNaN(Date.parse(value.endsAt)) &&
    new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime()
  );
}

function isPortalContext(value: unknown): value is SuperadminPortalContext {
  if (!isRecord(value) || !isRecord(value.operator) || !Array.isArray(value.rooms)) return false;
  return (
    typeof value.operator.playerId === "string" &&
    uuidPattern.test(value.operator.playerId) &&
    typeof value.operator.displayName === "string" &&
    value.operator.displayName.trim().length > 0 &&
    value.rooms.every(isPortalRoom)
  );
}

type SuperadminRoomMemberWire = Omit<SuperadminRoomMember, "avatarSrc"> & {
  readonly avatarPath: string | null;
};

function isRoomMember(value: unknown): value is SuperadminRoomMemberWire {
  if (!isRecord(value)) return false;
  return (
    typeof value.playerId === "string" &&
    uuidPattern.test(value.playerId) &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0 &&
    (value.email === null || typeof value.email === "string") &&
    (value.avatarPath === null || typeof value.avatarPath === "string") &&
    ["owner", "admin", "member", "spectator"].includes(String(value.role)) &&
    typeof value.joinedAt === "string" &&
    !Number.isNaN(Date.parse(value.joinedAt))
  );
}

type SuperadminRoomDetailWire = {
  readonly room: SuperadminPortalRoom;
  readonly members: readonly SuperadminRoomMemberWire[];
};

function isRoomDetailData(value: unknown): value is SuperadminRoomDetailWire {
  return (
    isRecord(value) &&
    isPortalRoom(value.room) &&
    Array.isArray(value.members) &&
    value.members.every(isRoomMember)
  );
}

type SuperadminPlayerCandidateRow = {
  readonly email: string;
  readonly player_id: string;
  readonly display_name: string;
};

function isPlayerCandidateRow(value: unknown): value is SuperadminPlayerCandidateRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.email === "string" &&
    value.email.trim().length > 0 &&
    typeof value.player_id === "string" &&
    uuidPattern.test(value.player_id) &&
    typeof value.display_name === "string" &&
    value.display_name.trim().length > 0
  );
}

function isRoomCreationResult(value: unknown): value is SuperadminRoomCreationResult {
  if (!isRecord(value) || !isRecord(value.owner)) return false;
  return (
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.slug === "string" &&
    value.slug.trim().length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.timeZone === "string" &&
    value.timeZone.trim().length > 0 &&
    typeof value.owner.playerId === "string" &&
    uuidPattern.test(value.owner.playerId) &&
    typeof value.owner.displayName === "string" &&
    value.owner.displayName.trim().length > 0 &&
    typeof value.memberCount === "number" &&
    Number.isSafeInteger(value.memberCount) &&
    value.memberCount >= 1
  );
}

function commandErrorCode(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  const candidates = [
    "not_authorized",
    "invalid_command",
    "invalid_room",
    "owner_not_found",
    "member_not_found",
    "duplicate_member",
    "owner_in_members",
    "invalid_member_role",
    "idempotency_conflict",
    "room_creation_failed",
  ];
  return (
    candidates.find((candidate) => message.includes(candidate)) ?? error.code ?? "command_failed"
  );
}

export class SupabaseSuperadminPortalQueries implements SuperadminPortalQueries {
  async getContext(): Promise<SuperadminPortalContext> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_portal_context");

    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase portal read failed: ${error.message}`);
    }
    if (!isPortalContext(data)) {
      throw new Error("Supabase portal read returned an invalid context payload.");
    }

    return { ...data, source: "supabase" };
  }

  async lookupPlayersByEmail(emails: readonly string[]): Promise<SuperadminPlayerCandidate[]> {
    const normalizedEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))].filter(
      Boolean,
    );
    if (normalizedEmails.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("lookup_superadmin_players", {
      target_emails: normalizedEmails,
    });

    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase player lookup failed: ${error.message}`);
    }
    if (!Array.isArray(data) || !data.every(isPlayerCandidateRow)) {
      throw new Error("Supabase player lookup returned an invalid payload.");
    }
    return data.map((candidate) => ({
      email: candidate.email,
      playerId: candidate.player_id,
      displayName: candidate.display_name,
    }));
  }
}

export const supabaseSuperadminPortalQueries = new SupabaseSuperadminPortalQueries();

export class SupabaseSuperadminRoomQueries implements SuperadminRoomQueries {
  async getDetail(roomId: string): Promise<SuperadminRoomDetailData | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_room_detail", {
      target_room_id: roomId,
    });

    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase room detail read failed: ${error.message}`);
    }
    if (data === null) return null;
    if (!isRoomDetailData(data)) {
      throw new Error("Supabase room detail read returned an invalid payload.");
    }
    return {
      room: data.room,
      members: data.members.map((member) => ({
        playerId: member.playerId,
        displayName: member.displayName,
        email: member.email,
        avatarSrc: resolveAvatarPath(member.avatarPath),
        role: member.role,
        joinedAt: member.joinedAt,
      })),
      source: "supabase",
    };
  }
}

export const supabaseSuperadminRoomQueries = new SupabaseSuperadminRoomQueries();

export class SupabaseSuperadminRoomCommands implements SuperadminRoomCommands {
  async createRoom(input: CreateRoomInput): Promise<SuperadminRoomCreationResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_superadmin_room", { input });

    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new SuperadminRoomCommandError(commandErrorCode(error), error);
    }
    if (!isRoomCreationResult(data)) {
      throw new SuperadminRoomCommandError("invalid_response");
    }
    return { ...data, source: "supabase" };
  }
}

export const supabaseSuperadminRoomCommands = new SupabaseSuperadminRoomCommands();

export function isSuperadminPortalContext(value: unknown): value is SuperadminPortalContext {
  return isPortalContext(value);
}

export function isSuperadminRoomCreationResult(
  value: unknown,
): value is SuperadminRoomCreationResult {
  return isRoomCreationResult(value);
}
