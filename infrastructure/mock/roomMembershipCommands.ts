import type {
  ManageRoomMemberInput,
  ManageRoomMemberResult,
  RoomMembershipCommands,
} from "@/application/ports/room-membership-commands";
import type { MockDomainStore } from "@/data/mock/store";
import { resolvePlayerRouteKey, resolveRoomRouteKey } from "@/data/mock/selectors";
import type { MockCurrentViewerProvider } from "@/infrastructure/mock/currentViewer";
import type { RoomMembershipRole } from "@/types/view-models";

type MembershipOverride = {
  role: RoomMembershipRole;
  status: "active" | "removed";
};

const overrides = new Map<string, MembershipOverride>();
const commandResults = new Map<string, { input: string; result: ManageRoomMemberResult }>();

function overrideKey(roomId: string, playerId: string) {
  return `${roomId}:${playerId}`;
}

export function getMockMembershipOverride(roomId: string, playerId: string) {
  return overrides.get(overrideKey(roomId, playerId));
}

export function resetMockMembershipOverrides() {
  overrides.clear();
  commandResults.clear();
}

export class MockRoomMembershipCommands implements RoomMembershipCommands {
  constructor(
    private readonly store: MockDomainStore,
    private readonly viewerProvider: MockCurrentViewerProvider,
  ) {}

  async manageMember(input: ManageRoomMemberInput): Promise<ManageRoomMemberResult> {
    const roomId = resolveRoomRouteKey(input.roomKey);
    const targetPlayerId = resolvePlayerRouteKey(input.targetMemberKey);
    const viewer = await this.viewerProvider.getCurrentViewer();
    if (!roomId || !targetPlayerId) throw new Error("member_not_found");

    const requestKey = `${viewer.playerId}:${input.idempotencyKey}`;
    const serializedInput = JSON.stringify(input);
    const cached = commandResults.get(requestKey);
    if (cached) {
      if (cached.input !== serializedInput) throw new Error("idempotency_conflict");
      return cached.result;
    }

    const actor = this.store.roomMemberships.find(
      (membership) => membership.roomId === roomId && membership.playerId === viewer.playerId,
    );
    const target = this.store.roomMemberships.find(
      (membership) => membership.roomId === roomId && membership.playerId === targetPlayerId,
    );
    const current = getMockMembershipOverride(roomId, targetPlayerId) ?? {
      role: target?.role ?? "member",
      status: target?.status === "active" ? "active" : "removed",
    };

    if (!actor || actor.role !== "owner" || !target || target.playerId === viewer.playerId) {
      throw new Error("not_authorized");
    }
    if (current.role === "owner") throw new Error("member_is_owner");
    if (current.status !== "active") throw new Error("member_not_found");
    if (input.action === "grant_admin") {
      if (current.role === "spectator") throw new Error("invalid_member_role");
      current.role = "admin";
    } else if (input.action === "revoke_admin") {
      if (current.role === "spectator") throw new Error("invalid_member_role");
      current.role = "member";
    } else {
      current.status = "removed";
    }

    overrides.set(overrideKey(roomId, targetPlayerId), current);
    const result = {
      roomKey: input.roomKey,
      targetMemberKey: input.targetMemberKey,
      action: input.action,
      role: current.role,
      status: current.status,
    };
    commandResults.set(requestKey, { input: serializedInput, result });
    return result;
  }
}
