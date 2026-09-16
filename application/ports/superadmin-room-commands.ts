import type { SuperadminRoomCreationResult } from "@/types/view-models";

export type SuperadminRoomMemberInput = {
  readonly email: string;
  readonly role: "admin" | "member" | "spectator";
};

export type CreateRoomInput = {
  readonly idempotencyKey: string;
  readonly title: string;
  readonly description: string;
  readonly timeZone: string;
  readonly ownerEmail: string;
  readonly initialMembers: readonly SuperadminRoomMemberInput[];
  readonly reason: string;
};

export interface SuperadminRoomCommands {
  createRoom(input: CreateRoomInput): Promise<SuperadminRoomCreationResult>;
}
