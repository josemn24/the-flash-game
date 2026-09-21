import type { RoomMembershipRole } from "@/types/view-models";

export type RoomMemberManagementAction = "grant_admin" | "revoke_admin" | "remove";

export type ManageRoomMemberInput = {
  readonly idempotencyKey: string;
  readonly roomKey: string;
  readonly targetMemberKey: string;
  readonly action: RoomMemberManagementAction;
};

export type ManageRoomMemberResult = {
  readonly roomKey: string;
  readonly targetMemberKey: string;
  readonly action: RoomMemberManagementAction;
  readonly role: RoomMembershipRole;
  readonly status: "active" | "removed";
};

export interface RoomMembershipCommands {
  manageMember(input: ManageRoomMemberInput): Promise<ManageRoomMemberResult>;
}
