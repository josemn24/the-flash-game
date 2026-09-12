import type {
  PlayerId,
  RoomId,
  RoomInvitationId,
  RoomMembershipId,
} from "@/types/domain/identifiers";
import type { EntityTimestamps, UtcIsoDateTime } from "@/types/domain/values";

export type RoomStatus = "active" | "deleted";
export type RoomRole = "owner" | "admin" | "member" | "spectator";
export type CompetitiveRoomRole = Exclude<RoomRole, "spectator">;
export type MembershipStatus = "active" | "left" | "removed" | "banned";

export type Room = EntityTimestamps & {
  readonly id: RoomId;
  readonly title: string;
  readonly description: string;
  readonly timeZone: string;
  readonly status: RoomStatus;
  readonly deletedAt: UtcIsoDateTime | null;
};

export type RoomMembership = EntityTimestamps & {
  readonly id: RoomMembershipId;
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly role: RoomRole;
  readonly status: MembershipStatus;
  readonly joinedAt: UtcIsoDateTime;
  readonly endedAt: UtcIsoDateTime | null;
};

export type RoomInvitation = EntityTimestamps & {
  readonly id: RoomInvitationId;
  readonly roomId: RoomId;
  readonly createdByPlayerId: PlayerId;
  readonly role: Exclude<RoomRole, "owner">;
  readonly tokenHash: string;
  readonly expiresAt: UtcIsoDateTime;
  readonly revokedAt: UtcIsoDateTime | null;
  readonly maxUses: number | null;
  readonly useCount: number;
};
