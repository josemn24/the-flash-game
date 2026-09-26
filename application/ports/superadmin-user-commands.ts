import type { SuperadminPlayerCandidate } from "@/types/view-models";

export type CreateSuperadminPlayerInput = {
  readonly idempotencyKey: string;
  readonly authUserId: string;
  readonly displayName: string;
  readonly reason: string;
};

export type AddSuperadminRoomMemberInput = {
  readonly idempotencyKey: string;
  readonly roomId: string;
  readonly targetPlayerId: string;
  readonly role: "admin" | "member" | "spectator";
  readonly reason: string;
};

export type SuperadminUserCommandResult = {
  readonly playerId: string;
  readonly displayName: string;
};

export type SuperadminRoomMemberCommandResult = {
  readonly roomId: string;
  readonly playerId: string;
  readonly role: "admin" | "member" | "spectator";
  readonly status: "active";
  readonly reactivated: boolean;
};

export interface SuperadminUserCommands {
  createPlayer(input: CreateSuperadminPlayerInput): Promise<SuperadminUserCommandResult>;
  addRoomMember(input: AddSuperadminRoomMemberInput): Promise<SuperadminRoomMemberCommandResult>;
  lookupPlayers(emails: readonly string[]): Promise<SuperadminPlayerCandidate[]>;
}
